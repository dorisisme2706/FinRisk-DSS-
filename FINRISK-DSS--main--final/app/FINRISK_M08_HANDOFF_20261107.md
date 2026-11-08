# FinRisk DSS — M08.0 Core Freeze + M08.1 MOCK/REAL Audit

## 1. Trạng thái bàn giao

- Baseline: `FinRisk_DSS_W07_Setup_Batch_Fix_20261107.zip`
- Baseline ZIP SHA-256: `135a45e1d73c3a3aab5879953f4aa28cc15218fa326fe69bffd8fa38622bd397`
- **M08.0 Core Freeze:** PASS — 39/39 protected files match.
- **M08.1 Source Audit:** PASS — 12/12 checks.
- **M08-specific Node tests:** PASS — 9/9.
- **Full Node regression:** PASS — 107/107.
- **W07 static/release audit:** PASS — 25/25.
- Không thay đổi hành vi runtime của ứng dụng; không sửa UI, API, database, model hoặc CORE4 trong M08.1.

### Bằng chứng Windows đã được người dùng xác nhận trong hội thoại

- CPython 3.14.7, Windows x64; 13 package khớp lock; `pip check` PASS.
- Runtime Gate với snapshot: 11/11 PASS.
- CORE4 Parquet SHA-256 MATCH; 307.511 rows; có `sk_id_curr`.
- H16 pipeline load không có `InconsistentVersionWarning`; schema có 169 ordered features.
- Server: `ML: READY`.
- W05 live score và Decision Trace 6 bước hoạt động; W06 tạo báo cáo cho `100035`.
- Người dùng xác nhận `run_w07_qa.bat` trên Windows cho kết quả như mong đợi.

Lưu ý: API test chạy lại trong build container Python 3.13/scikit-learn 1.8.0 đạt 18/18 nhưng có `InconsistentVersionWarning`; log được lưu dưới tên `M08_API_TESTS_BUILD_CONTAINER_DIAGNOSTIC_20261107.txt` và **không** dùng làm bằng chứng target-Windows. M08.1 không sửa backend API. W07 Windows runtime gate là căn cứ môi trường phù hợp đã được người dùng xác nhận.

## 2. Core Freeze — phạm vi chính xác

| Protected scope | File count | Nội dung |
|---|---:|---|
| `backend_ml/` | 32 | H16 pipeline, package, inference, 169-feature contract, threshold, calibration metadata và lockfile |
| `evidence/h16/` | 4 | H16 final test/release evidence |
| `evidence/h18/` | 2 | H18 integration/reference evidence |
| `backend_api/decision_engine.py` | 1 | H18 decision-support adapter và no-auto-decision guardrails |
| **Tổng** | **39** | Được khóa bằng SHA-256 và file size |

### Giá trị được đóng băng

| Thành phần | Giá trị baseline |
|---|---|
| Model | `finrisk_lgbm_h12_demo_v0.2` |
| Pipeline SHA-256 | `7db887ce309eaa9c2151c9f408c1f7b673e562fa8b3aed08f8f22942581dae34` |
| Feature set | `core4_169_baseline_v1` |
| Feature count | 169 (154 numeric + 15 categorical) |
| Feature order SHA-256 | `782078170a2e89b0d210cc1cff1959d1880872768f22c2885f978b0a4416753e` |
| Data version | `finrisk_v2_20261022151614259322` |
| Data hash | `a86250a18e4bf23789176759a145b69562cc5caf072665c7b131b98c2232abc0` |
| Split hash | `1992247193e6eab1d895732bc8c9350fd70fac641e1b4773ad0331a151a88417` |
| Threshold policy | `finrisk_demo_f1_validation_v1` |
| Threshold | `0.14484327385366114`, comparator `>=` |
| Threshold scope | `demo_only_pending_review` |
| Calibration | `uncalibrated_candidate_not_selected` |
| Calibration method tested | `logistic_recalibration_on_logit_OOF`; candidate not selected |
| H16 formal GK review field | `PENDING` in release metadata |
| H18 business policy | `NOT_APPROVED` |
| Automatic approval/rejection | Disabled |
| Proposed amount/term/rate/monthly payment | Must remain null |

The freeze does not alter the H16 metadata field `formal_GK_review: PENDING`. The user's confirmation of W01-W07 work acceptance is not used to overwrite model governance metadata.

## 3. Source audit — key findings

- 13 workspace routes and 13 corresponding renderers.
- 4 GET APIs: health, CORE4 profile, ML score and H18 decision-support assessment.
- W02 is a read-only CORE4 projection with 38 allowlisted fields; test split returns HTTP 403.
- The W03 real ML lookup panel is mounted in the W05 `decision` screen in the current 13-route source; there is no separate W03 workspace route.
- W05 calls H18 and reports a review signal, not a credit decision.
- W06 reads W02 profile first and calls H18 only after the profile is valid; report history is saved only after explicit user action, in current-browser localStorage, max 50 records.
- Overview/KPI, loan form, PostgreSQL readiness screen, validation #10, legacy trace #11, result #12, credit report #13, E2E #18 and Test Center retain MOCK/local browser behavior.
- Current source contains no PostgreSQL driver, database write API, SQL migration or database schema.
- No user authentication or per-user authorization layer exists in the local server.
- The 9 form fields in #09 have **zero direct field-name overlap** with the 169 H16 model predictors. Do not map or invent features by guessing.
- Legacy CarbonGraph localStorage names remain and need a backward-compatible cleanup plan.
- Marketing/footer text has generic Local UI Demo / NO LIVE BACKEND language that should be clarified during M08 cleanup because W02/H18 paths are live.

