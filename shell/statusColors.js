// SPDX-License-Identifier: GPL-2.0-or-later
// Shared status colors for panel and menu dots. The Fleetbar palette keeps the
// same green/amber/red/gray meaning everywhere: mid tones that meet in the
// middle on light sessions, bright tones on dark sessions. The theme palette
// instead follows the Shell's semantic colors with GNOME palette fallbacks.
const fleetbarDark = {up: '#57e389', degraded: '#f8e45c', down: '#ff7b63', unknown: '#c0bfbc'};
const fleetbarLight = {up: '#38b16a', degraded: '#caa930', down: '#df4b45', unknown: '#8f8e90'};
const themeDark = {up: '#57e389', degraded: '#f8e45c', down: '#ff7b63', unknown: '#c0bfbc'};
const themeLight = {up: '#1a7f4b', degraded: '#9c6e03', down: '#c01c28', unknown: '#5e5c64'};
const themeColors = {up: 'success_color', degraded: 'warning_color', down: 'error_color'};

function palette(node, scheme) {
    const theme = scheme === 'theme';
    if (!node)
        return theme ? themeDark : fleetbarDark;
    const foreground = node.get_foreground_color();
    if (foreground.red + foreground.green + foreground.blue > 384)
        return theme ? themeDark : fleetbarDark;
    return theme ? themeLight : fleetbarLight;
}

export function statusColor(node, state, scheme = 'fleetbar') {
    const colors = palette(node, scheme);
    let color = colors[state] ?? colors.unknown;
    const key = themeColors[state];
    if (scheme === 'theme' && node && key) {
        const [found, themeColor] = node.lookup_color(key, true);
        if (found)
            color = themeColor.to_string();
    }
    return color;
}

export function applyStatusColor(node, dot, state, scheme = 'fleetbar') {
    const style = `color: ${statusColor(node, state, scheme)};`;
    if (dot.style !== style)
        dot.set_style(style);
}

export function applyStatusFill(node, segment, state, scheme = 'fleetbar') {
    const style = `background-color: ${statusColor(node, state, scheme)};`;
    if (segment.style !== style)
        segment.set_style(style);
}
