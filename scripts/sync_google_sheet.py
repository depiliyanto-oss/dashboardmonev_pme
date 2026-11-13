#!/usr/bin/env python3
"""Sinkronkan data dashboard CARE-I dari Google Sheets ke data/monev.json."""

import argparse
import os
import subprocess
import sys
import tempfile
import urllib.request
from datetime import datetime

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_SHEET_ID = "1dmzjHShz84nrRlt5TEk-yakhsZ415rY68tSy7LL65iU"
CACHE = os.path.join(BASE, "data", "source", "google-sheet.xlsx")
EXTRACTOR = os.path.join(BASE, "scripts", "extract_data.py")


def download_sheet(sheet_id, destination):
    url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=xlsx"
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Dashboard-Monev-CAREI/1.0",
            "Accept": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
    )
    os.makedirs(os.path.dirname(destination), exist_ok=True)
    temp_path = destination + ".download"
    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            content = response.read()
        if not content.startswith(b"PK"):
            raise RuntimeError(
                "File yang diunduh bukan XLSX. Pastikan spreadsheet dapat diakses "
                "dengan link (Anyone with the link - Viewer)."
            )
        with open(temp_path, "wb") as handle:
            handle.write(content)
        os.replace(temp_path, destination)
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)
    return len(content)


def main():
    parser = argparse.ArgumentParser(description="Sinkronkan Google Sheets CARE-I ke dashboard.")
    parser.add_argument("--sheet-id", default=DEFAULT_SHEET_ID, help="ID Google Spreadsheet")
    parser.add_argument(
        "--use-cache",
        action="store_true",
        help="Pakai file XLSX hasil unduhan sebelumnya tanpa mengunduh ulang",
    )
    args = parser.parse_args()

    if args.use_cache and os.path.exists(CACHE):
        size = os.path.getsize(CACHE)
        print(f"MENGGUNAKAN CACHE {CACHE} ({size:,} byte)", flush=True)
    else:
        size = download_sheet(args.sheet_id, CACHE)
        print(f"UNDUH OK {CACHE} ({size:,} byte)", flush=True)

    synced_at = datetime.now().strftime("%d %b %Y %H:%M")
    command = [
        sys.executable,
        EXTRACTOR,
        "--source",
        CACHE,
        "--source-label",
        "Google Sheets CARE-I",
        "--synced-at",
        synced_at,
    ]
    print("MENJALANKAN EKSTRAKSI...", flush=True)
    subprocess.run(command, check=True)
    print(f"SELESAI. Data dashboard diperbarui dari Google Sheets pada {synced_at}.", flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"GAGAL: {error}", file=sys.stderr)
        sys.exit(1)
