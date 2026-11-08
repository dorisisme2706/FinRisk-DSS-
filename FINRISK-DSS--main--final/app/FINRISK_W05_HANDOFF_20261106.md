# FinRisk DSS – W05 Decision Engine – Bàn giao 06/11/2026

## 1. Kết quả

W05 đã được triển khai trên nền `FinRisk_DSS_W04_Loan_Simulation_20261106.zip`. Hạng mục bổ sung một tab `Decision Engine` độc lập với màn `Đánh giá tín dụng (MOCK)` cũ.

- Route: `http://127.0.0.1:8080/#decision`
- API: `GET /api/decision/assess?sk_id_curr=<id>` (H18 hiện có)
- Nguồn hồ sơ: CORE4 snapshot, chỉ tra cứu ID hiện hữu.
- Model: frozen LightGBM package, feature set `core4_169_baseline_v1` (169 predictors).
- Kết quả: `MANUAL_REVIEW_RECOMMENDED` hoặc `NO_REVIEW_SIGNAL` theo threshold demo đã khóa.

**Đây không phải quyết định cấp tín dụng.** `business_policy_status` vẫn là `NOT_APPROVED`; automatic credit decision luôn `false`. Không phát hành `APPROVE`/`REJECT`, không đề xuất số tiền/hạn mức, kỳ hạn, lãi suất hoặc khoản thanh toán. W05 không lưu quyết định vào database/lịch sử.

## 2. Chức năng W05

1. Tra cứu hồ sơ thật CORE4 theo `sk_id_curr` qua API H18.
2. Hiển thị risk score, threshold demo, review signal, model version, data version, feature-set version, threshold-policy version, H16 release stage.
3. Hiển thị calibration status, threshold scope, quality flags và top-10 feature contribution trên thang raw-margin log-odds qua panel ML H18 hiện có.
4. Hiển thị Decision Trace 6 bước: CORE4 profile → feature set → frozen LightGBM → threshold comparison → decision-support signal → business-policy gate.
5. Hiển thị rõ business policy chưa được duyệt, automatic decision disabled, loan terms not generated và read-only/no history write.
6. Hỗ trợ VI/EN thông qua cơ chế i18n hiện có; bố cục flow 3 cột desktop, 2 cột tablet, 1 cột mobile.

## 3. Guardrails

- Không dùng form hồ sơ vay #09 MOCK để tự tạo 169 predictors.
- Không thay đổi H16 model bundle, 169 predictors, model threshold, calibration hoặc business policy.
- Không đồng nhất `NO_REVIEW_SIGNAL` với chấp thuận khoản vay.
- Không đồng nhất `MANUAL_REVIEW_RECOMMENDED` với từ chối khoản vay.
- API response không đúng H18 contract hoặc có business policy ngoài `NOT_APPROVED` sẽ bị từ chối ở frontend.
- Các trường `recommended_amount`, `recommended_term_months`, `interest_rate`, `monthly_payment` phải là `null`.

## 4. File thay đổi

**Modified**
- `app/index.html` – nạp module W05 mới.
- `app/src/app.js` – thêm tab/route W05, màn Decision Engine, Decision Trace động và kiểm tra chặt response H18.
- `app/src/i18n.js` – bổ sung bản dịch VI/EN cho W05.
- `app/assets/styles.css` – bổ sung layout responsive W05.
- `app/backend_api/test_server.py` – thêm kiểm tra `NO_REVIEW_SIGNAL` không phải approval và kiểm tra policy basis.
- `app/CHANGELOG.md` – ghi nhận W05.

**Added**
- `app/src/finrisk-decision-engine.js` – validate H18 decision-support contract và build trace 6 bước.
- `app/tests/finrisk-w05-decision-engine.test.js` – 5 nhóm test W05.
- `app/FINRISK_W05_HANDOFF_20261106.md` – tài liệu này.

`backend_ml/` và `evidence/h16/` được giữ nguyên hash so với ZIP W04 nền.

## 5. Kiểm thử trong môi trường build

