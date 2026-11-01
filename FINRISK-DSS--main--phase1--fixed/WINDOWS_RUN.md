# Chạy FinRisk DSS trên Windows 10/11

**Trạng thái Windows: NOT TESTED.** Các lệnh dưới đây là hướng dẫn chưa được thực thi trên Windows. LIVE QA đã chạy trên Linux với Python 3.12.14 và Chromium, 52 PASS/0 FAIL. Metadata model gốc ghi Python 3.14/Windows; kết quả Linux không tự chứng nhận Windows.

## 1. Chuẩn bị

- Windows 10/11 64-bit; cài Python 3.12 x64 từ python.org, gồm Python Launcher (`py`). Chọn 3.12 để gần môi trường đã kiểm thử; không đổi dependency lock nếu cài thất bại.
- Cài Node.js 24 x64 để chạy test JavaScript. Node không bắt buộc để phục vụ giao diện/API.
- Dùng Command Prompt (CMD) cho các lệnh dưới đây. Nếu đang ở PowerShell, gõ `cmd` trước.
- Giải nén ZIP source vào ví dụ `C:\FinRiskDSS`. Thư mục này phải chứa `app\backend_api\server.py`.
- Nhận CORE4 và tài sản ML gốc từ kênh nội bộ được phép. ZIP source sạch không chứa model binary, split IDs, response examples có giá trị đặc trưng hoặc snapshot. Không lấy model từ nguồn khác, không tự huấn luyện hay thay policy.

## 2. Bổ sung tài sản ML riêng tư

Chép đúng các tệp gốc sau vào vị trí tương ứng, không chép đè toàn bộ thư mục backend_ml vì sẽ mất source đã tích hợp:

```text
C:\FinRiskDSS\app\backend_ml\model\pipeline.joblib
C:\FinRiskDSS\app\backend_ml\splits\split_manifest.csv
C:\FinRiskDSS\app\backend_ml\contracts\response_examples.json
```

Hai tệp đầu cần cho runtime; response_examples cần cho reference QA. Metadata, policy, requirements-lock, schema và toàn bộ source Python đã có trong source ZIP. Model, split, policy phải đúng bộ gốc. Hash model phải bằng `7db887ce309eaa9c2151c9f408c1f7b673e562fa8b3aed08f8f22942581dae34`; ProfileScorer tự kiểm thêm split/policy/data. Không đưa các tài sản local này vào commit. `fresh_process_smoke_h13.json` lịch sử không cần cho runtime và không nằm trong ZIP sạch.

Giải nén snapshot vào thư mục ngoài checkout, ví dụ:

```text
C:\FinRiskData\FinRisk_CORE4_Snapshot\
  data\feature_matrix.parquet
  reports\feature_contract.json
  reports\model_candidate_columns.json
```

Nếu snapshot đang là nhiều volume, để tất cả phần `.7z.001`, `.7z.002` cạnh nhau, dùng 7-Zip giải nén từ `.001`, sau đó giải nén ZIP bên trong. Không đổi nội dung các tệp.

Kiểm hash bằng CMD:

```bat
certutil -hashfile "C:\FinRiskData\FinRisk_CORE4_Snapshot\data\feature_matrix.parquet" SHA256
certutil -hashfile "C:\FinRiskDSS\app\backend_ml\model\pipeline.joblib" SHA256
```

Parquet phải bằng:

```text
a86250a18e4bf23789176759a145b69562cc5caf072665c7b131b98c2232abc0
```

## 3. Python và dependencies

```bat
cd /d C:\FinRiskDSS\app
py -0p
py -3.12 -m venv .venv
setup_windows.bat
.venv\Scripts\python.exe --version
.venv\Scripts\python.exe -m pip check
```

`setup_windows.bat` dùng venv có sẵn và cài chính xác `backend_ml\model\requirements-lock.txt`. Không cần activate; mọi lệnh dùng Python trong venv. Nếu đã có venv khác, kiểm phiên bản trước khi dùng lại; không ghi đè môi trường cá nhân ngoài dự án. Nếu lỗi thiếu DLL LightGBM trên Windows, kiểm Visual C++ Redistributable x64 từ Microsoft và wheel phù hợp Python x64; giữ kiểm TLS và phiên bản khóa.

## 4. Kiểm reference rồi khởi động API

