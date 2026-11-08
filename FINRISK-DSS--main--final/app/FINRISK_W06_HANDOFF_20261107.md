# FinRisk DSS – W06 Reports & History

**Ngày:** 07/11/2026  
**Nền source:** W05 Decision Engine – i18n hotfix 07/11/2026  
**Phạm vi:** Báo cáo từ hồ sơ CORE4 và tín hiệu hỗ trợ H18; lịch sử lưu cục bộ trên trình duyệt.

## 1. Mục tiêu W06

W06 bổ sung tab **Báo cáo & lịch sử / Reports & history** riêng. Tab này tạo bản báo cáo từ hai phản hồi backend của cùng một mã `sk_id_curr`:

1. `GET /api/customer/profile?sk_id_curr=<id>` – lấy hồ sơ CORE4 read-only từ W02.
2. Chỉ khi bước 1 thành công, `GET /api/decision/assess?sk_id_curr=<id>` – lấy tín hiệu hỗ trợ H18.
3. Module W06 xác thực hợp đồng của cả hai phản hồi, mã hồ sơ phải khớp, profile chỉ chứa 38 trường allowlist của W02 và H18 phải qua `FinRiskDecisionEngine.validateResponse()`.
4. Khi hợp lệ, giao diện hiển thị bản xem trước. Báo cáo **chưa được lưu** cho đến khi người dùng chủ động bấm **Lưu vào lịch sử trình duyệt / Save to browser history**.

Hồ sơ thuộc tập Test như `100009` phải bị W02 chặn trước khi W06 gọi H18; không tạo báo cáo cho hồ sơ đó.

## 2. Chức năng đã bổ sung

- Tab W06 riêng, hỗ trợ VI/EN thông qua i18n hiện có.
- Nhập `sk_id_curr` để tạo báo cáo từ CORE4 và H18.
- Hiển thị snapshot 38 trường được phép, chia thành 5 nhóm: thông tin hồ sơ, tài chính, Bureau, hồ sơ trước đây và thanh toán kỳ góp.
- Hiển thị điểm rủi ro, threshold demo, tín hiệu H18, phiên bản model/data/feature set/policy, calibration status, threshold scope và quality flags.
- Hiển thị tối đa Top 10 feature contributions, observed values và phần phân rã raw margin nếu H18 cung cấp giải thích hợp lệ.
- Hiển thị Decision Trace 6 bước và business guardrails.
- Xuất báo cáo thành JSON hoặc HTML. File HTML có print stylesheet; người dùng có thể mở file HTML và dùng Chrome **Print → Save as PDF** nếu cần bản PDF.
- Lưu báo cáo có chủ đích, xem lại, lọc theo mã hồ sơ, xuất lại, xóa từng báo cáo hoặc xóa toàn bộ lịch sử.
- Giới hạn 50 bản ghi gần nhất trong localStorage.

## 3. Lưu trữ và giới hạn

- Storage key: `finrisk.w06.report-history.v1`.
- Storage: `window.localStorage` tại origin hiện tại; chỉ tồn tại trong trình duyệt/profile đang dùng.
- Không có API ghi lịch sử; không ghi vào PostgreSQL/backend và không đồng bộ giữa máy hoặc trình duyệt.
- Không tự động lưu khi tạo báo cáo. Phải bấm nút Save.
- Khi xóa dữ liệu trình duyệt, đổi origin/port hoặc dùng profile Chrome khác, lịch sử có thể không còn hiển thị.
- Trên máy dùng chung, cần xóa lịch sử sau khi kiểm thử.
- Lịch sử là bản sao cục bộ phục vụ xem lại, không phải hồ sơ nghiệp vụ chính thức hoặc audit log tập trung.

## 4. Ràng buộc nghiệp vụ và dữ liệu

