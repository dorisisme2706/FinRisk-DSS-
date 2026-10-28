# FinRisk DSS – Hạng mục #01 và #02 (16/10/2026)

**Trạng thái bàn giao: CHỜ DUYỆT của leader Trọng Khang.** Đây là bản phát triển trên source CarbonGraph UI Refresh 08, chỉ xử lý màu sắc/animation; chưa đổi branding, News, Roadmap, dữ liệu tín dụng hoặc nghiệp vụ.

## #01 – Giữ màu xanh đặc trưng (★★★★★, bàn giao dự kiến 17/10)
- **GIỮ NGUYÊN** các giá trị màu nền chính `--forest: #003c33`, `--forest-deep: #002820`, `--leaf: #9fe870`, `--mint: #edf8e6`, `--sage: #c5edab`, gradient Hero và nút CTA.
- Chỉnh màu chữ phụ `--muted-green` từ `#6a8978` sang `#54715f` (màu xanh trầm cùng phong cách) để dễ đọc trên nền trắng: tỷ lệ tương phản ước tính **3.84:1 → 5.38:1**.
- Chỉnh màu chữ menu workspace **chưa được chọn** trên nền xanh đậm: trước đây `#4c626e` khó đọc, nay dùng `#e6f5ed` với tương phản tham chiếu **khoảng 11.3:1**, cao hơn ngưỡng 4.5:1 cho văn bản thông thường. Màu chữ khi hover/focus đổi về xanh đậm trên nền sáng để đọc được; màu active nav gốc vẫn giữ.
- Nền node, hero, các thành phần News và Product Roadmap **không đổi**.

## #02 – Giữ animation node background (★★★★★, bàn giao dự kiến 17/10)
- **GIỮ NGUYÊN** Canvas, node/edge/glow, hiệu ứng pointer, vận tốc gốc `0.24`, số node theo breakpoint: mobile 30 / tablet 46 / laptop 64 / desktop lớn 76.
- Khi resize, giữ vị trí các node và cập nhật theo tỷ lệ mới thay vì tạo lại toàn bộ node gây nhảy hình; coalescing sự kiện resize với `requestAnimationFrame`.
- Theo dõi thay đổi **Reduce motion** của hệ điều hành ngay khi trang đang mở. Động tác dừng/khôi phục diễn ra theo lựa chọn hệ thống, không ghi đè thiết lập bật/tắt thủ công trước đó.
- Animation luôn ở phía sau UI (`pointer-events: none`) và không cản thao tác form/nav.

## Kết quả kiểm thử
- **38/38** kiểm tra trình duyệt đạt: desktop `1440×900`, mobile `390×844`, tương phản của các nhãn tiêu biểu, Canvas thực sự đổi frame, resize không lỗi, không tràn ngang, Reduce motion khi tải và khi thay đổi trong lúc chạy, pause/resume.
- **87/87** dòng kiểm thử `PASS` ở Node.js (75 test hiện có + 12 assertion bảo vệ màu/animation mới).
- Kiểm tra cú pháp `src/ambient-graph.js`: **PASS**.
- Có ảnh kiểm chứng desktop / mobile / reduced-motion tại `evidence/` và log JSON + log chạy Node tại `evidence/`.
- Lưu ý môi trường kiểm thử chặn truy cập HTTP localhost/file URI trong trình duyệt, nên đã tải chính xác HTML, CSS, JS vào trang trình duyệt thông qua injection cục bộ; kiểm thử giao diện mang tính smoke test, không thay thế UAT trên thiết bị thực tế. Ảnh trang News không dùng để nghiệm thu do đường dẫn ảnh ngoài ngữ cảnh injection không tải được.

## DoD cần leader xét duyệt
1. Đối chiếu screenshot `evidence/UI_Desktop_1440.png` và `evidence/UI_Mobile_390.png` với bản thiết kế gốc. Nền xanh/CTA/màu nhấn đúng nhận diện.
2. Mở dự án trên trình duyệt thực tế (ví dụ Edge/Chrome), kéo cửa sổ và điều hướng, kiểm tra Canvas chuyển động mượt; node không che nội dung.
3. Bật **Windows Settings → Accessibility → Visual effects → Animation effects** theo thiết bị hoặc **Reduce motion** của OS/browser và xác nhận animation dừng; tắt lựa chọn để thấy animation chạy lại.
4. Leader xác nhận đạt DoD mới chuyển trạng thái từ **CHỜ DUYỆT** sang **HOÀN THÀNH**.

## Chạy project (Windows)
- Giải nén ZIP và vào thư mục `CarbonGraph_MVP_Source_v0.6.2_UI-Refresh08_LANG_NEWS_20260915`.
- Chạy `run_localhost.bat` và mở địa chỉ localhost được in trên terminal.
- Chạy `run_tests.bat` (cần Node.js) để chạy cả test bảo vệ #01/#02.
- Chỉ các file `assets/styles.css`, `src/ambient-graph.js`, `run_tests.bat`, `tests/finrisk-ui-01-02.test.js` và tài liệu/bằng chứng mới khác với source gốc.

**Không chỉnh sửa thư mục Drive gốc.** ZIP là một phiên bản làm việc riêng, có thể giải nén/cherry-pick các thay đổi sang nhánh FinRisk.
