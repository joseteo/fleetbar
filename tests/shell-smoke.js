// Isolated test harness. Excluded from the submitted extension.
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Shell from 'gi://Shell';
import St from 'gi://St';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const output = '/tmp/fleetbar-shell-test';
const pause = ms => new Promise(resolve => GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => {
    resolve();
    return GLib.SOURCE_REMOVE;
}));

function assert(value, message) {
    if (!value)
        throw new Error(message);
}

export default class FleetbarSmoke extends Extension {
    enable() {
        this.run().catch(error => {
            console.error(`FLEETBAR_TEST_FAIL ${error}: ${error.stack}`);
            GLib.file_set_contents(`${output}/failed.txt`, `${error}\n${error.stack}`);
        });
    }

    async run() {
        await pause(4000);
        Main.overview.hide();
        const extension = Main.extensionManager.lookup('fleetbar@joseteo.github.com');
        const app = extension?.stateObj;
        assert(app?._button && !extension.error, `Enable failed: ${extension?.error}`);
        assert(app._projects.length === 3, 'Three example projects should load');
        app._runId++;
        app._checker.destroy();
        app._busy = false;
        const results = new Map();
        const fakeChecker = {
            results,
            async check(projects) {
                for (const project of projects) {
                    for (const service of project.services) {
                        results.set(`${project.id}/${service.id}`, {state: 'up', reason: 'http',
                            checkedAt: Date.now(), latency: 24, failures: 0});
                    }
                }
                return results;
            },
            cancel() {},
            destroy() { results.clear(); },
        };
        app._checker = fakeChecker;
        await app._refresh();
        assert(app._count.text === '3/3', 'Healthy project count');
        assert(app._indicators.actor.get_n_children() === 3, 'One indicator per project');
        const website = app._indicators._items.get('website');
        assert(website.segments.length === 3, 'One pill segment per service');
        assert(app._indicators._items.get('workspace').segments.length === 2, 'One pill segment per service');
        assert(website.glyph instanceof St.DrawingArea, 'Projects use drawn shape glyphs');
        assert(website.glyph.state === 'up' && !website.pill.visible, 'Healthy projects collapse the service pill');
        assert(!app._count.visible, 'Default panel does not duplicate the project count');
        const setTheme = name => {
            const theme = new St.Theme({application_stylesheet:
                Gio.File.new_for_path(`/usr/share/gnome-shell/theme/${name}/gnome-shell.css`)});
            theme.load_stylesheet(Gio.File.new_for_path(`${app.path}/stylesheet.css`));
            St.ThemeContext.get_for_stage(global.stage).set_theme(theme);
        };
        const screenshot = new Shell.Screenshot();
        const capture = async name => {
            const stream = Gio.File.new_for_path(`${output}/${name}.png`).replace(null, false,
                Gio.FileCreateFlags.REPLACE_DESTINATION, null);
            const panel = name.startsWith('panel-');
            await screenshot.screenshot_area(panel ? 780 : 900, 0, panel ? 500 : 380, panel ? 80 : 760, stream);
            stream.close(null);
        };
        setTheme('Yaru-blue-dark');
        await pause(500);
        app._update();
        for (const item of app._indicators._items.values()) {
            assert(item.glyph._color, 'Glyphs resolve a status color');
            for (const service of item.segments)
                assert(service.segment.style.includes('background-color:'), 'Service segments have visible status colors');
        }
        await capture('panel-healthy');
        app._button.menu.open();
        app._projectRows.get('website').item.menu.open();
        await pause(500);
        await capture('menu-dark');
        setTheme('Yaru-blue');
        await pause(500);
        await capture('menu-light');
        app._button.menu.close();
        app._checker.results.set('workspace/worker', {state: 'down', reason: 'connection', checkedAt: Date.now(), failures: 2});
        app._update();
        const partial = app._indicators._items.get('workspace');
        assert(partial.state === 'degraded' && partial.label.text.endsWith('1/2'), 'Partial failure shows service counts');
        assert(partial.glyph.state === 'degraded' && website.glyph.state === 'up', 'Glyph shape follows the aggregate state');
        assert(partial.glyph._color !== website.glyph._color, 'Warning color differs from healthy');
        assert(partial.pill.visible, 'The service pill appears when a project needs attention');
        assert(partial.segments.map(service => service.state).join() === 'up,down', 'Pill segments track each service');
        assert(partial.segments[0].segment.style !== partial.segments[1].segment.style, 'The failing service segment stands out');
        assert(partial.segments[1].segment.accessible_name.includes('Worker'), 'Segments name the failing service');
        const workerRow = app._serviceRows.get('workspace/worker');
        assert(workerRow.icon.icon_name === 'media-record-symbolic', 'Menu service rows use status dots');
        assert(workerRow.icon.style !== app._serviceRows.get('workspace/api').icon.style, 'Menu dot colors follow each service');
        const workspaceRow = app._projectRows.get('workspace');
        assert(workspaceRow.glyph.state === 'degraded' &&
            workspaceRow.glyph._color !== app._projectRows.get('website').glyph._color,
            'Menu project glyphs mirror the panel shape and state');
        for (const service of app._projects.find(project => project.id === 'homelab').services)
            results.set(`homelab/${service.id}`, {state: 'down', reason: 'connection', checkedAt: Date.now(), failures: 2});
        app._update();
        const down = app._indicators._items.get('homelab');
        assert(down.state === 'down' && down.label.text.endsWith('0/2'), 'Offline state');
        assert(down.glyph.state === 'down', 'Offline projects draw the square glyph');
        assert(down.glyph._color !== partial.glyph._color, 'Offline color differs from warning');
        assert(down.segments.every(service => service.state === 'down'), 'Every failing service has its own segment');
        await pause(500);
        await capture('panel-outage');
        app._settings.set_boolean('show-project-labels', false);
        await pause(500);
        await capture('panel-compact');
        app._settings.set_boolean('show-project-labels', true);
        results.clear();
        app._update();
        const unknownItem = app._indicators._items.get('website');
        assert(unknownItem.label.text === 'Web ?', 'Unknown is distinct from healthy');
        assert(unknownItem.glyph.state === 'unknown', 'Unknown projects draw the ring glyph');
        assert(unknownItem.pill.visible && unknownItem.segments.every(service => service.state === 'unknown'),
            'Unknown services show gray segments');
        await pause(500);
        await capture('panel-unknown');
        const loading = app._load();
        await app._refresh();
        await loading;
        assert(app._projects.length === 3 && !app._configCancellable, 'Refresh does not invalidate configuration loading');
        for (const result of results.values())
            result.checkedAt = Date.now() - 999999;
        app._busy = true;
        await app._refresh();
        assert(app._indicators._items.get('website').state === 'unknown', 'Busy checks age existing green indicators');
        app._busy = false;
        const currentPartial = app._indicators._items.get('workspace');
        app._settings.set_boolean('show-project-labels', false);
        assert(!currentPartial.label.visible, 'Compact mode hides labels');
        app._settings.set_boolean('show-project-labels', true);
        app._settings.set_boolean('show-service-dots', false);
        assert(!currentPartial.pill.visible, 'Service pill can be turned off');
        app._settings.set_boolean('show-service-dots', true);
        assert(currentPartial.pill.visible, 'Service pill returns while a project needs attention');
        app._notify('Notification lifecycle smoke test');
        assert(app._notificationSource, 'Notification source exists');
        app.disable();
        assert(!Main.panel.statusArea['fleetbar@joseteo.github.com'], 'Panel cleaned up');
        assert(!app._notificationSource && !app._checker && !app._fileMonitor, 'Owned resources cleaned up');
        app.enable();
        await pause(500);
        const pending = app._refresh();
        app.disable();
        await pending;
        app.enable();
        await pause(500);
        assert(app._indicators.actor.get_n_children() === 3, 'Re-enable restores indicators');
        GLib.file_set_contents(`${output}/passed.txt`, 'passed');
        console.log('FLEETBAR_TEST_PASS: shape glyphs, collapsing service pills, menu status dots, service counts, colors, themes, compact mode, notifications and lifecycle');
    }

    disable() {}
}