- JavaScript syntax (`app.js`, `i18n.js`, `finrisk-decision-engine.js`): PASS.
- Node.js regression: **71 PASS / 0 FAIL** (66 test nền W04 + 5 test W05).
- Python API regression: **18 PASS / 0 FAIL** (17 test nền + 1 test W05 no-review).
- Response contract unit tests: PASS cho cả `MANUAL_REVIEW_RECOMMENDED` và `NO_REVIEW_SIGNAL`; FAIL-CLOSED khi policy status, signal, ID hoặc loan-term fields không đúng.
- API contract smoke với test-double scorer: HTTP 200 và payload H18 có đầy đủ decision-support guardrails. Đây là test-double để kiểm tra UI/API contract, **không phải live inference trên CORE4**.
- ZIP integrity: kiểm tra sau đóng gói.

## 6. Cần kiểm tra trên Windows

### Chạy ứng dụng

Giải nén ZIP W05 vào thư mục mới, không ghi đè W04 đã nghiệm thu. Mở PowerShell tại `FINRISK-DSS--main\app`, sau đó chạy:

```powershell
.\run_with_ml.bat "D:\FinRisk_CORE4_Snapshot_For_GK_20261029\FinRisk_CORE4_Snapshot"
```

Dùng đúng đường dẫn CORE4 hiện tại trên máy người dùng. Giữ cửa sổ PowerShell mở và truy cập:

```text
http://127.0.0.1:8080/#decision
```

### Kịch bản kiểm tra

1. Tab `Decision Engine` xuất hiện trên thanh điều hướng; mở trực tiếp `#decision` cũng hoạt động.
2. Tra cứu `100035`: API trả kết quả thật từ CORE4; UI hiển thị risk score, threshold, signal, phiên bản model/data/policy, flags và Decision Trace 6 bước.
3. Với kết quả `MANUAL_REVIEW_RECOMMENDED`, không được thấy `APPROVE`/`REJECT` hay điều khoản vay được tạo.
4. Kiểm tra `100009` thuộc tập test: API phải từ chối với HTTP 403 và UI không hiển thị kết quả.
5. Chuyển VI → EN → VI sau khi đã có kết quả; các phần W05, panel H18 và Decision Trace phải đổi ngôn ngữ, vẫn giữ trạng thái kết quả.
6. Kiểm tra viewport 390×844, 768×1024, 1440×900; flow lần lượt 1, 2, 3 cột; không tràn ngang hoặc chồng lấn.
7. Quay lại W02 và W04 để đảm bảo không ảnh hưởng chức năng đã nghiệm thu.

### Kiểm thử tự động trên Windows

```powershell
.\run_tests.bat
```

Nếu môi trường `.venv` đã được cài, lệnh sẽ chạy Node và Python API tests. Có thể chạy riêng backend:

```powershell
.\run_api_tests.bat
```

## 7. Trạng thái nghiệm thu

| Hạng mục | Trạng thái |
|---|---|
| W05 source implementation | DONE |
| Node.js regression | 71/71 PASS |
| Python API regression | 18/18 PASS |
| H16 model/evidence unchanged | PASS |
| Actual CORE4 inference in this build environment | NOT RUN |
| Windows browser QA / VI-EN / responsive | PENDING USER QA |
| Full W05 acceptance | PENDING USER QA |

Không đánh dấu W05 hoàn tất nghiệm thu cho đến khi người dùng kiểm tra luồng thật trên Windows.


## 8. Hotfix đa ngôn ngữ tab W05 – 07/11/2026

Sau W05, phát hiện nhãn tab điều hướng `Decision Engine` giữ nguyên tiếng Anh khi chuyển sang VI. Nguyên nhân: nhãn nguồn trong `screens` là chuỗi tiếng Anh thuần; bộ dịch tổng quát chỉ dịch chuỗi có dấu tiếng Việt hoặc có ánh xạ phù hợp.

Đã sửa:
- Nhãn nguồn trong `src/app.js`: `Bộ máy hỗ trợ quyết định`.
- Ánh xạ trong `src/i18n.js`: `Bộ máy hỗ trợ quyết định` → `Decision Engine`.
- Bổ sung regression assertion trong `tests/finrisk-w05-decision-engine.test.js`.

Kỳ vọng: VI hiển thị `Bộ máy hỗ trợ quyết định`; EN hiển thị `Decision Engine`; chuyển EN → VI khôi phục đúng nhãn tiếng Việt. Không thay đổi API, model H16, 169 predictors, threshold, calibration hoặc policy.
