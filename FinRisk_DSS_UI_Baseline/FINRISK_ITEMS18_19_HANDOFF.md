# FinRisk DSS — #18 / #19 Frontend MOCK

## Scope
- #19 reuses **Evidence Queue** route (`evidence`) as **Quản lý dữ liệu / Data Management**. Save/read/export local MOCK loan record metadata, offline status, backend/schema blockers.
- #18 reuses **End-to-End** route (`e2e`) for PostgreSQL → ML → Decision Engine → UI → History simulation and JSON run log.
- No backend, PostgreSQL connection, real ML inference, approved credit policy, or API history. Do not treat SIMULATED as production success.
- Source preserves original layout, palette, ambient animation, News, Roadmap, other FinRisk tabs.

## Run
Launch `run_localhost.bat` on Windows, open localhost, select Quản lý dữ liệu / End-to-End. For #19 enter valid #09 data first. Use mock actions, inspect JSON downloads. For #18 run valid and invalid applications.

## QA / DoD
- [x] Reuse routes without new nav tab.
- [x] Explicit MOCK / OFFLINE disclaimers.
- [x] Local-only save/read and export, pipeline simulation with invalid-input handling.
- [x] Scoped responsive CSS, VI/EN dictionary entries.
- [ ] Manual browser QA on 390 / 768 / 1440px and both languages.
- [ ] Real backend/schema, ML, policy, history APIs.
- [ ] Leader acceptance.

## Changed files
Modified: src/app.js, src/i18n.js, index.html, assets/styles.css.
Added: src/finrisk-integration-mock.js, tests/finrisk-items18-19.test.js, FINRISK_ITEMS18_19_HANDOFF.md.
Deleted: none.
