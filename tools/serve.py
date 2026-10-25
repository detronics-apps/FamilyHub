"""Local dev server that tells the browser never to cache, so a reload always
runs the code on disk (a stale module cache otherwise hides fixes).

    python tools/serve.py [port]
"""
import http.server
import sys


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8851
    http.server.ThreadingHTTPServer(('', port), NoCache).serve_forever()
