import Gio from 'gi://Gio';
import {saveProjects} from '../lib/configFile.js';

if (ARGV.length !== 1)
    throw new Error('Usage: import-config.js projects.json');
const [, bytes] = Gio.File.new_for_path(ARGV[0]).load_contents(null);
saveProjects(JSON.parse(new TextDecoder().decode(bytes)));
print('Project configuration imported.');
