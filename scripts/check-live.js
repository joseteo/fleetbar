import GLib from 'gi://GLib';
import {readProjects} from '../lib/config.js';
import {Checker} from '../lib/checker.js';
import {aggregate} from '../lib/model.js';

const loop = new GLib.MainLoop(null, false);
const checker = new Checker(8);
async function run() {
    try {
        const projects = readProjects();
        await checker.check(projects);
        const results = await checker.check(projects);
        for (const project of projects) {
            const states = project.services.map(service => results.get(`${project.id}/${service.id}`).state);
            print(`${project.group} / ${project.name}: ${aggregate(states)}`);
            for (const service of project.services) {
                const result = results.get(`${project.id}/${service.id}`);
                print(`  ${service.name}: ${result.state} (${result.reason}, ${result.latency} ms)`);
            }
        }
    } finally {
        checker.destroy();
        loop.quit();
    }
}
run().catch(error => { printerr(error); loop.quit(); });
loop.run();
