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

Tại thời điểm chốt M08.2 (08/11/2026), M08.3 chỉ được bắt đầu sau khi data contract, roles/RLS, PII encryption, retention và backup/restore được duyệt. Trạng thái triển khai M08.3 được cập nhật ở mục tiếp theo.


## M08.3 — PostgreSQL Persistence Foundation (cập nhật 09/11/2026)

PostgreSQL Foundation đã được apply và kiểm thử trên PostgreSQL 17.11 thật trên Windows: hai migrations APPLIED, Database Health qua HTTP trả `ready` / `DB_CONNECTED`, 12 bảng, 8 bảng RLS + FORCE RLS, 11 policies, quyền runtime đã kiểm tra và actor context fail-closed. Trên Windows reference machine: Source Audit 12/12, Database Tests 9/9, Server Tests 19/19 và pip check PASS. Sau khi bổ sung regression guard vào source package: Source Audit 13/13, Database Tests 10/10 và Server Tests 19/19 đã được recheck trong build container.

**Phạm vi chưa hoàn tất:** trusted authentication, isolation giữa hai người dùng đã xác thực, CRUD/write API, chuyển localStorage, PII key management và backup/restore. CORE4 Snapshot chưa cấu hình trên máy Windows reference; điều này độc lập với PostgreSQL Health.

Tài liệu bàn giao: `app/FINRISK_M08_3_HANDOFF_20261109.md`. Hướng dẫn triển khai máy mới: `app/database/FINRISK_M08_3_DEPLOYMENT_GUIDE_VI.md`. Bằng chứng live DB: `app/evidence/m08/M08_3_POSTGRESQL_LIVE_VALIDATION_20261109.md`.

Không diễn giải M08.3 là CRUD/authentication đã hoàn tất; đây là PostgreSQL Foundation đã được live-validated.
