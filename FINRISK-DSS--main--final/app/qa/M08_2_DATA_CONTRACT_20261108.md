# M08.2 — Data Contract & PostgreSQL Logical Design

**Status:** DESIGN PROPOSAL — awaiting user/team review. No PostgreSQL server or live schema has been created/applied.

## 1. Design objectives

1. PostgreSQL stores only records created/managed by the FinRisk application.
2. CORE4 Parquet remains the canonical, read-only inference source for H16/H18.
3. No copy of the 169 predictor matrix, `TARGET`, split manifest, pipeline or model artefacts is written to PostgreSQL.
4. A loan application form is a business intake record, not an H16 feature vector.
5. H18 assessment rows capture the immutable support signal and model/data/policy versions; they do not create an approval/rejection decision.
6. W06 reports are stored only after explicit user save and are validated against the existing 38-field profile allowlist.
7. Every write operation is owner-scoped and emits an append-only audit event in the same transaction.

## 2. System-of-record ownership

| Data domain | System of record | PostgreSQL policy |
|---|---|---|
| CORE4 application/bureau/previous/installment snapshot | CORE4 Parquet snapshot | Read-only external dependency; no automatic replication |
| H16 pipeline, feature order, threshold, calibration | Frozen model package | Never write/update from app DB |
| User-entered loan application | FinRisk application DB | Store only after explicit save/submit; owner scoped |
| Financial input-quality findings | FinRisk application DB | Store validator version, result and codes; not credit policy |
| W04 scenario | FinRisk application DB | Store only if user explicitly saves; always `HYPOTHETICAL` |
| H18 support assessment | FinRisk application DB | Explicitly saved snapshot referencing CORE4 `sk_id_curr`; never a credit decision |
| W06 report | FinRisk application DB | Explicitly saved sanitized report payload and linked assessment |
| Business rules | Rule registry | DRAFT/NOT_APPROVED/RETIRED only; `is_executable=false` |
| Audit events | FinRisk application DB | Append-only; no secrets or raw sensitive payloads |

## 3. Application form #09 contract mapping

The browser MOCK form currently contains nine input fields. The proposed database contract maps them as follows; this is **not** a mapping into H16 predictors.

| Current UI field | Proposed DB field | Type | Rule / note |
|---|---|---|---|
| `customer_id` | `applicant_reference` | varchar(30) | Application-side reference; explicitly not CORE4 `sk_id_curr` |
| `full_name` | `applicant_name_ciphertext` + `pii_key_version` | bytea + varchar | Application-layer AES-256-GCM authenticated encryption (`AES_GCM_V1`); proposed envelope is 12-byte nonce + ciphertext + 16-byte tag; plaintext is never stored. Key remains external and key management must be approved before M08.3 |
| `age` | `applicant_age_years` | smallint | Data attribute only; not an H16 feature mapping |
| `monthly_income` | `monthly_income_amount` | numeric(18,2) | UI labels this VND; allow NULL until supplied |
| `monthly_expenses` | `monthly_expenses_amount` | numeric(18,2) | UI labels this VND; allow NULL until supplied |
| `existing_monthly_debt` | `existing_monthly_debt_amount` | numeric(18,2) | UI labels this VND; does not validate affordability |
| `loan_amount` | `requested_amount` | numeric(18,2) | User-requested amount; not approved limit |
| `loan_term_months` | `requested_term_months` | smallint | User-requested term; not approved tenor |
| `loan_purpose` | `loan_purpose_code` | varchar(24) | `personal/business/education/housing/other` |

The audit found zero direct field-name overlap between the nine form inputs and the 169 H16 feature names. Do not infer feature construction, data joins, imputation or H16 prediction from this application form.

## 4. Logical ERD

See `M08_2_ERD_20261108.md`. The draft physical SQL is in `database/proposals/001_app_schema_draft.sql`.

## 5. Identity and ownership

- `app_users` maps an external verified identity (`identity_provider`, `identity_subject`) to an internal UUID. No password, email, phone or access token is stored in this table. Runtime identity resolution is through a narrow SECURITY DEFINER function; the runtime role has no direct SELECT on this table.
- Roles are `VIEWER`, `LOAN_OFFICER`, `REVIEWER`, `AUDITOR`, `ADMIN`, `QA`.
- The API derives `owner_user_id`, `created_by`, `updated_by` and other actor fields from a verified session/token. It must never accept an owner ID or actor ID from the request body as authority. The draft SQL constrains inserted actor fields to the transaction-local verified actor context.
- `finrisk.user_id` is a transaction-local DB context used by row-level security (RLS). The API may set it only after verifying the principal. A custom GUC/RLS policy is defense-in-depth, not a substitute for authentication.
- M08.3 must implement/choose authentication before opening write APIs. Until then, the existing local UI/API remains read-only for CORE4/H18.

## 6. H18 assessment record contract

An `assessment_runs` record is created only after successful W02 profile access and H18 response validation for the exact same `sk_id_curr`. It records:
- CORE4 `sk_id_curr` as an external identifier (no FK to a copied CORE4 table).
- data version, feature-set version, fixed feature count 169.
- model version/hash, threshold policy version/value.
- risk score and one of the two H18 support signals.
- `business_policy_status=NOT_APPROVED` and `automatic_credit_decision=false`.
- response contract version and a sanitized explanation snapshot (top-10 only if it conforms to the approved allowlist).

The schema intentionally contains no fields for an approval/rejection result, approved amount, interest rate, term, or monthly payment.

## 7. W06 report storage contract

- A user explicitly chooses Save; generation/preview alone must not write a report.
- A report links to one persisted `assessment_runs` record.
- The saved payload is a sanitized snapshot from the W02 allowlist and validated H18 response. The JSON forbidden-key check is case-insensitive and recursive. Reject forbidden exact keys including `target`, `code_gender`, `days_birth`, `full_name`, `email`, `phone`, `address`, credentials and secrets.
- The payload checksum is recorded for integrity.
- Archive/soft-delete only; no hard-delete permission for the normal app role.

## 8. Migration and versioning

- Draft SQL is in `database/proposals/`; it is not an active migration and must not be applied before sign-off.
- M08.3 will move approved SQL into `database/migrations/NNN_*.sql`, record checksum/version in `schema_migrations`, and refuse to rerun an applied migration with a different checksum.
- Additive migrations preferred; destructive changes require backup, explicit data migration and rollback/forward-fix plan.
- `row_version` on `loan_applications` supports optimistic concurrency. API updates must use `If-Match`/version matching.

## 9. Invariants

- CORE4 is never written by the application DB.
- Test-split profile IDs must be blocked by the existing W02/H18 server path before saving an assessment/report.
- No H16 raw 169-vector or TARGET column/table.
- `business_rule_registry.is_executable` is constrained FALSE in this proposal.
- H18 `NOT_APPROVED`; no automatic approval/rejection or loan terms.
- W04 scenarios remain `HYPOTHETICAL` and independent of H16 risk score.
