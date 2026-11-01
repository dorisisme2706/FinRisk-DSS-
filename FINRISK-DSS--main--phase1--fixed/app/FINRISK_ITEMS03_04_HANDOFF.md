# FINRISK DSS — HẠNG MỤC #03 & #04

**Ngày thực hiện:** 16/10/2026 (hoàn thành sớm kế hoạch 18/10).

**Phạm vi:** #03 chuyển động UI mượt khi chọn mục; #04 Header hai tầng (marketing + workspace).

**Baseline:** Kế thừa #01 / #02 đã được leader phê duyệt và #20 responsive bản gần nhất. **Giữ nguyên** hệ màu forest green/emerald/mint, Canvas node/edge/glow và tốc độ animation, Hero, News, Product Roadmap. Các nội dung CarbonGraph vẫn giữ để bảo đảm không làm thay đổi nghiệp vụ ở giai đoạn này.

## Thực hiện #03 — Hiệu ứng chuyển màn

- Khi đổi màn workspace thực sự, content xuất hiện nhẹ trong 250 ms (`finrisk-screen-enter`: opacity + translateY 7 px); không chạy lại animation khi click cùng màn hoặc khi state/input thay đổi.
- Mục đang chọn duy trì active highlight và `aria-current=page`; màn mới đưa về đầu trang, tránh bị mắc tại vị trí scroll từ màn khác.
- Các liên kết marketing scroll mượt tới section, có bù chiều cao sticky header. Click section ở ngay Overview không tạo lại DOM gây nhảy trang; xử lý người dùng click nhiều lần/cuộn nhanh.
- `prefers-reduced-motion: reduce` tắt animation và smooth scroll cho nội dung; #02 Canvas vốn đã tuân thủ Reduced Motion tiếp tục giữ nguyên.

## Thực hiện #04 — Header hai tầng

- **Desktop (>1120px)**: giữ 2 tầng, 5 link giới thiệu, workspace navigation, branding, language toggle, Test Center và CTA; chỉ thêm trạng thái section active/focus dễ nhận biết.
- **Tablet/mobile (<=1120px)**: bổ sung nút `Menu` để mở 5 link trước kia bị ẩn; menu mở theo chiều dọc dưới header, không làm mất tầng workspace.
- Có `aria-controls`, `aria-expanded`, focus outline, `Escape` đóng và trả focus, click ngoài đóng menu, chọn section tự đóng và cuộn đúng vị trí; thay đổi breakpoint tự thu menu.
- Workspace vẫn hiển thị tab được chọn ở thanh ngang nhờ cơ chế #20. Không đổi màu/bộ icon hiện có.

## File chỉnh sửa

1. `index.html` — điều khiển menu thu gọn và ID cho marketing navigation.
2. `assets/styles.css` — animation ngắn, trạng thái menu và responsive CSS; giữ token màu cũ.
3. `src/app.js` — điều hướng, scroll bù sticky header, active aria states, xử lý menu và animation chỉ khi đổi màn.
4. `tests/finrisk-ui-03-04.test.js` + `qa/item03_04_qa.py` — kiểm thử tĩnh và thao tác trình duyệt.
5. `run_tests.bat` — thêm bài test mới vào vòng regression.

## Kiểm thử đã chạy

| Kiểm tra | Kết quả |
|---|---|
| #03/#04 Browser UI: desktop, 10 kích thước mobile/tablet, toggle, Esc, chọn News, chọn Giải pháp, reduced motion | **68/68 PASS** |
| #20 responsive 18 viewport × 9 màn hình | **162/162 PASS** |
| Regression JS 16 file test (trong đó 20 assert mới cho #03/#04) | **156/156 PASS** |
| `node --check` toàn bộ JS `src/` | **16/16 PASS** |
| JavaScript lỗi tại browser QA | **0** |
| Canvas engine #02 | **Giữ nguyên SHA-256** |

**Ảnh bằng chứng:** `evidence/item03_04/desktop_header_1366.png`, `mobile_menu_390.png`, `mobile_news_390.png`. Kết quả chi tiết lưu trong `evidence/item03_04/item03_04_qa.json`.

**Giới hạn:** Browser QA chạy source HTML/CSS/JS thật bằng cách tải vào trang trong Chromium; không phải kiểm thử backend PostgreSQL/ML/Decision Engine (những phần chưa triển khai). Nên kiểm lại trên Edge/Chrome Windows trước nghiệm thu cuối.

## Cách chạy

Giải nén, mở `FinRisk_DSS_UI_Baseline`, chạy `run_localhost.bat` và vào `http://127.0.0.1:8080`. Dùng `run_tests.bat` với Node.js để chạy test. Với Playwright: `python qa/responsive_qa.py` và `python qa/item03_04_qa.py` sau khi cài chromium.

## Trạng thái DoD

- [x] Giữ nguyên thiết kế, màu sắc #01 và Canvas #02.
- [x] Hover, transition, chuyển màn và cuộn section mượt; Reduced Motion được tôn trọng.
- [x] Marketing header & workspace bar có mặt ở desktop/mobile; menu bị ẩn nay truy cập được trên màn nhỏ.
- [x] Đủ thao tác chuột/bàn phím, đúng active state, không tràn ngang.
- [x] Regression 68/68, 162/162, 156/156 không lỗi.
- [ ] Leader Trọng Khang xem bản chạy thật trên máy và duyệt.

**Trạng thái: CHỜ LEADER DUYỆT**, chưa ghi hoàn thành. Không thay đổi source gốc trên Drive/GitHub.
