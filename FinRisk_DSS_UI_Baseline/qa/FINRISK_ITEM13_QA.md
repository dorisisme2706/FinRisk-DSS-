# #13 – Credit Assessment Report | QA / DoD

- [x] Tab `export` renamed to Báo cáo tín dụng; same navigation position.
- [x] Existing Export Center cards and preview layout retained.
- [x] Read application #09 from localStorage and validate via #10.
- [x] Evaluate current #12 MOCK scenario (APPROVE / REVIEW / REJECT / UNAVAILABLE / INVALID_INPUT).
- [x] Export standalone HTML with escaped customer data, prominent MOCK disclaimer.
- [x] Export structured JSON with provenance and disclaimer.
- [x] VI/EN text mappings added in `src/i18n.js`.
- [x] Automated #13 tests: 14/14 PASS (`node tests/finrisk-item-13.test.js`).
- [ ] Manual desktop/mobile browser visual QA not run.
- [ ] Manual VI/EN browser toggle not run.
- [ ] Leader approval not obtained.
- [ ] ML, approved credit policy, backend and PostgreSQL integration not available.

Full Node regression: 26/27 test files PASS, 1 existing `finrisk-ui-03-04.test.js` FAIL on `Original five marketing links retained` (baseline also has this condition; unrelated to #13). No claim of all-suite PASS.

To run: `python serve_local.py` then open http://localhost:8000 (or `run_localhost.bat`). Enter a sample in Hồ sơ vay, choose scenario in Đánh giá tín dụng, open Báo cáo tín dụng and export HTML / JSON. Do not use real customer PII with localStorage demo.
