# Bàn giao tích hợp ML H13 — FinRisk DSS

> Bàn giao cuối: xem FINAL_HANDOFF_REVIEW.md và WINDOWS_RUN.md. Windows: NOT TESTED. ZIP source sạch loại tài sản ML/dữ liệu riêng tư; các hướng dẫn đóng gói cũ bên dưới là lịch sử.

> Cập nhật mới: [CORE4 thật đã được xác minh, 52 kiểm tra live PASS](H13_CORE4_LIVE_REPORT.md). Các mục BLOCKED do thiếu dữ liệu bên dưới là trạng thái lịch sử trước khi nhận snapshot. Windows và các luồng PostgreSQL/MOCK vẫn chưa được xác nhận.

## Trạng thái và phạm vi

Nhánh làm việc: `integration/h13-core4`, nền `191011985916fe0ca338c5e2da5c6c4ff6bce035`.
HEAD nền khớp remote main khi bắt đầu tác vụ. Không commit, push, PR, merge hoặc deploy.
Source có thể chạy nằm trong `app/`; ZIP gốc ở root được giữ nguyên.

Đã hoàn thiện các phần có thể kiểm thử độc lập: cấu hình snapshot, adapter API hiện hữu, bảo vệ tài nguyên riêng tư, kiểm tra CORE4 contract, panel tra cứu hiện hữu và VI/EN. Chưa xác nhận tích hợp end-to-end với dữ liệu thật.

Đã truy cập: model, metadata, policy, schema đặc trưng đóng gói, split manifest, ProfileScorer và sáu response examples. Thiếu ba đầu vào CORE4 gốc:

- `data/feature_matrix.parquet`
- `reports/feature_contract.json`
- `reports/model_candidate_columns.json`

SHA256 Parquet bắt buộc: `a86250a18e4bf23789176759a145b69562cc5caf072665c7b131b98c2232abc0`.
Candidate JSON cũng phải đúng hash gốc trong `finrisk_ml/common.py`. Không tạo dữ liệu thay thế.

## Thay đổi triển khai

- Tái sử dụng ProfileScorer và policy sẵn có. Khởi tạo scorer một lần trong main, dùng chung cho các request.
- `--snapshot` ưu tiên hơn `FINRISK_SNAPSHOT`; không có đường dẫn máy cá nhân mặc định.
- Chặn thiếu ba tệp CORE4; kiểm Parquet, candidate hash, thứ tự/tổ hợp predictor và kiểu numeric/TEXT giữa contract gốc và schema đóng gói.
- Giữ kiểm hash model/policy/split, bổ sung kiểm 169 predictor không trùng và không chứa ID/target/code_gender/days_birth; kiểm ID split đầy đủ, không trùng và tên split hợp lệ.
- Giữ nguyên chính sách gốc: ngưỡng `0.14484327385366114`, toán tử `>=`, khuyến nghị chuyên viên xem xét, không tự duyệt/từ chối. Model, metadata, policy, split và schema đặc trưng gốc không thay đổi.
- API lỗi: 400 ID không hợp lệ, 404 không có hồ sơ, 403 reserved test, 503 ML chưa sẵn sàng, 500 lỗi inference. Không gửi chi tiết lỗi khởi tạo/đường dẫn máy ra API.
- Chỉ phục vụ index, src và assets; chặn HTTP tới backend/model/split/data và directory listing. Đây vẫn là server local, không phải production server.
- Panel ML sử dụng layout và CSS hiện hữu. Giữ nguyên MOCK, navigation, màu sắc, hiệu ứng và các chức năng khác. Không thêm trang.
- Chuỗi panel ML và lỗi được quản lý VI/EN trong i18n.js; đổi ngôn ngữ giữ kết quả và ID đang nhập. Có timeout, khóa submit khi đang tải, kiểm phản hồi H13 trước khi hiển thị.
- Sửa CLI verify-references dùng `contracts/response_examples.json` có thật trong bundle.
- Cập nhật cờ triển khai trong contract/manifest; giữ trạng thái review chưa được ghi nhận và ghi rõ validation CORE4 đang blocked. Manifest SHA256 được cập nhật cho source ML chủ động chỉnh sửa; không thay hash kỳ vọng của model/policy/dữ liệu.

## Hướng dẫn Windows

