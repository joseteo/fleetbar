// SPDX-License-Identifier: GPL-2.0-or-later
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import St from 'gi://St';
import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as MessageTray from 'resource:///org/gnome/shell/ui/messageTray.js';
import * as Util from 'resource:///org/gnome/shell/misc/util.js';
import {Checker} from './lib/checker.js';
import {configDirectory, configPath, readProjectsAsync} from './lib/config.js';
import {aggregate, effectiveState} from './lib/model.js';
import {ProjectIndicators} from './shell/projectIndicators.js';

const icons = {up: 'emblem-ok-symbolic', degraded: 'dialog-warning-symbolic',
    down: 'network-error-symbolic', unknown: 'help-about-symbolic'};

function stateLabel(state) {
    return {up: _('Online'), degraded: _('Needs attention'), down: _('Offline'), unknown: _('Unknown')}[state];
}

function styleInformationRow(row) {
    row.remove_style_class_name('popup-menu-item');
    row.remove_style_class_name('popup-inactive-menu-item');
    row.add_style_class_name('fleetbar-info-row');
}

function resultLabel(result, state) {
    if (!result)
        return _('Waiting for first check');
    if (state === 'unknown' && result.state !== 'unknown')
        return _('Check is out of date');
    if (result.failures === 1)
        return _('Retrying to confirm');
    switch (result.reason) {
    case 'http': return `${stateLabel(state)} · ${result.latency} ms`;
    case 'tcp': return `${_('Reachable')} · ${result.latency} ms`;
    case 'monitor': return stateLabel(state);
    case 'health': return _('Health check failed');
    case 'http-error': return `HTTP ${result.code}`;
    case 'timeout': return _('Connection timed out');
    case 'connection': return _('Cannot connect');
    case 'stale': return _('Monitor is out of date');
    case 'retry': return _('Monitor is confirming status');
    default: return _('Monitor unavailable');
    }
}

