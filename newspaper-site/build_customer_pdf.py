#!/usr/bin/env python3
"""Build Newspaper_Website_Customer_Quote.pdf from customer-quote.html."""
from pathlib import Path
import subprocess
import sys

HERE = Path(__file__).resolve().parent
HTML = HERE / "customer-quote.html"
PDF = HERE / "Newspaper_Website_Customer_Quote.pdf"


def main() -> int:
    if not HTML.exists():
        print(f"Missing {HTML}", file=sys.stderr)
        return 1
    cmd = [
        "google-chrome",
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--no-pdf-header-footer",
        "--allow-file-access-from-files",
        f"--print-to-pdf={PDF}",
        f"file://{HTML}",
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(r.stdout, r.stderr, file=sys.stderr)
        return r.returncode
    print(f"Wrote {PDF} ({PDF.stat().st_size} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
