# M08.2 — Access, retention, backup and privacy decisions

## 1. Application-role matrix (proposal)

| Action | VIEWER | LOAN_OFFICER | REVIEWER | AUDITOR | ADMIN | QA |
|---|---:|---:|---:|---:|---:|---:|
| Read own/authorized applications | Yes | Yes | Assigned scope only | No raw PII | Admin metadata only | Test fixtures only |
| Create/update application | No | Yes | No | No | No by default | No production data |
| Run input-quality validation | No | Yes | Review only | Read metadata | No | Test fixtures |
| Save hypothetical W04 scenario | No | Yes | No | No | No | Test fixtures |
| Request H18 assessment | No | Yes | Read/review | Read audit metadata | No | Test fixtures only |
| Save/export report | Read permitted | Yes | Assigned scope | Metadata only | No by default | Test fixtures only |
| Assign roles | No | No | No | No | Yes, audited | No |
| Edit business-rule registry | No | No | Draft/review only | Read | Governance administrator | No |
| Execute credit policy | **No role** | **No role** | **No role** | **No role** | **No role** | **No role** |

The current app has no authentication. These are target roles for M08.3; they are not active permissions today. LOGIN principals are separate from NOLOGIN group roles (for example `finrisk_api_login` IN ROLE `finrisk_app`). Before shared/multi-user DB writes, M08.3 must provide verified authentication, authorization and owner-scoped API tests.

## 2. PostgreSQL database roles (technical principals)

- `finrisk_owner`: NOLOGIN owner of schema/tables/functions.
- `finrisk_migrator`: NOLOGIN group allowed to SET ROLE `finrisk_owner`; only a separately provisioned migration login uses it.
- `finrisk_app`: NOLOGIN runtime group. No DDL, no TRUNCATE, no hard DELETE, no update/delete of audit events. Validation runs/findings and H18 assessment snapshots are INSERT/SELECT only; loan applications have a restricted update-column list; scenarios can only be soft-deleted; reports can only be archived.
- `finrisk_auditor`: read-only, limited to assessment/audit data; report payload is not granted by default.
- `finrisk_readonly`: restricted lookup of role/rule catalogue only.

A DBA separately provisions per-person LOGIN principals and passwords interactively. Never place passwords in SQL or Git.

## 3. Row-level security

Security errata M08.3: `current_actor_id()` intentionally returns NULL until a trusted authentication adapter is integrated. Do not restore caller-settable `finrisk.user_id`, and do not expose a resolver that accepts arbitrary provider/subject claims. Owner-scoped RLS therefore denies access until verified actor context is implemented. RLS remains defense in depth, not a substitute for authentication, input validation, parameterized SQL or network controls.

## 4. Data classification and protection

| Classification | Examples | Required treatment |
|---|---|---|
| Public | schema version, generic status, static help text | No secrets |
| Internal | application IDs, status codes, rule codes | Authenticated access, audit changes |
| Sensitive financial | income, expenses, debt, requested amount, assessment/report snapshot | Owner/role scope, minimum retention, backup access control |
| Direct identifier | applicant name | Proposed application-layer AES-256-GCM envelope (12-byte nonce + ciphertext + 16-byte tag); only ciphertext in DB; key outside DB/source; key lifecycle and rotation require owner approval |
| Prohibited in app DB | H16 raw 169-row vectors, TARGET, test split manifest, model binary, passwords/tokens | Must not be persisted |

TLS: for remote DB require `sslmode=verify-full` and trusted CA. For local-only development `sslmode=prefer` may be used; bind PostgreSQL to localhost/firewall. Store secrets in a Windows protected secret store; `.env` is a development fallback and must be untracked.

## 5. Retention decisions

No statutory or organizational retention period was supplied in M08.1. Therefore:
- Do not invent a 90-day/1-year/5-year retention policy.
- Add `deleted_at`/ARCHIVED soft state, but do not auto purge records.
- Before M08.3 production-like use, project owner must approve retention by record class (applications, assessments, reports, audit events), legal basis, deletion/export process and backup expiry.
- W06 browser-local history remains separate during transition; no silent automatic import.

## 6. Backup and restore

Proposed minimum operational procedure (retention values pending owner approval):
- Use PostgreSQL `pg_dump -Fc` for a logical backup of the application database.
- Protect backup files with access controls and encryption at rest.
- Test restore into a separate database before each release milestone.
- Keep backup/restore logs and verify migration version/checksum after restore.
- Define RPO/RTO and backup frequency with the project owner; not inferred in this design.
- Do not back up the CORE4 snapshot from the application DB job; it has its own approved source/snapshot process.
