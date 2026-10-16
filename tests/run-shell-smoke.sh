#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
TEST_DIR=/tmp/fleetbar-shell-test
mkdir -p "$TEST_DIR/data/gnome-shell/extensions/fleetbar@joseteo.github.com" "$TEST_DIR/data/gnome-shell/extensions/fleetbar-test@local" "$TEST_DIR/config/fleetbar" "$TEST_DIR/run"
chmod 700 "$TEST_DIR/run"
printenv DBUS_SESSION_BUS_ADDRESS > "$TEST_DIR/bus-address"
printf '%s\n' "$$" > "$TEST_DIR/shell.pid"
cp "$ROOT_DIR/"{metadata.json,extension.js,prefs.js,stylesheet.css} "$TEST_DIR/data/gnome-shell/extensions/fleetbar@joseteo.github.com/"
cp -r "$ROOT_DIR/lib" "$ROOT_DIR/prefs" "$ROOT_DIR/shell" "$ROOT_DIR/schemas" "$ROOT_DIR/locale" "$TEST_DIR/data/gnome-shell/extensions/fleetbar@joseteo.github.com/"
cp "$ROOT_DIR/tests/fixtures/projects.json" "$TEST_DIR/config/fleetbar/projects.json"
cp "$ROOT_DIR/tests/shell-smoke.js" "$TEST_DIR/data/gnome-shell/extensions/fleetbar-test@local/extension.js"
cat > "$TEST_DIR/data/gnome-shell/extensions/fleetbar-test@local/metadata.json" <<'JSON'
{"uuid":"fleetbar-test@local","name":"Fleetbar test harness","description":"Isolated test only","shell-version":["46"]}
JSON
gsettings set org.gnome.shell enabled-extensions "['fleetbar@joseteo.github.com', 'fleetbar-test@local']"
gsettings set org.gnome.shell disable-user-extensions false
gsettings set org.gnome.desktop.interface color-scheme 'prefer-dark'
gsettings set org.gnome.desktop.interface gtk-theme 'Yaru-blue-dark'
gsettings set org.gnome.shell welcome-dialog-last-shown-version '46'
exec gnome-shell --wayland --headless --virtual-monitor 1280x1000 --no-x11
