# Kết quả kiểm thử CORE4 thật — FinRisk DSS H13

> Đóng gói hiện hành: xem FINAL_HANDOFF_REVIEW.md. ZIP source sạch không kèm model binary, split IDs, reference values hoặc ảnh chụp chứa dữ liệu; WINDOWS_RUN.md hướng dẫn bổ sung local assets. Trạng thái Windows: NOT TESTED.

## Kết luận

PASS cho luồng tra cứu hiện hữu: CORE4 thật → LightGBM/ProfileScorer → policy gốc → API HTTP → Chromium. Cả sáu hồ sơ tham chiếu khớp; 52 kiểm tra API/Chromium thực tế thành công. Không dùng fixture, route interception hoặc dữ liệu thay thế trong bộ kiểm thử live.

Nhánh: `integration/h13-core4`. Không commit, push, merge, PR hoặc production deployment.

## Gói dữ liệu và vị trí

Hai phần `.7z.001` (20,971,520 byte) và `.7z.002` (13,792,069 byte) đã tải đủ. Môi trường chưa có 7-Zip CLI nên đã cài py7zr vào venv riêng, ghép các volume đúng thứ tự byte và giải nén. Archive 7z chứa ZIP gốc; kiểm CRC ZIP thành công và giải nén đủ 7 tệp. Sau kiểm thử, cả 7 tệp được đối chiếu lại byte-for-byte với ZIP gốc, không thay đổi.

Snapshot root:

`/workspace/finrisk-data/extracted/snapshot/FinRisk_CORE4_Snapshot`

Đã tìm thấy và sử dụng:

- `data/feature_matrix.parquet`
- `reports/feature_contract.json`
- `reports/model_candidate_columns.json`

SHA256 Parquet:

`a86250a18e4bf23789176759a145b69562cc5caf072665c7b131b98c2232abc0`

Hash khớp yêu cầu và metadata model. Candidate hash khớp giá trị gốc được khóa trong common.py. Contract CORE4 và schema model khớp thứ tự 169 predictor (154 numeric, 15 categorical). ID, TARGET, code_gender và days_birth không nằm trong predictor.

## Kết quả thực tế

| ID tham chiếu | risk_score thực tế | review_recommended | explanation_status |
|---|---:|---|---|
| 100007 | 0.06580698514961447 | false | ok |
| 379997 | 0.05751336121481303 | false | ok |
| 100006 | 0.08725027752667788 | false | ok |
| 100035 | 0.15160322574159024 | true | ok |
| 100048 | 0.2599797810722127 | true | ok |
| 171816 | 0.14484327385366114 | true | ok |

Tất cả score khớp response_examples trong sai số <= 1e-10; trên lần chạy này các số hiển thị trùng số tham chiếu. API đã đối chiếu đủ top 10: tên feature, giá trị quan sát, contribution và thang raw_margin_log_odds. Giá trị quan sát chỉ dùng trong bộ nhớ để đối chiếu, không ghi vào evidence trong repository.

Policy gốc giữ nguyên `finrisk_demo_f1_validation_v1`, ngưỡng `0.14484327385366114`, toán tử `>=`. ID 171816 đúng bằng ngưỡng và trả true. Đây là tín hiệu manual review của policy demo, không phải phê duyệt tín dụng hoặc policy production đã được duyệt.

## QA PASS / FAIL / BLOCKED

