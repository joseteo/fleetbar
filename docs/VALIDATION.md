# Validation, 2026-10-17

Fleetbar 1.2.0 was verified on GNOME Shell 46 / Ubuntu 24.04.

- ESLint 10: passes with no reported errors.
- Pure model tests: ten cases cover top bar presentation, per-service segment states and ordering, typed health expectations, strict response matching, partial/unknown states, confirmation/recovery transitions, expiry and unsafe configuration rejection.
- Real GJS / libsoup / Gio fixtures: shared-endpoint deduplication, unhealthy responses, redirects, oversized responses, TCP, deadlines, stale monitor data and cancellation pass.
- Native Shell harness: shape-coded project glyphs (circle, triangle, square, ring), the per-service pill that hides while healthy and appears with distinct segment colors on failure, matching status dots in the menu, counts, compact mode, light/dark Yaru, the selectable Fleetbar or theme status colors, notifications, tracked signal cleanup, re-enable, concurrent config loading and stale results during busy checks pass.
- Native Libadwaita project and monitoring preferences render, including Spanish text, the optional top bar label, the status color dropdown and the service status switch.
- A read-only live audit against a real private installation passed.
- Runtime ZIP inventory and private-data checks pass. No production configuration, tests, npm dependencies or development scripts are included.
- Shexli 0.2.1, the analyzer the upload page suggests, reports no findings on the built ZIP. Shell-reachable code contains no synchronous file IO; blocking configuration access lives in a preferences-only module.

Only GNOME 46 is claimed. The public source URL is declared in `metadata.json` and must be publicly readable when reviewers inspect the submission. Store acceptance has not been established; code understanding/ownership review and GNOME's submission review remain required. Generic UI captures are in `screenshots/`.