Full route-by-route map: `qa/M08_MOCK_REAL_AUDIT_20261107.md`.  
Structured inventory: `evidence/m08/M08_MOCK_REAL_AUDIT_20261107.json`.

## 4. Files added / modified / deleted in this M08.1 package

### Added — 18 files

1. `M08_START_HERE_VI.md`
2. `app/FINRISK_M08_HANDOFF_20261107.md`
3. `app/qa/M08_CORE_FREEZE_MANIFEST.json`
4. `app/qa/m08_verify_freeze.py`
5. `app/qa/m08_mock_real_audit.py`
6. `app/qa/M08_MOCK_REAL_AUDIT_20261107.md`
7. `app/qa/M08_ROADMAP_20261107.md`
8. `app/tests/finrisk-m08-freeze.test.js`
9. `app/tests/finrisk-m08-audit.test.js`
10. `app/evidence/m08/M08_MOCK_REAL_AUDIT_20261107.json`
11. `app/evidence/m08/M08_FREEZE_VERIFICATION_20261107.json`
12. `app/evidence/m08/M08_NODE_TESTS_20261107.txt`
13. `app/evidence/m08/M08_FREEZE_VERIFICATION_20261107.txt`
14. `app/evidence/m08/M08_SOURCE_AUDIT_20261107.txt`
15. `app/evidence/m08/M08_W07_STATIC_AUDIT_20261107.txt`
16. `app/evidence/m08/W01_W07_FULL_NODE_REGRESSION_20261107.txt`
17. `app/evidence/m08/M08_API_TESTS_BUILD_CONTAINER_DIAGNOSTIC_20261107.txt`
18. `app/run_m08_audit.bat`

### Modified — 1 file

- `app/CHANGELOG.md` — thêm ghi chú M08.0/M08.1.

### Deleted — 0 files

No runtime application code, backend API, database connector, H16 model or raw CORE4 snapshot was changed/added/deleted.

## 5. Reproduce M08.0/M08.1 checks

From `app/`:

```powershell
.\.venv\Scripts\python.exe qa\m08_verify_freeze.py
.\.venv\Scripts\python.exe qa\m08_mock_real_audit.py --json-out evidence\m08\M08_MOCK_REAL_AUDIT_20261107.json
node --test tests\finrisk-m08-freeze.test.js tests\finrisk-m08-audit.test.js
```

Or run the M08 helper:

```powershell
.\run_m08_audit.bat
```

Expected:
- Freeze verifier: 8/8 PASS.
- Source audit: 12/12 PASS.
- M08 Node tests: 9/9 PASS.
- Full Node suite on this source: 107/107 PASS.
- W07 static audit: 25/25 PASS.

## 6. M08 roadmap

1. **M08.0 Core Freeze — completed.** Protect 39 files and frozen model/business-signal invariants.
2. **M08.1 MOCK/REAL Audit — completed.** Inventory screens, APIs, browser storage, database gaps and feature mapping boundary.
3. **M08.2 Data Contract & PostgreSQL Logical Design — next.** Define ownership, user identity/roles, application schema, assessment/report metadata, audit events, retention, backup/restore and secret handling. No schema migration until design is reviewed.
4. **M08.3 PostgreSQL persistence.** Add versioned migrations and authenticated repository/API for app-owned records. Keep CORE4 snapshot as canonical read-only inference source until any replacement is separately validated.
5. **M08.4 Real Dashboard & Data Management.** Each KPI needs a metric definition, source query, population/split and refresh timestamp; no test-split leakage.
6. **M08.5 Financial Validation & Decision Governance.** Separate data validation from credit policy; each business rule requires owner, approver, version, effective date and test evidence.
7. **M08.6 Mock Cleanup & integrated QA.** Clarify/retire redundant mocks only after migration and regression; retest VI/EN, responsiveness, access boundaries, failures and data isolation.

## 7. Non-negotiable M08 rules

- No H16 retraining, re-pickling, feature addition/removal/reordering, threshold retuning, recalibration or metadata change within M08.
- Keep calibration status `uncalibrated_candidate_not_selected`.
- Keep threshold demo-only pending review.
- `MANUAL_REVIEW_RECOMMENDED` and `NO_REVIEW_SIGNAL` are support signals, not approval/rejection.
- Business policy remains `NOT_APPROVED`; no automatic credit decisions or loan terms.
- No Dataiku; it is not part of this project's stack.
- Any changes outside the protected set must pass M08 freeze verifier and W01-W07 regression.

## 8. Next stage

Proceed to **M08.2 — Data Contract & PostgreSQL Logical Design**. Start with the logical ERD and data dictionary; only then implement SQL migrations and API persistence. The proposed record groups in `qa/M08_ROADMAP_20261107.md` are design candidates, not approved schema yet.
