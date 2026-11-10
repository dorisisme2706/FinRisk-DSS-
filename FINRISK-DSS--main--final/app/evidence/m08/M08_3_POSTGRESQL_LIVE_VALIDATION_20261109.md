# M08.3 — PostgreSQL Live Validation Evidence

**Ngày thực hiện:** 09/11/2026 (máy Windows reference)  
**Source:** `FinRisk_DSS_M08_3_PostgreSQL_Foundation_20261109.zip`, với migration 0002 được bổ sung column-level grant trước khi apply  
**Mục đích:** Lưu kết quả PostgreSQL thật trong khi source audit/unit tests build không tự kết nối database.

## 1. Môi trường

| Thành phần | Kết quả |
|---|---|
| PostgreSQL | 17.11, x86_64 Windows 64-bit |
| Windows Service | `postgresql-x64-17`, Running, StartMode Auto, chạy dưới `NT AUTHORITY\NetworkService` |
| Python | CPython 3.14.7 64-bit |
| PostgreSQL driver | `psycopg` / `psycopg-binary` 3.3.6 |
| H16 lock | Các package version khớp `backend_ml/model/requirements-lock.txt` |
| Dependency check | `No broken requirements found.` |

`app/.env`, passwords, PostgreSQL data directory và `.venv` không được đưa vào source package/evidence.

## 2. Cluster, roles và database

Đã tạo và xác minh năm group roles:

- `finrisk_owner`
- `finrisk_migrator`
- `finrisk_app`
- `finrisk_auditor`
- `finrisk_readonly`

Cả năm đều `rolcanlogin=false`, `rolsuper=false`, `rolcreatedb=false`, `rolcreaterole=false`, `rolbypassrls=false`. `finrisk_migrator` là member của `finrisk_owner`.

Hai login roles:

- `finrisk_migrator_login` thuộc `finrisk_migrator`.
- `finrisk_api_login` thuộc `finrisk_app`.

Cả hai đã đăng nhập thực tế vào `finrisk_app_db`. Database có owner `finrisk_owner`, encoding `UTF8`.

## 3. Migration execution

Migration runner thực thi thành công:

```text
APPLY 0001_initial_schema (committed)
APPLY 0002_runtime_grants (committed)
```

Exit code: `0`.

Chạy `migrate.py --status` sau đó:

```text
APPLIED 0001_initial_schema
APPLIED 0002_runtime_grants
```

Exit code: `0`.

### 3.1. SHA-256 nội dung đã apply

| Migration | SHA-256 |
|---|---|
| `0001_initial_schema.sql` | `F80659267ED3B8845D992837C5099C9C983E03BD453170679CDA057FD11B28A0` |
| `0002_runtime_grants.sql` | `0B73B2F877FB6B9CF2ED442D6440184A600F9F0ABEEA7AE906CFEC439ED54013` |

Migration 0002 bao gồm:

```sql
REVOKE ALL ON finrisk_app.schema_migrations FROM finrisk_app;
GRANT SELECT (migration_version) ON finrisk_app.schema_migrations TO finrisk_app;
```

Đây là quyền cột tối thiểu cần cho database health check. Không cấp SELECT toàn bảng `schema_migrations` cho runtime.

## 4. Runtime connection và HTTP health

Python gọi `database_health()` bằng `FINRISK_DATABASE_URL` trả:

```text
{'status': 'ready', 'code': 'DB_CONNECTED'}
PASS: FinRisk PostgreSQL runtime connection
EXIT CODE: 0
```

Backend server khởi động tại `127.0.0.1:8080`. HTTP GET `/api/db/health` trả:

```json
{
  "status": "ready",
  "code": "DB_CONNECTED",
  "integration_stage": "M08.3"
}
```

Server start log ghi `ML: UNAVAILABLE - SNAPSHOT_NOT_CONFIGURED`. CORE4 Snapshot chưa cấu hình trên máy Windows reference; đây là vấn đề cấu hình ML riêng, không phải lỗi PostgreSQL.

## 5. Schema, RLS và policies

Catalog query xác nhận 12 bảng trong `finrisk_app`:

| Bảng | RLS | FORCE RLS |
|---|---:|---:|
| `app_roles` | false | false |
| `app_user_roles` | true | true |
| `app_users` | false | false |
| `assessment_runs` | true | true |
| `audit_events` | true | true |
| `business_rule_registry` | false | false |
| `financial_validation_findings` | true | true |
| `financial_validation_runs` | true | true |
| `loan_applications` | true | true |
| `loan_simulation_scenarios` | true | true |
| `report_records` | true | true |
| `schema_migrations` | false | false |

