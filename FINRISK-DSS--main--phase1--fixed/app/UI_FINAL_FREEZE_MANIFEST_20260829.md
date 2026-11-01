# CARBONGRAPH UI FINAL FREEZE MANIFEST

**Build:** `CarbonGraph_MVP_Source_v0.6.2_UI-FINAL_20260829`  
**Technical baseline:** `v0.6.2 RC1_CANDIDATE`  
**UI status:** `VISUAL_FROZEN`  
**Date:** 29/08/2026

## 1. Freeze decision

The following visual directions are approved and frozen:

- CarbonGraph brand/logo in the top-left header.
- Eco/enterprise visual language: forest green, emerald, mint, white and neutral surfaces.
- Marketing header + product navigation + technical workspace navigation.
- Animated graph-node background with denser nodes and medium-light motion speed.
- Landing/product narrative, capability cards and product-roadmap concept section.
- Deep workspace layouts for Input, Evidence, Validation, Trace, Release, Export, End-to-End and Test Center.
- Toast notifications, SVG navigation icons, empty/error/busy states and graph node inspector.
- Enterprise multi-column footer with TerraMetric branding, project/contact information and operational guardrails.
- Responsive rules for compact laptop, Full HD and mobile layouts.

## 2. Frozen guardrails

UI freeze does NOT change product/compliance status:

- `SYNTHETIC_DEMO`
- `R-006 OPEN`
- `NUMERIC BLOCKED / MASKED`
- `COMPLIANCE NOT_EVALUATED`
- Candidate CN remains separate from real CN.
- No numeric tCO2e/SEE is released.

## 3. Change policy after freeze

Allowed after this build:

- Critical UI bug fixes.
- Broken interaction fixes.
- Browser compatibility fixes.
- Text typo corrections that do not alter claims.
- Accessibility fixes.
- Small responsive fixes required for the actual demo device.

Not allowed without explicitly reopening the UI design phase:

- New navigation architecture.
- Major palette changes.
- Major spacing/typography redesign.
- New landing sections.
- Replacing the animated graph visual direction.
- Redesigning workspace modules.

## 4. Required release checks

- JavaScript syntax check PASS.
- Automated regression 75/75 PASS.
- Localhost assets return HTTP 200.
- Manual visual acceptance remains the final device-specific check.

## 5. Demo rule

This UI is the frozen localhost demonstration interface. It is not an official CBAM filing interface and does not certify compliance.

## 6. Final verification results

- JavaScript syntax: **PASS** (`src/app.js`, `src/ambient-graph.js`).
- Automated regression: **75/75 PASS** across 13 test files.
- Localhost smoke: **PASS**.
  - `index.html` → HTTP 200
  - `assets/styles.css` → HTTP 200
  - `assets/carbongraph-logo.png` → HTTP 200
  - `src/app.js` → HTTP 200
  - `src/ambient-graph.js` → HTTP 200
- User approved before freeze: graph motion speed, enterprise footer, and overall product/landing direction.

**Final UI decision:** `VISUAL_FROZEN`
