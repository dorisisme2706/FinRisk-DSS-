# CARBONGRAPH – CLAIMS AUDIT REGISTER v0.1

Ngày rà soát: 27/08/2026  
Phạm vi: CarbonGraph MVP v0.6.2 RC1_CANDIDATE và các bề mặt truyền thông của VietFuture 2026.  
Chủ sở hữu: Khánh Linh. Người duyệt cuối: Minh Thư.  
Trạng thái: `IN_PROGRESS – R-007 OPEN`.

## 1. Guardrail bắt buộc

Mọi bề mặt phải hiển thị hoặc diễn đạt nhất quán:

- `SYNTHETIC_DEMO` / dữ liệu giả lập.
- `R-006 OPEN`.
- Kết quả số `BLOCKED/MASKED`.
- `Compliance NOT_EVALUATED`.
- CarbonGraph là công cụ chuẩn bị và truy vết bằng chứng; không phải verifier, không tự khai báo CBAM và không xác nhận tuân thủ.

Không được dùng các tuyên bố: `CBAM compliant`, `CBAM certified`, `verified emissions`, “đã thẩm tra”, “đã sẵn sàng khai báo”, “kết quả phát thải chính xác”, hoặc bất kỳ số tCO2e/SEE nào khi R-006 còn mở.

## 2. Kết quả theo bề mặt

| Bề mặt | Vị trí/bản kiểm tra | Kết quả | Việc cần bổ sung ở đâu và thế nào | Người xử lý | Điều kiện đóng |
|---|---|---|---|---|---|
| Ứng dụng | `index.html`, `src/app.js` | `PASS_TECHNICAL` | Giữ banner trạng thái và không thêm số phát thải | UI owner | Scanner 0 finding + ảnh toàn màn hình |
| Working export | `src/report-engine.js` | `PASS_TECHNICAL` | Giữ trường numeric ở trạng thái masked/blocked | Kỹ thuật | Test export PASS + mở PDF/HTML kiểm tra tay |
| README | `README.md` | `PASS_TECHNICAL` | Giữ cảnh báo demo và giới hạn sử dụng ở phần đầu | Kỹ thuật | Scanner 0 finding |
| Pitch deck | `CarbonGraph_VietFuture_2026_Pitch_Deck_v0.1_20260827.pptx` | `PASS_TECHNICAL / PENDING SIGN-OFF` | Đã có footer đủ bốn guardrail trên 10/10 slide; no-overflow test PASS; deterministic claim scan 0 finding. Tải bản PPTX/PDF vào `07_PITCH/CLAIMS_REVIEW` | Minh Thư | Khánh Linh mở từng slide và ký PASS/REVISE |
| Kịch bản 5 phút | `CarbonGraph_5_Minute_Pitch_Script_v0.1_20260827.md` | `PASS_TECHNICAL / PENDING REHEARSAL` | Đã chia đúng 05:00, có demo cue/fallback và điều cấm; deterministic claim scan 0 finding. Tải bản ký vào `07_PITCH/SCRIPT` | Trọng Khang | Claims sign-off + đọc thử không quá 05:00 |
| Poster A1 | Chưa có bản khóa | `PENDING` | Góc dưới poster phải có nhãn demo và tuyên bố không thay verifier; không đưa tCO2e | Thiết kế | PDF in ấn qua Claims Audit |
| Brochure | Chưa có bản khóa | `PENDING` | Mặt cuối ghi phạm vi một sản phẩm–một cơ sở–một kỳ và disclaimer | Thiết kế | PDF gấp ba qua Claims Audit |
| Video backup | Chưa có bản khóa | `PENDING` | Chèn slate đầu/cuối `SYNTHETIC_DEMO`; che mọi numeric; phụ đề không dùng claim cấm | Video owner | Xem 100% video + transcript scan 0 finding |
| Website/social | Chưa có bản khóa | `PENDING` | Dùng câu mô tả được duyệt tại mục 3; lưu ảnh chụp bài đăng trước khi phát hành | Truyền thông | Minh Thư duyệt nội dung và ảnh |
| Booth/QR | Chưa có bản khóa | `PENDING` | QR chỉ mở hồ sơ demo; nhãn vật mẫu ghi `MÔ PHỎNG`; không dùng dấu/tem “verified” | Booth owner | Quét QR và kiểm tra toàn bộ hành trình |

## 3. Câu mô tả được phép dùng

> CarbonGraph là bản demo dùng dữ liệu giả lập để minh họa quy trình thu thập, kiểm tra và truy vết bằng chứng CBAM cho một sản phẩm thép. Công cụ không thay thế verifier, không tự khai báo CBAM và chưa đánh giá tuân thủ hoặc phát hành kết quả phát thải số.

## 4. Quy trình duyệt nhanh cho từng file mới

1. Chủ file đặt bản PDF/MP4/DOCX vào đúng thư mục nêu ở bảng trên và thêm hậu tố `_FOR_CLAIMS_REVIEW`.
2. Khánh Linh kiểm tra chữ, hình, voice-over, caption, QR và export; ghi từng finding theo mẫu `CLM-xxx | trang/timecode | câu gốc | cách sửa`.
3. Chủ file sửa và đổi hậu tố thành `_RETEST`.
4. Khánh Linh kiểm tra lại; chỉ ghi `PASS` khi 0 finding và đủ disclaimer.
5. Minh Thư ký/ghi ngày thực; bản được duyệt đổi hậu tố `_APPROVED_FOR_EVENT`.
6. Lưu bản nháp và bản duyệt để audit; không ghi đè lịch sử.

## 5. Bằng chứng kỹ thuật hiện có

Bộ scanner VR-019 đã kiểm tra 4 bề mặt văn bản của v0.6.2, deck v0.1, script 5 phút v0.1 và Q&A v0.1 với 0 finding đối với bốn nhóm legacy/compliance/verification pattern. Kết quả này chỉ là `PASS_TECHNICAL`, không phải phê duyệt pháp lý hoặc đóng R-007.

## 6. Phê duyệt

Người rà soát – Khánh Linh: ____________________  Ngày giờ thực: ____________________  
Người duyệt – Minh Thư: _______________________  Ngày giờ thực: ____________________

Quyết định F1: `[ ] PASS  [ ] REVISE  [ ] BLOCKED`
