// SPDX-License-Identifier: GPL-2.0-or-later
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Soup from 'gi://Soup?version=3.0';
import {matchesHealth, transition} from './model.js';

export class Checker {
    constructor(timeout) {
        this._timeout = timeout;
        this._session = new Soup.Session({timeout, user_agent: 'Fleetbar/1.1', max_conns: 8, max_conns_per_host: 4});
        this._active = new Map();
        this._generation = 0;
        this.results = new Map();
    }

    cancel() {
        this._generation++;
        for (const [cancellable, request] of this._active) {
            if (request.sourceId)
                GLib.Source.remove(request.sourceId);
            request.sourceId = 0;
            cancellable.cancel();
        }
        this._active.clear();
    }

    destroy() {
        this.cancel();
        this._session?.abort();
        this._session = null;
        this.results.clear();
    }

    async _bounded(operation) {
        const cancellable = new Gio.Cancellable();
        const request = {sourceId: 0};
        this._active.set(cancellable, request);
        request.sourceId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, this._timeout, () => {
            request.sourceId = 0;
            cancellable.cancel();
            return GLib.SOURCE_REMOVE;
        });
        try {
            return await operation(cancellable);
        } finally {
            if (request.sourceId)
                GLib.Source.remove(request.sourceId);
            request.sourceId = 0;
            this._active.delete(cancellable);
        }
    }

    async _http(url) {
        return this._bounded(cancellable => new Promise((resolve, reject) => {
            const message = Soup.Message.new('GET', url);
            if (!message) {
                reject(new Error('url'));
                return;
            }
            message.request_headers.append('Cache-Control', 'no-cache');
            // A redirect to a login page is not an application health response.
            message.set_flags(Soup.MessageFlags.NO_REDIRECT);
            this._session.send_async(message, GLib.PRIORITY_DEFAULT, cancellable, async (session, response) => {
                let stream = null;
                try {
                    stream = session.send_finish(response);
                    const status = message.status_code;
                    const limit = 262144;
                    if (message.response_headers.get_content_length() > limit)
                        throw new Error('Health response exceeds limit');
                    const chunks = [];
                    let length = 0;
                    while (true) {
                        const bytes = await new Promise((done, fail) => {
                            stream.read_bytes_async(8192, GLib.PRIORITY_DEFAULT, cancellable, (source, result) => {
                                try { done(source.read_bytes_finish(result)); } catch (error) { fail(error); }
                            });
                        });
                        if (!bytes.get_size())
                            break;
                        length += bytes.get_size();
                        if (length > limit)
                            throw new Error('Health response exceeds limit');
                        chunks.push(bytes.get_data());
                    }
                    let body = null;
                    const data = new Uint8Array(length);
                    let offset = 0;
                    for (const chunk of chunks) {
                        data.set(chunk, offset);
                        offset += chunk.length;
                    }
                    try { body = JSON.parse(new TextDecoder().decode(data)); } catch { /* HTTP-only service */ }
                    resolve({status, body});
                } catch (error) { reject(error); } finally {
                    try { stream?.close(null); } catch { /* Cancelled stream */ }
                }
            });
        }));
    }

    async _tcp(service) {
        await this._bounded(cancellable => new Promise((resolve, reject) => {
            const client = new Gio.SocketClient({timeout: this._timeout, enable_proxy: false});
            client.connect_to_host_async(service.host, service.port, cancellable, (source, response) => {
                try {
                    const connection = source.connect_to_host_finish(response);
                    connection.close(null);
                    resolve();
                } catch (error) { reject(error); }
            });
        }));
        return {state: 'up', reason: 'tcp'};
    }

    async _monitor(path) {
        return this._bounded(async cancellable => {
            const file = Gio.File.new_for_path(path);
            const info = await new Promise((resolve, reject) => {
                file.query_info_async('time::modified,standard::size', Gio.FileQueryInfoFlags.NONE,
                    GLib.PRIORITY_DEFAULT, cancellable, (source, response) => {
                        try { resolve(source.query_info_finish(response)); } catch (error) { reject(error); }
                    });
            });
            if (info.get_size() > 262144)
                throw new Error('Monitor state exceeds limit');
            const bytes = await new Promise((resolve, reject) => {
                file.load_contents_async(cancellable, (source, response) => {
                    try {
                        const [, contents] = source.load_contents_finish(response);
                        resolve(contents);
                    } catch (error) { reject(error); }
                });
            });
            const modified = info.get_attribute_uint64('time::modified') * 1000;
            return {modified, body: JSON.parse(new TextDecoder().decode(bytes))};
        });
    }

    async check(projects) {
        this.cancel();
        const generation = this._generation;
        const cache = new Map();
        const once = (key, operation) => {
            if (!cache.has(key))
                cache.set(key, operation());
            return cache.get(key);
        };
        const tasks = projects.flatMap(project => project.services.map(service => ({project, service})));
        const run = async ({project, service}) => {
            const started = GLib.get_monotonic_time();
            let observed;
            try {
                if (service.type === 'http') {
                    const response = await once(`http:${service.url}`, () => this._http(service.url));
                    const success = response.status >= 200 && response.status < 300 && matchesHealth(response.body, service.expect);
                    observed = {state: success ? 'up' : 'down', reason: success ? 'http' :
                        response.status >= 200 && response.status < 300 ? 'health' : 'http-error', code: response.status};
                } else if (service.type === 'tcp') {
                    observed = await once(`tcp:${service.host}:${service.port}`, () => this._tcp(service));
                } else {
                    const response = await once(`monitor:${service.path}`, () => this._monitor(service.path));
                    const record = response.body.services?.[service.probe];
                    if (Date.now() - response.modified > 120000 || response.modified > Date.now() + 5000)
                        observed = {state: 'unknown', reason: 'stale'};
                    else if (!record || !['up', 'down'].includes(record.status))
                        observed = {state: 'unknown', reason: 'unavailable'};
                    else if (record.status === 'up' && record.failures > 0)
                        observed = {state: 'unknown', reason: 'retry'};
                    else
                        observed = {state: record.status, reason: 'monitor'};
                }
            } catch (error) {
                observed = {state: service.type === 'monitor' ? 'unknown' : 'down',
                    reason: service.type === 'monitor' ? 'unavailable' :
                        error.matches?.(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED) ? 'timeout' : 'connection'};
            }
            const key = `${project.id}/${service.id}`;
            const result = transition(this.results.get(key), {...observed,
                latency: Math.round((GLib.get_monotonic_time() - started) / 1000), checkedAt: Date.now()});
            return [key, result];
        };
        const entries = new Array(tasks.length);
        let next = 0;
        const worker = async () => {
            while (next < tasks.length && generation === this._generation && this._session) {
                const index = next++;
                entries[index] = await run(tasks[index]);
            }
        };
        await Promise.all(Array.from({length: Math.min(8, tasks.length)}, worker));
        if (!this._session || generation !== this._generation)
            return null;
        this.results = new Map(entries);
        return this.results;
    }
}
