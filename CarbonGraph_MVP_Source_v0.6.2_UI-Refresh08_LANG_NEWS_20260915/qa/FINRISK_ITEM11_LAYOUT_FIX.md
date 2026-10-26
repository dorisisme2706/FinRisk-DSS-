# #11 – Sửa lỗi bố cục Decision Trace

## Lỗi
6 node được render vào CSS grid cũ chỉ định 4 cột nội dung + 3 cột mũi tên, khiến các node cuối quá hẹp và chữ xuống dòng từng ký tự.

## Cách sửa
- Chỉ áp dụng CSS trong `.finrisk-trace-screen`, không thay đổi bố cục tab khác.
- Desktop/tablet: mỗi node tối thiểu 185px, cho phép cuộn ngang trong vùng luồng.
- Mobile <=720px: xếp node theo chiều dọc.
- Giữ màu xanh, hiệu ứng hover và nút xem chi tiết.

## Kiểm thử
- Kiểm tra tự động: `node tests/finrisk-item-11-layout.test.js`.
- QA trình duyệt cần kiểm tra: 1366px, 1024px, 768px, 390px; nội dung Decision và Recommendation đọc được; cuộn ngang; chọn node; VI/EN.
- Chưa có ảnh chụp trình duyệt sau sửa; không tuyên bố nghiệm thu.
