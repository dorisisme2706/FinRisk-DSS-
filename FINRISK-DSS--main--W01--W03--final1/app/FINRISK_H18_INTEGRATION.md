# FinRisk H18 — Main model integration

## Trạng thái

`PASS_TECHNICAL_PENDING_FORMAL_GK_REVIEW`

Base: `FINRISK-DSS--main--phase1-fixed.zip`.

## Luồng đã nối

`CORE4 snapshot -> frozen H16 LightGBM -> ProfileScorer -> H18 review adapter -> local API -> frontend`

### Endpoint

- `GET /api/ml/health`
- `GET /api/ml/score?sk_id_curr=<id>`
- `GET /api/decision/assess?sk_id_curr=<id>`

Endpoint H18 trả risk score thật, threshold/policy version và `decision_support`.

## Guardrail nghiệp vụ

H18 **không** tự động APPROVE/REJECT và **không** tự tạo hạn mức, kỳ hạn, lãi suất hay monthly payment. Threshold `0.14484327385366114` chỉ tạo tín hiệu `MANUAL_REVIEW_RECOMMENDED` hoặc `NO_REVIEW_SIGNAL` theo policy demo đã khóa từ Validation.

Phần amount/term của UI MOCK vẫn độc lập; thay đổi scenario không được phép làm thay đổi risk score của model H16.

## Phiên bản khóa

- Model: `finrisk_lgbm_h12_demo_v0.2`
- Feature set: `core4_169_baseline_v1` — 169 predictor
- Data: `finrisk_v2_20261022151614259322`
- Threshold policy: `finrisk_demo_f1_validation_v1`
- Threshold: `0.14484327385366114`
- H16 stage: `h16_final_test_evaluated_pending_formal_GK_review`

Model, feature set, threshold và calibration không thay đổi sau Final Test H16.

## QA

- Python API tests: 12 PASS / 0 FAIL.
- Toàn bộ Node regression suite: 47 PASS / 0 FAIL.
- H18 real reference QA: 6/6 hồ sơ non-test khớp score; max absolute error `1.3877787807814457e-17`.
- `test_profiles_scored = 0` trong H18.
- Model hash, split hash và threshold-policy hash đều khớp metadata.

## Giới hạn

- Runtime sản phẩm vẫn dùng snapshot Parquet chuẩn và tự kiểm SHA256.
- Container hiện tại không có `pyarrow`, nên QA H18 tại đây dùng bản `feature_matrix.csv.gz` tương đương chỉ cho 6 reference profile; không thay đổi product code.
- Formal GK review vẫn pending.
- PostgreSQL chưa phải dependency của luồng tra cứu ID H18 này.
