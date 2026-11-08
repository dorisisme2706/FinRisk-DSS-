# W01 + W03 — ghi chú thay đổi (trên nền H19 M5 Candidate)

## Nguyên tắc giữ nguyên
- Không đổi model LightGBM đã freeze, 169 feature, threshold, policy, calibration (`backend_ml/` và `evidence/h16/` giữ nguyên byte).
- Không đổi `index.html`; CSS chỉ **thêm** cuối file (không sửa quy tắc cũ).
- Không tạo mức Low/Medium/High hay hạn mức/lãi suất/kỳ hạn; không đặt quy tắc phê duyệt.
- Panel ML thật vẫn tách khỏi luồng MOCK và giữ nhãn REAL/MOCK.

## W01 — Giao diện tổng thể / vận hành
- `backend_api/server.py`: thêm `--host` (mặc định `127.0.0.1`; hoặc biến môi trường `FINRISK_HOST`). Khi bind khác loopback, in cảnh báo "không có xác thực". Lỗi dự đoán nay được ghi log phía server (stderr), phản hồi vẫn không lộ chi tiết nội bộ.
- `run_with_ml.bat`: tham số thứ 2 tùy chọn là host (mặc định `127.0.0.1`).
- `src/i18n.js`: xóa 18 dòng dịch cũ của CarbonGraph/CBAM không còn được tham chiếu trong `index.html`, `src/*.js`, `tests/*.js`.
- `assets/styles.css`: thêm quy tắc responsive cho panel ML thật (xuống dòng chuỗi dài, nút full-width ≤560px).

## W03 — Risk Assessment (panel ML thật)
Bổ sung hiển thị: trạng thái hiệu chỉnh (`calibration_status`), phạm vi ngưỡng (`threshold_scope`), cảnh báo chất lượng có mô tả (ANNUITY_MISSING, BUREAU_NOT_OBSERVED; mã lạ hiển thị nguyên mã), và phân rã log-odds (base + top 10 + phần còn lại = margin thô). UI từ chối phản hồi nếu phân rã không tái dựng đúng margin (sai số > 1e-6) hoặc thiếu trường.

## Chỉnh sửa nhỏ sau kiểm tra giao diện
- Dòng "Hiệu chỉnh xác suất" và "Phạm vi ngưỡng": bỏ cặp ngoặc đơn liền nhau, dùng dấu `·` ngăn cách mô tả và mã gốc.
- Bản EN của "Business policy": "No approval/rejection policy has been approved yet" (nghĩa không đổi).
- Nút "Chỉnh sửa hồ sơ vay" trong thẻ MOCK: thêm lề 18px (CSS thêm vào cuối file) để thẳng hàng với các dòng bên trên, không đổi phong cách.

## Kiểm tra
- Node: 33 file, 0 lỗi (thêm `tests/finrisk-w01-w03.test.js`, 6 test).
- API: 14 test pass (thêm 2: log lỗi phía server, host mặc định).
- `qa/verify_h19.py` với snapshot thật: PASS_M5_FREEZE, 0 hồ sơ test bị chấm.
- 6 hồ sơ tham chiếu qua HTTP (cả qua `--host 0.0.0.0`): sai số tái dựng margin ≤ 4.4e-15; ID test (100009) vẫn bị chặn 403; host mặc định không truy cập được từ IP mạng.

## Chưa kiểm tra
- Chưa mở trình duyệt thật (VI↔EN, bố cục 390/768/1440 px) và chưa chạy trên Windows.
- Sign-off chính thức của GK vẫn PENDING.
