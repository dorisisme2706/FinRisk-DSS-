# W07 – Overall QA Matrix

**Release baseline:** W06 Reports & History – 07/11/2026  
**Scope:** Overall source, navigation, module order, API boundaries, frozen model/evidence, i18n, responsive browser presentation, exact Python runtime, and release packaging.

## 1. Workspace coverage

| Workspace | Route | QA boundary | Evidence / check |
|---|---|---|---|
| W01 / Overview | `#overview` | Dashboard and product overview remain available; demo metrics stay disclosed as MOCK | Node regression + browser DOM/layout matrix |
| W02 / Customer Profile | `#customer` | CORE4 read-only projection; 38 allowlisted fields; test split blocked by API | Python API tests + W07 static audit + Windows live API check |
| Existing application form | `#data` | Continues as MOCK/localStorage; no feature fabrication for H16 | Existing #09/#10 regression + browser DOM/layout matrix |
| W04 / Loan Simulation | `#simulation` | Annuity/equal-principal and 0% arithmetic; no API or credit decision | W04 unit tests + W07 static audit + browser DOM/layout matrix |
| W05 / Decision Engine | `#decision` | H18 signal and Decision Trace; `NOT_APPROVED`; no auto approval/rejection or loan terms | W05 unit tests + API regression + VI/EN browser test |
| W06 / Reports & History | `#reports` | W02-before-H18, matching profile ID, explicit local save, max 50 records, JSON/HTML export | W06 unit/contract tests + W07 static audit + browser DOM/layout matrix |
| Legacy MOCK / evidence / UAT screens | Other 7 routes | Retain renderer and do not imply real backend integration | Renderer registration test + browser DOM/layout matrix |

## 2. Automated source and browser checks

| Check | Result in W07 build | Scope |
|---|---:|---|
| Full Node.js regression | 98/98 PASS | Includes 17 W07 cross-workspace/runtime-gate assertions |
| Python API regression | 18/18 in prior build-container run | That diagnostic run used an incompatible Python 3.13 environment and emitted `InconsistentVersionWarning`; it is archived separately, not accepted as release-runtime evidence |
| W07 static/release audit | 25/25 PASS | Route/renderer, module load order, W02 allowlist, H18 guardrails, W06 workflow, i18n, CSS, server posture, runtime-gate wiring, lock metadata, H16 hashes and package hygiene |
| Browser DOM/layout regression | 39/39 PASS | 13 screens × 3 viewport sizes; local in-memory storage; no live APIs |
| Browser language checks | 4/4 PASS | W05/W06 labels, VI ↔ EN |
| Browser JavaScript page errors | 0 | During DOM-injected route/layout checks |
| Frozen H16 files | 36/36 MATCH | `backend_ml/` and `evidence/h16/` compared to W07 release manifest |
| ZIP integrity | PASS after packaging | Rechecked with `zipfile.testzip()` |

## 3. Windows setup batch parser regression

The user confirmed CPython 3.14.7 x64 is installed (`py -0p`, `py -3.14 --version`), but `setup_windows.bat` emitted `Was was unexpected at this time.` before creating the environment. Root cause: an unescaped `)` in `echo [FAIL] Python Launcher (py.exe) was not found.` inside an `if (...)` block prematurely closed the command block. The line is now `echo [FAIL] Python Launcher py.exe was not found.`. Node regression and static audit assert the safe wording. Windows CMD execution must still be confirmed on the deployment machine because this build environment has no Windows CMD interpreter.

## 4. Root cause and fix for dependency warnings

The frozen model metadata records **CPython 3.14.0** and these model runtime versions: pandas 3.1.0, pyarrow 26.0.0, NumPy 2.5.4, scikit-learn 1.9.1, LightGBM 4.7.0 and joblib 1.6.0. The requirements lock pins all 13 runtime packages, including their transitive dependencies.

The prior `setup_windows.bat` incorrectly created `.venv` with Python 3.12. The W07 build sandbox used Python 3.13.5 and different installed package versions, with PyArrow missing. It consequently emitted `InconsistentVersionWarning` when loading the serialized scikit-learn pipeline.

**Fix implemented in this release:**

