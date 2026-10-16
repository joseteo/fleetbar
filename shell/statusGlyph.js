// SPDX-License-Identifier: GPL-2.0-or-later
// Shape-coded status glyphs: circle (online), triangle (needs attention),
// square (offline) and ring (unknown). Shape and color both encode the state,
// so color vision is never the only signal.
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';
import Cairo from 'gi://cairo';

function rgba(color) {
    const hex = /^#([0-9a-f]{6})(?:[0-9a-f]{2})?$/i.exec(color ?? '');
    if (hex) {
        const value = parseInt(hex[1], 16);
        return [(value >> 16 & 0xff) / 255, (value >> 8 & 0xff) / 255, (value & 0xff) / 255];
    }
    const rgb = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(color ?? '');
    if (rgb)
        return [Number(rgb[1]) / 255, Number(rgb[2]) / 255, Number(rgb[3]) / 255];
    return [1, 1, 1];
}

function roundedRect(cr, x, y, width, height, radius) {
    cr.moveTo(x + radius, y);
    cr.lineTo(x + width - radius, y);
    cr.arc(x + width - radius, y + radius, radius, -Math.PI / 2, 0);
    cr.lineTo(x + width, y + height - radius);
    cr.arc(x + width - radius, y + height - radius, radius, 0, Math.PI / 2);
    cr.lineTo(x + radius, y + height);
    cr.arc(x + radius, y + height - radius, radius, Math.PI / 2, Math.PI);
    cr.lineTo(x, y + radius);
    cr.arc(x + radius, y + radius, radius, Math.PI, 3 * Math.PI / 2);
    cr.closePath();
}

export const StatusGlyph = GObject.registerClass({
    GTypeName: 'FleetbarStatusGlyph',
}, class StatusGlyph extends St.DrawingArea {
    _init(size = 11) {
        super._init({y_align: Clutter.ActorAlign.CENTER});
        this.width = size;
        this.height = size;
        this._size = size;
        this._state = 'unknown';
        this._color = null;
    }

    get state() {
        return this._state;
    }

    setState(state, color) {
        if (state === this._state && color === this._color)
            return;
        this._state = state;
        this._color = color;
        if (this.has_allocation())
            this.queue_repaint();
    }

    vfunc_repaint() {
        const [surfaceWidth, surfaceHeight] = this.get_surface_size();
        if (!surfaceWidth || !surfaceHeight)
            return;
        const size = this._size;
        const [red, green, blue] = rgba(this._color);
        const cr = this.get_context();
        const center = size / 2;
        cr.setSourceRGBA(red, green, blue, 1);
        switch (this._state) {
        case 'up':
            cr.arc(center, center, center - 0.75, 0, 2 * Math.PI);
            cr.fill();
            break;
        case 'degraded':
            // Fill plus a round-join stroke gives the triangle soft corners.
            cr.setLineJoin(Cairo.LineJoin.ROUND);
            cr.setLineWidth(2);
            cr.moveTo(center, 2.4);
            cr.lineTo(size - 2.2, size - 2.2);
            cr.lineTo(2.2, size - 2.2);
            cr.closePath();
            cr.fillPreserve();
            cr.stroke();
            break;
        case 'down':
            roundedRect(cr, 1, 1, size - 2, size - 2, 2);
            cr.fill();
            break;
        default:
            cr.setLineWidth(2);
            cr.arc(center, center, center - 1.5, 0, 2 * Math.PI);
            cr.stroke();
            break;
        }
        cr.$dispose();
    }
});
