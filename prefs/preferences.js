// SPDX-License-Identifier: GPL-2.0-or-later
import Adw from 'gi://Adw?version=1';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk?version=4.0';
import Gettext from 'gettext';
import {readProjects, saveProjects} from '../lib/configFile.js';
import {validateProjects, formatHealthValue, parseHealthValue} from '../lib/model.js';

const _ = Gettext.domain('fleetbar').gettext;

function button(icon, tooltip, action) {
    const widget = new Gtk.Button({icon_name: icon, tooltip_text: tooltip, valign: Gtk.Align.CENTER,
        css_classes: ['flat']});
    widget.connect('clicked', action);
    return widget;
}

function entry(group, title, value = '', subtitle = '') {
    const row = new Adw.EntryRow({title, text: value, use_markup: false});
    if (subtitle)
        row.set_tooltip_text(subtitle);
    group.add(row);
    return row;
}

function saveButton(group, action) {
    const row = new Adw.ActionRow({title: _('Save changes'), use_markup: false});
    const widget = new Gtk.Button({label: _('Save'), valign: Gtk.Align.CENTER, css_classes: ['suggested-action']});
    widget.connect('clicked', action);
    row.add_suffix(widget);
    row.activatable_widget = widget;
    group.add(row);
}

function errorToast(window, message) {
    window.add_toast(new Adw.Toast({title: message, timeout: 5}));
}

function choosePath(parent, row, directory) {
    const chooser = new Gtk.FileChooserNative({title: directory ? _('Choose project folder') : _('Choose SSH key'),
        transient_for: parent, action: directory ? Gtk.FileChooserAction.SELECT_FOLDER : Gtk.FileChooserAction.OPEN,
        accept_label: _('Select'), cancel_label: _('Cancel')});
    chooser.connect('response', (_dialog, response) => {
        if (response === Gtk.ResponseType.ACCEPT)
            row.text = chooser.get_file().get_path();
        chooser.destroy();
    });
    chooser.show();
}

function serviceEditor(parent, service, onSave) {
    const dialog = new Adw.PreferencesWindow({title: service ? _('Edit service') : _('Add service'),
        transient_for: parent, modal: true, default_width: 540, default_height: 640, search_enabled: false});
    const page = new Adw.PreferencesPage();
    dialog.add(page);
    const details = new Adw.PreferencesGroup({title: _('Service')});
    page.add(details);
    const name = entry(details, _('Name'), service?.name);
    const types = ['http', 'tcp', 'monitor'];
    const kind = new Adw.ComboRow({title: _('Check type'), use_markup: false,
        model: Gtk.StringList.new([_('HTTP health check'), _('TCP port'), _('Local monitor')]),
        selected: Math.max(0, types.indexOf(service?.type ?? 'http'))});
    details.add(kind);
    const http = new Adw.PreferencesGroup({title: _('HTTP health check'),
        description: _('Use a read-only health endpoint. Redirects are treated as failures.')});
    page.add(http);
    const url = entry(http, _('Health URL'), service?.url ?? '', 'https://example.com/health');
    const rules = Object.entries(service?.expect ?? {});
    const field = entry(http, _('Response field (optional)'), rules[0]?.[0] ?? '',
        _('For a nested field, use a dot: components.database.status'));
    const expected = entry(http, _('Healthy value'), rules.length ? formatHealthValue(rules[0][1]) : '',
        _('For example: ok, healthy, true'));
    const tcp = new Adw.PreferencesGroup({title: _('TCP port'),
        description: _('Checks connectivity only. An open port does not prove the application is healthy.')});
    page.add(tcp);
    const host = entry(tcp, _('Host'), service?.host ?? '');
    const port = entry(tcp, _('Port'), String(service?.port ?? 22));
    const monitor = new Adw.PreferencesGroup({title: _('Local monitor'),
        description: _('Reads a local service monitor. Results older than two minutes become unknown.')});
    page.add(monitor);
    const path = entry(monitor, _('Monitor state file'), service?.path ?? '');
    const probe = entry(monitor, _('Probe name'), service?.probe ?? '');
    const visibility = () => {
        http.visible = kind.selected === 0;
        tcp.visible = kind.selected === 1;
        monitor.visible = kind.selected === 2;
    };
    kind.connect('notify::selected', visibility);
    visibility();
    const actions = new Adw.PreferencesGroup();
    page.add(actions);
    saveButton(actions, () => {
        const type = types[kind.selected];
        const value = {id: service?.id ?? GLib.uuid_string_random(), name: name.text.trim(), type};
        if (type === 'http') {
            value.url = url.text.trim();
            value.expect = {};
            if (field.text.trim()) {
                value.expect[field.text.trim()] = parseHealthValue(expected.text);
            }
            // Preserve additional externally configured rules when editing the first.
            for (const [key, val] of rules.slice(1))
                value.expect[key] = val;
        } else if (type === 'tcp') {
            value.host = host.text.trim();
            value.port = Number(port.text);
        } else {
            value.path = path.text.trim();
            value.probe = probe.text.trim();
        }
        try {
            validateProjects([{id: 'validation', name: 'validation', group: 'validation', services: [value]}]);
        } catch {
            errorToast(dialog, _('Enter a service name and valid connection details'));
            return;
        }
        onSave(value);
        dialog.close();
    });
    dialog.present();
    return dialog;
}

