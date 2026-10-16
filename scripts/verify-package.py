"""Validate the runtime-only GNOME submission archive."""
from pathlib import Path
import hashlib
import json
import re
import sys
import zipfile

archive = Path(sys.argv[1])
submission = '--submission' in sys.argv[2:]
required = {'extension.js', 'prefs.js', 'stylesheet.css', 'metadata.json', 'LICENSE', 'PRIVACY.md',
            'schemas/org.gnome.shell.extensions.fleetbar.gschema.xml',
            'locale/es/LC_MESSAGES/fleetbar.mo'}
allowed = re.compile(r'^(extension\.js|prefs\.js|stylesheet\.css|metadata\.json|LICENSE|PRIVACY\.md|'
                     r'(lib|prefs|shell)/[\w-]+\.js|schemas/[\w.-]+\.gschema\.xml|locale/[\w@.-]+/LC_MESSAGES/fleetbar\.mo)$')
private_patterns = [
    r'BEGIN (?:OPENSSH|RSA|EC|PGP) PRIVATE KEY',
    r'/home/[A-Za-z0-9._-]+',
    r'\b(?:\d{1,3}\.){3}\d{1,3}\b',
]
# Workstation-specific identifiers extend the generic patterns without
# entering the repository: one regex per line in the git-ignored
# scripts/private-ids.local.
local_ids = Path(__file__).resolve().parent / 'private-ids.local'
if local_ids.exists():
    private_patterns += [line.strip() for line in local_ids.read_text().splitlines()
                         if line.strip() and not line.startswith('#')]
private = re.compile('|'.join(private_patterns), re.I)
with zipfile.ZipFile(archive) as bundle:
    names = {name for name in bundle.namelist() if not name.endswith('/')}
    assert required <= names, f'Missing runtime files: {required - names}'
    assert all(allowed.match(name) for name in names), f'Unexpected package files: {sorted(name for name in names if not allowed.match(name))}'
    metadata = json.loads(bundle.read('metadata.json'))
    assert metadata['name'] == 'Fleetbar'
    assert metadata['uuid'] == 'fleetbar@joseteo.github.com'
    assert metadata['settings-schema'] == 'org.gnome.shell.extensions.fleetbar'
    assert metadata['gettext-domain'] == 'fleetbar'
    assert metadata['shell-version'] == ['46']
    assert re.fullmatch(r'\d+\.\d+\.\d+', metadata['version-name'])
    assert 'version' not in metadata, 'GNOME assigns the internal version'
    assert 'session-modes' not in metadata, 'Only user mode is required'
    url = metadata.get('url', '')
    if submission:
        assert re.fullmatch(r'https://(?:github\.com|gitlab\.com)/[\w.-]+/[\w.-]+/?', url), 'Set the actual public source/support repository URL before submission'
    for name in names:
        data = bundle.read(name)
        assert not private.search(data.decode('utf-8', errors='ignore')), f'Private infrastructure data in {name}'
        if name.endswith('.js'):
            assert b'SPDX-License-Identifier: GPL-2.0-or-later' in data, f'Missing license marker: {name}'
print(f'PASS: {len(names)} runtime files; no private configuration or development dependencies')
print(f'SHA-256: {hashlib.sha256(archive.read_bytes()).hexdigest()}')
if not metadata.get('url'):
    print('Publication pending: metadata needs the verified public source/support repository URL.')
