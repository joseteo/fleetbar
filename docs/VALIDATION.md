# Validation, 2026-10-16

Fleetbar 1.2.0 was verified on GNOME Shell 46 / Ubuntu 24.04.

- ESLint 10: passes with no reported errors.
- Pure model tests: ten cases cover top bar presentation, per-service dot states and ordering, typed health expectations, strict response matching, partial/unknown states, confirmation/recovery transitions, expiry and unsafe configuration rejection.
- Real GJS / libsoup / Gio fixtures: shared-endpoint deduplication, unhealthy responses, redirects, oversized responses, TCP, deadlines, stale monitor data and cancellation pass.
- Native Shell harness: project dots with a per-service panel dot each, distinct status colors, counts, compact mode, light/dark Yaru, notifications, resource cleanup, re-enable, concurrent config loading and stale results during busy checks pass.
- Native Libadwaita project and monitoring preferences render, including Spanish text, the optional top bar label and the service-dot switch.
- The migrated private installation is active. All 16 checks across the owner's three projects passed the read-only live audit.
- Runtime ZIP inventory and private-data checks pass. No production configuration, tests, npm dependencies or development scripts are included.

Only GNOME 46 is claimed. The public source/support URL remains unset until supplied by the maintainer. Store acceptance has not been established; code understanding/ownership review and GNOME's submission review remain required. Generic UI captures are in `screenshots/`.
