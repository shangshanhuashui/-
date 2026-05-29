#!/usr/bin/env python3
"""
本地静态服务器 - 启用跨域隔离 (Cross-Origin Isolation)
为 FFmpeg.wasm 启用 SharedArrayBuffer 支持。

启动: python3 server.py
访问: http://localhost:8765/index.html
"""
import http.server
import socketserver
import sys

PORT = 8765

class COOPHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # 启用跨域隔离 → 允许 SharedArrayBuffer
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')
        self.send_header('Cross-Origin-Resource-Policy', 'cross-origin')
        # 缓存策略
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

if __name__ == '__main__':
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), COOPHandler) as httpd:
        print(f"✓ Serving at http://localhost:{PORT}")
        print(f"✓ COOP/COEP enabled — SharedArrayBuffer available")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nbye.")
            sys.exit(0)
