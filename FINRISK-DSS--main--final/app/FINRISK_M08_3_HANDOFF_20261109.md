# FinRisk DSS — M08.3 PostgreSQL Persistence Foundation

**Ngày cập nhật:** 09/11/2026  
**Baseline source:** `FinRisk_DSS_M08_3_PostgreSQL_Foundation_20261109.zip`  
**Môi trường live reference:** Windows, PostgreSQL 17.11, CPython 3.14.7 64-bit, `psycopg[binary]==3.3.6`  
**Trạng thái:** PostgreSQL Foundation đã được apply và kiểm thử trên PostgreSQL thật; trusted authentication và CRUD nghiệp vụ vẫn chưa triển khai.

## 1. Phạm vi M08.3 đã triển khai

- Hai migration versioned:
  - `database/migrations/0001_initial_schema.sql`
  - `database/migrations/0002_runtime_grants.sql`
- PostgreSQL adapter tại `backend_api/db.py`.
- Migration runner tại `backend_api/migrate.py`, có kiểm tra thứ tự, SHA-256 checksum, advisory transaction lock và PostgreSQL major 16–18.
- `GET /api/db/health`, response đã được kiểm chứng qua HTTP và không tiết lộ DSN/credential.
- Chỉ cho phép database loopback (`127.0.0.1`, `localhost`, `::1`).
- Runtime/API dùng `finrisk_api_login`; migration dùng riêng `finrisk_migrator_login`.
- `psycopg[binary]==3.3.6` được cài riêng, không thay đổi H16 `requirements-lock.txt`.
- Không thay đổi UI, CORE4 Snapshot contract, H16 model/169 predictors/threshold, H18 policy hoặc dữ liệu khách hàng.

## 2. Kết quả triển khai PostgreSQL thật (09/11/2026)

Đã chạy trên Windows local:

- PostgreSQL `17.11`, Windows Service `postgresql-x64-17`, trạng thái `Running`, startup `Automatic`.
- Database `finrisk_app_db`, owner `finrisk_owner`, encoding `UTF8`.
- Năm group roles `finrisk_owner`, `finrisk_migrator`, `finrisk_app`, `finrisk_auditor`, `finrisk_readonly`: đều `NOLOGIN`, không superuser/createdb/createrole/bypassrls.
- Hai login role riêng: `finrisk_migrator_login` thuộc `finrisk_migrator`; `finrisk_api_login` thuộc `finrisk_app`; cả hai đăng nhập được vào `finrisk_app_db`.
- `0001_initial_schema` và `0002_runtime_grants` được apply/commit; `migrate.py --status` sau đó hiển thị cả hai `APPLIED`.
- Runtime Database Health trực tiếp và HTTP `/api/db/health` đều trả `status=ready`, `code=DB_CONNECTED`; HTTP thêm `integration_stage=M08.3`.
- Schema có 12 bảng; 8 bảng bật RLS và FORCE RLS; 11 policies trên 8 bảng.
- API đọc được migration versions `0001`, `0002`; không có table-level SELECT trên `schema_migrations`, chỉ có column-level SELECT trên `migration_version`.
- `audit_events`: API có SELECT/INSERT, không có UPDATE/DELETE/TRUNCATE.
- `current_actor_id()` do `finrisk_owner` sở hữu, không phải `SECURITY DEFINER`, `STABLE`, body `SELECT NULL::uuid`.
- Thử đặt custom GUC `app.actor_id` không thay đổi kết quả actor (`resolved_actor_id=NULL`); transaction test kết thúc `ROLLBACK`.
- API runtime nhìn thấy 0 `loan_applications` khi chưa có trusted actor context; đây là kết quả fail-closed dự kiến.

Bằng chứng chi tiết: `evidence/m08/M08_3_POSTGRESQL_LIVE_VALIDATION_20261109.md`.

## 3. Sửa quyền cần thiết trong migration 0002

Health-check runtime cần truy vấn `migration_version` để xác nhận các migration đã apply. Vì runtime không được phép đọc toàn bộ bảng lịch sử, `0002_runtime_grants.sql` giữ nguyên lệnh revoke toàn bảng và cấp đúng quyền cột:

```sql
REVOKE ALL ON finrisk_app.schema_migrations FROM finrisk_app;
GRANT SELECT (migration_version) ON finrisk_app.schema_migrations TO finrisk_app;
```

Quyền này đã được xác minh trên PostgreSQL thật:
- `has_table_privilege(..., 'schema_migrations', 'SELECT') = false`.
- `has_column_privilege(..., 'migration_version', 'SELECT') = true`.
- HTTP `/api/db/health` trả `DB_CONNECTED`.

Không sửa nội dung migration này sau khi đã apply. Migration runner dùng SHA-256 để phát hiện thay đổi.

## 4. QA và bằng chứng

### 4.1. Source/build test evidence trong gói

