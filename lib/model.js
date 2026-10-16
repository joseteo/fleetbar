// SPDX-License-Identifier: GPL-2.0-or-later
// Pure data rules, shared with preferences and the test suite.
export const MAX_PROJECTS = 40;
export const MAX_SERVICES = 30;

const text = (value, fallback = '') => typeof value === 'string' ? value.trim() : fallback;

export function validHttpUrl(value) {
    // GJS does not provide the browser URL class. Reject embedded credentials.
    return typeof value === 'string' && /^https?:\/\/[^\s/@?#]+(?::\d+)?(?:[/?#][^\s]*)?$/i.test(value);
}

export function validateProjects(input) {
    if (!Array.isArray(input) || input.length > MAX_PROJECTS)
        throw new Error('projects');
    const ids = new Set();
    return input.map(project => {
        if (!project || typeof project !== 'object')
            throw new Error('project');
        const id = text(project.id);
        const name = text(project.name);
        const group = text(project.group);
        if (!id || ids.has(id) || !name || !group)
            throw new Error('identity');
        ids.add(id);
        if (!Array.isArray(project.services) || !project.services.length || project.services.length > MAX_SERVICES)
            throw new Error('services');
        const serviceIds = new Set();
        const services = project.services.map(service => {
            const sid = text(service?.id);
            const label = text(service?.name);
            if (!sid || serviceIds.has(sid) || !label)
                throw new Error('service');
            serviceIds.add(sid);
            const type = service.type ?? 'http';
            const result = {id: sid, name: label, type};
            if (type === 'http') {
                if (!validHttpUrl(service.url))
                    throw new Error('url');
                result.url = service.url;
                result.expect = service.expect ?? {};
                if (!result.expect || Array.isArray(result.expect) || typeof result.expect !== 'object' ||
                    Object.entries(result.expect).some(([key, value]) => !key ||
                        (value !== null && !['string', 'number', 'boolean'].includes(typeof value))))
                    throw new Error('expect');
            } else if (type === 'tcp') {
                result.host = text(service.host);
                result.port = service.port;
                if (!/^[a-zA-Z0-9.:-]+$/.test(result.host) || !Number.isInteger(result.port) || result.port < 1 || result.port > 65535)
                    throw new Error('host');
            } else if (type === 'monitor') {
                result.path = text(service.path);
                result.probe = text(service.probe);
                if (!result.path.startsWith('/') || !result.probe)
                    throw new Error('monitor');
            } else {
                throw new Error('type');
            }
            return result;
        });
        const webUrl = text(project.webUrl);
        const projectPath = text(project.projectPath);
        const sshTarget = text(project.sshTarget);
        const sshKey = text(project.sshKey);
        const panelLabel = text(project.panelLabel);
        if (webUrl && !validHttpUrl(webUrl))
            throw new Error('website');
        if (projectPath && !projectPath.startsWith('/'))
            throw new Error('path');
        // SSH opens interactively, with argv only; never interpret shell input.
        if (sshTarget && (!/^[a-zA-Z0-9][a-zA-Z0-9_.@:-]*$/.test(sshTarget) || sshTarget.includes('..')))
            throw new Error('ssh');
        if (sshKey && !sshKey.startsWith('/'))
            throw new Error('key');
        return {id, name, panelLabel, group, instance: text(project.instance), webUrl, projectPath, sshTarget, sshKey, services};
    });
}

export function valueAt(body, path) {
    return path.split('.').reduce((current, key) => current !== null && typeof current === 'object' &&
        Object.hasOwn(current, key) ? current[key] : undefined, body);
}

export function matchesHealth(body, expected) {
    return Object.entries(expected).every(([key, value]) => valueAt(body, key) === value);
}

export function formatHealthValue(value) {
    return typeof value === 'string' ? JSON.stringify(value) : String(value);
}

export function parseHealthValue(value) {
    const text = value.trim();
    try {
        const scalar = JSON.parse(text);
        if (scalar === null || ['string', 'number', 'boolean'].includes(typeof scalar))
            return scalar;
    } catch { /* Unquoted words remain string values. */ }
    return text;
}

export function aggregate(states) {
    if (!states.length || states.every(state => state === 'unknown'))
        return 'unknown';
    if (states.every(state => state === 'up'))
        return 'up';
    if (states.every(state => state === 'down'))
        return 'down';
    return states.includes('down') ? 'degraded' : 'unknown';
}

export function effectiveState(result, now, staleAfter) {
    return !result || now < result.checkedAt || now - result.checkedAt > staleAfter ? 'unknown' : result.state;
}

export function panelPresentation(project, states) {
    const state = aggregate(states);
    const name = project.panelLabel || project.name;
    const online = states.filter(value => value === 'up').length;
    const suffix = state === 'up' ? '' : state === 'unknown' ? ' ?' : ` ${online}/${states.length}`;
    return {state, online, total: states.length, label: name + suffix};
}

export function transition(previous, observed) {
    const failures = observed.state === 'down' ? (previous?.failures ?? 0) + 1 : 0;
    const confirmed = observed.state === 'down' && failures < 2 ? 'unknown' : observed.state;
    // Keep the last confirmed state through the first failed observation.
    const lastConfirmed = confirmed === 'unknown' ? previous?.lastConfirmed : confirmed;
    let event = null;
    if (confirmed === 'down' && previous?.lastConfirmed === 'up')
        event = 'down';
    else if (confirmed === 'up' && previous?.lastConfirmed === 'down')
        event = 'up';
    return {...observed, state: confirmed, failures, lastConfirmed, event};
}
