# GNOME Extensions listing

**Name:** Fleetbar

**Summary:** Named, shape-coded status for every project and service, right in the top bar.

**Description:**

Know which component needs attention without opening a dashboard. Fleetbar puts a named, shape-coded glyph for each project in your GNOME top bar - a green circle when healthy, an amber triangle when a service needs attention, a red square when offline, and a ring while unknown or stale - plus a compact service pill that appears only when something is wrong: one segment per service, so the failing component is visible at a glance. Failure labels show how many services are healthy.

Expand a project to inspect each service with its own colored status dot, response times and the last update. Group projects by provider and open websites, local folders or SSH connections from the same menu.

* HTTP health checks with optional JSON response matching
* TCP instance checks and optional local monitor files
* One status segment per service, in the same order in the top bar and in the menu
* Native settings, light/dark themes and English/Spanish translations
* Adjustable polling, timeouts, compact labels, the service status pill, a choice of Fleetbar or theme status colors, and optional notifications
* No telemetry, cloud account or subscription

Requires GNOME 46. SSH shortcuts use GNOME Terminal and OpenSSH. Configure your own projects and endpoints in Settings.

**UUID:** `fleetbar@joseteo.github.com`

**License:** GPL-2.0-or-later

**Homepage / issues:** the public source repository URL is declared in `metadata.json` (`https://github.com/joseteo/fleetbar`), and the repository is public with issues open.

**Screenshots:** use the native captures under `docs/screenshots/`. These show synthetic example projects rather than real infrastructure: the top bar views (`panel-healthy`, `panel-outage`, `panel-unknown`, `panel-compact`), the light and dark menus (`menu-light`, `menu-dark`), and the monitoring preferences in English and Spanish (`monitoring-en`, `monitoring-es`).
