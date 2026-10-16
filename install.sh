#!/usr/bin/env bash
set -euo pipefail
SOURCE_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
UUID="fleetbar@joseteo.github.com"
DEST_DIR="${HOME}/.local/share/gnome-shell/extensions/${UUID}"
if [[ -L "$DEST_DIR" ]]; then
    echo "Refusing to replace a symlink: $DEST_DIR" >&2
    exit 1
fi
if [[ "$SOURCE_DIR" == "$DEST_DIR" ]]; then
    echo 'Run install.sh from the source checkout.' >&2
    exit 1
fi
mkdir -p "$DEST_DIR/lib" "$DEST_DIR/schemas" "$DEST_DIR/prefs" "$DEST_DIR/shell"
install -m 644 "$SOURCE_DIR/metadata.json" "$SOURCE_DIR/extension.js" "$SOURCE_DIR/prefs.js" "$SOURCE_DIR/stylesheet.css" "$DEST_DIR/"
install -m 644 "$SOURCE_DIR"/lib/*.js "$DEST_DIR/lib/"
install -m 644 "$SOURCE_DIR"/prefs/*.js "$DEST_DIR/prefs/"
install -m 644 "$SOURCE_DIR"/shell/*.js "$DEST_DIR/shell/"
install -m 644 "$SOURCE_DIR/LICENSE" "$DEST_DIR/"
install -m 644 "$SOURCE_DIR"/schemas/*.xml "$DEST_DIR/schemas/"
glib-compile-schemas --strict "$DEST_DIR/schemas"
if command -v msgfmt >/dev/null; then
    for PO_FILE in "$SOURCE_DIR"/po/*.po; do
        LOCALE_NAME="$(basename "$PO_FILE" .po)"
        mkdir -p "$DEST_DIR/locale/$LOCALE_NAME/LC_MESSAGES"
        msgfmt --check -o "$DEST_DIR/locale/$LOCALE_NAME/LC_MESSAGES/fleetbar.mo" "$PO_FILE"
    done
fi
if [[ $# -gt 0 ]]; then
    # Validate before replacing the private, user-owned project configuration.
    gjs -m "$SOURCE_DIR/scripts/import-config.js" "$1"
fi
# GNOME 46 discovers new extensions at startup. Enable it for the next reload
# even if the current Shell has not discovered the UUID yet.
gjs -c 'const Gio = imports.gi.Gio; const s = new Gio.Settings({schema_id: "org.gnome.shell"}); const id = "fleetbar@joseteo.github.com"; const e = s.get_strv("enabled-extensions"); if (!e.includes(id)) s.set_strv("enabled-extensions", [...e, id]); const d = s.get_strv("disabled-extensions"); if (d.includes(id)) s.set_strv("disabled-extensions", d.filter(v => v !== id)); Gio.Settings.sync();'
echo "Installed $UUID"
echo 'If the panel icon is not visible yet: on X11, Alt+F2, r, Enter. On Wayland, log out and back in.'
