# FinRisk DSS — Bắt đầu M08

Bản nền: W07 Setup Batch Fix đã được người dùng chạy và xác nhận Windows runtime gate 11/11, CORE4 snapshot, `ML: READY`, W05 live Decision Trace và W06 tạo báo cáo.

## Những việc đã hoàn thành trong gói này

- M08.0: đóng băng 39 file của backend_ml, H16/H18 evidence và adapter H18 bằng SHA-256.
- M08.1: kiểm kê 13 route, 4 GET API, nguồn dữ liệu, storage, mock flows, thiếu PostgreSQL/auth và ranh giới form #09 với 169 H16 features.
- Chưa thay đổi hành vi ứng dụng; không sửa model, UI hoặc API.

## Chạy audit

Từ `app/`:

```powershell
.\run_m08_audit.bat
```

## Tài liệu

- `app/FINRISK_M08_HANDOFF_20261107.md`
- `app/qa/M08_MOCK_REAL_AUDIT_20261107.md`
- `app/qa/M08_ROADMAP_20261107.md`
- `app/qa/M08_CORE_FREEZE_MANIFEST.json`

Dataiku không thuộc stack dự án và không được đưa vào M08.

## M08.2 — Data Contract & PostgreSQL Logical Design (08/11/2026)

**Trạng thái:** Thiết kế hoàn tất, cần user/team review và sign-off. Chưa cài PostgreSQL Server, chưa tạo live database, chưa apply SQL, chưa bật persistence API.

Từ `app/` chạy kiểm tra thiết kế:

```powershell
.\run_m08_2_design_audit.bat
```

Tài liệu chính: `app/FINRISK_M08_2_HANDOFF_20261108.md`; checklist bắt buộc rà soát tại `app/qa/M08_2_SCHEMA_REVIEW_CHECKLIST_20261108.md`; SQL đề xuất tại `app/database/proposals/`.

M08.3 chỉ bắt đầu sau khi data contract, roles/RLS, PII encryption, retention và backup/restore được duyệt.