function projectEditor(parent, project, onSave) {
    const dialog = new Adw.PreferencesWindow({title: project ? _('Edit project') : _('Add project'),
        transient_for: parent, modal: true, default_width: 620, default_height: 760, search_enabled: false});
    const page = new Adw.PreferencesPage();
    dialog.add(page);
    const details = new Adw.PreferencesGroup({title: _('Project')});
    page.add(details);
    const name = entry(details, _('Name'), project?.name);
    const panelLabel = entry(details, _('Top bar label (optional)'), project?.panelLabel,
        _('A short name such as API or Web. Leave empty to use the project name.'));
    const group = entry(details, _('Provider or group'), project?.group, _('For example: Hetzner, netcup, Local / Tailscale'));
    const instance = entry(details, _('Instance'), project?.instance, _('A hostname or label to identify this server'));
    const links = new Adw.PreferencesGroup({title: _('Shortcuts'), description: _('Optional locations to open from the panel menu.')});
    page.add(links);
    const webUrl = entry(links, _('Website'), project?.webUrl);
    const projectPath = entry(links, _('Project folder'), project?.projectPath);
    projectPath.add_suffix(button('folder-open-symbolic', _('Choose project folder'), () => choosePath(dialog, projectPath, true)));
    const ssh = new Adw.PreferencesGroup({title: _('SSH connection'),
        description: _('Opens an interactive terminal using your existing SSH configuration. No commands run automatically.')});
    page.add(ssh);
    const sshTarget = entry(ssh, _('Host or SSH alias'), project?.sshTarget, _('For example: deploy@example.com'));
    const sshKey = entry(ssh, _('Identity file (optional)'), project?.sshKey);
    sshKey.add_suffix(button('document-open-symbolic', _('Choose SSH key'), () => choosePath(dialog, sshKey, false)));
    const services = project?.services.map(value => ({...value, expect: value.expect ? {...value.expect} : undefined})) ?? [];
    let serviceGroup;
    const renderServices = () => {
        if (serviceGroup)
            page.remove(serviceGroup);
        serviceGroup = new Adw.PreferencesGroup({title: _('Services'), description: _('Add separate checks for the instance, API and its dependencies.')});
        serviceGroup.set_header_suffix(button('list-add-symbolic', _('Add service'), () => serviceEditor(dialog, null, value => {
            services.push(value);
            renderServices();
        })));
        if (!services.length)
            serviceGroup.add(new Adw.ActionRow({title: _('Add at least one service'), use_markup: false}));
        for (const service of services) {
            const row = new Adw.ActionRow({title: service.name, subtitle: service.type === 'http' ? service.url :
                service.type === 'tcp' ? `${service.host}:${service.port}` : service.probe, use_markup: false});
            row.add_suffix(button('document-edit-symbolic', _('Edit service'), () => serviceEditor(dialog, service, value => {
                services[services.indexOf(service)] = value;
                renderServices();
            })));
            row.add_suffix(button('user-trash-symbolic', _('Remove service'), () => {
                services.splice(services.indexOf(service), 1);
                renderServices();
            }));
            serviceGroup.add(row);
        }
        page.add(serviceGroup);
    };
    renderServices();
    const save = () => {
        const value = {id: project?.id ?? GLib.uuid_string_random(), name: name.text.trim(), panelLabel: panelLabel.text.trim(), group: group.text.trim(),
            instance: instance.text.trim(), webUrl: webUrl.text.trim(), projectPath: projectPath.text.trim(),
            sshTarget: sshTarget.text.trim(), sshKey: sshKey.text.trim(), services};
        try { validateProjects([value]); } catch {
            errorToast(dialog, _('Enter a name, group and at least one valid service. Check optional URLs and paths.'));
            return;
        }
        if (onSave(value))
            dialog.close();
    };
    const headerSave = new Gtk.Button({label: _('Save'), valign: Gtk.Align.CENTER, css_classes: ['suggested-action']});
    headerSave.connect('clicked', save);
    details.set_header_suffix(headerSave);
    dialog.present();
    return dialog;
}

