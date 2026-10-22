#!/usr/bin/env python3
r"""Pull the accomplishment workbook from SharePoint and rebuild the snapshot.

This makes the deployed dashboard live against the shared file rather than a
local OneDrive copy. It uses the Microsoft Graph API with an app registration
(client credentials), so no interactive sign-in is needed on the server.

One-time setup (Azure portal -> Entra ID -> App registrations -> New registration):
  1. Create an app registration in the EMB tenant.
  2. Add an application permission: Files.Read.All (or Sites.Read.All) and
     grant admin consent.
  3. Add a client secret and copy the tenant id, client id, and secret.
  4. Put them in the environment (or a .env file next to this script):

     EMB_TENANT_ID   = 00000000-0000-0000-0000-000000000000
     EMB_CLIENT_ID   = 00000000-0000-0000-0000-000000000000
     EMB_CLIENT_SECRET = <secret>
     EMB_SITE        = r7planning_emb_gov_ph
     EMB_DRIVE       = personal
     EMB_FILE_NAME   = EMB 7 Accomplishment 2026 - ALL SECTIONS.xlsx

Usage:
    python scripts/graph_live_data.py
    python scripts/graph_live_data.py --once      # single pull, then exit
    python scripts/graph_live_data.py --interval 300

The file id can be taken straight from the share link:
    https://embco-my.sharepoint.com/:x:/g/personal/<site>/<item-id>?e=<token>
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from sync_live_data import DEFAULT_OUTPUT, build_payload  # noqa: E402

GRAPH = "https://graph.microsoft.com/v1.0"


def load_env_file() -> None:
    """Read a local .env file without requiring python-dotenv."""
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if not env_path.is_file():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip("'\""))


def get_token(tenant: str, client_id: str, client_secret: str) -> str:
    body = urllib.parse.urlencode(
        {
            "client_id": client_id,
            "client_secret": client_secret,
            "scope": "https://graph.microsoft.com/.default",
            "grant_type": "client_credentials",
        }
    ).encode()
    request = urllib.request.Request(
        f"https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token",
        data=body,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        payload = json.load(response)
    return payload["access_token"]


def graph_get(url: str, token: str) -> dict:
    request = urllib.request.Request(
        url, headers={"Authorization": f"Bearer {token}"}
    )
    with urllib.request.urlopen(request, timeout=120) as response:
        return json.load(response)


def download_workbook(token: str, site: str, drive: str, file_id: str) -> bytes:
    """Download the workbook bytes from the shared drive."""
    if drive == "personal":
        url = f"{GRAPH}/drives/{site}/items/{file_id}/content"
    else:
        url = (
            f"{GRAPH}/sites/{site}/drives/{drive}/items/{file_id}/content"
        )
    request = urllib.request.Request(
        url, headers={"Authorization": f"Bearer {token}"}
    )
    with urllib.request.urlopen(request, timeout=300) as response:
        return response.read()


def rebuild(workbook_bytes: bytes, output: Path, work_dir: Path) -> dict:
    """Parse the downloaded workbook and write the JSON snapshot."""
    import tempfile

    with tempfile.NamedTemporaryFile(
        suffix=".xlsx", delete=False, dir=str(work_dir)
    ) as handle:
        handle.write(workbook_bytes)
        temp_path = Path(handle.name)

    try:
        payload = build_payload(temp_path)
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        return payload
    finally:
        temp_path.unlink(missing_ok=True)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--once", action="store_true", help="Pull once and exit")
    parser.add_argument(
        "--interval", type=int, default=300, help="Seconds between pulls"
    )
    parser.add_argument(
        "--file-id",
        help="SharePoint item id (default: taken from EMB_FILE_ID)",
    )
    parser.add_argument(
        "--out", default=str(DEFAULT_OUTPUT), help="Output JSON path"
    )
    args = parser.parse_args()

    load_env_file()

    tenant = os.environ.get("EMB_TENANT_ID", "")
    client_id = os.environ.get("EMB_CLIENT_ID", "")
    client_secret = os.environ.get("EMB_CLIENT_SECRET", "")
    site = os.environ.get("EMB_SITE", "")
    drive = os.environ.get("EMB_DRIVE", "personal")
    file_id = args.file_id or os.environ.get("EMB_FILE_ID", "")

    missing = [
        name
        for name, value in (
            ("EMB_TENANT_ID", tenant),
            ("EMB_CLIENT_ID", client_id),
            ("EMB_CLIENT_SECRET", client_secret),
            ("EMB_SITE", site),
            ("EMB_FILE_ID", file_id),
        )
        if not value
    ]
    if missing:
        raise SystemExit(
            "Missing configuration: "
            + ", ".join(missing)
            + "\nSee the setup notes at the top of this script."
        )

    output = Path(args.out)
    work_dir = output.parent

    def pull() -> None:
        token = get_token(tenant, client_id, client_secret)
        data = download_workbook(token, site, drive, file_id)
        payload = rebuild(data, output, work_dir)
        meta = payload["meta"]
        print(
            f"[{time.strftime('%H:%M:%S')}] {meta['recordCount']} indicators, "
            f"{meta.get('projectCount', 0)} activities, "
            f"reporting through {meta['reportingLabel']}"
        )

    if args.once:
        pull()
        return

    print(f"Pulling every {args.interval}s from {site}. Ctrl+C to stop.\n")
    try:
        while True:
            try:
                pull()
            except (urllib.error.URLError, OSError) as exc:
                print(f"  Pull failed: {exc}")
            time.sleep(args.interval)
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
