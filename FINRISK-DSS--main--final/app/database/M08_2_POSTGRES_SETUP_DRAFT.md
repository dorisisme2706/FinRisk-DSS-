# M08.2 — PostgreSQL setup design (draft only)

## Scope

This document prepares a separate PostgreSQL database for **application-owned workflow records**. It does not create a DB service on the developer's machine, does not connect the current UI/API, and does not replace the CORE4 Parquet snapshot used by H16. M08.2 is design/review; M08.3 applies migrations, installs the adapter, authenticates users and enables persistence.

## Proposed target

- PostgreSQL target: versions 16–18.
- Database: `finrisk_app_db`.
- Schema: `finrisk_app` (not `public`).
- Encoding: UTF8.
- Application DB timezone: store `timestamptz`, write UTC; render local time in UI.
- Python adapter for M08.3: Psycopg 3 binary extra, pinned separately at `psycopg[binary]==3.3.6`.
- Keep `backend_ml/model/requirements-lock.txt` unchanged. Psycopg belongs to the application persistence adapter, not the frozen H16 runtime lock.

Psycopg's official documentation lists Python 3.10–3.15, Windows and PostgreSQL 10–18 support and recommends the binary extra for a self-contained client library. See the project docs in the M08.2 handoff.

## What the developer actually creates

The repository contains a logical schema, a draft DDL file, draft roles/grants and a placeholder connection file. The actual PostgreSQL Server service and database are created on the developer's Windows machine (or a team-managed server) after the design is reviewed. This assistant cannot silently install a service on the user's PC, choose a password, or create a remote DB without explicit access/credentials.

## Proposed local setup after design approval

1. Install PostgreSQL Server 16, 17 or 18 using the official Windows installer. Keep it bound to localhost during development.
2. Open SQL Shell (`psql`) as the PostgreSQL administrative account (a DBA role with `CREATEROLE` and `CREATEDB`).
3. Run `002_create_roles_draft.sql` while connected to maintenance DB `postgres`; it creates only NOLOGIN group roles. From the `app/` directory, the command after PostgreSQL is installed is:
   ```powershell
   psql -h 127.0.0.1 -U postgres -d postgres -v ON_ERROR_STOP=1 -f database\proposals\002_create_roles_draft.sql
   ```
4. Create `finrisk_app_db` with owner `finrisk_owner` and UTF8 encoding. Run `CREATE DATABASE` as a separate psql command (it cannot run inside a transaction):
   ```sql
   CREATE DATABASE finrisk_app_db OWNER finrisk_owner ENCODING 'UTF8' TEMPLATE template0;
   ```
   The `CREATE DATABASE` command is run at the `psql` prompt as the DBA, not inside a SQL file transaction.
5. Provision LOGIN principals separately from NOLOGIN group roles. Example names must match the `.env.example` runtime user:
   ```sql
   CREATE ROLE finrisk_migrator_login LOGIN IN ROLE finrisk_migrator;
   CREATE ROLE finrisk_api_login LOGIN IN ROLE finrisk_app;
   CREATE ROLE finrisk_auditor_login LOGIN IN ROLE finrisk_auditor;
   ```
   Then set each password interactively inside `psql` (do not put passwords in SQL, PowerShell history, `.env.example` or Git):
   ```text
   \password finrisk_migrator_login
   \password finrisk_api_login
   \password finrisk_auditor_login
   ```
   These login roles are examples; provision only the principals the deployment actually needs.
6. Connect to `finrisk_app_db` as `finrisk_migrator_login` and review/apply `001_app_schema_draft.sql` only after M08.2 sign-off. The script uses `SET LOCAL ROLE finrisk_owner`; the migration login must be a member of `finrisk_migrator`, which is granted membership in `finrisk_owner`:
   ```powershell
   psql -h 127.0.0.1 -U finrisk_migrator_login -d finrisk_app_db -v ON_ERROR_STOP=1 -f database\proposals\001_app_schema_draft.sql
   ```
7. Still connected to `finrisk_app_db`, run `003_grants_draft.sql` as the migrator (or DBA) after schema creation. The script starts a transaction and sets `finrisk_owner` before granting:
   ```powershell
   psql -h 127.0.0.1 -U finrisk_migrator_login -d finrisk_app_db -v ON_ERROR_STOP=1 -f database\proposals\003_grants_draft.sql
   ```
8. Keep credentials in an untracked `.env` or, preferably, a Windows protected secret store. `.env.example` contains placeholders only.
9. In M08.3, test connection health, least-privilege access, RLS ownership boundaries, backup/restore and role separation before enabling write APIs.

## Important sequencing note

The role scripts are supplied as proposals for review, not a one-click bootstrapper. `002_create_roles_draft.sql` runs on the maintenance DB, `001_app_schema_draft.sql` runs on the target database under `finrisk_owner`, and `003_grants_draft.sql` runs on the target database after schema creation. Do not execute any proposal until M08.2 schema/security design is signed off. M08.3 will provide tested, ordered, versioned migrations and a runner. The proposed runtime group has column-limited grants: validation and H18 assessment snapshots are insert/read only; report content can only be archived; hypothetical scenarios can only be soft-deleted; application records cannot have owner/creator identity rewritten. The grant script revokes PUBLIC database CONNECT and resets previous broad grants before applying the limited access set.

## No credentials in repository

Never commit `.env`, passwords, OIDC client secrets, API tokens or PII encryption keys. The DB URL is a placeholder only. For networked/production use require TLS with certificate verification (`sslmode=verify-full`), firewall restrictions, managed secret rotation and backups.
