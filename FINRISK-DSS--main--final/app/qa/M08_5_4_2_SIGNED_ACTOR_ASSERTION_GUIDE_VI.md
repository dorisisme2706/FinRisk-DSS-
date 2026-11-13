# M08.5.4.2 — Signed Actor Assertion POC trên PostgreSQL isolated cluster

**Mục tiêu:** chứng minh caller có thể tự đặt custom GUC nhưng không thể giả mạo PostgreSQL actor nếu không có HMAC key của trusted backend; assertion hợp lệ chỉ dùng được trong đúng transaction đã ký; RLS vẫn phân biệt Authentication và Authorization.

**Trạng thái:** gói POC để chạy trên isolated PostgreSQL 17.11. Chưa phải production implementation, chưa tạo migration 0004, không thay đổi `main`, production DB, H16, CORE4 hoặc H18.

## 1. Phạm vi và ranh giới an toàn

Gói này chỉ chấp nhận test cluster đã tạo ở M08.5.3.1:

- Data directory mặc định: `%LOCALAPPDATA%\FinRisk\M08_5_3_1_Test_Data_PostLF_20261112`
- Isolation marker: `.m08_5_3_1_isolated_test_cluster`
- Database: `finrisk_app_db` bên trong test cluster
- Host/port: `127.0.0.1:55432`
- PostgreSQL: 17
- Kết nối POC: user `postgres` của test cluster, không phải `finrisk_migrator_login` production

PowerShell runner từ chối port `5432`, từ chối data directory production đã biết, yêu cầu marker đúng và kiểm tra endpoint trước khi thực thi SQL. Runner không đọc/ghi `app/.env`.

Không dùng mật khẩu production. Khi được hỏi password, nhập password của `postgres` trong isolated test cluster đã tạo ở M08.5.3.1.

## 2. Thiết kế POC

### 2.1. Assertion claims

Backend trusted tạo HMAC-SHA256 từ chuỗi UTF-8 chuẩn hóa:

```text
finrisk-actor-v1|finrisk-api|finrisk-db|key_id|user_uuid|issued_at|expires_at|nonce_uuid|postgres_xid
```

Các thuộc tính:

- `key_id`: hỗ trợ luân chuyển key.
- `user_uuid`: internal `app_users.user_id` sau khi backend xác minh OIDC và identity mapping.
- `issued_at` / `expires_at`: thời hạn tối đa 60 giây; POC signer dùng 30 giây.
- `nonce_uuid`: mã ngẫu nhiên cho assertion.
- `postgres_xid`: `pg_current_xact_id()` của transaction hiện tại, ngăn replay assertion ở transaction khác.
- Audience cố định: `finrisk-db`; issuer nội bộ cố định: `finrisk-api`.

### 2.2. Database verifier

SQL POC tạo schema `finrisk_private`, cài `pgcrypto` riêng trong schema đó, và tạo bảng key. `finrisk_app` không có `USAGE` trên schema này và không có SELECT trên bảng key.

`finrisk_app.current_actor_id()` được thay tạm trong test DB bằng `SECURITY DEFINER` function, owner `finrisk_owner`, `search_path` cố định. Function chỉ trả UUID khi:

1. Tất cả claims có định dạng hợp lệ.
2. Assertion còn hạn, lifetime không quá 60 giây, clock skew issuance không quá 5 giây.
3. XID claim khớp transaction PostgreSQL hiện tại.
4. HMAC đúng với key đang ở trạng thái `ACTIVE` hoặc `VERIFY_ONLY`.
5. `app_users.account_status = 'ACTIVE'`.

Mọi lỗi/claim sai trả NULL (fail-closed). Function không đọc `app.actor_id`.

### 2.3. Authentication khác Authorization

- Actor có assertion hợp lệ nhưng không có `RULE_MANAGER`: `current_actor_id()` trả đúng actor, nhưng RLS vẫn từ chối INSERT Registry.
- Actor có assertion hợp lệ và có `RULE_MANAGER`: RLS cho phép INSERT synthetic Registry row.
- Caller đặt `app.actor_id` hoặc tự điền các GUC mới mà không có chữ ký hợp lệ: actor NULL và RLS từ chối INSERT.

## 3. Chạy POC

Giải nén gói ZIP. Chép bốn file trong `app\qa` của gói vào đúng `app\qa` trong working copy local của repository. Không ghi đè file hiện hữu.

Mở PowerShell tại thư mục `app`:

```powershell
powershell -ExecutionPolicy Bypass -File .\qa\run_m08_5_4_2_signed_actor_assertion_test.ps1
```

Runner sẽ:

