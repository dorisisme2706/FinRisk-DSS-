# Bàn giao H18 — FinRisk DSS

## Kết quả

H18 đã nối model H16 frozen vào source frontend mới nhất mà nhóm cung cấp. Giao diện hiện gọi API H18 để hiển thị score thật và tín hiệu review. Luồng MOCK cũ vẫn được giữ riêng để không biến form vài trường thành 169 feature của model.

## DoD

- [x] Dùng đúng base `FINRISK-DSS--main--phase1-fixed.zip`.
- [x] Nhúng đúng package model H16 frozen.
- [x] Không retrain, không đổi feature, threshold hoặc calibration.
- [x] Có API health, ML score và H18 decision-support endpoint.
- [x] Không tự động approve/reject.
- [x] Không phát sinh amount/term/rate/monthly payment từ ML khi chưa có business policy.
- [x] Giữ test-ID runtime guard.
- [x] i18n VI/EN cập nhật cho nội dung H18.
- [x] 12/12 API tests PASS.
- [x] 47/47 Node tests PASS.
- [x] 6/6 reference profiles khớp score model thật; không dùng Final Test trong H18.
- [ ] GK review/sign-off chính thức.

## Chạy nhanh

Xem `WINDOWS_RUN.md`.
