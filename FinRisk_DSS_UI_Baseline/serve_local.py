#!/usr/bin/env python3
"""CarbonGraph local-only static server.

Uses Python standard library only. No external packages.
Serves the project directory at http://127.0.0.1:8080 by default.
"""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import argparse
import os


def main():
    parser = argparse.ArgumentParser(description="Run CarbonGraph MVP on localhost")
    parser.add_argument("--port", type=int, default=8080)
    args = parser.parse_args()

    project_dir = Path(__file__).resolve().parent
    os.chdir(project_dir)
    server = ThreadingHTTPServer(("127.0.0.1", args.port), SimpleHTTPRequestHandler)
    print(f"CarbonGraph MVP v0.6.2: http://127.0.0.1:{args.port}")
    print("Press Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping CarbonGraph local server...")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
