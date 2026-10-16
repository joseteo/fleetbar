import GLib from 'gi://GLib';
import System from 'system';
import {Checker} from '../lib/checker.js';

const port = Number(GLib.getenv('TEST_PORT'));
const directory = GLib.getenv('TEST_STATE_DIR');
const base = `http://127.0.0.1:${port}`;
const projects = [{id: 'p', services: [
    {id: 'api', type: 'http', url: `${base}/ok`, expect: {status: 'ok'}},
    {id: 'db', type: 'http', url: `${base}/ok`, expect: {db: true}},
    {id: 'degraded', type: 'http', url: `${base}/degraded`, expect: {status: 'ok'}},
    {id: 'failed', type: 'http', url: `${base}/failed`, expect: {}},
    {id: 'redirect', type: 'http', url: `${base}/redirect`, expect: {}},
    {id: 'slow', type: 'http', url: `${base}/slow`, expect: {}},
    {id: 'large', type: 'http', url: `${base}/large`, expect: {}},
    {id: 'tcp', type: 'tcp', host: '127.0.0.1', port},
    {id: 'worker', type: 'monitor', path: `${directory}/fresh.json`, probe: 'worker'},
    {id: 'missing', type: 'monitor', path: `${directory}/absent.json`, probe: 'worker'},
    {id: 'stale', type: 'monitor', path: `${directory}/stale.json`, probe: 'worker'},
    {id: 'probe', type: 'monitor', path: `${directory}/fresh.json`, probe: 'absent'},
]}];
const checker = new Checker(2);
const loop = new GLib.MainLoop(null, false);
function assert(value, message) {
    if (!value)
        throw new Error(message);
}
async function run() {
    const first = await checker.check(projects);
    assert(first.get('p/degraded').state === 'unknown', 'first failure is unconfirmed');
    const results = await checker.check(projects);
    for (const name of ['api', 'db', 'tcp', 'worker'])
        assert(results.get(`p/${name}`).state === 'up', `${name} should be up`);
    for (const name of ['degraded', 'failed', 'redirect', 'slow', 'large'])
        assert(results.get(`p/${name}`).state === 'down', `${name} should be down`);
    for (const name of ['missing', 'stale', 'probe'])
        assert(results.get(`p/${name}`).state === 'unknown', `${name} should be unknown`);
    const pending = checker.check([{id: 'p', services: [{id: 'cancel', type: 'http', url: `${base}/slow`, expect: {}}]}]);
    checker.cancel();
    assert(await pending === null, 'cancelled request must not replace current results');
    checker.destroy();
    print('GJS integration checks passed');
}
let failed = false;
run().catch(error => { failed = true; printerr(error.stack); }).finally(() => {checker.destroy(); loop.quit();});
loop.run();
if (failed)
    System.exit(1);
