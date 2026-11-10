# M08.3 — Danh sách file bàn giao và hướng dẫn commit GitHub Desktop

**Gói gốc đối chiếu:** `FinRisk_DSS_M08_3_PostgreSQL_Foundation_20261109.zip`  
**Gói bàn giao mới:** `FinRisk_DSS_M08_3_PostgreSQL_LiveVerified_20261109.zip`  
**Phạm vi so sánh:** nội dung gói bàn giao mới so với ZIP M08.3 gốc trong phiên này; chưa phải diff với branch GitHub thực tế của người dùng.

## 1. Tóm tắt thay đổi

- Bổ sung column-level grant cho health check trong migration 0002; không mở SELECT toàn bảng `schema_migrations`.
- Bổ sung regression test và source audit check để ngăn lỗi grant tái xuất hiện.
- Cập nhật handoff/setup/start-here để phản ánh kết quả PostgreSQL live validation 09/11/2026.
- Thêm hướng dẫn triển khai máy Windows mới.
- Thêm bằng chứng PostgreSQL live validation, không chứa password, `.env`, `.venv` hoặc data directory.

## 2. Modified — file đã chỉnh sửa

| # | File | Nội dung thay đổi |
|---:|---|---|
| 1 | `M08_START_HERE_VI.md` | Thay trạng thái M08.3 cũ bằng kết quả live foundation và giới hạn còn lại. |
| 2 | `app/FINRISK_M08_3_HANDOFF_20261109.md` | Cập nhật handoff từ source-only sang live-validated; bổ sung migration hash, runtime evidence và giới hạn. |
| 3 | `app/backend_api/test_database.py` | Thêm regression test cho quyền SELECT riêng cột `migration_version`. |
| 4 | `app/database/M08_3_POSTGRES_SETUP.md` | Trỏ tới deployment guide và ghi nhận mốc live verification. |
| 5 | `app/database/migrations/0002_runtime_grants.sql` | Thêm `GRANT SELECT (migration_version) ...`; giữ `REVOKE ALL` và không cấp table-level SELECT. |
| 6 | `app/qa/m08_3_persistence_audit.py` | Thêm source audit check về column-level migration grant. |
| 7 | `app/evidence/m08/M08_3_SOURCE_AUDIT_20261109.json` | Cập nhật số check và SHA-256 sau khi chạy audit mới. |
| 8 | `app/evidence/m08/M08_3_SOURCE_AUDIT_20261109.txt` | Cập nhật log source audit. |

## 3. Added — file mới

| # | File | Nội dung |
|---:|---|---|
| 1 | `M08_3_FILE_CHANGES_20261109.md` | Danh sách file thay đổi và commit guidance (file này). |
| 2 | `app/database/FINRISK_M08_3_DEPLOYMENT_GUIDE_VI.md` | Runbook triển khai PostgreSQL Foundation trên Windows mới. |
| 3 | `app/evidence/m08/M08_3_POSTGRESQL_LIVE_VALIDATION_20261109.md` | Bằng chứng PostgreSQL live validation, HTTP health, RLS, grants và actor test. |

## 4. Deleted — file bị xóa

Không có file nào bị xóa.

## 5. Không đưa vào commit/source ZIP

Các thành phần local/secret không nằm trong gói bàn giao:

- `app/.env` (connection strings/passwords).
- `app/.venv/` và Python site-packages.
- PostgreSQL data directory và database files.
- Mật khẩu PostgreSQL, encryption key/secret.
- CORE4 Snapshot/Parquet/split data riêng tư và dữ liệu khách hàng.

## 6. Kết quả QA được ghi nhận

- PostgreSQL 17.11; Windows service Running/Automatic.
- `finrisk_app_db`, owner `finrisk_owner`, UTF8.
- 0001 và 0002 APPLIED; `migrate.py --status` xác nhận.
- HTTP `/api/db/health`: `ready`, `DB_CONNECTED`, `integration_stage=M08.3`.
- 12 tables; 8 RLS + FORCE RLS; 11 policies.
- API đọc `migration_version` nhưng không có SELECT toàn bảng `schema_migrations`.
- `audit_events` runtime SELECT/INSERT only; không UPDATE/DELETE/TRUNCATE.
- `current_actor_id()` trả NULL; custom GUC giả mạo không thay đổi actor; transaction rollback.
- Trên Windows reference machine: Source Audit 12/12, DB tests 9/9, Server tests 19/19 PASS; pip check PASS.
- Sau khi cập nhật package: Source Audit 13/13, DB tests 10/10 và Server tests 19/19 PASS trong build container Python 3.13. Server test có warning version scikit-learn container 1.8.0 so với artifact 1.9.1; Windows reference với H16 lock 1.9.1 đã đạt 19/19 trước đó.
- Nên chạy lại regression test mới trong `.venv` Windows của bạn trước commit để lưu log 10/10 theo đúng runtime target.
- CORE4 Snapshot chưa cấu hình trên Windows reference: ML `SNAPSHOT_NOT_CONFIGURED`. Đây không phải lỗi PostgreSQL.

## 7. GitHub Desktop — hướng dẫn review và commit

1. Mở GitHub Desktop, chọn **repository chính thức** của FinRisk, không dùng thư mục ZIP giải nén làm repository mới nếu nó không có metadata Git.
2. Checkout đúng branch dự án đang dùng (ví dụ `integration/h13-core4` chỉ khi đây là branch đã thống nhất cho M08.3).
3. Đưa các file trong mục **Modified** và **Added** vào đúng working tree repository, giữ nguyên folder structure.
4. Không sao chép `app/.env`, `.venv`, database files hoặc snapshot vào repository.
5. Trong tab **Changes**, đối chiếu đúng danh sách ở mục 2 và 3; xem diff của migration 0002, không chấp nhận thay đổi H16/CORE4/H18/UI ngoài phạm vi đã nêu.
6. Chỉ commit khi GitHub Desktop hiển thị đúng các file dự kiến và không thấy secret/local data.

**Commit Summary**

```text
Hoàn thiện PostgreSQL Foundation và live validation cho M08.3
```

**Commit Description**

```text
- Bổ sung column-level SELECT cho migration_version để runtime DB health hoạt động mà không đọc toàn bảng schema_migrations.
- Thêm regression test và source audit check cho quyền migration history.
- Cập nhật M08.3 handoff và PostgreSQL setup theo kết quả live PostgreSQL 17.11.
- Bổ sung hướng dẫn triển khai M08.3 trên máy Windows mới.
- Ghi nhận bằng chứng migration, HTTP DB health, RLS, least privilege và actor fail-closed.
- Giữ nguyên CORE4/H16/H18 guardrails; không mở trusted authentication hoặc CRUD API.
- Không đưa app/.env, .venv, password, database data hoặc customer data vào Git.
```

**Expected change count so với ZIP M08.3 gốc:** Added 3 (bao gồm chính manifest này); Modified 8; Deleted 0. GitHub Desktop có thể hiển thị nhiều hơn nếu branch làm việc có khác biệt độc lập so với ZIP gốc; phải review diff thực tế trước commit.
