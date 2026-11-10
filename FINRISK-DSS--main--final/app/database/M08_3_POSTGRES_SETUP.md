# M08.3 — PostgreSQL local setup

> Runbook triển khai đầy đủ cho Windows mới: [FINRISK_M08_3_DEPLOYMENT_GUIDE_VI.md](FINRISK_M08_3_DEPLOYMENT_GUIDE_VI.md). Live reference validation ngày 09/11/2026 được ghi tại `../evidence/m08/M08_3_POSTGRESQL_LIVE_VALIDATION_20261109.md`.

## Runtime target
- PostgreSQL 16–18, loopback only (`127.0.0.1`).
- Database `finrisk_app_db`, schema `finrisk_app`.
- `psycopg[binary]==3.3.6` installed separately from the frozen H16 lock.
- Reference verification: PostgreSQL 17.11 / Windows; migrations 0001 and 0002 APPLIED; HTTP Database Health `DB_CONNECTED`.
- Copy `database/.env.example` to `app/.env`; never commit `app/.env`.

## Roles and database bootstrap
Run `database/proposals/002_create_roles_draft.sql` on maintenance DB `postgres` as a DBA. Create `finrisk_app_db` owned by `finrisk_owner`, then create login principals separately and set passwords interactively. See `FINRISK_M08_3_HANDOFF_20261109.md` for exact commands.

## Migrations
From the `app/` directory:
```powershell
py -3.14 -m pip install -r database\requirements-postgres.txt
Copy-Item database\.env.example .env
py -3.14 backend_api\migrate.py --status
py -3.14 backend_api\migrate.py
```
Only `database/migrations/*.sql` is executable migration input. Files under `database/proposals/` are review/reference artifacts; do not apply proposals 001 or 003 manually.

The runner validates localhost target, PostgreSQL major version 16–18, ordered filenames, SHA-256 checksums and migration history. It acquires a transaction-scoped advisory lock and commits each migration atomically.

## Authentication gate
`current_actor_id()` intentionally returns NULL until a trusted authentication mechanism is approved and integrated. The old caller-settable GUC and caller-parameterized identity resolver are not accepted. Therefore owner-scoped RLS denies access and no application write endpoints are exposed yet. Never set `finrisk.user_id` from HTTP input.

## Health
`GET /api/db/health` reports only sanitized status and does not expose connection details. A reachable DB with schema is reported as ready for connectivity, not proof that all persistence features or auth are ready.