export default class FleetbarExtension extends Extension {
    enable() {
        this._busy = false;
        this._runId = 0;
        this._settings = this.getSettings();
        this._checker = new Checker(this._settings.get_int('timeout'));
        this._button = new PanelMenu.Button(0.0, _('Fleetbar'));
        this._launchCancellable = new Gio.Cancellable();
        const box = new St.BoxLayout({style_class: 'panel-status-menu-box'});
        this._panelIcon = new St.Icon({icon_name: 'network-server-symbolic', style_class: 'system-status-icon'});
        this._count = new St.Label({text: '…', y_align: Clutter.ActorAlign.CENTER});
        box.add_child(this._panelIcon);
        this._indicators = new ProjectIndicators(this._button);
        box.add_child(this._indicators.actor);
        box.add_child(this._count);
        this._button.add_child(box);
        Main.panel.addToStatusArea(this.uuid, this._button);
        this._settingsSignal = this._settings.connect('changed', (_settings, key) => {
            if (key === 'show-count' || key === 'show-project-labels' || key === 'show-service-dots')
                this._update();
            else if (key === 'refresh-interval')
                this._schedule();
            else if (key === 'timeout') {
                this._runId++;
                this._checker.destroy();
                this._checker = new Checker(this._settings.get_int('timeout'));
                this._busy = false;
                this._refresh();
            }
        });
        this._button.menu.connect('open-state-changed', (_menu, open) => {
            if (open) {
                this._update();
                this._refresh();
            }
        });
        GLib.mkdir_with_parents(configDirectory, 0o700);
        this._fileMonitor = Gio.File.new_for_path(configDirectory).monitor_directory(Gio.FileMonitorFlags.NONE, null);
        this._fileMonitorSignal = this._fileMonitor.connect('changed', (_monitor, file) => {
            if (file.get_path() !== configPath)
                return;
            if (this._reloadTimer)
                GLib.Source.remove(this._reloadTimer);
            this._reloadTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 300, () => {
                this._reloadTimer = 0;
                this._load();
                return GLib.SOURCE_REMOVE;
            });
        });
        this._load();
        this._schedule();
    }

    disable() {
        this._runId++;
        for (const timer of [this._timer, this._reloadTimer]) {
            if (timer)
                GLib.Source.remove(timer);
        }
        this._timer = 0;
        this._reloadTimer = 0;
        this._configCancellable?.cancel();
        this._configCancellable = null;
        this._launchCancellable?.cancel();
        this._launchCancellable = null;
        if (this._fileMonitorSignal)
            this._fileMonitor.disconnect(this._fileMonitorSignal);
        this._fileMonitorSignal = 0;
        this._fileMonitor?.cancel();
        this._fileMonitor = null;
        this._checker?.destroy();
        this._checker = null;
        if (this._settingsSignal)
            this._settings.disconnect(this._settingsSignal);
        this._settingsSignal = 0;
        this._notificationSource?.destroy();
        this._notificationSource = null;
        this._indicators?.destroy();
        this._indicators = null;
        this._button?.destroy();
        this._button = null;
        this._settings = null;
        this._projects = null;
        this._serviceRows = null;
        this._projectRows = null;
        this._checkedAt = null;
        this._panelIcon = null;
        this._count = null;
        this._summary = null;
        this._lastCheck = null;
        this._refreshAction = null;
    }

    _schedule() {
        if (this._timer)
            GLib.Source.remove(this._timer);
        this._timer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, this._settings.get_int('refresh-interval'), () => {
            this._refresh();
            return GLib.SOURCE_CONTINUE;
        });
    }

    async _load() {
        this._runId++;
        this._checkedAt = null;
        this._checker.cancel();
        this._checker.results.clear();
        this._busy = false;
        this._configCancellable?.cancel();
        const cancellable = new Gio.Cancellable();
        this._configCancellable = cancellable;
        let projects;
        let configError = false;
        try {
            projects = await readProjectsAsync(cancellable);
        } catch {
            projects = [];
            configError = true;
        }
        if (cancellable.is_cancelled() || cancellable !== this._configCancellable || !this._button)
            return;
        this._configCancellable = null;
        this._projects = projects;
        this._configError = configError;
        this._indicators.setProjects(projects);
        this._panelIcon.visible = projects.length === 0;
        this._buildMenu();
        this._update();
        this._refresh();
    }

    _buildMenu() {
        const menu = this._button.menu;
        menu.removeAll();
        this._serviceRows = new Map();
        this._projectRows = new Map();
        const header = new PopupMenu.PopupBaseMenuItem({reactive: false, can_focus: false});
        styleInformationRow(header);
        const heading = new St.BoxLayout({vertical: true, x_expand: true, style_class: 'fleetbar-heading'});
        heading.add_child(new St.Label({text: _('Fleetbar'), style_class: 'fleetbar-title'}));
        this._summary = new St.Label({style_class: 'fleetbar-secondary'});
        heading.add_child(this._summary);
        header.add_child(heading);
        menu.addMenuItem(header);
        menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        const groups = new Map();
        for (const project of this._projects) {
            if (!groups.has(project.group))
                groups.set(project.group, []);
            groups.get(project.group).push(project);
        }
        for (const [name, projects] of groups) {
            const section = new PopupMenu.PopupMenuSection();
            const groupHeading = new PopupMenu.PopupMenuItem(name, {reactive: false, can_focus: false});
            styleInformationRow(groupHeading);
            groupHeading.add_style_class_name('fleetbar-group');
            section.addMenuItem(groupHeading);
            for (const project of projects) {
                const item = new PopupMenu.PopupSubMenuMenuItem(project.name);
                const icon = new St.Icon({icon_name: icons.unknown, style_class: 'popup-menu-icon'});
                item.insert_child_at_index(icon, 0);
                const state = new St.Label({style_class: 'fleetbar-secondary', y_align: Clutter.ActorAlign.CENTER});
                item.insert_child_below(state, item._triangleBin);
                this._projectRows.set(project.id, {item, icon, state});
                if (project.instance) {
                    const instance = new PopupMenu.PopupMenuItem(project.instance, {reactive: false, can_focus: false});
                    styleInformationRow(instance);
                    instance.add_style_class_name('fleetbar-secondary');
                    item.menu.addMenuItem(instance);
                }
                for (const service of project.services) {
                    const row = new PopupMenu.PopupBaseMenuItem({reactive: false, can_focus: false});
                    styleInformationRow(row);
                    const serviceIcon = new St.Icon({icon_name: icons.unknown, style_class: 'popup-menu-icon'});
                    const title = new St.Label({text: service.name, x_expand: true, y_align: Clutter.ActorAlign.CENTER});
                    const detail = new St.Label({style_class: 'fleetbar-secondary', y_align: Clutter.ActorAlign.CENTER});
                    row.add_child(serviceIcon);
                    row.add_child(title);
                    row.add_child(detail);
                    item.menu.addMenuItem(row);
                    this._serviceRows.set(`${project.id}/${service.id}`, {row, icon: serviceIcon, detail});
                }
                item.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
                if (project.webUrl)
                    item.menu.addAction(_('Open website'), () => this._openUri(project.webUrl), 'web-browser-symbolic');
                if (project.projectPath)
                    item.menu.addAction(_('Open project folder'), () =>
                        this._openUri(Gio.File.new_for_path(project.projectPath).get_uri()), 'folder-symbolic');
                if (project.sshTarget) {
                    item.menu.addAction(_('Connect with SSH'), () => {
                        const argv = ['gnome-terminal', '--', 'ssh'];
                        if (project.sshKey)
                            argv.push('-i', project.sshKey);
                        argv.push('-o', 'StrictHostKeyChecking=yes', project.sshTarget);
                        try { Util.spawn(argv); } catch { this._notify(_('Could not open the terminal')); }
                    }, 'utilities-terminal-symbolic');
                }
                section.addMenuItem(item);
            }
            menu.addMenuItem(section);
        }
        if (!this._projects.length) {
            const empty = new PopupMenu.PopupMenuItem(this._configError ? _('Project configuration could not be read') :
                _('Add a project in Settings to get started'), {reactive: false, can_focus: false});
            menu.addMenuItem(empty);
        }
        menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._lastCheck = new PopupMenu.PopupMenuItem(_('Not checked yet'), {reactive: false, can_focus: false});
        styleInformationRow(this._lastCheck);
        this._lastCheck.add_style_class_name('fleetbar-secondary');
        menu.addMenuItem(this._lastCheck);
        this._refreshAction = menu.addAction(_('Refresh now'), () => this._refresh(), 'view-refresh-symbolic');
        menu.addAction(_('Settings'), () => this.openPreferences(), 'emblem-system-symbolic');
    }

    _openUri(uri) {
        Gio.AppInfo.launch_default_for_uri_async(uri, global.create_app_launch_context(0, -1), this._launchCancellable, (_source, result) => {
            try { Gio.AppInfo.launch_default_for_uri_finish(result); } catch {
                if (this._button)
                    this._notify(_('Could not open this location'));
            }
        });
    }

    _notify(body) {
        if (!this._notificationSource) {
            this._notificationSource = new MessageTray.Source({title: _('Fleetbar'), iconName: 'network-server-symbolic'});
            this._notificationSource.connect('destroy', () => { this._notificationSource = null; });
            Main.messageTray.add(this._notificationSource);
        }
        const notification = new MessageTray.Notification({source: this._notificationSource, title: _('Fleetbar'), body});
        this._notificationSource.addNotification(notification);
    }

    async _refresh() {
        if (!this._button || !this._projects?.length)
            return;
        this._update();
        if (this._busy || this._configCancellable)
            return;
        this._busy = true;
        const runId = ++this._runId;
        const checker = this._checker;
        this._refreshAction.setSensitive(false);
        this._refreshAction.label.text = _('Checking…');
        try {
            const results = await checker.check(this._projects);
            if (checker !== this._checker || runId !== this._runId || !results)
                return;
            this._checkedAt = Date.now();
            this._update();
            if (this._settings.get_boolean('notifications')) {
                const events = this._projects.flatMap(project => project.services.flatMap(service => {
                    const event = results.get(`${project.id}/${service.id}`)?.event;
                    return event ? [`${project.name} · ${service.name}: ${event === 'up' ? _('Recovered') : _('Offline')}`] : [];
                }));
                if (events.length)
                    this._notify(events.join('\n'));
            }
        } catch {
            if (checker === this._checker && runId === this._runId)
                this._summary.text = _('Checks unavailable');
        } finally {
            if (checker === this._checker && runId === this._runId) {
                this._busy = false;
                this._refreshAction.setSensitive(true);
                this._refreshAction.label.text = _('Refresh now');
            }
        }
    }

    _update() {
        if (!this._serviceRows)
            return;
        const now = Date.now();
        const staleAfter = (this._settings.get_int('refresh-interval') * 2 + this._settings.get_int('timeout')) * 1000;
        const states = [];
        const descriptions = [];
        const showLabels = this._settings.get_boolean('show-project-labels');
        const showServiceDots = this._settings.get_boolean('show-service-dots');
        for (const project of this._projects) {
            const services = project.services.map(service => {
                const key = `${project.id}/${service.id}`;
                const result = this._checker.results.get(key);
                const state = effectiveState(result, now, staleAfter);
                const row = this._serviceRows.get(key);
                row.icon.icon_name = icons[state];
                row.detail.text = resultLabel(result, state);
                row.row.accessible_name = `${service.name}: ${row.detail.text}`;
                return state;
            });
            const state = aggregate(services);
            states.push(state);
            descriptions.push(this._indicators.update(project, services, showLabels, showServiceDots));
            const row = this._projectRows.get(project.id);
            row.icon.icon_name = icons[state];
            row.state.text = stateLabel(state);
            row.item.accessible_name = `${project.name}: ${stateLabel(state)}`;
        }
        const overall = aggregate(states);
        const online = states.filter(state => state === 'up').length;
        this._count.text = `${online}/${states.length}`;
        this._count.visible = this._settings.get_boolean('show-count');
        this._panelIcon.icon_name = overall === 'up' ? 'network-server-symbolic' :
            overall === 'unknown' ? 'network-server-symbolic' : icons[overall];
        const summary = this._configError ? _('Configuration needs attention') : !states.length ? _('No projects yet') :
            overall === 'up' ? _('All systems operational') : overall === 'unknown' ? _('Waiting for confirmed status') :
                _('Some services need attention');
        this._summary.text = summary;
        this._button.accessible_name = `${_('Fleetbar')}: ${summary}. ${descriptions.join('; ')}`;
        if (this._checkedAt) {
            const time = GLib.DateTime.new_from_unix_local(Math.floor(this._checkedAt / 1000)).format('%X');
            this._lastCheck.label.text = `${_('Last checked')}: ${time}`;
        }
    }

}