Có 11 RLS policies trên 8 bảng bật RLS.

## 6. Runtime least-privilege checks

| Quyền tài khoản `finrisk_api_login` | `audit_events` | `schema_migrations` |
|---|---:|---:|
| SELECT toàn bảng | true | false |
| INSERT | true | false |
| UPDATE | false | false |
| DELETE | false | false |
| TRUNCATE | false | false |
| SELECT riêng `migration_version` | — | true |

Runtime truy vấn được migration history và nhận hai version `0001`, `0002`. Query `count(*)` trên `loan_applications` trả `0`, đúng trạng thái khi chưa có trusted actor context.

## 7. Actor context / chống caller GUC spoofing

Định nghĩa hàm được đọc từ PostgreSQL:

- Owner: `finrisk_owner`.
- `SECURITY DEFINER`: false.
- Volatility: `STABLE`.
- Body: `SELECT NULL::uuid`.

API được quyền `EXECUTE` hàm, nhưng `current_actor_id()` trả NULL.

Thử nghiệm trong transaction bằng login API:

```sql
BEGIN;
SET LOCAL app.actor_id = '00000000-0000-0000-0000-000000000001';
SELECT current_setting('app.actor_id', true), finrisk_app.current_actor_id();
ROLLBACK;
```

Kết quả: custom GUC có giá trị UUID giả lập; `resolved_actor_id` vẫn NULL; `is_auditor=false`; transaction `ROLLBACK`. Không có dữ liệu nghiệp vụ nào được thay đổi.

## 8. Automated tests

Kết quả đã chạy trên Windows reference machine trước khi bổ sung regression test mới trong source package:

| Suite | Kết quả |
|---|---:|
| `qa/m08_3_persistence_audit.py` | 12/12 PASS |
| `python -m unittest backend_api.test_database -v` | 9/9 PASS |
| `python -m unittest backend_api.test_server -v` | 19/19 PASS |
| H16 `pip check` | PASS |
| Full Node regression (evidence trong source) | 124/124 PASS |
| Freeze verifier (evidence trong source) | 8/8 PASS; 39/39 protected files MATCH |

Gói source bàn giao bổ sung 1 static regression test và 1 source audit check để bảo vệ column-level migration grant. Sau khi bổ sung, source audit được chạy lại trong môi trường đóng gói: **13/13 PASS**; `backend_api.test_database`: **10/10 PASS**; `backend_api.test_server`: **19/19 PASS**. Lần chạy package recheck dùng Python 3.13 build container; Server Tests có `InconsistentVersionWarning` do môi trường container sử dụng scikit-learn 1.8.0 trong khi model artifact được tạo với 1.9.1, nhưng suite vẫn kết thúc `OK`. Riêng trên Windows reference machine, người dùng đã chạy Python 3.14.7 với H16 lock scikit-learn 1.9.1 và `test_server.py` đạt 19/19 PASS; trước khi bổ sung regression test, `test_database.py` đạt 9/9. Live database đã được kiểm chứng với SQL đúng theo checksum ở mục 3.1.

## 9. Phần chưa được kiểm thử hoặc chưa triển khai

- Trusted authentication chưa tích hợp; chưa kiểm thử RLS isolation giữa hai actor đã được xác thực.
- CRUD/write API chưa được mở.
- Chưa chuyển localStorage/browser history sang PostgreSQL.
- PII encryption key management chưa được hoàn thiện/xác minh; không dùng DB cho PII thật trước khi quy trình key được phê duyệt.
- Backup/restore chưa được thực nghiệm; không tuyên bố đã nghiệm thu.
- CORE4 Snapshot chưa cấu hình trên máy Windows này; ML log là `SNAPSHOT_NOT_CONFIGURED`.
- HTTP API chỉ bind loopback `127.0.0.1`; chưa có authentication ở API layer, không expose mạng công cộng.

**Kết luận:** PostgreSQL Foundation, migration, runtime connection, DB Health HTTP, schema/RLS catalog, least-privilege grant và fail-closed actor context đã được kiểm chứng trên PostgreSQL 17.11 thật. Đây không phải xác nhận hoàn tất CRUD/authentication/backup-restore hoặc toàn bộ FinRisk DSS.
