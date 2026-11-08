# Bàn giao #17 + #20 (MOCK)

Chạy `run_localhost.bat` hoặc `python serve_local.py`, sau đó mở URL localhost mà máy chủ hiển thị.

**Modified:** `src/app.js`, `src/i18n.js`, `index.html`, `assets/styles.css`.
**Added:** `src/finrisk-uat.js`, `tests/finrisk-items17-20.test.js`, `qa/FINRISK_ITEMS17_20_QA.md`, `FINRISK_17_20_HANDOFF.md`.
**Deleted:** Không.

#17: Test Center có 12 UAT thủ công dành cho FinRisk, tất cả bắt đầu NOT_RUN; lưu trạng thái/ghi chú trong localStorage và chỉ xuất JSON khi 12 PASS + reviewer. Không thay đổi kết quả của catalog CarbonGraph cũ; UI chỉ hiển thị FinRisk UAT.
#20: Bổ sung CSS responsive theo hướng không thay đổi layout tổng thể, theme, animation, News/Roadmap. Không xác nhận responsive trên trình duyệt thật nếu chưa kiểm thử thủ công.

**Blockers:** PostgreSQL, backend, ML và approved credit policy chưa tích hợp (#18/#19). Cần QA trình duyệt, evidence và leader Trọng Khang nghiệm thu.

GitHub Desktop Summary: `Triển khai #17 Test Center FinRisk và #20 responsive tích hợp`
Description: `Thêm 12 kịch bản UAT thủ công, ghi chú/evidence, lưu trạng thái và xuất JSON có kiểm soát; bổ sung CSS responsive và cập nhật VI/EN. Giữ nguyên bố cục, màu xanh, animation, News/Roadmap. Chưa xác nhận QA trình duyệt hoặc nghiệm thu leader; backend/ML/PostgreSQL còn blocker.`