1. Xác minh marker, data directory và PostgreSQL 17 binaries.
2. Khởi động đúng test cluster nếu cluster đang dừng.
3. Hỏi password của `postgres` trên test cluster (input ẩn).
4. Xác minh database, user, host, port và server version.
5. Chạy SQL POC trong một transaction trên test database.
6. Python sinh HMAC key ngẫu nhiên 32 byte trong bộ nhớ, chèn vào bảng private bằng parameterized query; key không in ra, không ghi vào source, `.env` hoặc file.
7. Chạy các kiểm tra tampering, expiry, replay, account status, role authorization và INSERT thật qua RLS với `SET LOCAL ROLE finrisk_app`.
8. Cleanup POC: xóa synthetic fixtures, khôi phục `current_actor_id()` về `SELECT NULL::uuid` / `SECURITY INVOKER`, gỡ `pgcrypto` và schema private.
9. Dừng test cluster nếu chính runner đã khởi động nó. Data directory test vẫn được giữ nguyên.

Nếu cluster đã chạy, runner không tự dừng cluster đó.

## 4. Các assertion phải PASS

1. `app.actor_id` giả mạo bị bỏ qua; actor NULL; Registry INSERT bị RLS chặn.
2. Các assertion GUC tự khai báo nhưng không có HMAC hợp lệ bị từ chối.
3. Thay `user_uuid` sau khi ký làm chữ ký không còn hợp lệ.
4. Tài khoản `DISABLED` không tạo được actor.
5. Assertion của user không có `RULE_MANAGER` nhận diện được actor nhưng không INSERT được Registry.
6. Actor có assertion hợp lệ và `RULE_MANAGER` nhưng giả mạo `created_by` của user khác vẫn bị RLS chặn.
7. Assertion hợp lệ của user ACTIVE có `RULE_MANAGER` hoạt động trong đúng transaction và INSERT được synthetic Registry row.
8. GUC dùng transaction-local bị xóa sau COMMIT.
9. Assertion được ký cho transaction cũ không dùng được ở transaction mới.
10. Assertion hợp lệ về chữ ký nhưng hết hạn bị từ chối.
11. Runtime `finrisk_app` không có USAGE private schema và không đọc được key table.

Kết quả cuối kỳ vọng:

```text
M08.5.4.2 SIGNED ACTOR ASSERTION POC: PASS
ISOLATED_POSTGRESQL: TRUE
PRODUCTION_DATABASE: NOT CONNECTED
H16_CORE4_H18: NOT MODIFIED
POC_OBJECTS: CLEANED UP
```

## 5. Cleanup nếu tiến trình bị dừng bất thường

Nếu PowerShell/Python bị tắt cưỡng bức sau khi SQL POC setup thành công và trước khi cleanup, chạy:

```powershell
powershell -ExecutionPolicy Bypass -File .\qa\run_m08_5_4_2_signed_actor_assertion_test.ps1 -CleanupOnly
```

Lệnh này cũng yêu cầu marker và endpoint isolated `127.0.0.1:55432`; nó chỉ khôi phục helper fail-closed và xóa POC objects trong test DB.

Nếu cleanup-only báo không tìm thấy `finrisk_private` hoặc `pgcrypto`, có thể POC đã được dọn xong. Không tự chạy câu lệnh cleanup trên production.

## 6. Giới hạn và việc chưa chứng minh

Đây là POC về **DB actor assertion**, không phải tích hợp OIDC đầy đủ:

- Không có IdP thật; synthetic `app_users` fixture mô phỏng identity đã được backend tin cậy ánh xạ.
- HMAC key được sinh trong Python test process và chỉ lưu tạm trong test database. Chưa giải quyết provisioning/rotation secret production giữa Windows secret store/KMS và PostgreSQL.
- Test role dùng `SET LOCAL ROLE finrisk_app` từ test-cluster superuser; đây là kiểm tra DB grants/RLS, không phải kiểm thử HTTP login thực tế.
- HMAC là symmetric MAC, không phải chữ ký số bất đối xứng. Backend và DB verifier cần cùng key; backend bị chiếm quyền có thể tạo assertion cho actor khác.
- Hàm so sánh chữ ký chạy vòng lặp cố định 32 byte, không dừng ở byte khác đầu tiên; tuy vậy PL/pgSQL chưa được chứng nhận là primitive constant-time chính thức. Production security review cần xem xét điểm này.
- Transaction XID binding ngăn replay sang transaction khác; không thay thế TLS, BFF session security, CSRF defense, OIDC nonce/state/PKCE hoặc bảo vệ khỏi backend compromise.
- `current_actor_id()` được sửa tạm trong database test và phải được cleanup về fail-closed NULL trước khi kết thúc. Runner tự thực hiện việc này.

Không đưa POC SQL vào migration production. Chỉ sau khi POC PASS, security review và quyết định secret management mới thiết kế migration 0004 riêng.

## 7. Files

- `M08_5_4_2_ACTOR_ASSERTION_POC.sql`
- `test_m08_5_4_2_signed_actor_assertion.py`
- `run_m08_5_4_2_signed_actor_assertion_test.ps1`
- `M08_5_4_2_SIGNED_ACTOR_ASSERTION_GUIDE_VI.md`
