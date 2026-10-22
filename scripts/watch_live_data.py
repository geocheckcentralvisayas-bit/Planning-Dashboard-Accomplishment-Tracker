#!/usr/bin/env python3
r"""Watch the shared workbook and keep the dashboard snapshot live.

The workbook lives in OneDrive, so when a unit updates the workbook the file's
timestamp changes on this machine. This watcher polls for that change and
re-runs the snapshot build, which means the browser picks up the new numbers on
its next reload without anyone touching the dashboard.

Usage:
    python scripts/watch_live_data.py
    python scripts/watch_live_data.py --interval 30

The browser fetches `public/live-data.json` with a cache-busting query string,
so a refresh always reads the newest snapshot.
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from sync_live_data import DEFAULT_OUTPUT, build_payload, find_source  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--interval",
        type=int,
        default=20,
        help="Seconds between checks (default: 20)",
    )
    parser.add_argument("--source", help="Path to the live .xlsx workbook")
    parser.add_argument(
        "--out",
        default=str(DEFAULT_OUTPUT),
        help=f"Output JSON path (default: {DEFAULT_OUTPUT})",
    )
    args = parser.parse_args()

    source = find_source(args.source)
    output = Path(args.out)
    print(f"Watching {source}")
    print(f"Writing {output}")
    print("Press Ctrl+C to stop.\n")

    last_mtime = source.stat().st_mtime
    rebuilt = False

    try:
        while True:
            time.sleep(args.interval)
            current = source.stat().st_mtime
            if current == last_mtime:
                continue

            last_mtime = current
            print(f"[{time.strftime('%H:%M:%S')}] Workbook changed — rebuilding…")
            try:
                payload = build_payload(source)
                output.parent.mkdir(parents=True, exist_ok=True)
                output.write_text(
                    __import__("json").dumps(
                        payload, ensure_ascii=False, indent=2
                    ),
                    encoding="utf-8",
                )
                meta = payload["meta"]
                print(
                    f"  {meta['recordCount']} indicators, "
                    f"{meta.get('projectCount', 0)} activities, "
                    f"reporting through {meta['reportingLabel']}"
                )
            except Exception as exc:  # noqa: BLE001 - keep watching
                print(f"  Rebuild failed: {exc}")
            else:
                rebuilt = True
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
