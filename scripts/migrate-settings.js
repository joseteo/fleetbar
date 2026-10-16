// SPDX-License-Identifier: GPL-2.0-or-later
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {readProjects, saveProjects, configPath} from '../lib/config.js';
import {validateProjects} from '../lib/model.js';

const legacy = Gio.File.new_for_path(GLib.build_filenamev([GLib.get_user_config_dir(), 'gnome-servers', 'projects.json']));
if (!Gio.File.new_for_path(configPath).query_exists(null) && legacy.query_exists(null)) {
    const [, bytes] = legacy.load_contents(null);
    const projects = validateProjects(JSON.parse(new TextDecoder().decode(bytes)));
    saveProjects(projects);
    print('Migrated existing projects without changing their checks.');
}
const defaultSource = Gio.SettingsSchemaSource.get_default();
const oldDirectory = Gio.File.new_for_path(GLib.build_filenamev([GLib.get_home_dir(), '.local/share/gnome-shell/extensions/servers@joseteo.github.com/schemas']));
if (oldDirectory.query_exists(null)) {
    const oldSource = Gio.SettingsSchemaSource.new_from_directory(oldDirectory.get_path(), defaultSource, false);
    const newDirectory = GLib.build_filenamev([GLib.get_home_dir(), '.local/share/gnome-shell/extensions/fleetbar@joseteo.github.com/schemas']);
    const newSource = Gio.SettingsSchemaSource.new_from_directory(newDirectory, defaultSource, false);
    const oldSettings = new Gio.Settings({settings_schema: oldSource.lookup('org.gnome.shell.extensions.servers', false)});
    const newSettings = new Gio.Settings({settings_schema: newSource.lookup('org.gnome.shell.extensions.fleetbar', false)});
    for (const key of ['refresh-interval', 'timeout', 'show-count', 'notifications']) {
        const value = oldSettings.get_user_value(key);
        if (value && !newSettings.get_user_value(key))
            newSettings.set_value(key, value);
    }
    Gio.Settings.sync();
}
print(`Fleetbar has ${readProjects().length} configured projects.`);
