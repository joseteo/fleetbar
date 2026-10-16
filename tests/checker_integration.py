"""Run the real GJS/Soup/Gio checker against disposable local fixtures."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json
import os
import subprocess
import tempfile
import threading
import time

counts = {}

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_args):
        pass

    def do_GET(self):
        counts[self.path] = counts.get(self.path, 0) + 1
        if self.path == '/slow':
            time.sleep(4)
        status = 503 if self.path == '/failed' else 302 if self.path == '/redirect' else 200
        self.send_response(status)
        if status == 302:
            self.send_header('Location', '/ok')
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        try:
            body = b'x' * 300000 if self.path == '/large' else json.dumps({'status': 'degraded' if self.path == '/degraded' else 'ok', 'db': True}).encode()
            self.wfile.write(body)
        except BrokenPipeError:
            pass

server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
threading.Thread(target=server.serve_forever, daemon=True).start()
with tempfile.TemporaryDirectory(prefix='fleetbar-checker-') as directory:
    fresh = Path(directory, 'fresh.json')
    fresh.write_text(json.dumps({'services': {'worker': {'status': 'up', 'failures': 0}}}))
    stale = Path(directory, 'stale.json')
    stale.write_text(fresh.read_text())
    os.utime(stale, (time.time() - 300,) * 2)
    env = {**os.environ, 'TEST_PORT': str(server.server_port), 'TEST_STATE_DIR': directory}
    result = subprocess.run(['gjs', '-m', str(Path(__file__).with_name('checker-integration.js'))], env=env, capture_output=True, text=True, timeout=25)
    print(result.stdout, end='')
    print(result.stderr, end='')
    assert result.returncode == 0, result.returncode
    assert counts.get('/ok') == 2, counts  # Two cycles, one shared HTTP request per cycle.
server.shutdown()
print('PASS: shared endpoints, health semantics, redirects, response size limit, TCP, timeout, stale monitor and cancellation')
