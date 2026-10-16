// SPDX-License-Identifier: GPL-2.0-or-later
// Shared status colors for panel and menu dots: semantic theme colors with
// GNOME palette fallbacks, resolved against the owning widget's theme node.
const darkColors = {up: '#57e389', degraded: '#f8e45c', down: '#ff7b63', unknown: '#c0bfbc'};
const lightColors = {up: '#1a7f4b', degraded: '#9c6e03', down: '#c01c28', unknown: '#5e5c64'};
const themeColors = {up: 'success_color', degraded: 'warning_color', down: 'error_color'};

function palette(node) {
    if (!node)
        return darkColors;
    const foreground = node.get_foreground_color();
    return foreground.red + foreground.green + foreground.blue > 384 ? darkColors : lightColors;
}

export function statusColor(node, state) {
    const colors = palette(node);
    let color = colors[state] ?? colors.unknown;
    const key = themeColors[state];
    if (node && key) {
        const [found, themeColor] = node.lookup_color(key, true);
        if (found)
            color = themeColor.to_string();
    }
    return color;
}

export function applyStatusColor(node, dot, state) {
    const style = `color: ${statusColor(node, state)};`;
    if (dot.style !== style)
        dot.set_style(style);
}

export function applyStatusFill(node, segment, state) {
    const style = `background-color: ${statusColor(node, state)};`;
    if (segment.style !== style)
        segment.set_style(style);
}
