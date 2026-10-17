# Agent guidelines

## This repository is public

Fleetbar is published at github.com/joseteo/fleetbar and submitted to extensions.gnome.org.
Personal data must never reach it: real hosts, IPs, SSH targets, monitor paths, project
names, configuration files or maintainer-specific notes. Examples, fixtures and
screenshots use synthetic projects only (Web, Workspace and Home Lab in
`tests/fixtures/projects.json`).

Rules for every change:

- Before any push, run `bash scripts/audit-public.sh` and fix every finding. It scans the
  working tree, the full history and the commit messages. Keep `scripts/private-ids.local`
  (git-ignored) current with the maintainer's private identifiers.
- Write docs for strangers: no "owner's ..." notes, no private prototype names, no
  migration stories from the maintainer's machine.
- Screenshots must come from the isolated smoke harnesses with fixtures, never from the
  live desktop session, and each new image gets looked at before it is committed.
  `docs/images/` holds design renders; never present them as captures.
- Artifacts are the reviewed material: `npm run package -- --submission` must pass its
  verifier (and Shexli for the store) before upload.
- Do not publish design explorations, plans or internal process documents without an
  explicit OK from the maintainer.
- If something leaked anyway: stop pushing, fix the tree, rebuild the artifact, then scrub
  the history and request a GitHub Support GC. The full protocol is in the
  `publicacion-segura` skill; the release checklist in `docs/RELEASING.md` also applies.
