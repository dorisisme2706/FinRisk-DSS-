"""Out-of-band HMAC key provisioning and rotation for M08.5.4.3.

Usage (from app/):
  python backend_api/provision_assertion_key.py --status
  python backend_api/provision_assertion_key.py --activate
  python backend_api/provision_assertion_key.py --set-status --key-id 1 --status VERIFY_ONLY

Reads FINRISK_MIGRATION_DATABASE_URL and signing key env vars without ever
printing secret key material or storing keys in repository files.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from db import (
        _connect,
        assertion_signing_config,
        migration_database_url,
        validate_local_database_url,
    )
else:
    from .db import (
        _connect,
        assertion_signing_config,
        migration_database_url,
        validate_local_database_url,
    )

VALID_STATUSES = ("ACTIVE", "VERIFY_ONLY", "RETIRED")


class KeyProvisionError(RuntimeError):
    pass


def _require_migration_dsn() -> str:
    dsn = migration_database_url()
    if not dsn:
        raise KeyProvisionError("FINRISK_MIGRATION_DATABASE_URL is not configured.")
    valid, code = validate_local_database_url(dsn)
    if not valid:
        raise KeyProvisionError(f"Refusing database target: {code}.")
    return dsn


def list_key_metadata(*, dsn: str | None = None) -> list[dict]:
    target_dsn = dsn or _require_migration_dsn()
    with _connect(application_name="finrisk-dss-key-status", dsn=target_dsn) as conn:
        with conn.transaction():
            with conn.cursor() as cur:
                cur.execute("SET LOCAL ROLE finrisk_owner")
                cur.execute(
                    "SELECT key_id, octet_length(key_material), key_status, "
                    "created_at::text, rotated_at::text "
                    "FROM finrisk_private.actor_assertion_keys ORDER BY key_id"
                )
                return [
                    {
                        "key_id": int(row[0]),
                        "key_bytes": int(row[1]),
                        "key_status": str(row[2]),
                        "created_at": row[3],
                        "rotated_at": row[4],
                    }
                    for row in cur.fetchall()
                ]


def provision_active_key(
    *,
    key_id: int | None = None,
    key_material: bytes | None = None,
    demote_previous_active_to: str = "VERIFY_ONLY",
    dsn: str | None = None,
) -> dict:
    if demote_previous_active_to not in ("VERIFY_ONLY", "RETIRED"):
        raise KeyProvisionError("Previous active key may only transition to VERIFY_ONLY or RETIRED.")

    if key_id is None or key_material is None:
        config = assertion_signing_config()
        if config is None:
            raise KeyProvisionError(
                "FINRISK_ACTOR_ASSERTION_KEY_ID and FINRISK_ACTOR_ASSERTION_KEY_HEX/B64 are required."
            )
        key_id, key_material = config

    if int(key_id) < 1 or int(key_id) > 32767:
        raise KeyProvisionError("ASSERTION_KEY_ID_INVALID")
    if len(key_material) < 32:
        raise KeyProvisionError("ASSERTION_KEY_TOO_SHORT")

    target_dsn = dsn or _require_migration_dsn()
    with _connect(application_name="finrisk-dss-key-provisioner", dsn=target_dsn) as conn:
        with conn.transaction():
            with conn.cursor() as cur:
                cur.execute("SET LOCAL ROLE finrisk_owner")
                cur.execute(
                    "UPDATE finrisk_private.actor_assertion_keys "
                    "SET key_status = %s, rotated_at = statement_timestamp() "
                    "WHERE key_status = 'ACTIVE' AND key_id <> %s",
                    (demote_previous_active_to, int(key_id)),
                )
                demoted_count = cur.rowcount

                cur.execute(
                    "INSERT INTO finrisk_private.actor_assertion_keys "
                    "(key_id, key_material, key_status, created_at, rotated_at) "
                    "VALUES (%s, %s, 'ACTIVE', statement_timestamp(), NULL) "
                    "ON CONFLICT (key_id) DO UPDATE "
                    "SET key_material = EXCLUDED.key_material, "
                    "    key_status = 'ACTIVE', "
                    "    rotated_at = statement_timestamp()",
                    (int(key_id), key_material),
                )
    return {
        "status": "PROVISIONED",
        "active_key_id": int(key_id),
        "key_bytes": len(key_material),
        "demoted_previous_active_count": int(demoted_count),
        "demoted_to": demote_previous_active_to,
    }


def update_key_status(
    *,
    key_id: int,
    new_status: str,
    dsn: str | None = None,
) -> dict:
    if new_status not in VALID_STATUSES:
        raise KeyProvisionError(f"Invalid key status: {new_status}")
    target_dsn = dsn or _require_migration_dsn()
    with _connect(application_name="finrisk-dss-key-status-update", dsn=target_dsn) as conn:
        with conn.transaction():
            with conn.cursor() as cur:
                cur.execute("SET LOCAL ROLE finrisk_owner")
                cur.execute(
                    "UPDATE finrisk_private.actor_assertion_keys "
                    "SET key_status = %s, rotated_at = statement_timestamp() "
                    "WHERE key_id = %s",
                    (new_status, int(key_id)),
                )
                if cur.rowcount != 1:
                    raise KeyProvisionError(f"Key ID {key_id} does not exist.")
    return {"status": "UPDATED", "key_id": int(key_id), "key_status": new_status}


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="FinRisk M08.5.4.3 actor assertion key provisioner")
    parser.add_argument("--status", action="store_true", help="List provisioned key metadata without key material.")
    parser.add_argument("--activate", action="store_true", help="Provision or rotate the configured active key.")
    parser.add_argument(
        "--demote-previous-to",
        default="VERIFY_ONLY",
        choices=("VERIFY_ONLY", "RETIRED"),
        help="Target status for any existing ACTIVE key when activating a new key.",
    )
    parser.add_argument("--set-status", action="store_true", help="Change status of an existing key_id.")
    parser.add_argument("--key-id", type=int, help="Target key_id for --set-status.")
    parser.add_argument("--new-status", choices=VALID_STATUSES, help="Target status for --set-status.")
    args = parser.parse_args(argv)

    try:
        if args.status:
            rows = list_key_metadata()
            if not rows:
                print("NO_KEYS_PROVISIONED")
            for row in rows:
                print(
                    f"KEY key_id={row['key_id']} status={row['key_status']} "
                    f"bytes={row['key_bytes']} created_at={row['created_at']} rotated_at={row['rotated_at']}"
                )
            return 0
        if args.activate:
            res = provision_active_key(demote_previous_active_to=args.demote_previous_to)
            print(
                f"PROVISIONED active_key_id={res['active_key_id']} bytes={res['key_bytes']} "
                f"demoted_previous={res['demoted_previous_active_count']} ({res['demoted_to']})"
            )
            return 0
        if args.set_status:
            if not args.key_id or not args.new_status:
                raise KeyProvisionError("--set-status requires --key-id and --new-status.")
            res = update_key_status(key_id=args.key_id, new_status=args.new_status)
            print(f"UPDATED key_id={res['key_id']} status={res['key_status']}")
            return 0
        parser.print_help()
        return 1
    except Exception as exc:
        print(f"KEY_PROVISION_FAILED: {type(exc).__name__}: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