| Kiểm tra | Kết quả | Evidence |
|---|---|---|
| Hai phần archive, giải nén và tính bất biến của snapshot | PASS | `app/evidence/h13/core4-integrity.json`; hash từng phần ở thư mục dữ liệu riêng |
| Parquet SHA256, candidate hash, CORE4 contract/model schema | PASS | `core4-integrity.json`; ProfileScorer khởi tạo thành công |
| ProfileScorer với cả sáu hồ sơ và guards | PASS | `/workspace/finrisk-data/evidence/inference-live.json` |
| API health với CORE4 thật | PASS | `app/evidence/h13/live-results.json` |
| API score/policy/top10 của sáu reference | PASS | `live-results.json`, 24 kiểm tra score/policy/top10/privacy |
| API ID sai, ID không có, reserved test | PASS | 400/404/403 đúng mã lỗi; không score cho ID test |
| Chặn truy cập HTTP model, dữ liệu, split, source backend | PASS | 4 kiểm tra HTTP 404 |
| Chromium tra cứu cả sáu ID qua backend thật | PASS | 6 lần submit thật, so score response và 10 dòng giải thích trên DOM |
| Chromium 100035, VI→EN→VI | PASS | Score 15.160%, review recommendation, kết quả/ID/top10 giữ nguyên khi đổi ngôn ngữ |
| Chromium ID không tồn tại và ID test, VI/EN | PASS | Request thật trả 404/403, thông báo đúng ở hai ngôn ngữ |
| Chromium ID không hợp lệ | PASS | Validation frontend chặn abc |
| Chromium backend thực sự ngừng hoạt động | PASS | Dừng process do test khởi tạo, xác nhận thông báo mất kết nối VI/EN; không mock response |
| Panel 390px, MOCK selector và lỗi JavaScript runtime | PASS | Panel trong viewport, MOCK còn nguyên, không có pageerror |
| Model, metadata, policy, split, schema đóng gói, index và CSS không đổi | PASS | SHA256 và so sánh byte với ZIP source gốc |
| Windows runtime | NOT TESTED | Kiểm thử hiện tại trên Linux/Chromium; chưa xác nhận trên máy Windows |
| PostgreSQL, tạo feature hồ sơ mới, báo cáo/trace ngoài tra cứu ML | Chưa kiểm thử tích hợp thật | Các module này vẫn MOCK như trước, không thuộc PASS của luồng tra cứu CORE4 |

Tổng bộ live QA: 52 PASS, 0 FAIL. Không còn BLOCKED do thiếu snapshot. 31 tệp JavaScript và 10 test backend của tác vụ trước giữ nguyên kết quả; không gọi đó là lượt chạy mới trong báo cáo này.

## Chạy lại

Tại `/workspace/FINRISK-DSS-/app`, dùng venv đã có:

```bash
export FINRISK_SNAPSHOT=/workspace/finrisk-data/extracted/snapshot/FinRisk_CORE4_Snapshot
export OMP_NUM_THREADS=2 OPENBLAS_NUM_THREADS=2 PYTHONDONTWRITEBYTECODE=1
/workspace/finrisk-runtime/venv/bin/python qa/verify_h13.py
/workspace/finrisk-runtime/venv/bin/python qa/h13_live_qa.py
```

Bộ live QA khởi tạo và dừng server riêng trên cổng động; không để lại process. Nó ghi evidence ngoài checkout và không xuất hàng dữ liệu/TARGET/giá trị feature. Cần Playwright và Chromium như môi trường hiện tại.

Để sử dụng UI tương tác với CORE4 thật:

```bash
FINRISK_SNAPSHOT=/workspace/finrisk-data/extracted/snapshot/FinRisk_CORE4_Snapshot \
OMP_NUM_THREADS=2 OPENBLAS_NUM_THREADS=2 \
/workspace/finrisk-runtime/venv/bin/python backend_api/server.py --port 8080
```

Trên Windows: `setup_windows.bat`, sau đó `run_with_ml.bat "DUONG_DAN_SNAPSHOT_GOC"`. Giữ nguyên cấu trúc data/reports. Có thể chạy `qa/verify_h13.py` để xác minh runtime Windows; chưa đánh dấu Windows PASS.

## File thay đổi trong lượt này

Added:

- `app/qa/h13_live_qa.py`: test tái chạy với CORE4/API/Chromium thật, không fixtures.
- `app/evidence/h13/core4-integrity.json`: hash, số predictor và bằng chứng artifact không đổi; không chứa snapshot/feature values/TARGET.
- `app/evidence/h13/live-results.json`: kết quả 52 checks và score của các ID tham chiếu đã có trong source gốc.
- `H13_CORE4_LIVE_REPORT.md`: báo cáo này.

Modified:

- `H13_DELIVERY.md`: thêm liên kết trạng thái live mới, giữ báo cáo cũ làm lịch sử.
- `README.md`: dẫn tới kết quả live.
- `H13_CHANGES.json`: cập nhật danh sách đầy đủ và phân biệt lượt kiểm thử CORE4 mới.

Deleted: không có. Không sửa app.js, i18n.js, backend API, ProfileScorer, model hoặc policy trong lượt này. Không tạo thêm model binary.

Dữ liệu CORE4, các phần archive, raw log và bản giải nén đều nằm ngoài checkout. Báo cáo JSON được đưa vào source chỉ chứa kết quả tổng hợp, hash và score tham chiếu có sẵn; không chứa giá trị feature khách hàng hoặc TARGET. ZIP bàn giao chỉ gồm source/evidence đã chọn rõ ràng, không chứa CORE4 hay attachments.
