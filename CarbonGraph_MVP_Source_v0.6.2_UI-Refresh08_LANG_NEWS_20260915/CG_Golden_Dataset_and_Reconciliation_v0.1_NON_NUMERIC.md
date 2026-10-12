# CG GOLDEN DATASET & RECONCILIATION v0.1 – NON-NUMERIC ONLY

## Trạng thái

`PARTIAL / NON_NUMERIC_ONLY` – 22/08/2026.

Tài liệu này không phải golden result cho phát thải. R-006 vẫn OPEN, C4 chưa chạy và không có expected emission number.

## Baseline được phép đối chứng

| Field | Expected |
|---|---|
| data_origin | SYNTHETIC_DEMO |
| facility | FAC-VN-001 |
| product | RP-ST-001 |
| period | 2026 |
| batch | BATCH-SYN-001 |
| HRC lot | HRCLOT-SYN-001 |
| candidate CN8 | 72083800 · SYNTHETIC_CANDIDATE · REVIEW |
| real HRC CN8 | null · MISSING/REVIEW |
| HRC SEE | null · MISSING |
| graph integrity | PASS · orphan 0 |
| release | BLOCKED · MASKED |
| compliance | NOT_EVALUATED |
| R-006 | OPEN |

## Reconciliation assertions

1. Synthetic candidate không được copy sang real CN8.
2. Blank numeric không được đổi thành 0.
3. Report không chứa `numericValue`, SEE numeric value hoặc emission unit/value.
4. Graph phải có INSTANCE_OF, PRODUCED_AT, CONSUMES, IS_LOT_OF, DERIVED_FROM, HAS_TRACE và GATED_BY.
5. Working report phải có trace ID và guardrails.

## Các cột numeric bị cấm điền ở v0.1

- expected embedded emission;
- actual embedded emission;
- deviation/variance numeric;
- tolerance numeric;
- pass/fail calculation accuracy.

## Điều kiện để nâng lên v1.0 numeric

Chỉ thực hiện khi R-006 được xử lý đúng quyết định dự án, factor/SEE source được khóa, C4 calculation version được phê duyệt, công thức A5 được reviewer xác nhận và có independent reference calculation. Không dùng dữ liệu SYNTHETIC_DEMO để công bố kết quả thật.
