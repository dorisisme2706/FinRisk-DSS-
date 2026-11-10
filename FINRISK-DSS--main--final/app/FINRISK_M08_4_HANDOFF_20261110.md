# FinRisk DSS — M08.4 Initial Implementation Handoff

**Date:** 10/11/2026  
**Baseline:** M08.3 PostgreSQL Foundation (live-validated on Windows by the project owner)  
**Stage:** M08.4 — Real Dashboard & Data Management  
**Status:** Initial implementation increment; target-Windows live verification and owner review remain pending.

## 1. Objective

Replace illustrative dashboard KPI claims with traceable API-backed metrics and show PostgreSQL and CORE4/H16 source health separately. PostgreSQL remains the source for application-owned operational records. CORE4/H16 remains a canonical read-only inference/data source; no model artifacts or raw CORE4 data are copied into the application database.

## 2. Delivered in this increment

- Added `GET /api/dashboard/summary` for actor-scoped operational metrics and independent PostgreSQL / CORE4-H16 source status.
- Added `GET /api/data/health` for data-source health and policy status.
- Added PostgreSQL metric aggregation in `backend_api/db.py` for applications, INPUT_QUALITY validation runs, H18 support-signal assessments, active reports, application-state distribution and six-month application trend.
- Every aggregate query is scoped with `owner_user_id = current_actor_id`; PostgreSQL RLS remains enabled. If `current_actor_id()` is `NULL`, no aggregate query is executed and all metric values remain `null` with `AUTH_CONTEXT_REQUIRED`.
- Replaced illustrative dashboard counts and approval/high-risk claims with API-backed KPI slots. Missing/blocked data is shown as `—`, not fabricated zero.
- Added operational source-health and data-catalog information to the Data Management screen. Legacy localStorage demo records remain only in a clearly labelled compatibility section and are excluded from real KPIs and ML.
- Added Metric Glossary and Dashboard API Contract.
- Added M08.4 static audit and Python/Node regression tests.

## 3. KPI definitions and boundaries

See `qa/M08_4_METRIC_GLOSSARY_20261110.md` and `qa/M08_4_DASHBOARD_API_CONTRACT_20261110.yaml`.

Included metrics are application counts/status, INPUT_QUALITY validation outcomes, H18 assessment support-signal counts under `NOT_APPROVED` / no-automatic-decision constraints, active report counts, and application-created monthly trend. All are current-actor scoped.

Explicitly excluded: approval/rejection rates, loan eligibility, high-risk/risk-band populations, recommendations of loan amount/term/interest, CORE4 test-split data, target statistics and raw feature-vector aggregation.

## 4. Current behavior on the M08.3 Windows reference setup

M08.3 currently implements `finrisk_app.current_actor_id()` as `SELECT NULL::uuid` until trusted authentication is integrated. Therefore, on the existing Windows reference database:

- PostgreSQL source health is expected to be `ready` / `DB_CONNECTED`.
- Operational metrics are expected to be `blocked` / `AUTH_CONTEXT_REQUIRED` with `null` values.
- UI KPI slots display `—` and an explicit trusted-authentication explanation.
- CORE4/H16 health depends on whether the local CORE4 snapshot is configured. The owner’s earlier Windows server start reported `SNAPSHOT_NOT_CONFIGURED`; that does not affect PostgreSQL health.

This is deliberate fail-closed behavior. It is not evidence of zero applications or a cross-user aggregate.

## 5. Database and model impact

- No new SQL migration; existing M08.3 schema and privileges are reused.
- No CRUD/write endpoint was added.
- No authentication mechanism or actor GUC was added.
- No `BYPASSRLS`, global count, or RLS policy relaxation was introduced.
- No CORE4/H16 model, 169-feature order, threshold, calibration metadata, snapshot or H18 decision policy was changed.

## 6. Verification performed in the build container

| Check | Result |
|---|---:|
| Python compile / JavaScript syntax | PASS |
| M08.4 Dashboard Source Audit | 13/13 PASS |
| Python `backend_api.test_database` + `backend_api.test_server` | 34/34 PASS |
| Full Node regression (`node --test tests/*.test.js`) | 129/129 PASS |
| M08 Core Freeze verifier | 8/8 PASS; 39/39 protected files MATCH |

**Environment caveat:** the build container's installed scikit-learn is 1.8.0 while the frozen H16 lock and serialized model use 1.9.1. `test_original_model_policy_schema` passed but emitted `InconsistentVersionWarning`. Use the project's locked H16 requirements on the target Windows machine for authoritative model-runtime validation. The user’s Windows M08.3 baseline previously passed 19/19 Server Tests under its locked 1.9.1 environment; M08.4 target-Windows regression is still required.

## 7. Not yet verified / not complete

- New endpoints have not yet been exercised against the owner’s live Windows PostgreSQL instance after this code increment.
- No non-null trusted actor exists yet; actor-scoped metrics cannot return populated numbers until authentication is implemented and reviewed.
- No per-user isolation test with two authenticated users can be performed before trusted authentication exists.
- CORE4/H16 health on a target machine requires that machine’s approved snapshot path.
- Browser visual/responsive QA, VI/EN manual verification, and full target-Windows regression remain pending.
- M08.4 is not complete; this is its first implementation increment.

## 8. Target-Windows verification

From `app/`, with the M08.3 `.venv`, PostgreSQL service and local `.env` already configured:

```powershell
.\.venv\Scripts\python.exe qa\m08_4_dashboard_audit.py
.\.venv\Scripts\python.exe -m unittest backend_api.test_database backend_api.test_server -v
node --test tests/*.test.js
```

Then start the API using the existing local method and check:

```powershell
Invoke-RestMethod http://127.0.0.1:8080/api/dashboard/summary | ConvertTo-Json -Depth 8
Invoke-RestMethod http://127.0.0.1:8080/api/data/health | ConvertTo-Json -Depth 8
```

Expected on the current reference setup: PostgreSQL `DB_CONNECTED`; metrics `AUTH_CONTEXT_REQUIRED` with `null` counts; CORE4/H16 status depends on snapshot configuration; overall health may be `partial`. Verify UI cards display `—` rather than zero while actor context is absent.

## 9. Next steps

1. Run target-Windows verification above and capture HTTP/UI evidence.
2. Review all M08.4 Added/Modified files in GitHub Desktop and commit the increment.
3. Continue metric source/definition review with the owner before adding metrics that require a separate data contract.
4. Do not implement global metrics or enable cross-owner access as a workaround for the missing actor context.
5. Complete M08.4 exit criteria only after every displayed KPI is traceable, target QA passes and owner review is recorded.
