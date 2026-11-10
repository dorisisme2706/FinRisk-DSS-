# FinRisk DSS — M08.4 File Changes

**Date:** 10/11/2026  
**Baseline:** `FinRisk_DSS_M08_3_PostgreSQL_LiveVerified_20261109.zip`  
**Increment:** M08.4 — Real Dashboard & Data Management (initial implementation)

This manifest compares this M08.4 source package with the M08.3 LiveVerified source package. The ZIP is a source package, not a Git repository; it contains no `.git` metadata. Use the paths below to review/copy the increment into the official repository in GitHub Desktop.

## Added — 10 files

| # | File | Purpose |
|---:|---|---|
| 1 | `M08_4_FILE_CHANGES_20261110.md` | This file manifest and commit review aid |
| 2 | `app/FINRISK_M08_4_HANDOFF_20261110.md` | Scope, technical design, verification, known limitations and next steps |
| 3 | `app/qa/M08_4_METRIC_GLOSSARY_20261110.md` | Metric definitions, source tables, filters and governance boundaries |
| 4 | `app/qa/M08_4_DASHBOARD_API_CONTRACT_20261110.yaml` | API contract for dashboard summary and data-source health |
| 5 | `app/qa/m08_4_dashboard_audit.py` | Static M08.4 source-boundary audit |
| 6 | `app/tests/finrisk-m08-dashboard.test.js` | UI/dashboard regression tests |
| 7 | `app/evidence/m08/M08_4_PYTHON_TESTS_BUILD_20261110.txt` | Python database/server test evidence from build container |
| 8 | `app/evidence/m08/M08_4_NODE_FULL_REGRESSION_20261110.txt` | Full Node regression result |
| 9 | `app/evidence/m08/M08_4_SOURCE_AUDIT_20261110.txt` | M08.4 static source audit result |
| 10 | `app/evidence/m08/M08_4_FREEZE_VERIFICATION_20261110.txt` | M08 protected-file/model freeze verification |

## Modified — 9 files

| # | File | Change |
|---:|---|---|
| 1 | `M08_START_HERE_VI.md` | Records M08.4 initial implementation and limitations; does not mark stage complete |
| 2 | `app/CHANGELOG.md` | Adds M08.4 implementation entry |
| 3 | `app/backend_api/db.py` | Adds actor-scoped PostgreSQL aggregation; fail-closed when trusted actor is absent |
| 4 | `app/backend_api/server.py` | Adds `GET /api/dashboard/summary` and `GET /api/data/health` |
| 5 | `app/backend_api/test_database.py` | Adds metric aggregation, actor-scope and sanitized-failure tests |
| 6 | `app/backend_api/test_server.py` | Adds dashboard summary/data-health endpoint tests |
| 7 | `app/src/app.js` | Replaces illustrative KPI panel with API-backed dashboard; adds source-health/data catalog view; labels legacy MOCK storage |
| 8 | `app/src/i18n.js` | Adds VI/EN translations for M08.4 dashboard and data-health labels |
| 9 | `app/assets/styles.css` | Adds dashboard charts, KPI/source-health and data-management styles |

## Deleted — 0 files

No files were deleted.

## Important implementation boundaries

- No new PostgreSQL migration; existing M08.3 schema and grants are reused.
- No CRUD/write API and no trusted-authentication mechanism were added.
- Aggregates require `finrisk_app.current_actor_id()` and use owner predicates with RLS active.
- If actor context is NULL, the API returns `AUTH_CONTEXT_REQUIRED` and `null` metric values. The UI renders `—`; it does not show fabricated zeroes or global owner totals.
- CORE4/H16 remains read-only and separate from PostgreSQL operational records.
- Approval/rejection rates, risk bands/high-risk counts and CORE4 test-split statistics are excluded.
- H16/CORE4 model, 169-feature order, threshold, calibration and H18 governance guardrails remain frozen.

## Verification status

| Check | Result |
|---|---:|
| M08.4 source audit | 13/13 PASS |
| Python database tests | 13/13 PASS |
| Python server tests | 21/21 PASS |
| Full Node regression | 129/129 PASS |
| M08 core freeze | 8/8 PASS; 39/39 protected files MATCH |

Python tests above ran in the build container. The build container's scikit-learn 1.8.0 differs from the model lock 1.9.1 and emitted `InconsistentVersionWarning` while the model schema test passed. Run the tests on the target Windows machine using its locked H16 requirements before formal sign-off. The new live HTTP endpoints have not yet been tested against the owner's Windows PostgreSQL instance; that is the next validation step.