- W06 chỉ đọc CORE4 và H18; không sửa snapshot, không huấn luyện model, không ghi ngược dữ liệu.
- Chỉ chấp nhận đúng 38 trường allowlist từ W02. Không chấp nhận `TARGET`, giới tính, ngày sinh dạng `DAYS_BIRTH`, tên thật, địa chỉ, số điện thoại hoặc email.
- Giữ `NULL` là dữ liệu thiếu; không tự thay bằng 0.
- Giá trị tài chính giữ nguyên đơn vị nguồn của dataset; không tự quy đổi thành VNĐ.
- `MANUAL_REVIEW_RECOMMENDED` chỉ là tín hiệu đề nghị xem xét; `NO_REVIEW_SIGNAL` không có nghĩa là được duyệt.
- `business_policy_status` phải là `NOT_APPROVED`; quyết định tín dụng tự động luôn `false`.
- Các trường số tiền đề xuất, kỳ hạn, lãi suất và khoản thanh toán phải là `null`; không sinh APPROVE/REJECT, hạn mức hoặc điều khoản vay.
- Báo cáo luôn ghi rõ đây không phải quyết định tín dụng, phê duyệt, từ chối hay đề nghị cho vay.

## 5. File thay đổi so với W05 i18n hotfix

### Added – 3 files

| Đường dẫn | Nội dung |
|---|---|
| `app/src/finrisk-report-history.js` | Module xác thực hợp đồng, tạo báo cáo, lịch sử localStorage, JSON/HTML export. |
| `app/tests/finrisk-w06-reports-history.test.js` | 9 nhóm kiểm thử mới cho W06. |
| `app/FINRISK_W06_HANDOFF_20261107.md` | Tài liệu bàn giao W06. |

### Modified – 5 files

| Đường dẫn | Nội dung |
|---|---|
| `app/src/app.js` | Thêm tab `reports`, giao diện tạo báo cáo, gọi tuần tự CORE4 → H18, preview, lưu/xem/lọc/xóa lịch sử và export. |
| `app/src/i18n.js` | Thêm nhãn điều hướng VI/EN cho W06. |
| `app/index.html` | Nạp `finrisk-report-history.js` trước `app.js`. |
| `app/assets/styles.css` | Thêm style W06 và responsive cho desktop/tablet/mobile. |
| `app/CHANGELOG.md` | Ghi nhận release W06. |

### Deleted – 0 files

Không xóa file nào. Không sửa `backend_api/`, `backend_ml/`, model H16, 169 predictors, threshold, calibration, policy hoặc `evidence/h16/`.

## 6. Kết quả kiểm thử trong môi trường phát triển

| Kiểm tra | Kết quả |
|---|---:|
| W06 unit/contract/storage/export tests | 9/9 PASS |
| Full Node.js suite | 80/80 PASS |
| Python API regression | 18/18 PASS |
| JavaScript syntax (`app.js`, module W06, i18n) | PASS |
| ZIP integrity | PASS sau khi đóng gói |
| `backend_ml/` và `evidence/h16/` | Hash được đối chiếu, giữ nguyên so với W05 hotfix |

**Chưa xác nhận trong môi trường này:** live inference bằng snapshot Parquet thật và Browser QA. Runtime hiện tại thiếu `pyarrow`, còn Chromium không được phép mở localhost/file URL trong sandbox. Vì vậy cần chạy checklist Windows dưới đây trước khi đánh dấu W06 nghiệm thu cuối cùng.

## 7. Hướng dẫn chạy trên Windows

1. Giải nén ZIP W06 vào thư mục mới; không ghi đè source W05/W04 đã nghiệm thu.
2. Mở PowerShell tại thư mục `FINRISK-DSS--main\app` của source W06.
3. Khởi động backend và UI với snapshot CORE4 hiện có:

```powershell
.\run_with_ml.bat "D:\FinRisk_CORE4_Snapshot_For_GK_20261029\FinRisk_CORE4_Snapshot"
```

4. Giữ cửa sổ PowerShell mở và truy cập:

```text
http://127.0.0.1:8080/#reports
```

## 8. Checklist kiểm thử Windows

### A. Tạo báo cáo từ CORE4/H18

