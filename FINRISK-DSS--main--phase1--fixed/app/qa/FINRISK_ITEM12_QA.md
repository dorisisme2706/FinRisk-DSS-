# QA #12 – Đánh giá tín dụng FinRisk (MOCK)

**Baseline:** `FinRisk_UI_Items09_10_Renamed_Tabs.zip`.

**Phạm vi:** Giữ nguyên vị trí tab `result`, layout tổng quan → hero → checklist/aside → reasons. Chuyển nội dung Release Gate cũ thành đánh giá tín dụng FinRisk. Tái sử dụng hồ sơ #09 và validation #10. Điểm rủi ro là các kịch bản giả lập 20, 55, 85 hoặc thiếu ML.

**Giới hạn:** Ngưỡng 40/70 chỉ là giả định trình diễn, không phải policy được duyệt. Chưa tích hợp ML thật, PostgreSQL, API hoặc quyết định cấp tín dụng thực tế.

## Kiểm thử

Chạy `node tests/finrisk-item-12.test.js`. Kiểm tra cú pháp với `node --check src/app.js`, `node --check src/i18n.js`, `node --check src/finrisk-decision-mock.js`.

## UAT thủ công – chưa xác nhận trên trình duyệt

1. Chạy `run_localhost.bat`, vào tab Đánh giá tín dụng.
2. Chọn lần lượt 20, 55, 85 và thiếu điểm ML; xem kết quả MOCK.
3. Kiểm tra khi hồ sơ không hợp lệ: `INVALID_INPUT`, không có điểm rủi ro.
4. Nhấn Chỉnh sửa hồ sơ vay, xác nhận điều hướng đến #09.
5. Chuyển VI/EN và kiểm tra tên tab, nội dung.
6. Kiểm tra responsive và các tab khác, News, Roadmap, animation.

## DoD

- [x] UI #12 và mock engine riêng, không nhúng dữ liệu ML thật.
- [x] Test logic, thiếu ML, invalid input, script order và nhãn VI/EN.
- [ ] Kiểm thử trình duyệt và evidence ảnh chụp.
- [ ] Policy, hợp đồng ML/API chính thức để thay MOCK.
- [ ] Leader duyệt.

**Trạng thái:** Đã triển khai frontend MOCK, chờ QA trình duyệt và leader nghiệm thu.
