# FinRisk DSS — W04 Loan Simulation

**Bản bàn giao:** `FinRisk_DSS_W04_Loan_Simulation_20261106.zip`  
**Nền source:** `FinRisk_DSS_W02_Customer_Profile_20261106.zip` (W01–W03 đã được người dùng xác nhận nghiệm thu trên Windows và GK sign-off theo lịch sử dự án).  
**Ngày:** 2026-11-06

## 1. Phạm vi triển khai

W04 bổ sung một màn hình **Mô phỏng khoản vay** riêng trong workspace, không thay thế tab **Hồ sơ vay #09 MOCK**.

- Nhận số tiền vay và kỳ hạn khởi tạo từ hồ sơ vay #09 MOCK lưu trong `localStorage`.
- Cho phép người dùng nhập lãi suất giả định (%/năm); mặc định để trống, không tự đặt lãi suất sản phẩm.
- Hỗ trợ hai cách tính: (1) trả góp đều, tổng gốc + lãi mỗi tháng gần như bằng nhau; (2) gốc chia đều, lãi tính trên dư nợ đầu kỳ nên tổng khoản trả giảm dần.
- Hỗ trợ lãi suất 0%.
- Hiển thị tóm tắt kỳ trả đầu/cuối, tổng lãi giả định, tổng gốc + lãi và tối đa 12 kỳ đầu trên màn hình.
- Xuất toàn bộ lịch trả nợ ra CSV.
- Hiển thị dòng tiền tham chiếu từ các trường MOCK nếu đủ dữ liệu: thu nhập tháng, chi phí tháng, nợ hiện tại/tháng và khoản trả đầu tiên. Đây chỉ là phép tính số học, không đưa ra kết luận đạt/không đạt.
- Có nút nạp lại số tiền/kỳ hạn từ hồ sơ #09 và nút quay về tab Hồ sơ vay.
- Đã bổ sung chuỗi VI/EN và CSS responsive theo breakpoint.

## 2. Quy ước và giả định tính toán

- Lãi suất tháng `i = lãi suất năm / 100 / 12`.
- Khoản thanh toán giả định được thực hiện vào cuối mỗi tháng.
- Lãi từng kỳ được tính trên dư nợ đầu kỳ.
- Trả góp đều: `A = P × i / (1 − (1 + i)^(-n))`; khi `i = 0`, `A = P / n`.
- Gốc chia đều: gốc mỗi kỳ `P / n`; lãi kỳ `t` bằng dư nợ đầu kỳ nhân `i`.
- Chưa tính phí, bảo hiểm, ân hạn, lịch thu không đều, lãi suất thay đổi trong kỳ hoặc các điều khoản hợp đồng khác.
- Phép tính nội bộ giữ số thực; giao diện làm tròn giá trị tiền tệ đến đồng. CSV lưu giá trị tính toán đầy đủ.

Giới hạn đầu vào trong bản triển khai: số tiền gốc lớn hơn 0 và không quá 10^13; kỳ hạn nguyên từ 1 đến 600 tháng; lãi suất giả định từ 0% đến 100%/năm; chỉ chấp nhận hai phương thức trả nợ nói trên.

## 3. Ranh giới nghiệp vụ

W04 là công cụ mô phỏng kịch bản phía trình duyệt:

- Không gọi backend API, không gọi H18/LightGBM và không thay đổi điểm `risk_score`.
- Không dùng đầu vào W04 để tái tạo bộ 169 features của CORE4.
- Không tạo kết quả duyệt/từ chối, không đề xuất hạn mức, lãi suất sản phẩm hay kỳ hạn được phê duyệt.
- Không ghi kịch bản W04 ngược vào hồ sơ vay #09; thao tác W04 không sửa dữ liệu MOCK đã lưu.
- Dòng tiền tham chiếu từ hồ sơ #09 MOCK không phải đánh giá khả năng trả nợ hoặc chính sách tín dụng.

## 4. File thay đổi

**Modified**
- `app/index.html` — nạp module tính toán W04 trước `app.js`.
- `app/src/app.js` — thêm tab và renderer `simulation`.
- `app/src/i18n.js` — bổ sung nội dung VI/EN cho W04.
- `app/assets/styles.css` — bổ sung style responsive có scope `.finrisk-w04-*`.

**Added**
- `app/src/finrisk-simulation.js` — bộ tính toán thuần JavaScript.
- `app/tests/finrisk-w04-simulation.test.js` — 8 kiểm thử W04.
- `app/evidence/w04/W04_QA_RESULTS_20261106.md` — kết quả kiểm thử tự động và giới hạn QA.

## 5. Kết quả kiểm thử tự động

