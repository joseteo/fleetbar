// SPDX-License-Identifier: GPL-2.0-or-later
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {validateProjects} from './model.js';

export const configDirectory = GLib.build_filenamev([GLib.get_user_config_dir(), 'fleetbar']);
export const configPath = GLib.build_filenamev([configDirectory, 'projects.json']);

export async function readProjectsAsync(cancellable) {
    const file = Gio.File.new_for_path(configPath);
    try {
        const bytes = await new Promise((resolve, reject) => {
            file.load_contents_async(cancellable, (source, response) => {
                try {
                    const [, contents] = source.load_contents_finish(response);
                    resolve(contents);
                } catch (error) { reject(error); }
            });
        });
        if (bytes.length > 1048576)
            throw new Error('Configuration exceeds limit');
        return validateProjects(JSON.parse(new TextDecoder().decode(bytes)));
    } catch (error) {
        if (error.matches?.(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND))
            return [];
        throw error;
    }
}