- [ ] Mở tab **Báo cáo & lịch sử**.
- [ ] Nhập mã `100035`, bấm **Tạo báo cáo**.
- [ ] Xác nhận hệ thống đọc hồ sơ CORE4 trước, sau đó mới lấy kết quả H18 của cùng mã.
- [ ] Xác nhận báo cáo hiển thị profile 38 trường, risk score, threshold, signal, metadata model/data/policy, quality flags, top 10 giải thích (nếu API trả lời hợp lệ) và Decision Trace.
- [ ] Kiểm tra `NOT_APPROVED`, automatic decision `DISABLED`, loan terms `NOT_GENERATED`.
- [ ] Xác nhận sau khi tạo báo cáo, history chưa tăng cho tới khi bấm Save.

### B. Test-split protection

- [ ] Nhập `100009`, bấm Tạo báo cáo.
- [ ] Kỳ vọng UI hiển thị thông báo hồ sơ test bị khóa.
- [ ] Network phải có request W02 profile trả `403`.
- [ ] Không phát sinh request `/api/decision/assess` cho mã này và không có bản báo cáo mới.

### C. Lưu và quản lý lịch sử

- [ ] Bấm **Lưu vào lịch sử trình duyệt** cho báo cáo `100035`.
- [ ] Xác nhận số lượng history tăng 1 và hiển thị nhãn `LOCAL ONLY`.
- [ ] Rời tab W06, quay lại; bản ghi vẫn còn trong cùng browser/origin.
- [ ] Dùng bộ lọc theo mã `100035`.
- [ ] Bấm View để mở lại bản báo cáo đã lưu.
- [ ] Xóa một báo cáo và xác nhận biến mất khỏi lịch sử.
- [ ] Tạo/lưu lại một báo cáo rồi thử Clear all; xác nhận hộp thoại trước khi xóa.

### D. Export

- [ ] Xuất JSON, mở file và xác nhận dữ liệu là cấu trúc JSON hợp lệ.
- [ ] Xuất HTML, mở bằng Chrome và kiểm tra nội dung.
- [ ] Nếu cần PDF: từ trang HTML chọn Print → Save as PDF.
- [ ] Kiểm tra không xuất hiện `APPROVE`, `REJECT`, hạn mức hay terms được đề xuất.

### E. VI/EN và responsive

- [ ] Chuyển VI → EN → VI khi màn W06 đang mở.
- [ ] Xác nhận tiêu đề, biểu mẫu, trạng thái, preview và lịch sử đổi ngôn ngữ đúng.
- [ ] Kiểm tra 390 × 844, 768 × 1024, 1440 × 900; không tràn ngang ngoài ý muốn, bảng dữ liệu có thể cuộn ngang trong container riêng.

### F. Regression

- [ ] Chạy `run_tests.bat`; kỳ vọng 80/80 Node.js PASS và 18/18 Python API PASS (nếu `.venv` đã sẵn sàng).
- [ ] Kiểm tra lại W02 `100035` và `100009`.
- [ ] Kiểm tra W04 Loan Simulation.
- [ ] Kiểm tra W05 Decision Engine; bảo đảm nhãn VI/EN hotfix vẫn đúng.

## 9. GitHub Desktop

**Summary**

```text
Hoàn thiện W06 – Reports & History
```

**Description**

```text
- Thêm tab Báo cáo & lịch sử từ dữ liệu CORE4 và H18.
- Xác thực hồ sơ W02 và response H18 của cùng mã SK_ID_CURR.
- Bổ sung báo cáo 38 trường allowlist, model metadata, top 10 explanation và Decision Trace.
- Thêm lưu history có chủ đích trên localStorage, giới hạn 50 bản ghi.
- Bổ sung tìm kiếm, xem lại, xóa và export JSON/HTML.
- Tách riêng khỏi báo cáo MOCK hiện có.
- Giữ nguyên API/backend, model H16, 169 predictors, threshold và policy.
- Node.js 80/80 PASS; Python API 18/18 PASS.
- Browser/live snapshot QA chờ xác nhận trên Windows.
```

**git add** (chạy từ repository root; đường dẫn tương đối từ repo root):

```bash
git add app/src/finrisk-report-history.js app/tests/finrisk-w06-reports-history.test.js app/FINRISK_W06_HANDOFF_20261107.md app/src/app.js app/src/i18n.js app/index.html app/assets/styles.css app/CHANGELOG.md
```
