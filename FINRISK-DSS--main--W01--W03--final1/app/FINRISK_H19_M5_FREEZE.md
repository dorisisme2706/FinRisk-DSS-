# FinRisk DSS — H19 E2E & M5 Freeze

## Mục tiêu
H19 không huấn luyện lại mô hình. Bước này xác minh luồng đã khóa sau H16/H18 và chỉ freeze build khi canonical CORE4 Parquet + model + API + frontend cùng vượt qua kiểm tra.

## Trạng thái trong môi trường đóng gói
- Node/UI regression: 47/47 PASS.
- Backend API unit/guard: 12/12 PASS.
- 6 hồ sơ reference dùng model thật trên biểu diễn CSV cùng snapshot: PASS; sai số lớn nhất 1.3877787807814457e-17.
- Test-set guard: không chấm lại hồ sơ Test trong H19.
- Canonical Parquet runtime: chưa thể chạy trong môi trường đóng gói do thiếu `pyarrow` và không có mạng để cài lock; vì vậy **M5 chưa được tự động đánh dấu final PASS tại đây**.

## Chốt M5 trên máy HK/GK
1. Chạy `setup_windows.bat` nếu chưa có `.venv` đúng `requirements-lock.txt`.
2. Đảm bảo snapshot chuẩn có `data\feature_matrix.parquet` và report contract.
3. Chạy:

```powershell
.\03_H19_E2E_FREEZE.cmd "D:\DSS\FinRisk_CORE4_Snapshot"
```

Chỉ khi cuối cùng hiện `PASS_M5_FREEZE` mới đánh dấu H19/M5 là PASS chính thức.

## Điều kiện freeze
- Model version: `finrisk_lgbm_h12_demo_v0.2`.
- Data version: `finrisk_v2_20261022151614259322`.
- Threshold policy: `finrisk_demo_f1_validation_v1`.
- Không đổi model/feature/threshold sau H16.
- Không dùng Test để tuning lại.
- API phải chặn ID thuộc Test trước inference.
- REAL Decision Support chỉ phát tín hiệu review; không tự tạo approve/reject/hạn mức/lãi suất/kỳ hạn.
