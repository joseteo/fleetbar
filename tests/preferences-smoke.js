import Adw from 'gi://Adw?version=1';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk?version=4.0';
import Gettext from 'gettext';
import {buildPreferences} from '../prefs/preferences.js';

Gettext.bindtextdomain('fleetbar', GLib.getenv('TEST_LOCALE_DIR') ?? '/tmp/fleetbar/locale');
const app = new Adw.Application({application_id: 'com.joseteo.FleetbarSmokeTest', flags: Gio.ApplicationFlags.NON_UNIQUE});
app.connect('activate', () => {
    const settings = new Gio.Settings({schema_id: 'org.gnome.shell.extensions.fleetbar'});
    const window = new Adw.PreferencesWindow({application: app, title: 'Fleetbar'});
    const controls = buildPreferences(window, settings);
    window.present();
    if (ARGV.includes('--monitoring'))
        window.set_visible_page(controls.monitoringPage);
    let target = window;
    if (ARGV.includes('--edit'))
        target = controls.edit(null);
    if (ARGV.includes('--service'))
        target = controls.serviceEditor(window, null, () => {});
    GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 2, () => {
        const paintable = new Gtk.WidgetPaintable({widget: target});
        const snapshot = new Gtk.Snapshot();
        paintable.snapshot(snapshot, target.get_width(), target.get_height());
        const node = snapshot.to_node();
        if (!node)
            throw new Error('Preferences did not render');
        const texture = target.get_native().get_renderer().render_texture(node, null);
        const mode = ARGV.includes('--edit') ? 'project' : ARGV.includes('--service') ? 'service' :
            ARGV.includes('--monitoring') ? 'monitoring' : 'settings';
        const output = `/tmp/fleetbar-shell-test/${mode}-${GLib.getenv('LANGUAGE') ?? 'en'}.png`;
        texture.save_to_png(output);
        print(`PASS: native ${mode} preferences rendered: ${output}`);
        return GLib.SOURCE_REMOVE;
    });
    if (!ARGV.includes('--keep')) {
        GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 3, () => {
            app.quit();
            return GLib.SOURCE_REMOVE;
        });
    }
});
app.run([]);
