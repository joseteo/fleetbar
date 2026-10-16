// SPDX-License-Identifier: GPL-2.0-or-later
import Clutter from 'gi://Clutter';
import Pango from 'gi://Pango';
import St from 'gi://St';
import {gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import {panelPresentation} from '../lib/model.js';

const darkColors = {up: '#57e389', degraded: '#f8e45c', down: '#ff7b63', unknown: '#c0bfbc'};
const lightColors = {up: '#1a7f4b', degraded: '#9c6e03', down: '#c01c28', unknown: '#5e5c64'};
const themeColors = {up: 'success_color', degraded: 'warning_color', down: 'error_color'};

function stateLabel(state) {
    return {up: _('Online'), degraded: _('Needs attention'), down: _('Offline'), unknown: _('Unknown')}[state];
}

export class ProjectIndicators {
    constructor(owner) {
        this.actor = new St.BoxLayout({style_class: 'fleetbar-projects', y_align: Clutter.ActorAlign.CENTER});
        this._owner = owner;
        this._items = new Map();
        this._styleSignal = owner.connect('style-changed', () => this._applyColors());
    }

    setProjects(projects) {
        this.actor.destroy_all_children();
        this._items.clear();
        for (const project of projects) {
            const badge = new St.BoxLayout({style_class: 'fleetbar-project', y_align: Clutter.ActorAlign.CENTER});
            const dot = new St.Icon({icon_name: 'media-record-symbolic', style_class: 'fleetbar-dot',
                y_align: Clutter.ActorAlign.CENTER});
            const label = new St.Label({text: project.panelLabel || project.name, style_class: 'fleetbar-project-label',
                y_align: Clutter.ActorAlign.CENTER});
            label.clutter_text.ellipsize = Pango.EllipsizeMode.END;
            const services = new St.BoxLayout({style_class: 'fleetbar-services', y_align: Clutter.ActorAlign.CENTER});
            const serviceDots = project.services.map(service => {
                const serviceDot = new St.Icon({icon_name: 'media-record-symbolic',
                    style_class: 'fleetbar-service-dot', y_align: Clutter.ActorAlign.CENTER});
                serviceDot.accessible_name = `${service.name}: ${stateLabel('unknown')}`;
                services.add_child(serviceDot);
                return {dot: serviceDot, state: 'unknown'};
            });
            badge.add_child(dot);
            badge.add_child(label);
            badge.add_child(services);
            this.actor.add_child(badge);
            this._items.set(project.id, {badge, dot, label, services, serviceDots, state: 'unknown'});
        }
        this._applyColors();
    }

    update(project, states, showLabels, showServiceDots) {
        const item = this._items.get(project.id);
        const presentation = panelPresentation(project, states);
        item.state = presentation.state;
        item.label.text = presentation.label;
        item.label.visible = showLabels;
        item.services.visible = showServiceDots;
        const failed = [];
        presentation.services.forEach((service, index) => {
            const entry = item.serviceDots[index];
            if (!entry)
                return;
            entry.state = service.state;
            entry.dot.accessible_name = `${service.name}: ${stateLabel(service.state)}`;
            if (service.state !== 'up')
                failed.push(entry.dot.accessible_name);
        });
        const state = stateLabel(item.state);
        item.badge.accessible_name = `${project.name}: ${state}, ${presentation.online}/${presentation.total}`;
        this._applyColors();
        const description = `${project.name}: ${state}, ${presentation.online}/${presentation.total}`;
        return failed.length ? `${description}. ${failed.join(', ')}` : description;
    }

    _applyColors() {
        if (!this._owner.mapped)
            return;
        const node = this._owner.get_theme_node();
        const foreground = node.get_foreground_color();
        const colors = foreground.red + foreground.green + foreground.blue > 384 ? darkColors : lightColors;
        for (const item of this._items.values()) {
            this._colorDot(node, colors, item.dot, item.state);
            for (const service of item.serviceDots)
                this._colorDot(node, colors, service.dot, service.state);
        }
    }

    _colorDot(node, colors, dot, state) {
        let color = colors[state];
        const key = themeColors[state];
        if (key) {
            const [found, themeColor] = node.lookup_color(key, true);
            if (found)
                color = themeColor.to_string();
        }
        const style = `color: ${color};`;
        if (dot.style !== style)
            dot.set_style(style);
    }

    destroy() {
        this._owner.disconnect(this._styleSignal);
        this._styleSignal = 0;
        this._owner = null;
        this._items.clear();
        this.actor.destroy();
        this.actor = null;
    }
}
