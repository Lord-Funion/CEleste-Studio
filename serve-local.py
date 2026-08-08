#!/usr/bin/env python3
from __future__ import annotations

import os
import socket
import threading
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
HOST = "127.0.0.1"


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-cache, must-revalidate")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()


def choose_port(start: int = 8765) -> int:
    for port in range(start, start + 50):
        with socket.socket() as sock:
            try:
                sock.bind((HOST, port))
            except OSError:
                continue
            return port
    raise RuntimeError("No free local port found")


def main() -> None:
    os.chdir(ROOT)
    port = choose_port()
    url = f"http://{HOST}:{port}/"
    server = ThreadingHTTPServer((HOST, port), NoCacheHandler)
    print(f"CEleste Studio private build: {url}")
    print("Press Ctrl+C to stop. The server is bound to this computer only.")
    threading.Timer(0.35, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
