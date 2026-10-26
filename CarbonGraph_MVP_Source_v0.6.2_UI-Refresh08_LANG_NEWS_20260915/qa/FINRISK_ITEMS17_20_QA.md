# FinRisk #17 + #20 QA / DoD

- #17: 12 FinRisk manual UAT cases; all default NOT_RUN. Evidence notes + reviewer + export JSON only when 12/12 PASS. Browser UAT NOT EXECUTED in this package.
- #20: additive responsive CSS guardrails for Test Center and existing screen containers; preserved theme/ambient animations, navigation, News, Roadmap. Real viewport screenshots NOT CAPTURED.
- Automated checks: see tests/finrisk-items17-20.test.js and run `node --test tests/finrisk-items17-20.test.js`.
- MOCK: #09/#10/#11/#12/#13 are demonstration data/logic; no real ML, approved policy, PostgreSQL, or backend. #18/#19 blocked.
- Leader approval: PENDING. Final source acceptance and device/browser UAT: PENDING.
- Manual viewport matrix: 390px / 768px / 1440px; verify no horizontal overflow, VI/EN, News 6 cards, Roadmap 3 cards, ambient nodes, transitions, #11 six-step trace, #13 HTML/JSON exports.
- UAT results MUST be based on actual browser execution, not source checks.
