#!/usr/bin/env bash
set -euo pipefail
PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
cd "$PROJECT_DIR"
npm run lint
npm test
python3 scripts/build-translations.py
glib-compile-schemas --strict schemas
mkdir -p dist
gnome-extensions pack --force --extra-source=lib --extra-source=prefs --extra-source=shell \
    --extra-source=LICENSE --extra-source=PRIVACY.md --podir=po --out-dir=dist "$PROJECT_DIR"
python3 scripts/verify-package.py "dist/fleetbar@joseteo.github.com.shell-extension.zip" "$@"
