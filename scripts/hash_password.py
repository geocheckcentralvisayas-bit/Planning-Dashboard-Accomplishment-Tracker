#!/usr/bin/env python3
r"""Generate a PBKDF2 salt/hash pair for a dashboard account.

Passwords are never stored in plaintext. Each account in `src/lib/auth.ts`
holds a salt, a PBKDF2-SHA256 hash, and the iteration count. This script
produces a matching triple for a new password.

Usage:
    python scripts/hash_password.py "NewPassword@2026"

Then replace the `salt`, `passwordHash`, and `iterations` values for that
account in `src/lib/auth.ts` and rebuild.

To rotate every account, run this once per account and update each entry.
"""

from __future__ import annotations

import argparse
import hashlib
import secrets
import sys

DEFAULT_ITERATIONS = 120_000


def derive(password: str, salt: str, iterations: int) -> str:
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), bytes.fromhex(salt), iterations, dklen=32
    )
    return digest.hex()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("password", help="The new password to hash")
    parser.add_argument(
        "--salt",
        help="Reuse an existing salt (optional; a fresh one is generated otherwise)",
    )
    parser.add_argument(
        "--iterations",
        type=int,
        default=DEFAULT_ITERATIONS,
        help=f"PBKDF2 iterations (default: {DEFAULT_ITERATIONS})",
    )
    args = parser.parse_args()

    if not args.password:
        raise SystemExit("A password is required.")

    salt = args.salt or secrets.token_hex(16)
    if len(salt) != 32:
        raise SystemExit("The salt must be 32 hexadecimal characters.")

    digest = derive(args.password, salt, args.iterations)

    print("Add this to the account in src/lib/auth.ts:\n")
    print(f"    salt: '{salt}',")
    print(f"    passwordHash:")
    print(f"      '{digest}',")
    print(f"    iterations: {args.iterations},")
    print("\nThen run: npm run build")


if __name__ == "__main__":
    main()