- Node.js: `node --test tests/*.test.js` → **66 PASS / 0 FAIL** (bao gồm 8 test W04 và hồi quy W01–W03).
- Python API: `python -m unittest backend_api.test_server -v` → **17 PASS / 0 FAIL**.
- JavaScript syntax: `node --check src/app.js`, `node --check src/i18n.js`, `node --check src/finrisk-simulation.js` → PASS.
- Kiểm tra bảo toàn: `backend_ml/` và `evidence/h16/` được giữ nguyên so với ZIP W02 nền; model, schema 169 features, threshold, policy và calibration không được sửa trong W04.
- ZIP integrity được kiểm tra bằng `ZipFile.testzip()` sau khi đóng gói.

**Chưa xác nhận:** kiểm thử trình duyệt trực tiếp trên Windows cho W04 (VI/EN, luồng tương tác, tải CSV, viewport 390/768/1440). Đây là bước cần thực hiện sau khi giải nén gói mới. Kết quả test tự động không được hiểu là browser QA đã PASS.

## 6. Kiểm thử tự động trên Windows

Tại thư mục `app`, chạy `run_tests.bat` để thực hiện full Node.js suite; script sẽ chạy thêm Python API tests nếu `.venv` có sẵn. Có thể chạy riêng `run_api_tests.bat` để kiểm thử API. Nếu máy chưa có môi trường Python, xem `setup_windows.bat` và file requirements khóa hiện có trong source trước khi cài đặt.

## 7. Hướng dẫn chạy trên Windows

1. Giải nén ZIP W04 vào thư mục mới, không ghi đè source W02 đã nghiệm thu.
2. Mở PowerShell tại `FINRISK-DSS--main\app` của source W04.
3. Chạy launcher với đường dẫn snapshot hiện có:

   ```powershell
   .\run_with_ml.bat "D:\FinRisk_CORE4_Snapshot_For_GK_20261029\FinRisk_CORE4_Snapshot"
   ```

   Snapshot có thể tiếp tục nằm ở thư mục cũ; không cần di chuyển hoặc sao chép.
4. Giữ cửa sổ server mở, vào `http://127.0.0.1:8080/#simulation`.
5. Mở tab **Mô phỏng khoản vay**. Số tiền và kỳ hạn ban đầu được lấy từ hồ sơ #09 MOCK trong trình duyệt. Lãi suất vẫn để trống cho đến khi người kiểm thử nhập.

## 8. Kịch bản kiểm tra thủ công đề nghị

### A. Tính trả góp đều

Dùng bộ ví dụ kiểm tra: số tiền `200000000`, kỳ hạn `24`, lãi suất giả định `12` (%/năm), phương thức **Trả góp đều**.

Giá trị tham chiếu (giao diện làm tròn đến đồng):
- Kỳ trả đầu: khoảng **9.414.694 VNĐ**.
- Kỳ trả cuối: khoảng **9.414.694 VNĐ**.
- Tổng lãi giả định: khoảng **25.952.667 VNĐ**.
- Tổng gốc + lãi: khoảng **225.952.667 VNĐ**.

### B. Gốc chia đều

Giữ nguyên số tiền, kỳ hạn và lãi suất, chọn **Gốc chia đều, lãi theo dư nợ giảm dần**.

Giá trị tham chiếu:
- Kỳ trả đầu: khoảng **10.333.333 VNĐ**.
- Kỳ trả cuối: khoảng **8.416.667 VNĐ**.
- Tổng lãi giả định: khoảng **25.000.000 VNĐ**.
- Tổng gốc + lãi: khoảng **225.000.000 VNĐ**.

### C. Biên và hành vi

- Để trống lãi suất rồi tính: phải hiện lỗi hợp lệ, không tạo lịch.
- Nhập `0`: phải tạo lịch không lãi; tổng gốc + lãi bằng tiền gốc (sai số hiển thị do làm tròn có thể xảy ra).
- Nhập lãi suất âm hoặc trên 100: bị từ chối.
- Nhấn **Nạp từ hồ sơ vay #09 MOCK**: số tiền/kỳ hạn được đọc lại từ #09; không ghi thay đổi mô phỏng trở lại #09.
- Tải CSV: tệp phải có đủ số dòng kỳ hạn (ví dụ 24 kỳ), không chỉ 12 kỳ đang hiển thị trên màn hình.
- Kiểm tra W03 trước/sau W04: W04 không gọi API/ML và không làm thay đổi điểm rủi ro.
- Kiểm tra VI ↔ EN, sau đó kiểm tra 390×844, 768×1024 và 1440×900; bảng lịch trả nợ có thể cuộn ngang trong vùng bảng trên màn hình hẹp, không làm tràn toàn trang.

**Lưu ý ví dụ 12%:** đây chỉ là lãi suất giả định được nhập để kiểm thử công thức, không phải lãi suất chào vay, lãi suất thị trường hay chính sách được FinRisk phê duyệt.
