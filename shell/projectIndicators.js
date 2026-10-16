// SPDX-License-Identifier: GPL-2.0-or-later
import Clutter from 'gi://Clutter';
import Pango from 'gi://Pango';
import St from 'gi://St';
import {gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import {panelPresentation} from '../lib/model.js';
import {StatusGlyph} from './statusGlyph.js';
import {applyStatusFill, statusColor} from './statusColors.js';

function stateLabel(state) {
    return {up: _('Online'), degraded: _('Needs attention'), down: _('Offline'), unknown: _('Unknown')}[state];
}

export class ProjectIndicators {
    constructor(owner) {
        this.actor = new St.BoxLayout({style_class: 'fleetbar-projects', y_align: Clutter.ActorAlign.CENTER});
        this._owner = owner;
        this._items = new Map();
        owner.connectObject('style-changed', () => this._applyColors(), this);
    }

    setProjects(projects) {
        this.actor.destroy_all_children();
        this._items.clear();
        for (const project of projects) {
            const badge = new St.BoxLayout({style_class: 'fleetbar-project', y_align: Clutter.ActorAlign.CENTER});
            const glyph = new StatusGlyph();
            const label = new St.Label({text: project.panelLabel || project.name, style_class: 'fleetbar-project-label',
                y_align: Clutter.ActorAlign.CENTER});
            label.clutter_text.ellipsize = Pango.EllipsizeMode.END;
            const pill = new St.BoxLayout({style_class: 'fleetbar-service-pill', y_align: Clutter.ActorAlign.CENTER});
            const segments = [];
            for (const service of project.services) {
                const segment = new St.Widget({style_class: 'fleetbar-service-segment',
                    y_align: Clutter.ActorAlign.CENTER});
                segment.accessible_name = `${service.name}: ${stateLabel('unknown')}`;
                pill.add_child(segment);
                segments.push({segment, state: 'unknown'});
            }
            badge.add_child(glyph);
            badge.add_child(label);
            badge.add_child(pill);
            this.actor.add_child(badge);
            this._items.set(project.id, {badge, glyph, label, pill, segments, state: 'unknown'});
        }
        this._applyColors();
    }

    update(project, states, showLabels, showServiceDots) {
        const item = this._items.get(project.id);
        const presentation = panelPresentation(project, states);
        item.state = presentation.state;
        item.label.text = presentation.label;
        item.label.visible = showLabels;
        const failed = [];
        presentation.services.forEach((service, index) => {
            const entry = item.segments[index];
            if (!entry)
                return;
            entry.state = service.state;
            entry.segment.accessible_name = `${service.name}: ${stateLabel(service.state)}`;
            if (service.state !== 'up')
                failed.push(entry.segment.accessible_name);
        });
        // The service pill only appears while a project needs attention, so a
        // fully healthy bar stays quiet and problems draw the eye.
        item.pill.visible = showServiceDots && presentation.services.some(service => service.state !== 'up');
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
        for (const item of this._items.values()) {
            item.glyph.setState(item.state, statusColor(node, item.state));
            for (const service of item.segments)
                applyStatusFill(node, service.segment, service.state);
        }
    }

    destroy() {
        this._owner.disconnectObject(this);
        this._owner = null;
        this._items.clear();
        this.actor.destroy();
        this.actor = null;
    }
}