export function buildPreferences(window, settings) {
    window.set_default_size(700, 740);
    window.search_enabled = true;
    const projectsPage = new Adw.PreferencesPage({title: _('Projects'), icon_name: 'network-server-symbolic'});
    window.add(projectsPage);
    const projectGroup = new Adw.PreferencesGroup({title: _('Your servers and projects'),
        description: _('Grouped by provider in the top bar. Checks never restart or modify your servers.')});
    projectsPage.add(projectGroup);
    let projects;
    let configError = false;
    try { projects = readProjects(); } catch { projects = []; configError = true; }
    const rows = [];
    const persist = next => {
        try {
            saveProjects(next);
            projects = next;
            render();
            return true;
        } catch {
            errorToast(window, _('Could not save projects. Check the connection details and file permissions.'));
            return false;
        }
    };
    const edit = project => projectEditor(window, project, value => persist(project ?
        projects.map(item => item.id === project.id ? value : item) : [...projects, value]));
    projectGroup.set_header_suffix(button('list-add-symbolic', _('Add project'), () => edit(null)));
    const render = () => {
        for (const row of rows)
            projectGroup.remove(row);
        rows.length = 0;
        if (!projects.length) {
            const row = new Adw.ActionRow({title: configError ? _('Project configuration could not be read') : _('No projects yet'),
                subtitle: configError ? _('Repair the configuration file before adding projects.') : _('Use + to add your first server and its services.'), use_markup: false});
            projectGroup.add(row);
            rows.push(row);
        }
        for (const project of projects) {
            const row = new Adw.ActionRow({title: project.name,
                subtitle: `${project.group} · ${project.instance || project.services.length + ' ' + _('services')}`, use_markup: false});
            row.add_prefix(new Gtk.Image({icon_name: 'network-server-symbolic'}));
            const editButton = button('document-edit-symbolic', _('Edit project'), () => edit(project));
            row.add_suffix(editButton);
            row.activatable_widget = editButton;
            row.add_suffix(button('user-trash-symbolic', _('Remove project'), () => {
                const confirm = new Adw.MessageDialog({transient_for: window, modal: true,
                    heading: _('Remove project?'), body: project.name, body_use_markup: false});
                confirm.add_response('cancel', _('Cancel'));
                confirm.add_response('remove', _('Remove'));
                confirm.set_response_appearance('remove', Adw.ResponseAppearance.DESTRUCTIVE);
                confirm.set_default_response('cancel');
                confirm.set_close_response('cancel');
                confirm.connect('response', (_dialog, response) => {
                    if (response === 'remove')
                        persist(projects.filter(value => value.id !== project.id));
                });
                confirm.present();
            }));
            projectGroup.add(row);
            rows.push(row);
        }
    };
    render();
    // Never overwrite malformed configuration by treating it as an empty list.
    if (configError)
        projectGroup.get_header_suffix().sensitive = false;
    const behaviorPage = new Adw.PreferencesPage({title: _('Monitoring'), icon_name: 'preferences-system-symbolic'});
    window.add(behaviorPage);
    const checks = new Adw.PreferencesGroup({title: _('Health checks'),
        description: _('A service is marked offline after two failed checks. Old observations are shown as unknown.')});
    behaviorPage.add(checks);
    for (const [key, title, lower, upper] of [
        ['refresh-interval', _('Check every (seconds)'), 15, 300],
        ['timeout', _('Connection timeout (seconds)'), 2, 30],
    ]) {
        const row = new Adw.SpinRow({title, use_markup: false,
            adjustment: new Gtk.Adjustment({lower, upper, step_increment: 1, page_increment: 5})});
        settings.bind(key, row, 'value', Gio.SettingsBindFlags.DEFAULT);
        checks.add(row);
    }
    const appearance = new Adw.PreferencesGroup({title: _('Panel and notifications'),
        description: _('Uses your desktop theme, fonts and language automatically. Choose which colors status shapes, segments and dots use.')});
    behaviorPage.add(appearance);
    const addSwitch = (key, title, subtitle) => {
        const row = new Adw.SwitchRow({title, subtitle, use_markup: false});
        settings.bind(key, row, 'active', Gio.SettingsBindFlags.DEFAULT);
        appearance.add(row);
    };
    for (const [key, title, subtitle] of [
        ['show-project-labels', _('Show project names'), _('Display each project name beside its status shape')],
        ['show-service-dots', _('Show service status'), _('Show one segment per service when a project needs attention')],
        ['show-count', _('Show project count'), _('Online projects / total projects')],
    ])
        addSwitch(key, title, subtitle);
    const schemes = ['fleetbar', 'theme'];
    const colors = new Adw.ComboRow({title: _('Status colors'), use_markup: false,
        model: Gtk.StringList.new([_('Fleetbar palette'), _('Theme colors')]),
        selected: Math.max(0, schemes.indexOf(settings.get_string('status-colors')))});
    colors.connect('notify::selected', () => settings.set_string('status-colors', schemes[colors.selected]));
    settings.connect('changed::status-colors', () =>
        colors.selected = Math.max(0, schemes.indexOf(settings.get_string('status-colors'))));
    appearance.add(colors);
    addSwitch('notifications', _('Notify on status changes'), _('Confirmed outages and recoveries, grouped per check'));
    window._serverSettings = settings;
    return {edit, serviceEditor, monitoringPage: behaviorPage};
}
