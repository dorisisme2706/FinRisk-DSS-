# FinRisk DSS – Legacy cleanup (26/10/2026)

## Changes
- Replaced CarbonGraph header branding with FinRisk DSS and a new SVG logo.
- Replaced CBAM-specific overview sections (readiness, capabilities, comparison, runtime, FAQ) with a FinRisk decision-flow explanation and FAQ.
- Preserved the FinRisk Hero, KPI dashboard, 3-card Product Roadmap, six Financial News cards, ambient animation, green palette and navigation structure.
- Removed obsolete CBAM/CarbonGraph translation entries, unused news icons and legacy documentation from the distributed source.
- Updated launcher branding.

## Compatibility limitations / blockers
The original runtime still depends on CG-prefixed internal modules, legacy sample data, rules and data contracts. These are **not** real FinRisk business logic. They remain in the source to avoid breaking existing pages and automated tests; a full removal requires replacing the remaining Evidence Queue / End-to-End legacy workflows and state/persistence contracts with FinRisk-specific implementations. Do not claim the codebase is 100% CarbonGraph-free.

The credit decision, report and trace use MOCK data; PostgreSQL/ML/backend remain unintegrated. Browser QA and leader acceptance are pending.
