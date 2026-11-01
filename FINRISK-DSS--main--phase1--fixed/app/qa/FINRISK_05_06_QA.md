# QA / Acceptance — #05 Hero & #06 KPI Dashboard

Source: FinRisk_UI_Items05_06_Demo.zip (unchanged feature code).

| Case | Expected | Status | Evidence |
|---|---|---|---|
| #05 Hero text | FinRisk credit-risk messaging | PASS (static) | evidence/item05_06/static_test_results.json |
| #05 CTA labels | Application and Decision Trace CTA present | PASS (static only) | static_test_stdout.txt |
| #05 CTA clicks | Navigate correctly | NOT RUN | browser UAT required |
| #05 no legacy CBAM in Overview | All visible text is FinRisk | OPEN | legacy content remains |
| #05 desktop/mobile | No overlap or broken animation | NOT RUN | screenshots required |
| #06 KPI + charts | Render and update without JS errors | NOT RUN | browser UAT required |
| #06 dashboard markup/CSS | Source declarations exist | PASS (static) | static_test_stdout.txt |
| #06 MOCK disclosure | Visible in browser | NOT RUN | screenshot required |
| #06 responsive | 390 / 768 / 1366 px | NOT RUN | screenshots required |
| Leader sign-off | Approved with evidence | PENDING | leader approval required |

**DoD: NOT MET.** Do not claim runtime/browser evidence from static checks. KPI data are demo/mock.

## Browser evidence checklist
1. Start `run_localhost.bat`; capture desktop 1366px Hero + dashboard.
2. Capture mobile 390px and tablet 768px; check scrolling, animations, and overflow.
3. Click both CTA; record destination and console errors.
4. Capture KPI/charts and visible MOCK label.
5. Attach screenshot filenames and leader sign-off.
