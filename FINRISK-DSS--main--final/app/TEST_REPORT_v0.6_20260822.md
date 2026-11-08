# CARBONGRAPH v0.6 – AUTOMATED TEST REPORT

Executed: 22/08/2026. Result: `62/62 PASS`.

| Suite | Cases | Result |
|---|---:|---|
| acceptance-catalog | 4 | PASS |
| acceptance-engine | 6 | PASS |
| e2e-engine | 4 | PASS |
| formal-d1-d4 | 5 | PASS |
| graph-engine | 5 | PASS |
| persistence | 4 | PASS |
| pipeline | 5 | PASS |
| release-engine | 4 | PASS |
| report-engine | 8 | PASS |
| state | 9 | PASS |
| validation-engine | 8 | PASS |
| **Total** | **62** | **PASS** |

Additional checks:

- JavaScript syntax check: PASS.
- Python server compile: PASS.
- Local HTTP static delivery: PASS; index, app, acceptance catalog/engine và stylesheet trả HTTP 200.
- DOCX render/visual review: PASS, 7 pages reviewed.
- Full browser automation: NOT EXECUTED in build environment because Playwright browser binary was unavailable. This is not counted as PASS; UAT-01…UAT-10 remain manual and must be executed by the user/reviewer.

Interpretation: technical regression passed. Compliance remains `NOT_EVALUATED`; R-006 remains `OPEN`; numeric emission remains `BLOCKED`.
