# FinRisk DSS — Model Card H15

## 1. Phạm vi gói

Đây là gói H15 dùng mô hình ngoài notebook. Gói **không huấn luyện lại**, không thay đổi model score, feature, split hay threshold từ H12/H13. Tập final test vẫn giữ kín.

## 2. Mô hình

- Thuật toán: LightGBM (`lgbm_leaves15_unweighted`)
- Model version: `finrisk_lgbm_h12_demo_v0.2`
- Feature set: `core4_169_baseline_v1` — 169 predictors
- Best iteration: 494
- Calibration: `uncalibrated_candidate_not_selected`
- Model SHA256: `7db887ce309eaa9c2151c9f408c1f7b673e562fa8b3aed08f8f22942581dae34`

## 3. Dữ liệu và split

- Data version: `finrisk_v2_20261022151614259322`
- Data SHA256: `a86250a18e4bf23789176759a145b69562cc5caf072665c7b131b98c2232abc0`
- Split SHA256: `1992247193e6eab1d895732bc8c9350fd70fac641e1b4773ad0331a151a88417`
- Snapshot đầy đủ **không nằm trong ZIP model**; phải truyền `snapshot_root` chứa `data/feature_matrix.parquet`.
- `SK_ID_CURR`, TARGET, `code_gender`, `days_birth` không thuộc X mặc định.
- Tập test bị chặn trong `ProfileScorer`; H15 không mở test.

## 4. Threshold demo

- Policy: `finrisk_demo_f1_validation_v1`
- Threshold: `0.14484327385366114` với comparator `>=`
- Mục tiêu chọn: maximum validation F1; ties within 1e-12 use highest threshold
- Validation: 46127 hồ sơ
- Precision tại điểm vận hành: 0.248845
- Recall: 0.462943
- F1: 0.323695
- Đây là **demo policy**, không phải ngưỡng phê duyệt tín dụng thật; không tự động approve/reject.

## 5. Giải thích mô hình

- Phương pháp: LightGBM native `pred_contrib`
- Scale: `raw_margin_log_odds`
- Top-10 chỉ là đóng góp vào margin, không phải thay đổi phần trăm xác suất và không phải quan hệ nhân quả.

## 6. Bằng chứng chạy độc lập

H13 đã chạy fresh-process smoke trên chính model/data/split hash này: `PASS`; 6 validation profiles; test scored = 0. H15 giữ nguyên byte của model và các contract chính, đồng thời bổ sung `predict.py` và `smoke_test.py` để GK chạy lại trong môi trường mới.

## 7. Giới hạn

- Chỉ chấm các hồ sơ đã tồn tại trong snapshot CORE4.
- Không tạo 169 feature bằng 0 từ form ít trường.
- Score là xác suất mô hình phục vụ DSS nghiên cứu, không phải quyết định tín dụng tự động.
- H15 chưa phải final-test release; H16 mới là gate đánh giá cuối theo workflow.