- M08.2 schema/security design audit: 19/19 PASS.
- M08.3 source audit trên source ban đầu: 12/12 PASS; sau khi thêm guard column-level grant, package recheck đạt 13/13 PASS.
- Python unittest evidence ban đầu: 28/28 PASS (9 database tests + 19 server tests, offline/mocked; không phải live database test).
- Trên Windows reference machine: Database tests 9/9 và Server tests 19/19 PASS; H16 lock khớp, `pip check` trả `No broken requirements found`.
- Sau khi đóng gói cập nhật: `test_database.py` 10/10 và `test_server.py` 19/19 PASS trong build container Python 3.13; container có cảnh báo scikit-learn 1.8.0 so với artifact 1.9.1. Windows reference run dùng scikit-learn 1.9.1; test_server 19/19 đã PASS ở đó.
- Full Node regression: 124/124 PASS.
- Freeze verifier: 8/8 PASS, protected files 39/39 MATCH.

### 4.2. Source audit và regression guard mới

`qa/m08_3_persistence_audit.py` hiện kiểm tra thêm quyền đọc riêng `migration_version` mà không cấp SELECT toàn bảng. `backend_api/test_database.py` có test regression tương ứng. Package recheck đạt source audit 13/13 và database tests 10/10. Có thể chạy lại trên máy Windows chính thức trước khi commit để lưu evidence cùng môi trường CPython 3.14.7/H16 lock.

### 4.3. SHA-256 migration đã apply trên máy reference

| File | SHA-256 |
|---|---|
| `0001_initial_schema.sql` | `F80659267ED3B8845D992837C5099C9C983E03BD453170679CDA057FD11B28A0` |
| `0002_runtime_grants.sql` | `0B73B2F877FB6B9CF2ED442D6440184A600F9F0ABEEA7AE906CFEC439ED54013` |

Source audit JSON là static source audit và giữ `live_database_tested=false`, bởi script đó không tự kết nối database. Live DB evidence được ghi riêng trong file PostgreSQL live validation.

## 5. Security hardening và các giới hạn cần giữ

- `current_actor_id()` trả `NULL` tới khi có trusted authentication adapter.
- Caller-settable identity GUC và caller-parameterized `SECURITY DEFINER` identity resolver không được sử dụng.
- RLS owner-scoped fail-closed khi actor là NULL.
- Chưa bật write/CRUD API. Không nhận `owner_user_id` hoặc actor ID do HTTP client tự truyền làm bằng chứng danh tính.
- Không cấp `BYPASSRLS`, superuser hoặc quyền xóa/truncate cho runtime API.
- API và PostgreSQL hiện chỉ được dùng qua loopback; server API chưa có authentication, không bind `0.0.0.0`, không expose ra Internet.
- `FINRISK_PII_KEY_REFERENCE` hiện chỉ là placeholder/reference; key management thực tế và xử lý PII thật cần hoàn thiện riêng.
- Chưa kiểm thử backup/restore; không tuyên bố có quy trình khôi phục đã nghiệm thu.
- Chưa chuyển localStorage/browser data sang PostgreSQL.
- Trusted Authentication, phân lập dữ liệu giữa hai người dùng đã xác thực và CRUD nghiệp vụ chưa triển khai.
- CORE4 Snapshot chưa cấu hình trên Windows reference machine; backend start log có `ML: UNAVAILABLE - SNAPSHOT_NOT_CONFIGURED`. Đây là cấu hình ML tách biệt, không làm mất kết quả PostgreSQL Database Health PASS.

## 6. Guardrails H16/H18/CORE4 giữ nguyên

- CORE4 Snapshot và H16 model là external/read-only; không đưa Parquet, `pipeline.joblib`, split manifest hoặc customer data vào database/Git.
- Không ánh xạ `customer_id` sang `sk_id_curr`.
- W04 vẫn HYPOTHETICAL.
- Financial validation chỉ là INPUT_QUALITY.
- H18 là manual-review support signal; `business_policy_status=NOT_APPROVED`, `automatic_credit_decision=false`.
- Business rules chưa được phê duyệt vẫn `is_executable=false`.

## 7. Hướng dẫn triển khai máy mới

Tài liệu đầy đủ: `database/FINRISK_M08_3_DEPLOYMENT_GUIDE_VI.md`.

Tài liệu mô tả clone source bằng GitHub Desktop, cài PostgreSQL, provision roles/database, tạo Python `.venv`, cài H16 lock và Psycopg riêng, cấu hình `app/.env`, apply migrations, kiểm tra RLS/grants/health và các giới hạn khi cập nhật hoặc chuyển máy.

## 8. Quy trình commit

Dùng GitHub Desktop theo quy trình của dự án. Không commit `app/.env`, `.venv`, password, database data directory, CORE4 snapshot, Parquet hoặc model artifacts. File list và commit Summary/Description được cung cấp trong `M08_3_FILE_CHANGES_20261109.md` ở repository root.