1. `setup_windows.bat` now requires 64-bit CPython 3.14, the interpreter minor version recorded in model metadata. Python.org currently lists stable Python 3.14.10 (as of 07/11/2026); install the Windows x64 installer from https://www.python.org/downloads/windows/.
2. An existing `.venv` with the wrong interpreter is preserved as `.venv_backup`, `.venv_backup_1`, etc.; it is not silently reused or deleted.
3. Setup installs only binary wheels from the unchanged `backend_ml/model/requirements-lock.txt`, runs `pip check`, then runs a strict environment preflight.
4. `qa/w07_environment_check.py` runs 10 checks (11 when a snapshot is supplied): CPython minor version, Windows platform, 64-bit interpreter, every pinned package, pip dependency consistency, imports, a PyArrow in-memory Parquet round trip, H16 model SHA-256, warning-free `joblib.load` and the exact 169-feature schema.
5. The gate fails closed before `joblib.load` if any interpreter/OS/package/pip/hash precondition fails. A snapshot only passes when both SHA-256 and its Parquet header (`sk_id_curr`, non-empty row count) are validated.
6. `run_w07_qa.bat`, `run_api_tests.bat`, `run_tests.bat`, `03_H19_E2E_FREEZE.cmd` and `run_with_ml.bat` invoke the strict environment gate before model/API/test work; the full regression runner cannot silently skip Python tests when `.venv` is missing.
6. The release gate fails closed if any dependency differs or if an `InconsistentVersionWarning` is emitted. It does not downgrade or edit the H16 artifact to silence a warning.

**Important verification boundary:** This build container has Python 3.13.5, no Python 3.14 interpreter and no package-index network access. Therefore the new strict preflight was source-checked but could not pass in this container. It must be executed in the target Windows `.venv`; this release remains a candidate until `environment_check_results.txt` reports PASS. The Python 3.13 diagnostic API log is retained as an archived explanation of the original warning. The current release-runner `api_tests.txt` is a placeholder until Windows strict runtime preflight passes and the Python API suite is regenerated.

## 5. Browser matrix

| Viewport | Screen count | Expected |
|---|---:|---|
| 390 × 844 | 13 | No document-level horizontal overflow; active navigation tab visible |
| 768 × 1024 | 13 | Same checks |
| 1440 × 900 | 13 | Same checks |

Browser checks use the actual local HTML, CSS and JavaScript files, loaded in a disposable Playwright page. The browser storage is replaced by an in-memory shim. This is a DOM/layout test, not a live backend/API test.

## 6. Security and business boundaries

- `/api/customer/profile` exposes only the 38-field allowlist and blocks split `test` with HTTP 403.
- W06 fetches W02 first; it must stop before requesting H18 if W02 rejects the profile.
- W04 simulation remains a local arithmetic scenario and does not call ML/API.
- W05/H18 only emits `MANUAL_REVIEW_RECOMMENDED` or `NO_REVIEW_SIGNAL`; `business_policy_status` remains `NOT_APPROVED`, automatic decision remains `false`, and proposed loan terms remain `null`.
- W06 is a local report copy; explicit save is required and history is browser-local only.
- Server defaults to `127.0.0.1`. Binding to a network address has no authentication and must not be exposed to the internet.
- Model, 169 predictors, threshold, calibration, policy and H16 evidence are not modified by W07.

## 7. Manual Windows acceptance

Run from `app/`:

```powershell
py -3.14 --version
.\setup_windows.bat
.\.venv\Scripts\python.exe -m pip check
.\.venv\Scripts\python.exe qa\w07_environment_check.py
.\run_w07_qa.bat
```

Expected: runtime gate PASS, Node 98/98 PASS, Python API 18/18 PASS with no `InconsistentVersionWarning`, W07 static audit 25/25 PASS, optional Browser QA 39/39 PASS when `.qa_venv` is installed.

For live CORE4 validation, pass the snapshot to the environment gate and API launcher:

```powershell
.\.venv\Scripts\python.exe qa\w07_environment_check.py --snapshot "D:\FinRisk_CORE4_Snapshot_For_GK_20261029\FinRisk_CORE4_Snapshot"
.\run_with_ml.bat "D:\FinRisk_CORE4_Snapshot_For_GK_20261029\FinRisk_CORE4_Snapshot"
```

Then confirm `ML: READY`, `/api/ml/health`, W02 `100035`/`100009`, W03/W05 H18 response, W04 calculations/CSV, W06 history/export, VI ↔ EN and Chrome viewports 390×844, 768×1024, 1440×900. W06 history should be cleared after testing on a shared device.

The runtime gate fails closed before unpickling the model when interpreter, OS, package pins, pip dependency graph or model hash are mismatched. A snapshot check cannot pass on SHA-256 alone; it must also read the Parquet header and find a non-empty `sk_id_curr` column. If PyArrow/LightGBM import fails with a missing DLL on Windows, install the latest x64 Microsoft Visual C++ Redistributable (https://aka.ms/vc14/vc_redist.x64.exe) and rerun the gate.
