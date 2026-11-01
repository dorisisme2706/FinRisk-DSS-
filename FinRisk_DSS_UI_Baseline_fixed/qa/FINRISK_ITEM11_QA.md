# QA / Bàn giao #11 – Decision Trace (MOCK)

## Phạm vi
- Giữ bố cục và điều hướng hiện có; đổi tab Trace Explorer thành **Giải thích quyết định**.
- Hiển thị 6 bước Customer → Features → ML → Risk → Decision → Recommendation, dùng hồ sơ #09, validation #10, kịch bản #12.
- Chọn node để xem giải thích; trạng thái lỗi và thiếu ML được thể hiện rõ.
- Không tạo hoặc lưu quyết định tín dụng thật; không sử dụng policy ngân hàng thật.

## Kiểm thử tự động
`node tests/finrisk-item-11.test.js`

## Checklist UAT trình duyệt (chưa thực thi)
- [ ] Mở tab Giải thích quyết định, thấy đủ 6 bước.
- [ ] Chọn mỗi node, panel chi tiết cập nhật.
- [ ] Đổi kịch bản ở Đánh giá tín dụng, quay lại trace, trạng thái cập nhật.
- [ ] Nhập dữ liệu sai ở Hồ sơ vay, trace chặn ML/decision.
- [ ] Chọn kịch bản thiếu ML, trace hiển thị UNAVAILABLE.
- [ ] Chuyển VI/EN, kiểm tra tên tab và nội dung.
- [ ] Kiểm tra desktop/mobile không tràn bố cục.
- [ ] Các tab khác, theme xanh, animation, News và Roadmap không bị ảnh hưởng.

## DoD và phụ thuộc
- Frontend MOCK: có source, test tự động, QA, evidence kết quả test.
- Chưa có kết quả ML thật, policy được duyệt, API/PG hay lịch sử quyết định.
- Chưa kiểm thử browser, chưa được leader nghiệm thu; không đánh dấu hoàn thành chính thức.