```bat
set "FINRISK_SNAPSHOT=C:\FinRiskData\FinRisk_CORE4_Snapshot"
set "OMP_NUM_THREADS=2"
set "OPENBLAS_NUM_THREADS=2"
.venv\Scripts\python.exe qa\verify_h13.py
run_with_ml.bat
```

Có thể truyền đường dẫn trực tiếp, kể cả có khoảng trắng:

```bat
run_with_ml.bat "C:\FinRiskData\FinRisk_CORE4_Snapshot"
```

Hoặc chạy Python:

```bat
.venv\Scripts\python.exe backend_api\server.py --snapshot "C:\FinRiskData\FinRisk_CORE4_Snapshot" --port 8080
```

`--snapshot` ưu tiên hơn biến `FINRISK_SNAPSHOT`. Tham số là thư mục CHA của data/reports, không phải tệp Parquet. Server nạp scorer một lần mỗi process; sau thay đổi cấu hình phải dừng bằng Ctrl+C rồi khởi động lại. Server chỉ lắng nghe loopback, không phải cấu hình production. Nếu cổng 8080 đã có tiến trình khác, chọn cổng khác bằng `--port` và dùng cùng cổng cho browser/health checks. Không dùng `serve_local.py` hoặc run_localhost.bat cho ML vì chúng chỉ phục vụ tĩnh.

Mở trình duyệt trên chính máy Windows tại:

```text
http://127.0.0.1:8080/#result
```

Tại panel tra cứu ML, nhập 100035. Kỳ vọng score hiển thị 15.160%, đề nghị chuyên viên xem xét, 10 đóng góp. Score chính xác qua API phải là `0.15160322574159024`; `review_recommended=true`, `explanation_status=ok`. Đổi VI→EN→VI và xác nhận kết quả vẫn giữ nguyên.

Ở CMD thứ hai:

```bat
curl.exe -i http://127.0.0.1:8080/api/ml/health
curl.exe "http://127.0.0.1:8080/api/ml/score?sk_id_curr=100035"
curl.exe -i "http://127.0.0.1:8080/api/ml/score?sk_id_curr=abc"
```

Health cần 200/ready. ID abc cần 400/INVALID_PROFILE_ID. Thiếu hoặc sai model/snapshot/schema thì health 503; xem log terminal, không thay bằng dữ liệu giả. API 403 dành cho final-test IDs; 404 hồ sơ không tồn tại; 500 lỗi suy luận. Không lưu raw phản hồi chứa feature values vào Git.

## 5. Chạy kiểm thử

```bat
.venv\Scripts\python.exe qa\verify_h13.py
.venv\Scripts\python.exe backend_api\test_server.py
for %F in (tests\*.test.js) do @node "%F"
```

Trong tệp .bat dùng `%%F` thay cho `%F`. Phải xem exit status của từng lệnh; vòng for tương tác không tự tổng hợp lỗi. `run_tests.bat` chỉ chạy tập con legacy. Bộ reference thoát 2 khi thiếu đầu vào (BLOCKED), 1 nếu FAIL, 0 khi thực sự PASS.

Để chạy live E2E browser tự động:

```bat
.venv\Scripts\python.exe -m pip install playwright==1.64.1
.venv\Scripts\python.exe -m playwright install chromium
.venv\Scripts\python.exe qa\h13_live_qa.py --snapshot "C:\FinRiskData\FinRisk_CORE4_Snapshot" --out "C:\FinRiskData\qa-live"
```

`--out` bắt buộc chỉ định đường dẫn Windows ngoài checkout để không dùng mặc định Linux. Script dùng server riêng/cổng động, không mock response, tự dừng server để kiểm lỗi mất kết nối. Nó không chứng nhận Windows cho tới khi chạy xong và kiểm evidence trên máy Windows. Kết quả live trước đó gồm 52 PASS trên Linux.

## 6. Giới hạn

- Windows 10/11: **NOT TESTED**.
- PASS hiện tại chỉ áp dụng tra cứu hồ sơ có sẵn trong CORE4. Hồ sơ mới chưa có feature engineering; PostgreSQL, lịch sử, decision trace và báo cáo vẫn MOCK.
- Policy gốc là demo/manual review; chưa có sign-off production hoặc cam kết score là PD đã hiệu chỉnh.
- Không có .env/API key bắt buộc cho API local. Không đưa snapshot, keys, raw response, screenshot chứa feature values hoặc tài sản ML riêng tư vào Git.