Giải nén gói bàn giao, mở terminal ở thư mục chứa `setup_windows.bat` và `backend_api/`. Nếu dùng checkout Git, thư mục này là `app/`.

Cần Python 64-bit có lệnh `py` và Node.js để chạy regression. Linux hiện tại đã kiểm bằng Python 3.12.14 và Node 24.19.0; chưa kiểm trực tiếp Windows. Metadata model gốc ghi Python 3.14 trên Windows; phải chạy lại reference checks trên máy đích trước khi xác nhận inference.

```bat
setup_windows.bat
set "FINRISK_SNAPSHOT=C:\duong-dan-snapshot-duoc-cap"
run_with_ml.bat
```

Đường dẫn trên chỉ là ví dụ cấu hình; không có mặc định trong source. Hoặc:

```bat
run_with_ml.bat "C:\duong-dan-snapshot-duoc-cap"
```

Thư mục snapshot phải chứa `data\` và `reports\` với đủ ba tệp gốc. Server chỉ lắng nghe 127.0.0.1:8080. Mở trình duyệt trên máy đó ở cổng 8080, trang Đánh giá tín dụng. Nếu chưa cấu hình snapshot, UI vẫn chạy và ML trả 503; không có score giả. Sau khi thay snapshot cần khởi động lại process.

Kiểm thử sau khi nhận dữ liệu:

```bat
.venv\Scripts\python.exe qa\verify_h13.py --snapshot "C:\duong-dan-snapshot-duoc-cap"
.venv\Scripts\python.exe backend_ml\src\score_hk_h13.py --run backend_ml --snapshot "C:\duong-dan-snapshot-duoc-cap" --verify-references
.venv\Scripts\python.exe backend_api\test_server.py
run_tests.bat
```

`qa/verify_h13.py` thoát 2 khi thiếu dữ liệu (BLOCKED), 1 khi kiểm tra thất bại, 0 chỉ khi reference checks thực sự thành công. Script so sánh cả sáu hồ sơ, score sai số <= 1e-10, policy, review, explanation status, top 10 contributions và các guard. Sau đó cần kiểm API health 200 và gọi `/api/ml/score?sk_id_curr=100035` trên server thật, đối chiếu score `0.15160322574159024`, review true và explanation_status ok, rồi QA trình duyệt dùng backend thật.

QA bổ sung, không phải dependency runtime:

```bat
.venv\Scripts\python.exe -m pip install playwright
.venv\Scripts\python.exe -m playwright install chromium
.venv\Scripts\python.exe qa\h13_browser_qa.py
```

Browser QA dùng reference fixture được ghi nhãn rõ, không chứng nhận inference hoặc E2E thật. Để chạy toàn bộ JS thay vì tập con trong run_tests.bat, tại CMD:

```bat
for %F in (tests\*.test.js) do @node "%F"
```

## QA và evidence

| Kiểm tra | Kết quả | Evidence/phạm vi |
|---|---|---|
| Regression toàn bộ 31 tệp JavaScript | PASS | `app/evidence/h13/javascript-tests.log`, 284 dòng PASS, tất cả lệnh exit 0 |
| 10 test backend | PASS | `app/evidence/h13/backend-tests.log`; HTTP local, mã lỗi, chặn tài nguyên, cấu hình, hash/model/schema và guard |
| Chromium: panel, VI→EN→VI, 390px, lỗi, MOCK giữ nguyên | PASS | `app/evidence/h13/browser-results.json`, 14 checks |
| Model/policy/split gốc và schema 169 predictor | PASS | Test `test_original_model_policy_schema`, kiểm SHA256, deserialize model và đối chiếu schema |
| Chặn reserved test trước predictor | PASS, kiểm tra guard độc lập | Dùng ID từ split manifest thật; đối tượng scorer cô lập với predictor mock không được gọi. Không phải inference trên snapshot |
| Hiển thị 100035 = 15.160%, review và 10 đóng góp | PASS, UI fixture | `reference-vi.png`, `reference-en.png`; phản hồi từ response_examples gốc, không phải dự đoán mới |
| Dependency pip check | PASS | No broken requirements found trên Linux hiện tại |
| CORE4 Parquet/hash và hai schema gốc | BLOCKED | `app/evidence/h13/inference-results.json`: thiếu ba tệp |
| Inference thật 100035 và năm hồ sơ còn lại | BLOCKED | Chưa chạy predictor với CORE4 gốc |
| API scoring/E2E với CORE4 thật | BLOCKED | Chưa có dữ liệu gốc; kiểm HTTP không dữ liệu không thay thế E2E |
| Windows runtime | BLOCKED/chưa chạy | Có hướng dẫn, chưa có máy Windows để xác minh |

Không có lỗi chưa xử lý trong các suite hoàn tất. Lần chạy browser đầu bị lỗi callback của test harness; đã sửa và chạy lại toàn bộ 14 check thành công. Evidence hiện tại là lần chạy cuối.

## Giới hạn còn lại

- Cần cung cấp ba tệp CORE4 gốc qua cơ chế tệp an toàn; không đưa dữ liệu khách hàng vào Git hoặc ZIP bàn giao source.
- Policy vẫn demo_only_pending_review; model provisional, chưa được xác nhận calibration thành PD, chưa có sign-off nghiệp vụ/schema.
- PostgreSQL, tạo đặc trưng hồ sơ mới, lịch sử, báo cáo/trace/E2E vẫn MOCK; không tự nối kết quả thật vào các nghiệp vụ chưa có dữ liệu/contract được duyệt.
- Không chứng nhận dịch hoàn chỉnh mọi màn hình legacy; các chuỗi mới của panel H13 đã được kiểm VI/EN thực tế.
- Server dành cho local; triển khai production, auth, kiểm soát truy cập dữ liệu và vận hành ngoài phạm vi này.

## Added / Modified / Deleted

Danh sách máy đọc đầy đủ ở `H13_CHANGES.json`. So với source trong ZIP gốc, Modified:

1. `app/backend_api/server.py`
2. `app/backend_ml/src/finrisk_ml/inference.py`
3. `app/backend_ml/src/score_hk_h13.py`
4. `app/backend_ml/contracts/inference_contract_h13.json`
5. `app/backend_ml/BUNDLE_MANIFEST.json`
6. `app/src/app.js`
7. `app/src/i18n.js`
8. `app/run_with_ml.bat`

Added so với ZIP:

1. `app/.gitignore`
2. `app/setup_windows.bat`
3. `app/backend_api/test_server.py`
4. `app/qa/verify_h13.py`
5. `app/qa/h13_browser_qa.py`
6. `app/evidence/h13/backend-tests.log`
7. `app/evidence/h13/browser-results.json`
8. `app/evidence/h13/inference-results.json`
9. `app/evidence/h13/javascript-tests.log`
10. `app/evidence/h13/reference-vi.png`
11. `app/evidence/h13/reference-en.png`

Deleted: không có. Ngoài app: sửa `README.md`, thêm `H13_DELIVERY.md`, `H13_CHANGES.json`. Theo Git, toàn bộ `app/` là Added vì nền trước đó chỉ theo dõi ZIP; danh sách JSON liệt kê từng đường dẫn Git Added, đồng thời phân biệt tệp được giải nén nguyên trạng và tệp thực sự thay đổi. ZIP gốc không đổi.

## GitHub Desktop — nội dung commit đề xuất

Summary:

`Tích hợp adapter ML H13, cấu hình CORE4 và giao diện VI/EN`

Description:

```text
Đưa source ZIP vào app để quản lý thay đổi trên Git và giữ nguyên gói bàn giao gốc.
Tái sử dụng ProfileScorer và policy H13; cấu hình snapshot qua --snapshot hoặc FINRISK_SNAPSHOT.
Kiểm contract CORE4, bảo vệ model/data khỏi HTTP và chuẩn hóa lỗi API.
Hoàn thiện panel tra cứu hiện hữu, VI/EN, kiểm response và xử lý lỗi; giữ nguyên MOCK và giao diện.
Bổ sung setup Windows, reference verifier và evidence QA.

Đã chạy: 31 tệp JS, 10 test backend, 14 check Chromium và pip check.
BLOCKED: inference 100035/sáu reference và E2E thật do thiếu Parquet cùng hai schema CORE4 gốc.
Chưa kiểm Windows. Không thay model, policy hoặc ngưỡng. Không push/merge/deploy.
```

Chưa tạo commit hoặc PR. Chỉ cân nhắc PR sau khi người dùng xem danh sách thay đổi và kết quả QA này.
