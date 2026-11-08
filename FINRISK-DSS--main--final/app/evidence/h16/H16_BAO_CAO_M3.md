# BÁO CÁO H16 — Gate M3 / đánh giá cuối trên Test

**Kết quả kỹ thuật:** `PASS_H16_FINAL_TEST_PENDING_FORMAL_GK_REVIEW`

H16 sử dụng nguyên package H15/H13 đã khóa. Không huấn luyện lại, không đổi feature, không đổi calibration và không đổi threshold sau khi xem Test. Tập Test được mở cho đánh giá cuối với **46.127 hồ sơ** và từ thời điểm này **không còn được dùng để chọn mô hình hoặc tuning**.

## 1. Khóa trước khi mở Test

- Model: `finrisk_lgbm_h12_demo_v0.2`
- Model SHA256: `7db887ce309eaa9c2151c9f408c1f7b673e562fa8b3aed08f8f22942581dae34`
- Feature set: `core4_169_baseline_v1` — **169 predictors**
- Data version: `finrisk_v2_20261022151614259322`
- Data SHA256 (Parquet): `a86250a18e4bf23789176759a145b69562cc5caf072665c7b131b98c2232abc0`
- Split SHA256: `1992247193e6eab1d895732bc8c9350fd70fac641e1b4773ad0331a151a88417`
- Threshold policy: `finrisk_demo_f1_validation_v1`
- Threshold đã khóa trên Validation: **0.14484327385366114**
- Calibration: `uncalibrated_candidate_not_selected`
- 6 hồ sơ reference không thuộc Test khớp trước khi mở Test; sai số lớn nhất: **1.388e-17**.

## 2. Kết quả Final Test

| Chỉ số | Kết quả |
|---|---:|
| Số hồ sơ | 46,127 |
| TARGET=1 | 3,724 (8.07%) |
| ROC-AUC | **0.777079** |
| Average Precision | **0.273886** |
| PR-AUC hình thang | 0.273724 |
| Gini | 0.554158 |
| KS | 0.422188 |
| Brier score | 0.066396 |
| Log loss | 0.239902 |
| Accuracy tại threshold khóa | 84.64% |
| Precision | **25.43%** |
| Recall | **46.72%** |
| F1 | **0.329358** |
| Tỷ lệ hồ sơ được gắn cờ review | 14.83% |

Confusion matrix theo nhãn `[0, 1]`:

- TN = **37,301**
- FP = **5,102**
- FN = **1,984**
- TP = **1,740**

## 3. Diễn giải

Kết quả Test gần với kết quả phát triển trên Validation (Validation LightGBM khoảng ROC-AUC 0,7770 và AP 0,2720). Điều này cho thấy khả năng xếp hạng của model không suy giảm mạnh trên tập giữ riêng trong split hiện tại. Tuy nhiên, đây là split ngẫu nhiên phân tầng trên dữ liệu ẩn danh thời gian; kết quả chưa chứng minh khả năng khái quát theo thời gian thật.

Threshold `0.14484327385366114` được chọn trước H16 trên Validation theo mục tiêu F1 cho **demo**. Nó không phải ngưỡng tối ưu nghiệp vụ ngân hàng và không tự động phê duyệt/từ chối khoản vay. Với threshold này trên Test, hệ thống gắn cờ khoảng 14.83% hồ sơ để review; Recall 46.72% và Precision 25.43%.

## 4. Quy tắc sau khi mở Test

- Không đổi model theo kết quả Test.
- Không thêm/bớt feature theo kết quả Test.
- Không đổi threshold theo kết quả Test.
- Không calibration lại theo Test.
- Nếu phát hiện lỗi thiết kế nghiêm trọng khiến Test mất độc lập, phải công bố Test hiện tại không còn nguyên vẹn và lập protocol đánh giá mới; không âm thầm chạy tuning rồi chấm lại cùng tập.

## 5. Lưu ý môi trường thực thi

Môi trường đánh giá hiện tại không trùng hoàn toàn `requirements-lock.txt` của H13/H15. Trước khi mở Test, 6 reference score đã được đối chiếu và khớp với sai số tối đa 1.388e-17. Vì môi trường không có `pyarrow`, H16 đọc `feature_matrix.csv.gz`, là representation cùng bảng được đăng ký trong `HANDOFF_MANIFEST.json`; Parquet SHA256 vẫn được kiểm để xác nhận đúng data version. Hai cảnh báo `InconsistentVersionWarning` của scikit-learn được lưu trong `h16_run_summary.json`.

## 6. Kết luận M3

**H16 PASS về kỹ thuật và chờ GK review chính thức.** Model/policy sau H16 được coi là **frozen**. Nếu không phát sinh lỗi package/integration thì không cần dùng H17; chuyển sang H18 để nối model chính với Decision Engine và đối chiếu version/threshold giữa model và service.
