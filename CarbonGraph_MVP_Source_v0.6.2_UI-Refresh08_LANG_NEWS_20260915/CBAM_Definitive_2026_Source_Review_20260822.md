# CBAM DEFINITIVE 2026 – OFFICIAL SOURCE REVIEW

Review date: 22/08/2026. Purpose: source-control note for C3/VR-001–022 expansion. This is not legal advice and does not change R-006, C4 or any Gate decision.

## Official sources checked

1. Regulation (EU) 2023/956 establishing CBAM: https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32023R0956
2. Commission Implementing Regulation (EU) 2025/2547 on calculation methods for embedded emissions: https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ:L_202502547
3. European Commission CBAM legislation/guidance index: https://taxation-customs.ec.europa.eu/carbon-border-adjustment-mechanism/cbam-legislation-and-guidance_en
4. European Commission definitive-period guidance release dated 14/08/2026: https://taxation-customs.ec.europa.eu/news/european-commission-publishes-series-guidance-documents-support-cbam-implementation-definitive-2026-08-14_en
5. Correcting act for definitive-period default values, Implementing Regulation (EU) 2026/1740: https://eur-lex.europa.eu/eli/reg_impl/2026/1740/oj

## Findings that affect CarbonGraph

1. The definitive regime is active from 01/01/2026. Transitional Implementing Regulation (EU) 2023/1773 is not the correct sole methodology baseline for numeric work in 2026.
2. Calculation-method source control must point to Implementing Regulation (EU) 2025/2547 and its annexes before C4 is opened.
3. Default-value source control must record both Implementing Regulation (EU) 2025/2621 and the correcting act 2026/1740. An informational Excel alone is not the legally binding source.
4. The Commission released ten definitive-period guidance documents on 14/08/2026, including Guidance No. 3 on embedded-emission calculation and Guidance No. 5d for iron and steel. These should be reviewed against A5 and the VR registry.
5. For actual-value reporting, the official template expects operator/installation identity, address, installation identifier, UN/LOCODE, coordinates, production processes/routes and goods by CN code.
6. Precursor records may need CN code, good name, country of origin, reporting period, origin installation and the actual/default path. Multiple periods/installations trigger weighted-average logic under Articles 13–15 of Implementing Regulation 2025/2547.
7. Data-quality/method fields and the share using default values are reportable controls, not optional UI decoration.
8. Verification is a separate controlled activity. CarbonGraph remains a working tool and must not represent itself as a verifier.

## Required next changes before expanding VR-001–022

| Priority | Change | Safe action while R-006 OPEN |
|---|---|---|
| P0 | Update Source Register to definitive 2026 legal acts and guidance | Yes; documentation only |
| P0 | Reconcile A5 against 2025/2547 Annexes and iron/steel Guidance 5d | Yes; reviewer analysis, no numeric output |
| P0 | Lock corrected default-value source/version | Yes; metadata/source registry only; values remain blocked from release |
| P1 | Extend Data Dictionary for operator/installation/process/precursor provenance | Yes; schema/UI fields may be added as MISSING/REVIEW |
| P1 | Map each VR rule to article/annex/guidance/source version | Yes; no unreferenced rule may be promoted to ACCEPTED |
| P1 | Add reporting-period and multi-installation precursor model | Yes; structure/trace only |
| P2 | Implement weighted-average/default/actual numeric path | No; HOLD until R-006 and C4 controls are satisfied |
| P2 | Claim calculation accuracy or compliance | Prohibited |

## Decision for v0.6

No new legal/numeric rule was inserted into the engine from this review. v0.6 only improves technical status semantics, UAT and non-numeric trace/reconciliation. This prevents a newly published or corrected definitive-period source from being silently replaced by assumptions.
