# Bản nháp Pull Request — chưa tạo PR

Base dự kiến: `main`. Head: `integration/h13-core4`.

## Tiêu đề

Tích hợp tra cứu ML H13 với CORE4 thật và xác minh API/Chromium

## Mô tả

Trang Đánh giá tín dụng hiện có gọi API local để tra cứu hồ sơ CORE4 theo sk_id_curr. Backend nạp ProfileScorer một lần mỗi process, dùng LightGBM và policy H13 gốc; kiểm hash dữ liệu/model/policy/split và schema 169 đặc trưng trước khi phục vụ. Kết quả thật được hiển thị độc lập với MOCK, gồm score, manual-review recommendation và top 10 contributions; đổi VI/EN giữ kết quả hiện tại.

Cấu hình snapshot qua --snapshot hoặc FINRISK_SNAPSHOT; chặn ID final test và truy cập HTTP tới model/data. Không thay layout, màu sắc, CSS, model hoặc policy. Source được đưa ra app từ ZIP gốc nên Git hiển thị nhiều Added; H13_CHANGES.json phân biệt thay đổi thực tế với source giải nén nguyên trạng.

## Phạm vi đã LIVE PASS

- Linux/Python 3.12.14/Chromium: 52 PASS, 0 FAIL; không mock network hoặc dữ liệu trong live suite.
- Cả sáu reference: 100007, 379997, 100006, 100035, 100048, 171816.
- 100035 = 0.15160322574159024; review=true; explanation_status=ok.
- Top 10 feature/contribution/scale/observed value khớp reference trong bộ nhớ; không lưu observed values trong evidence public.
- Ngưỡng gốc 0.14484327385366114, comparator >=; trường hợp bằng ngưỡng trả review=true.
- API ready/score, lỗi 400/403/404, ID test, bảo vệ tài nguyên riêng tư, VI→EN→VI, 390px và backend outage thật.
- Trước đó: 31 tệp test JS và 10 test backend PASS. Các suite này không phải kiểm thử Windows.

Evidence: app/evidence/h13/live-results.json, core4-integrity.json và H13_CORE4_LIVE_REPORT.md.

## Chưa LIVE / vẫn MOCK

- PostgreSQL, hồ sơ mới và feature engineering, lịch sử, decision trace, báo cáo và toàn bộ chu trình nghiệp vụ ngoài tra cứu ML vẫn MOCK/chưa kết nối.
- Không phải kết quả nghiệm thu production, calibration PD hoặc phê duyệt tín dụng.
- Policy/schema business sign-off chưa ghi nhận.
- Windows 10/11: NOT TESTED; xem WINDOWS_RUN.md.

## Dữ liệu và đóng gói

- CORE4 nằm ngoài checkout; ZIP source sạch không chứa Parquet, model binary, split IDs, raw reference feature values, screenshot nhạy cảm, .env hoặc keys.
- Các asset ML cần cho runtime/QA được cấp qua kênh riêng và đặt đúng đường dẫn local bị ignore; ZIP source không tự chạy inference khi chưa bổ sung chúng.
- Có công cụ tools/package_source.py và FINAL_HANDOFF_REVIEW.md mô tả phạm vi kiểm tra.
- Lưu ý cần trưởng nhóm xử lý: ZIP source gốc đã có trong commit nền chứa model/split/reference values. PR không thêm lại các dữ liệu đó thành tệp riêng nhưng .gitignore không xóa nội dung có sẵn trong lịch sử. Chưa xóa hay rewrite lịch sử tự động. Không tuyên bố toàn bộ repository/history đã sạch dữ liệu.

## Cách review và xác minh

1. Đọc H13_CHANGES.json và source diff so với ZIP gốc; kiểm model/policy/CSS không đổi.
2. Cấp tài sản ML và CORE4 qua kênh nội bộ theo WINDOWS_RUN.md; không thêm chúng vào staging.
3. Chạy qa/verify_h13.py, backend_api/test_server.py và qa/h13_live_qa.py với snapshot đúng hash.
4. Kiểm evidence và thông báo VI/EN, xác nhận phạm vi MOCK.
5. Quyết định xử lý archive gốc/history và kế hoạch kiểm Windows trước khi publish/merge.

Chưa tạo commit, push, PR hoặc merge. Đây chỉ là nội dung đề xuất để trưởng nhóm review sau khi người dùng phê duyệt.
