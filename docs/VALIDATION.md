# Validation, 2026-10-16

Fleetbar 1.2.0 was verified on GNOME Shell 46 / Ubuntu 24.04.

- ESLint 10: passes with no reported errors.
- Pure model tests: ten cases cover top bar presentation, per-service segment states and ordering, typed health expectations, strict response matching, partial/unknown states, confirmation/recovery transitions, expiry and unsafe configuration rejection.
- Real GJS / libsoup / Gio fixtures: shared-endpoint deduplication, unhealthy responses, redirects, oversized responses, TCP, deadlines, stale monitor data and cancellation pass.
- Native Shell harness: shape-coded project glyphs (circle, triangle, square, ring), the per-service pill that hides while healthy and appears with distinct segment colors on failure, matching status dots in the menu, counts, compact mode, light/dark Yaru, the selectable Fleetbar or theme status colors, notifications, tracked signal cleanup, re-enable, concurrent config loading and stale results during busy checks pass.
- Native Libadwaita project and monitoring preferences render, including Spanish text, the optional top bar label, the status color dropdown and the service status switch.
- The migrated private installation is active. All 16 checks across the owner's three projects passed the read-only live audit.
- Runtime ZIP inventory and private-data checks pass. No production configuration, tests, npm dependencies or development scripts are included.

Only GNOME 46 is claimed. The public source/support URL remains unset until supplied by the maintainer. Store acceptance has not been established; code understanding/ownership review and GNOME's submission review remain required. Generic UI captures are in `screenshots/`.
