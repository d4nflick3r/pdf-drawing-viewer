import webview
import threading
import http.server
import os
import sys
import socket
import time


def get_base_dir():
    if hasattr(sys, '_MEIPASS'):
        return sys._MEIPASS
    return os.path.dirname(os.path.abspath(__file__))


class SPAHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        self._static_dir = os.path.join(get_base_dir(), 'dist', 'public')
        super().__init__(*args, directory=self._static_dir, **kwargs)

    def do_GET(self):
        path = self.translate_path(self.path)
        if not os.path.exists(path) or os.path.isdir(path):
            self.path = '/index.html'
        return super().do_GET()

    def log_message(self, format, *args):
        pass


def find_free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]


def start_server():
    port = find_free_port()
    server = http.server.HTTPServer(('127.0.0.1', port), SPAHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return port


if __name__ == '__main__':
    port = start_server()
    time.sleep(0.5)

    window = webview.create_window(
        'PDF Drawing Viewer',
        f'http://127.0.0.1:{port}',
        width=1400,
        height=900,
        min_size=(900, 600)
    )
    webview.start()
