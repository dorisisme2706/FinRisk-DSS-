# FinRisk DSS — M08.1 MOCK / REAL audit

**Baseline:** `FinRisk_DSS_W07_Setup_Batch_Fix_20261107.zip`  
**Baseline SHA-256:** `135a45e1d73c3a3aab5879953f4aa28cc15218fa326fe69bffd8fa38622bd397`  
**Audit date:** 07/11/2026  
**Audit status:** `PASS` — 12/12 source assertions passed.

## 1. Audit objective and scope

M08.1 identifies which workspace screens use real CORE4/H16/H18 paths, which remain browser-local MOCK, where data is persisted, which API routes exist, and what must be designed before PostgreSQL or new business rules are implemented.

This is a source-code audit of the W07 accepted baseline. It does **not** claim a PostgreSQL integration, user authentication, a production credit policy, or a production deployment.

## 2. Workspace inventory — 13 routes

| Route | Tab / screen | Current source and behavior | Persistence / API | M08 disposition |
|---|---|---|---|---|
| `overview` | Tổng quan | Hard-coded hero/KPI demo values; explicitly marked DEMO/MOCK; no API-backed aggregates | None; static client view | M08.3 replace KPIs only after metric definitions and approved aggregate source exist |
| `customer` | Hồ sơ khách hàng (W02) | Real, read-only CORE4 profile projection; five groups and 38 allowlisted fields; `test` split is blocked with HTTP 403 | `GET /api/customer/profile?sk_id_curr=<id>`; no database write | Preserve as a live read-only source; add regression around contract and 403 |
| `data` | Hồ sơ vay (#09) | MOCK application form. Fields: customer_id, full_name, age, monthly_income, monthly_expenses, existing_monthly_debt, loan_amount, loan_term_months, loan_purpose. Seed includes synthetic example values | `localStorage` key `finrisk.loan.application.mock.v1`; no API or PostgreSQL | M08.2 define data contract and ownership before replacing persistence; do not feed directly to H16 |
| `simulation` | Mô phỏng khoản vay (W04) | Browser-side amortization calculator; annuity and equal-principal methods; user-supplied hypothetical annual rate; reference cashflow uses MOCK loan form data | No API call in `finrisk-simulation.js`; no central storage | Keep as explicitly hypothetical simulation; optional save is a future design decision, not an approved product offer |
| `decision` | Bộ máy hỗ trợ quyết định (W05; includes the live ML lookup panel) | Real CORE4/H16/H18 review-support path, metadata, top-10 explanations and six-stage decision trace; no final credit decision | `GET /api/decision/assess?sk_id_curr=<id>`; model remains read-only | Preserve; only extend around it with regression and freeze checks |
| `reports` | Báo cáo & lịch sử (W06) | Real report assembled from W02 CORE4 profile + H18 decision-support response; validates profile before calling H18; exports JSON/HTML | Two GET calls; explicit save into browser `localStorage` key `finrisk.w06.report-history.v1`; capped at 50; no sync to PostgreSQL | M08.3 may add authenticated centralized history after schema, access and retention are agreed; local mode must be labelled during transition |
| `evidence` | Quản lý dữ liệu / #19 | PostgreSQL integration readiness placeholder; uses `FinRiskIntegrationMock`, status `MOCK/OFFLINE`; not a real database connection | `localStorage` keys `finrisk.integration.records.mock.v1` and `finrisk.integration.last-run.mock.v1`; no API/DB | Replace readiness claims with actual health status only after PostgreSQL adapter is implemented |
| `validation` | Kiểm tra tài chính (#10) | Client-side `FinRiskLoan.validate` checks form fields and simple demonstration constraints; it explicitly says it is not credit policy | Reads `finrisk.loan.application.mock.v1`; no API | M08.4 separate input/data validation from business-credit rules; do not promote current rules to policy |
| `trace` | Giải thích quyết định (#11 legacy) | Legacy `FinRiskDecisionTrace` built from MOCK loan form and `FinRiskDecisionMock`; not the live W05 trace | Browser/local; `finrisk.decision.mock.scenario.v1` | Rename/label clearly or retire after replacement plan; avoid confusion with live W05 Decision Trace |
| `result` | Đánh giá tín dụng (#12 legacy) | `FinRiskDecisionMock` uses scenarios 20/55/85 and renders APPROVE/REVIEW/REJECT as MOCK examples | `localStorage`; no ML/API | Keep only as a clearly marked simulator or retire; never present as a real decision |
| `export` | Báo cáo tín dụng (#13 legacy) | `FinRiskCreditReport` exports a `finrisk.credit-report.v1-mock` from form #09, validation #10 and scenario #12 | Browser generated HTML/JSON; no API/DB | Keep separate from W06 CORE4/H18 reports; label unmistakably MOCK or retire |
| `e2e` | End-to-End (#18 legacy) | `FinRiskIntegrationMock` simulates PostgreSQL → ML → Decision → UI → History steps; it explicitly does not call those systems | `localStorage` key `finrisk.integration.last-run.mock.v1`; no API/DB | Do not use as evidence of a real E2E pipeline; rename or replace with a real health/flow check after integration |
| `acceptance` | Test Center | Manual UAT cases are user-marked in the browser; local status is not a leader signature or centrally stored QA record | `localStorage` key `finrisk.uat.v1` (plus legacy acceptance keys) | Retain as a local helper only or migrate to a role-controlled QA evidence store with explicit reviewer authority |

### Important route clarification

The 13 navigation routes are the actual routes in `src/app.js`. W03's real H18 prediction panel is mounted inside the W05 `decision` screen in this baseline; it is not a separate workspace route in the current 13-route registry. The older `trace`, `result`, `export` and `e2e` routes are separate MOCK/legacy flows.

## 3. Existing API surface

The current local `backend_api/server.py` exposes these GET routes:

| Method | Route | Current purpose |
|---|---|---|
| GET | `/api/ml/health` | Runtime readiness and model/data/policy metadata |
| GET | `/api/customer/profile?sk_id_curr=<id>` | Read-only, allowlisted CORE4 profile. `test` partition returns HTTP 403 |
| GET | `/api/ml/score?sk_id_curr=<id>` | Frozen H16 score response |
| GET | `/api/decision/assess?sk_id_curr=<id>` | H18 review signal and decision-support contract |

Audit findings from the baseline source:

- No `POST`/`PUT`/`PATCH`/`DELETE` application write route exists.
- No PostgreSQL driver, SQLAlchemy, SQLite adapter or SQL migration file exists in the application source.
- No authentication or per-user authorization layer is implemented.
- The server defaults to loopback; binding beyond loopback must not be treated as safe because the app does not implement authentication.
- CORE4 remains a canonical external Parquet snapshot configured for the local server; W02 is a read-only projection, not CRUD.

## 4. Browser-local persistence inventory

| Storage key | Used by | Meaning |
|---|---|---|
| `finrisk.loan.application.mock.v1` | #09 Loan Application | MOCK loan application form |
| `finrisk.decision.mock.scenario.v1` | #12 Decision Mock | selected illustrative low/medium/high/missing scenario |
| `finrisk.integration.records.mock.v1` | #19 Integration Mock | MOCK saved loan records |
| `finrisk.integration.last-run.mock.v1` | #18 E2E Mock | last browser-only simulated run |
| `finrisk.uat.v1` | Test Center | manually marked local UAT results |
| `finrisk.w06.report-history.v1` | W06 | up to 50 CORE4/H18 report snapshots in current browser |
| `finrisk-language` | i18n | selected VI/EN preference |
| `CG_UI_MOTION_ENABLED` | ambient graph | animation preference |
| `carbongraph.mvp.v0.6.working-state` and older v0.5/v0.4 keys | legacy persistence | old UI working state keys |
| `carbongraph.acceptance.v0.6` and reviewer key | legacy acceptance engine | old acceptance storage naming |

W06 history is explicitly opt-in, local to the current browser and not synchronized. It contains a read-only 38-field profile projection plus H18 assessment metadata. It excludes configured forbidden keys such as `target`, `code_gender`, `days_birth`, `full_name`, `name`, `address`, `phone` and `email`; nevertheless, financial/profile data in browser storage should not be treated as a secure centralized record.

## 5. Critical data-contract finding: #09 cannot be sent directly to H16

The MOCK loan form has 9 fields. The frozen H16 model requires the ordered `core4_169_baseline_v1` feature contract with 169 predictors (154 numeric + 15 categorical).

The source audit finds **zero direct field-name overlap** between the 9 form fields and the 169 model feature names. This does not prove a mapping can never be designed, but it proves no direct mapping exists in the current source. M08 must not create or infer 169 predictors from the form by guesswork. Any future feature construction must have a documented source, transformation, missingness rule, version and approval, and must not mutate the frozen H16 model package.

## 6. Current REAL / MOCK classification

**Real CORE4/H16/H18 paths:** W02 customer profile; W03 real ML panel embedded in W05; W05 decision-support/trace; W06 report generation.

**Browser-local MOCK or demo paths:** overview/KPI dashboard; #09 loan application; W04 scenario simulation inputs; #19 data-management placeholder; #10 financial validation; legacy #11 trace; #12 result; #13 credit report export; #18 E2E; local manual UAT storage.

This is a mixed REAL/MOCK local academic prototype. Do not describe the full site as entirely live, and do not describe the live model panel as a fully integrated loan-application-to-decision workflow.

## 7. Findings and M08 work items

| Finding | Priority | Evidence | M08 response |
|---|---|---|---|
| F01 — Dashboard KPIs remain illustrative | High | `renderOverview()` marks data DEMO/MOCK and says no backend aggregates | M08.3 define metric glossary, population/split boundaries and source queries before displaying real counts |
| F02 — Loan application uses MOCK schema/localStorage | High | `FinRiskLoan` uses `finrisk.loan.application.mock.v1`; no write API | M08.2 define application data contract, privacy and identity; M08.3 persist drafts/submissions in DB only after approval |
| F03 — No PostgreSQL implementation | High | No driver, SQL file, migration, or write endpoint | M08.2 schema/role/data-retention design; M08.3 versioned migrations and repository/API layer |
| F04 — #09 form fields do not map directly to 169 predictors | Critical guardrail | 0/9 direct name matches against H16 feature order | Keep form submission separate from H16 profile-ID inference unless a governed feature contract is approved |
| F05 — Financial validation is illustrative | High | `FinRiskLoan.validate` is local and labels rules MOCK | M08.4 build a documented input-quality layer; do not call it credit policy |
| F06 — Legacy decision screens can confuse users | High | #11/#12/#13 remain MOCK beside W05/W06 real paths | M08.6 relabel, merge or retire only after preserving needed demo paths and regression coverage |
| F07 — W06 report history is browser-local | High | `localStorage`, max 50; no account/DB | M08.2 decide identity, report retention and access; M08.3 add central persistence only after design approval |
| F08 — E2E and database screens simulate integration | Medium | #18 and #19 use `FinRiskIntegrationMock` | Replace mock status with real health checks when PostgreSQL implementation exists; do not call mock evidence a real E2E test |
| F09 — UAT is local and self-marked | Medium | `finrisk.uat.v1`, manual statuses and disclaimer | M08.6 preserve evidence/reviewer distinction or migrate with roles |
| F10 — Generic marketing/footer text is stale | Medium | Footer says `NO LIVE BACKEND` / Local UI Demo despite W02/H18 live paths | Correct the whole-site description during final cleanup without overstating prototype readiness |
| F11 — Legacy CarbonGraph storage keys remain | Low | `carbongraph.*` persistence/acceptance keys | Design backward-compatible migration before removing keys; do not silently discard user local state |

## 8. M08 implementation sequence

1. **M08.0 — Core Freeze (completed in this package):** manifest and byte-level verification for `backend_ml/` (32 files), `evidence/h16/` (4 files), `evidence/h18/` (2 files), and `backend_api/decision_engine.py` (1 file). Total: 39 protected files.
2. **M08.1 — MOCK/REAL Audit (completed in this package):** 13 routes, 4 GET APIs, browser storage, database absence, and feature-contract boundary documented.
3. **M08.2 — Data contract and PostgreSQL logical design (next):** define ownership, user identity/roles, application schema, assessment/report metadata, audit-event requirements, retention, backup, migrations, and connection-secret handling. No DB connection strings or credentials belong in source control.
4. **M08.3 — PostgreSQL adapter and persistence:** implement migrations/repository/API for app-owned records only. Keep CORE4 snapshot as canonical read-only inference source until a separately validated replacement is approved. Do not duplicate the 169-feature matrix into an app write path by default.
5. **M08.4 — Real Dashboard and Data Management:** metrics require a glossary, a declared population/split, reproducible SQL/source query, and timestamp. No test-partition leakage or unlabelled synthetic values.
6. **M08.5 — Financial Validation and Decision Governance:** separate technical input validation from approved policy. Every business rule requires an ID, definition, owner, approver, effective date and test cases. No APPROVE/REJECT or loan terms before formal approval.
7. **M08.6 — Mock Cleanup and integrated QA:** rename/retire redundant mocks only after migration/compatibility and regression tests; check VI/EN, 390/768/1440 viewports, API failures, role boundaries, data isolation and protected-file hashes.

## 9. M08 non-negotiable boundaries

- No model retraining, re-pickling, feature addition/removal/reordering, threshold retuning, calibration change or H16 metadata change within M08.
- `calibration_status` remains `uncalibrated_candidate_not_selected`; do not describe the model as calibrated.
- Threshold `0.14484327385366114`, comparator `>=`, and policy `finrisk_demo_f1_validation_v1` remain demo-only pending review.
- `MANUAL_REVIEW_RECOMMENDED` and `NO_REVIEW_SIGNAL` are support signals, not approval/rejection.
- Business policy remains `NOT_APPROVED`; no automatic decision, recommended amount, term, interest rate or monthly payment.
- Do not use Dataiku; it is not part of this project's stack.
- Any M08 changes outside the protected set must pass `m08_verify_freeze.py`, the W01-W07 regression suite, and target Windows QA.

## 10. Reproduce M08.1 audit

From `app/`:

```powershell
.\.venv\Scripts\python.exe qa\m08_verify_freeze.py
.\.venv\Scripts\python.exe qa\m08_mock_real_audit.py --json-out evidence\m08\M08_MOCK_REAL_AUDIT_20261107.json
node --test tests\finrisk-m08-freeze.test.js tests\finrisk-m08-audit.test.js
```

Expected current source results: freeze 8/8 PASS; source audit 12/12 PASS; M08 Node tests 9/9 PASS. The W07 protected baseline is separately run through `run_w07_qa.bat`.
