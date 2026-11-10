# M08.4 — Metric Glossary (10/11/2026)

## Purpose and non-negotiable boundaries

This glossary defines the first live Dashboard metrics. PostgreSQL is the source for app-owned operational records; CORE4/H16 is a separate, read-only inference/data source. Metrics are scoped to the trusted current actor and remain unavailable until a trusted actor context exists. A missing actor must produce `null` values and `AUTH_CONTEXT_REQUIRED`, never fabricated zeroes or cross-user totals.

The dashboard does not publish approval rate, rejection rate, high-risk population, risk bands, credit eligibility, or loan terms. H18 review signals are support signals only. Business policy remains `NOT_APPROVED`; automatic credit decisions remain disabled. CORE4 test split is excluded from Dashboard statistics.

## PostgreSQL operational metrics

| Metric key | Display label | Source | Definition | Scope / filter | Interpretation |
|---|---|---|---|---|---|
| `applications_total` | Total loan applications | `finrisk_app.loan_applications` | Count rows | Current actor; `deleted_at IS NULL` | Applications, not credit decisions |
| `applications_draft` | Draft applications | `loan_applications` | Count rows where status `DRAFT` | Current actor; not deleted | Workflow state only |
| `applications_submitted` | Submitted applications | `loan_applications` | Count rows where status `SUBMITTED` | Current actor; not deleted | Submission is not approval |
| `validation_runs_total` | Validation runs | `financial_validation_runs` | Count runs | Current actor; `validation_scope='INPUT_QUALITY'` | Technical/input-quality validation only |
| `validation_pass` | Validation PASS | `financial_validation_runs` | Count outcome `PASS` | Current actor; INPUT_QUALITY | Not credit eligibility |
| `validation_warn` | Validation WARN | `financial_validation_runs` | Count outcome `WARN` | Current actor; INPUT_QUALITY | Requires review of input warnings |
| `validation_fail` | Validation FAIL | `financial_validation_runs` | Count outcome `FAIL` | Current actor; INPUT_QUALITY | Input-quality failure only |
| `assessments_total` | H18 assessment runs | `assessment_runs` | Count support-signal snapshots | Current actor; policy status `NOT_APPROVED`; automatic decision false | Not approval/rejection volume |
| `manual_review_recommended` | Manual review signal | `assessment_runs` | Count `MANUAL_REVIEW_RECOMMENDED` | Current actor; H18 support records only | Human-review signal, not rejection |
| `no_review_signal` | No review signal | `assessment_runs` | Count `NO_REVIEW_SIGNAL` | Current actor; H18 support records only | Not approval |
| `active_reports` | Active reports | `report_records` | Count active report rows | Current actor; `record_status='ACTIVE'` | Saved report records, not approved loans |

## Time series and distributions

- `applications_by_status`: group `loan_applications` by `application_status`, within the current actor and excluding soft-deleted rows.
- `monthly_applications`: six calendar months including the current month, grouped by `created_at`, within the current actor and excluding soft-deleted rows.
- No CORE4/H16 score distribution, risk bands, test-split counts, target-based statistics, or approval rates are included in this M08.4 release.

## Source health

| Source | Endpoint source | Fields displayed | Meaning |
|---|---|---|---|
| PostgreSQL | `database_health()` / `/api/db/health` | `status`, sanitized `code`, integration stage | Local application database and migration readiness |
| CORE4/H16 | Initialized `ProfileScorer` / `/api/ml/health` | Ready/unavailable, model/data/feature-set versions, feature count | Canonical read-only source and frozen inference package; no data is copied into PostgreSQL |

## Known current limitation

M08.3 `current_actor_id()` deliberately returns `NULL` until trusted authentication is integrated. Therefore the current Windows reference database must return `AUTH_CONTEXT_REQUIRED` for aggregate metrics. This is expected fail-closed behavior. Dashboard KPI cards display an unavailable marker, while PostgreSQL and CORE4/H16 source health are shown independently.
