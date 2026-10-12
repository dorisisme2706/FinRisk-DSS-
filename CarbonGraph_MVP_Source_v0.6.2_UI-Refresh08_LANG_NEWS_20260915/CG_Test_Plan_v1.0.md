# CG TEST PLAN v1.0

Ngày hiệu lực: 22/08/2026.  
Build: CarbonGraph MVP Source v0.6.  
Owner: Minh Thư. Reviewer: Trọng Khang.

## Scope

- C2 Input/schema and normalization.
- C3 validation/status/classification branches.
- C5 trace/evidence integrity.
- C6 fail-closed release state.
- C7 working-only export/redaction.
- C8 end-to-end technical safety.
- D1/D3/D4 automated tests và D5 manual UAT.

Out of scope: C4 numeric calculation, numeric golden reconciliation, real-data acceptance, compliance decision và Gate decision.

## Environment

- Localhost `http://127.0.0.1:8080`.
- Python 3 cho server; Node.js cho automated suite.
- Dataset `SYNTHETIC_DEMO`; R-006 `OPEN`; numeric `BLOCKED/MASKED`.

## Test levels

1. Unit/module: state, validation, graph, release, persistence, report, E2E, acceptance engine.
2. Formal boundary: D1–D4 non-numeric boundary suite.
3. Regression: 62 automated cases.
4. UAT: UAT-01…UAT-10 trong Test Center.

## Entry criteria

- Source load/syntax không lỗi.
- Baseline guardrails đúng.
- `run_tests.bat` chạy được.
- Người test có thư mục evidence.

## Exit criteria

- Automated: 75/75 PASS.
- Manual: 10/10 PASS, có note + evidence + exported UAT JSON.
- Không còn blocker: numeric leak, R-006 change, synthetic→real promotion, trace identity error, export thiếu disclaimer.
- Reviewer sign-off trước khi task chuyển `Hoàn thành`.

Chi tiết case, sample, expected, failure diagnosis và fix nằm trong `CG_Test_Plan_and_UAT_Guide_v1.0.md` và màn `Test Center`.
