# GNOME Extensions listing

**Name:** Fleetbar

**Summary:** Named status dots for every project and service, right in the top bar.

**Description:**

Know which component needs attention without opening a dashboard. Fleetbar puts a named, colored status dot for each project in your GNOME top bar, followed by one smaller dot per service, so the failing component is visible at a glance. Green means healthy, amber means a partial failure, red means offline, and gray means unknown or stale. Failure labels show how many services are healthy.

Expand a project to inspect individual service checks, response times and the last update. Group projects by provider and open websites, local folders or SSH connections from the same menu.

* HTTP health checks with optional JSON response matching
* TCP instance checks and optional local monitor files
* One status dot per service, in the same order as the menu
* Native settings, light/dark themes and English/Spanish translations
* Adjustable polling, timeouts, compact labels, service dots and optional notifications
* No telemetry, cloud account or subscription

Requires GNOME 46. SSH shortcuts use GNOME Terminal and OpenSSH. Configure your own projects and endpoints in Settings.

**UUID:** `fleetbar@joseteo.github.com`

**License:** GPL-2.0-or-later

**Homepage / issues:** set the verified public source repository URL in `metadata.json` before publishing.

**Screenshots:** use the native captures under `docs/screenshots/`. These show synthetic example projects rather than the owner's configured infrastructure. Include both light and dark menu captures and the top bar outage view.
