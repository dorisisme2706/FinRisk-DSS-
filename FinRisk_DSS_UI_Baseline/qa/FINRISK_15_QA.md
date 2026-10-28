# FinRisk DSS — #15 VI/EN QA

## Phạm vi
- Mở rộng `src/i18n.js` với 97 ánh xạ VI→EN có chủ đích cho Hero, KPI Dashboard, 6 News cards, Roadmap và Footer.
- Kế thừa nút VI/EN và localStorage hiện có; không thay đổi CSS, app.js, schema hay backend.
- Bản gốc vẫn chứa các màn hình CarbonGraph/CBAM cũ; không tuyên bố dịch toàn bộ hệ thống.

## Kiểm thử tĩnh
- `node --check src/i18n.js`: PASS.
- `node tests/finrisk-ui-15.test.js`: 15/15 PASS.
- Kết quả được lưu trong `evidence/item15/`.

## Chưa được xác minh
- [ ] VI → EN → VI không còn chữ dịch sót / lỗi text.
- [ ] Refresh giữ lựa chọn EN.
- [ ] Chuyển trang rồi quay lại Overview vẫn dịch đúng.
- [ ] Responsive mobile/tablet/desktop và animation không bị ảnh hưởng.
- [ ] Soát từng dòng ở News, Roadmap, Footer, Hero, Dashboard; xử lý câu tiếng Việt chưa có trong từ điển.
- [ ] Leader nghiệm thu.

## Trạng thái
ĐÃ TRIỂN KHAI BẢN DỊCH BỔ SUNG; CHỜ KIỂM THỬ TRÌNH DUYỆT, SOÁT NỘI DUNG VÀ DUYỆT. Không đạt DoD hoàn chỉnh.
