# Chạy FinRisk DSS H18 trên Windows 10/11

## 1. Cấu trúc cần có

Sau khi giải nén ZIP H18, source đã chứa model H16 frozen tại:

```text
app\backend_ml\model\pipeline.joblib
app\backend_ml\splits\split_manifest.csv
app\backend_ml\contracts\response_examples.json
```

Snapshot CORE4 **không nằm trong ZIP source**. Giữ snapshot riêng, ví dụ:

```text
D:\DSS\FinRisk_CORE4_Snapshot\
  data\feature_matrix.parquet
  reports\feature_contract.json
  reports\model_candidate_columns.json
```

SHA256 Parquet phải là:

```text
a86250a18e4bf23789176759a145b69562cc5caf072665c7b131b98c2232abc0
```

## 2. Tạo môi trường

Mở PowerShell hoặc CMD tại thư mục `app`:

```bat
py -3.12 --version
setup_windows.bat
```

`setup_windows.bat` tạo `.venv` bằng Python 3.12 và cài đúng `backend_ml\model\requirements-lock.txt`.

## 3. Kiểm H18 trước khi chạy web

```bat
set "FINRISK_SNAPSHOT=D:\DSS\FinRisk_CORE4_Snapshot"
.venv\Scripts\python.exe qa\verify_h18.py
```

Kết quả mong muốn: `status = PASS`, 6 hồ sơ tham chiếu đạt, `test_profiles_scored = 0`.

## 4. Khởi động FinRisk H18

```bat
run_with_ml.bat "D:\DSS\FinRisk_CORE4_Snapshot"
```

Mở:

```text
http://127.0.0.1:8080/#result
```

ID tham chiếu `100035` phải có score chính xác:

```text
0.15160322574159024
```

và `review_recommended = true`.

API kiểm tra:

```bat
curl.exe http://127.0.0.1:8080/api/ml/health
curl.exe "http://127.0.0.1:8080/api/ml/score?sk_id_curr=100035"
curl.exe "http://127.0.0.1:8080/api/decision/assess?sk_id_curr=100035"
```

Endpoint `/api/decision/assess` phải trả:
- `integration_stage = H18`
- `decision_support.signal = MANUAL_REVIEW_RECOMMENDED` cho ID 100035
- `automatic_credit_decision = false`
- `recommended_amount`, `recommended_term_months`, `interest_rate`, `monthly_payment` đều `null`.

## 5. Chạy test

```bat
.venv\Scripts\python.exe backend_api\test_server.py
node --test tests\*.test.js
```

Nếu có snapshot chuẩn, chạy thêm `qa\verify_h18.py`.

## 6. Giới hạn cần giữ

- H16 đã mở Final Test; **không dùng Test để tuning lại model/feature/threshold**.
- Test IDs vẫn bị chặn ở runtime demo.
- Threshold `0.14484327385366114` là threshold review demo được khóa từ Validation, không phải policy phê duyệt tín dụng của ngân hàng.
- Thay đổi amount/term trong phần mô phỏng không được làm thay đổi risk score của model.
- H18 chưa tự động tạo hạn mức, kỳ hạn, lãi suất hoặc quyết định APPROVE/REJECT.
