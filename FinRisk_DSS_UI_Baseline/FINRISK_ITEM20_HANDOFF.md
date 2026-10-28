# FINRISK DSS – BÀN GIAO HẠNG MỤC #20

**Ngày thực hiện:** 16/10/2026  
**Hạng mục:** #20 – Bộ khung source & responsive (★★★★★)  
**Hạn bàn giao theo kế hoạch:** 29/10/2026  
**Trạng thái:** CHỜ LEADER NGHIỆM THU; nghiệm thu bản khung responsive, không đồng nghĩa với hoàn thiện toàn bộ nghiệp vụ FinRisk.

## Phạm vi được phê duyệt và bảo toàn

- Kế thừa bản đã duyệt #01 (forest green/emerald/mint/CTA) và #02 (node/edge/glow canvas, motion preference).
- Giữ nguyên Hero, News, PRODUCT ROADMAP · CONCEPT UI, footer, giao diện 2 tầng và mọi nghiệp vụ cũ đang chờ các hạng mục chuyển đổi kế tiếp.
- Đợt #20 chỉ sửa **bộ khung responsive** và trải nghiệm thanh điều hướng trên màn nhỏ; không đổi model, policy, branding, nội dung báo hoặc cơ sở dữ liệu.

## Thay đổi mã nguồn

1. `assets/styles.css`: thêm media query <=640px để tiêu đề `SAFE_WORKING_FLOW_PASS` ở End-to-End và tiêu đề dài trong Evidence tự xuống dòng, không kéo ngang trang ở 320–430px. Không thay bất kỳ màu sắc hay animation được duyệt ở #01–#02.
2. `src/app.js`: khi chọn một tab workspace nằm ngoài vùng nhìn thấy trên điện thoại, chỉ cuộn ngang trong thanh tab để hiện **đúng tab đang chọn**, không cuộn cả trang.
3. `tests/finrisk-ui-20.test.js`: bổ sung 49 assertion kiểm tra source cấu trúc, asset, menu, phong cách đã duyệt và bản sửa responsive.
4. `run_tests.bat`: thêm chạy kiểm thử #20 cùng các bộ test hiện tại; không bỏ các test gốc.
5. `qa/responsive_qa.py`: script kiểm thử bằng Playwright trên 18 viewport × 9 màn hình; lưu JSON và ảnh tại `evidence/item20/`.

## Bằng chứng kiểm thử

| Kiểm tra | Kết quả |
|---|---|
| 18 kích thước 320–1920 × 9 màn hình | **162/162 PASS** (không tràn ngang, đúng tab active, tab active nhìn thấy, header/footer/canvas có mặt) |
| Chức năng hình thức bảo toàn | **PASS** (Hero, 6 News cards, 3 Roadmap cards và ambient graph) |
| Reduced motion hệ điều hành (đang mở trang) | **PASS** (dừng và tiếp tục) |
| JavaScript regression tests | **136/136 PASS** (bao gồm 49 assertion mới) |
| `node --check` toàn bộ source và test | **PASS** |
| Static server HTTP | **7/7 HTTP 200** (HTML/CSS/JS/PNG/SVG) |
| Console/page JS errors trong viewport regression | **0 lỗi** |

**Lưu ý về phạm vi kiểm chứng:** 162/162 là số kết hợp màn hình/kích thước, không phải 162 ca nghiệp vụ. Browser QA tải nguyên HTML/CSS/JS bằng injection nội bộ để tránh giới hạn truy cập localhost của môi trường tự động. HTTP smoke test xác nhận static server thực trả nội dung qua loopback. Nhóm vẫn cần mở bản chạy trên trình duyệt Windows/thiết bị thật để kiểm tra thẩm mỹ và thao tác cảm ứng cuối cùng.

## Hướng dẫn chạy trên Windows

1. Giải nén ZIP; mở thư mục `FinRisk_DSS_UI_Baseline`.
2. Chạy `run_localhost.bat`, mở địa chỉ `http://127.0.0.1:8080` bằng Edge/Chrome (không cần chỉnh code).
3. Chạy `run_tests.bat` (cần Node.js) để kiểm tra JS regression.
4. Nếu muốn chạy test browser tự động: `pip install playwright`, `python -m playwright install chromium`, sau đó `python qa/responsive_qa.py`.
5. Kiểm tra các ảnh trong `evidence/item20/` hoặc so sánh trực tiếp trên desktop, laptop, mobile.

## Quy định Git / Sao lưu

- Bản ZIP source #01–#02 đã duyệt được đặt ở commit gốc nhánh `main` trong gói Git.
- Nhánh làm việc của hạng mục này: `feature/item20-responsive`.
- Có gói **Git bundle** để phục hồi lịch sử và hai nhánh; đây là nhánh Git *cục bộ*, chưa được push lên GitHub của nhóm.
- Sao lưu source CarbonGraph nguyên bản được cung cấp riêng; không ghi đè Google Drive, repo GitHub hay source gốc của leader.

## Định nghĩa Hoàn thành – DoD

- [x] Có bản dự phòng source gốc và nhánh Git để rollback.
- [x] Giữ #01 màu xanh, #02 Canvas và những phần News/Roadmap được duyệt.
- [x] Desktop/laptop/tablet/mobile không bị lỗi tràn ngang trên 9 màn hình trong ma trận kiểm thử.
- [x] Tab active đọc được/hiển thị đúng trong thanh workspace di động.
- [x] 136/136 regression assertion và 7/7 HTTP smoke test đạt.
- [ ] Leader Trọng Khang tự kiểm tra hình thức trên máy và phê duyệt.

**Chưa bao gồm**: đổi tên CarbonGraph → FinRisk, biểu mẫu khách hàng, PostgreSQL, ML, Decision Engine hay tin tức tài chính (thuộc hạng mục riêng). Không được diễn giải kết quả test UI như đã nghiệm thu hệ thống FinRisk end-to-end.
