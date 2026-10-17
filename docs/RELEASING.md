# Releasing Fleetbar

The submission archive is prepared locally. Nothing is uploaded to extensions.gnome.org automatically.

## Identity and scope

- Name: Fleetbar
- UUID: `fleetbar@joseteo.github.com`
- GSettings: `org.gnome.shell.extensions.fleetbar`
- Gettext domain: `fleetbar`
- Human version: `metadata.json` → `version-name`
- Supported Shell: 46 only, based on local testing
- License: GPL-2.0-or-later

Do not change the UUID after publishing. Do not add Shell versions without testing them. The store assigns the internal `version` field, so the source metadata omits it.

## Validation

1. Run `npm ci`, `npm run lint`, `npm test`, and `python3 tests/checker_integration.py`.
2. Compile translations and schemas. Run the Shell and preferences smoke tests in an isolated GNOME 46 session.
3. Inspect healthy, degraded, offline, unknown, empty and malformed-configuration states. Check long names, compact labels, theme changes and text scaling.
4. Verify disable/re-enable and cancellation with checks in flight. Extension-owned timers, signals, file monitors, requests, notification sources and actors must be released.
5. Run `./scripts/package.sh`. Review its ZIP inventory. It must contain only runtime GJS, schema XML, styles, translations and license/privacy material. The verifier rejects private-key blocks, home paths, IP addresses and any identifiers listed in the git-ignored `scripts/private-ids.local`.
6. Run the Shexli analyzer from the upload page (`pip install shexli`) on the ZIP; it reports packaging and review-guideline findings early. If a fresh install crashes in tree-sitter 0.26, installing `tree-sitter==0.23.2` and `tree-sitter-javascript==0.23.1` over it is a working combination.
7. Review the code and the current [GNOME review guidelines](https://gjs.guide/extensions/review-guidelines/review-guidelines.html), especially the authorship/code-understanding policy. The account owner must understand and be able to explain the implementation. Automated checks do not establish store acceptance.

## Before submitting

The `url` field in metadata declares the repository where people can read the source and report issues. It must be publicly readable when reviewers inspect the submission; the verifier can run with `--submission` to require the field.

Inspect the generic native screenshots under `docs/screenshots/`, update listing copy in `STORE_LISTING.md`, and choose the screenshot for the GNOME listing. Confirm the maintainer account and publisher rights.

Upload the verified ZIP through the GNOME Extensions website when the owner is ready. Review and approval belong to the GNOME extension reviewers; this project does not claim to be approved or published.

## Private installation migration

`scripts/migrate-settings.js` copies the earlier `gnome-servers` configuration into the private Fleetbar configuration if the new file does not exist. It retains the earlier file and imports explicitly changed monitoring preferences. It is development/migration tooling and is excluded from the store ZIP. Disable the old `servers@joseteo.github.com` extension before activating Fleetbar to avoid duplicate indicators.
