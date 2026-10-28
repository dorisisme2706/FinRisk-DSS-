# #09 + #10 – FinRisk Loan Application + Financial Validation

## Files changed
- `src/app.js` – replaced legacy CarbonGraph contents **only** inside Input Module and Validation screens with FinRisk loan workflows.
- `src/finrisk-loan.js` – MOCK schema, field validation, browser persistence.
- `src/i18n.js` – new VI/EN translation entries.
- `index.html` – load loan module before app.
- `tests/finrisk-items-09-10.test.js` – Node regression checks.
- `qa/FINRISK_ITEMS09_10_QA.md` – handoff and manual QA.

## Data contract (draft)
`customer_id`, `full_name`, `age`, `monthly_income`, `monthly_expenses`, `existing_monthly_debt`, `loan_amount`, `loan_term_months`, `loan_purpose`.

## Scope limits
MOCK-only. No real customer records, database, backend, ML or credit decisions. Legacy CarbonGraph behavior in **other tabs** remains untouched pending explicit migration scope. No leader approval claimed.

Suggested commit: `feat(finrisk): add mock loan application and financial validation (#09 #10)`
