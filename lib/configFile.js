// SPDX-License-Identifier: GPL-2.0-or-later
// Blocking configuration file access for the preferences process and
// maintenance scripts. Shell code must use readProjectsAsync() from
// config.js instead, so the compositor is never blocked by disk IO.
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {validateProjects} from './model.js';
import {configDirectory, configPath} from './config.js';

export function readProjects() {
    const file = Gio.File.new_for_path(configPath);
    try {
        const [, bytes] = file.load_contents(null);
        return validateProjects(JSON.parse(new TextDecoder().decode(bytes)));
    } catch (error) {
        if (error.matches?.(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND))
            return [];
        throw error;
    }
}

export function saveProjects(projects) {
    const valid = validateProjects(projects);
    if (GLib.mkdir_with_parents(configDirectory, 0o700) !== 0)
        throw new Error('Cannot create configuration directory');
    const file = Gio.File.new_for_path(configPath);
    file.replace_contents(JSON.stringify(valid, null, 2) + '\n', null, false,
        Gio.FileCreateFlags.PRIVATE | Gio.FileCreateFlags.REPLACE_DESTINATION, null);
}
