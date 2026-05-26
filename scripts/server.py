#!/usr/bin/env python3
import argparse
import http.server
import os
from socketserver import ThreadingMixIn
import mimetypes


class ThreadingHTTPServer(ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True


class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def guess_type(self, path):
        base, ext = os.path.splitext(path)
        if not ext:
            return "text/html"
        return mimetypes.types_map.get(ext.lower(), "application/octet-stream")


def main():
    parser = argparse.ArgumentParser(
        description="Servidor HTTP local para site clonado (Next.js/SPA)."
    )
    parser.add_argument(
        "--dir",
        default="./site-clonado",
        help="Diretório raiz a ser servido (default: ./site-clonado)",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=8000,
        help="Porta HTTP (default: 8000)",
    )

    args = parser.parse_args()

    web_dir = os.path.abspath(args.dir)
    os.chdir(web_dir)

    server_address = ("", args.port)
    httpd = ThreadingHTTPServer(server_address, CustomHandler)

    print(f"[server] Servindo {web_dir} em http://localhost:{args.port}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[server] Encerrando...")
    finally:
        httpd.server_close()


if __name__ == "__main__":
    main()
