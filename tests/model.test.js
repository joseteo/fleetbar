import assert from 'node:assert/strict';
import test from 'node:test';
import {validateProjects, matchesHealth, aggregate, transition, effectiveState, validHttpUrl, panelPresentation,
    formatHealthValue, parseHealthValue} from '../lib/model.js';

const fixture = () => [{id: 'p', name: 'Project', group: 'Provider', services: [
    {id: 'api', name: 'API', type: 'http', url: 'https://example.com/health', expect: {status: 'ok'}},
]}];

test('top bar distinguishes partial failure, offline and unknown without relying on color', () => {
    const project = {name: 'My production API', panelLabel: 'API'};
    assert.deepEqual(panelPresentation(project, ['up', 'up']), {state: 'up', online: 2, total: 2, label: 'API'});
    assert.equal(panelPresentation(project, ['up', 'down']).label, 'API 1/2');
    assert.equal(panelPresentation(project, ['down', 'down']).label, 'API 0/2');
    assert.equal(panelPresentation(project, ['up', 'unknown']).label, 'API ?');
    assert.equal(panelPresentation({name: 'Website'}, ['up']).label, 'Website');
});

test('editing health values preserves string, numeric, boolean and null response types', () => {
    for (const value of ['true', '123', 'null', '', 'ok', 'false', true, false, 123, 1.5, null])
        assert.equal(parseHealthValue(formatHealthValue(value)), value);
    assert.equal(parseHealthValue('ok'), 'ok');
});

test('health checks use the actual response body and strict scalar values', () => {
    assert.equal(matchesHealth({status: 'ok', db: true}, {status: 'ok', db: true}), true);
    assert.equal(matchesHealth({status: 'degraded'}, {status: 'ok'}), false);
    assert.equal(matchesHealth({db: 'true'}, {db: true}), false);
    assert.equal(matchesHealth({components: {database: {status: 'up'}}}, {'components.database.status': 'up'}), true);
    assert.equal(matchesHealth(null, {status: 'ok'}), false);
    assert.equal(matchesHealth({}, {'__proto__.polluted': true}), false);
});

test('partial failures, initial results and unknown observations do not claim all online', () => {
    assert.equal(aggregate(['up', 'up']), 'up');
    assert.equal(aggregate(['up', 'down']), 'degraded');
    assert.equal(aggregate(['down', 'down']), 'down');
    assert.equal(aggregate(['up', 'unknown']), 'unknown');
    assert.equal(aggregate([]), 'unknown');
});

test('two failures confirm an outage; notices emit once, including recovery after a missing observation', () => {
    const up = transition(undefined, {state: 'up'});
    assert.equal(up.event, null);
    const first = transition(up, {state: 'down'});
    assert.equal(first.state, 'unknown');
    assert.equal(first.event, null);
    const down = transition(first, {state: 'down'});
    assert.equal(down.state, 'down');
    assert.equal(down.event, 'down');
    assert.equal(transition(down, {state: 'down'}).event, null);
    const missing = transition(down, {state: 'unknown'});
    assert.equal(missing.lastConfirmed, 'down');
    assert.equal(transition(missing, {state: 'up'}).event, 'up');
});

test('a missing monitor result breaks the consecutive-failure sequence', () => {
    const first = transition(undefined, {state: 'down'});
    const missing = transition(first, {state: 'unknown'});
    assert.equal(transition(missing, {state: 'down'}).state, 'unknown');
});

test('expired observations and initial states are unknown', () => {
    assert.equal(effectiveState({state: 'up', checkedAt: 100}, 1100, 500), 'unknown');
    assert.equal(effectiveState({state: 'up', checkedAt: 100}, 500, 500), 'up');
    assert.equal(effectiveState(undefined, 100, 500), 'unknown');
});

test('reject malformed config, duplicate identifiers, unsafe SSH targets and embedded secrets', () => {
    assert.equal(validateProjects(fixture())[0].name, 'Project');
    assert.throws(() => validateProjects({}));
    assert.throws(() => validateProjects([...fixture(), ...fixture()]));
    for (const target of ['-oProxyCommand=bad', 'host; touch /tmp/bad', '$(id)', 'host\nother']) {
        const value = fixture();
        value[0].sshTarget = target;
        assert.throws(() => validateProjects(value));
    }
    for (const url of ['https://user:secret@example.com/health', 'file:///etc/passwd', 'https://example.com\n/health'])
        assert.equal(validHttpUrl(url), false);
    const value = fixture();
    value[0].services.push({...value[0].services[0]});
    assert.throws(() => validateProjects(value));
});

test('TCP and monitor configuration validate without executing anything', () => {
    const value = fixture();
    value[0].sshTarget = 'deploy@server.example';
    value[0].services = [{id: 'ssh', name: 'SSH', type: 'tcp', host: 'example.com', port: 22},
        {id: 'worker', name: 'Worker', type: 'monitor', path: '/tmp/state.json', probe: 'worker'}];
    assert.equal(validateProjects(value)[0].services.length, 2);
    value[0].services[0].port = 99999;
    assert.throws(() => validateProjects(value));
});
