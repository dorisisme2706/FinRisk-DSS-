# FinRisk DSS — M08.2 Data Contract & PostgreSQL Logical Design

**Ngày:** 08/11/2026  
**Baseline:** M08.1 Core Freeze & MOCK/REAL Audit (`FinRisk_DSS_M08_Core_Freeze_M08_1_Audit_20261107.zip`)  
**Trạng thái:** Design proposal completed; **user/team review and sign-off required**. No PostgreSQL service/database was created, and no SQL was applied.

## 1. PostgreSQL có được tạo tự động không?

Không. Trong source đã có thiết kế database, ERD, Data Dictionary, SQL schema proposal, role/grant proposal và file cấu hình mẫu. Tuy nhiên, PostgreSQL Server là một dịch vụ riêng cần được cài trên Windows hoặc một máy chủ của nhóm. Assistant không tự cài service trên PC của người dùng, không tự chọn mật khẩu và không có credential để tạo database trên server của người dùng.

M08.2 chỉ hoàn tất thiết kế và review tĩnh. M08.3 mới là bước cài adapter, áp dụng migration đã được duyệt, cấu hình xác thực/phân quyền và bật API persistence.

## 2. Phạm vi thiết kế

- Database đề xuất: `finrisk_app_db`; schema: `finrisk_app`; mục tiêu PostgreSQL 16–18.
- 12 entity ứng dụng: `app_users`, `app_roles`, `app_user_roles`, `loan_applications`, `financial_validation_runs`, `financial_validation_findings`, `loan_simulation_scenarios`, `assessment_runs`, `report_records`, `audit_events`, `business_rule_registry`, `schema_migrations`.
- PostgreSQL chỉ lưu dữ liệu do ứng dụng tạo/quản lý. CORE4 Parquet vẫn là nguồn inference canonical, read-only; không sao chép 169 predictors, `TARGET`, split manifest hoặc pipeline vào DB.
- Form #09 `customer_id` ánh xạ sang `applicant_reference`, tuyệt đối không ánh xạ sang `sk_id_curr`. Không suy diễn 169 feature từ 9 trường form.
- Tên người nộp chỉ được lưu dưới dạng application-layer ciphertext. Proposal `AES_GCM_V1` quy định envelope AES-256-GCM gồm 12-byte nonce + ciphertext + 16-byte authentication tag; key material và key rotation vẫn cần owner duyệt và phải nằm ngoài DB/source.
- Financial validation chỉ là `INPUT_QUALITY`; không phải credit policy.
- W04 scenario luôn `HYPOTHETICAL`/`scenario_only=true`; không sửa risk score và không đại diện báo giá.
- H18 assessment chỉ lưu explicit snapshot đã qua W02 guard, policy luôn `NOT_APPROVED`, `automatic_credit_decision=false`; không có cột approve/reject hoặc điều khoản khoản vay.
- W06 report chỉ lưu khi người dùng explicit-save; payload phải qua allowlist 38 trường và forbidden-key validation.
- Business rule registry chỉ có `DRAFT`, `NOT_APPROVED`, `RETIRED`; `is_executable=false`, `approved_at=NULL`.

## 3. Access, identity and least privilege

- Application roles (VIEWER, LOAN_OFFICER, REVIEWER, AUDITOR, ADMIN, QA) tách biệt với PostgreSQL technical roles.
- Technical group roles đều `NOLOGIN`: `finrisk_owner`, `finrisk_migrator`, `finrisk_app`, `finrisk_auditor`, `finrisk_readonly`. Ví dụ login riêng: `finrisk_migrator_login`, `finrisk_api_login`, `finrisk_auditor_login`.
- Runtime không được SELECT trực tiếp `app_users`; chỉ gọi `resolve_identity()` SECURITY DEFINER để lấy `user_id` và `account_status` từ verified identity.
- RLS owner scope áp dụng trên 8 bảng; actor/owner phải lấy từ verified principal, không nhận `owner_user_id` từ request body.
- Runtime grants áp dụng theo least privilege: loan application chỉ update danh sách cột cho phép; validation và H18 assessment là immutable INSERT/SELECT; scenario chỉ soft-delete; report chỉ archive; audit append-only, không UPDATE/DELETE/TRUNCATE.
- JSON forbidden-key guard recursive và không phân biệt chữ hoa/thường.
- Credential/key không đưa vào SQL/ Git. `.env.example` chỉ có placeholder.

## 4. SQL files and order (all are DRAFT proposals)

1. `database/proposals/002_create_roles_draft.sql` — run by DBA in maintenance DB `postgres`; creates NOLOGIN group roles only.
2. DBA creates `finrisk_app_db` with owner `finrisk_owner`, UTF8, then provisions separate LOGIN principals interactively.
3. `database/proposals/001_app_schema_draft.sql` — target DB schema DDL; uses `SET LOCAL ROLE finrisk_owner`.
4. `database/proposals/003_grants_draft.sql` — target DB grants; resets previous broad app grants, revokes PUBLIC database CONNECT, and applies restricted grants under `finrisk_owner`.

Do **not** run these scripts until the schema/security checklist is reviewed and approved. M08.3 will convert the approved design into ordered, versioned migrations with checksum enforcement and test them against an actual PostgreSQL instance.

## 5. Driver decision

Future application adapter candidate: `psycopg[binary]==3.3.6`, pinned in `database/requirements-postgres.txt`, separate from `backend_ml/model/requirements-lock.txt`. It is not installed into or added to H16 runtime lock. Psycopg's official install documentation lists compatibility with Windows and Python 3.10–3.15 / PostgreSQL 10–18. Sources: https://www.psycopg.org/install/ and https://www.psycopg.org/psycopg3/docs/basic/install.html .

## 6. Verification evidence

- M08.2 static database-design audit: **19/19 PASS**.
- M08.2 focused Node tests: **16/16 PASS**.
- Full Node regression: **124/124 PASS**.
- M08.0 freeze verifier: **8/8 PASS**, protected files **39/39 MATCH**.
- M08.1 source audit: **13/13 PASS**; confirms 3 draft SQL proposals are separate from **0 active migrations**.
- H16 pipeline hash, ordered 169-feature contract, threshold/calibration metadata and H18 guardrails remain unchanged.
- ZIP integrity checked after packaging.

**Not tested:** no `psql`, PostgreSQL server, Docker or Podman is available in the build environment. SQL syntax has not been parsed/applied against a live PostgreSQL engine. API persistence, authentication, RLS runtime, backup and restore are M08.3 tests, not M08.2 acceptance claims.

## 7. Deliverables

- `database/proposals/001_app_schema_draft.sql` — 12-table DDL proposal.
- `database/proposals/002_create_roles_draft.sql` — technical group-role proposal.
- `database/proposals/003_grants_draft.sql` — least-privilege grant proposal.
- `database/M08_2_POSTGRES_SETUP_DRAFT.md` — Windows/psql setup order.
- `database/requirements-postgres.txt` — isolated adapter pin for M08.3.
- `database/.env.example` — placeholders only.
- `qa/M08_2_DATA_CONTRACT_20261108.md`, `M08_2_ERD_20261108.md`, `M08_2_DATA_DICTIONARY_20261108.md`.
- `qa/M08_2_ACCESS_RETENTION_BACKUP_20261108.md`, `M08_2_API_CONTRACT_DRAFT_20261108.yaml`, `M08_2_SCHEMA_REVIEW_CHECKLIST_20261108.md`.
- `qa/M08_2_DESIGN_MANIFEST_20261108.json`, `qa/m08_database_design_audit.py`.
- `tests/finrisk-m08-database-design.test.js`, `run_m08_2_design_audit.bat`.
- `evidence/m08/M08_2_*_20261108.*` — static audit, freeze, source and Node test evidence.

## 8. Added / modified / deleted from M08.1

**Added — 23 files**

1. `app/FINRISK_M08_2_HANDOFF_20261108.md`
2. `app/database/.env.example`
3. `app/database/M08_2_POSTGRES_SETUP_DRAFT.md`
4. `app/database/proposals/001_app_schema_draft.sql`
5. `app/database/proposals/002_create_roles_draft.sql`
6. `app/database/proposals/003_grants_draft.sql`
7. `app/database/requirements-postgres.txt`
8. `app/evidence/m08/M08_2_DESIGN_AUDIT_20261108.json`
9. `app/evidence/m08/M08_2_DESIGN_AUDIT_20261108.txt`
10. `app/evidence/m08/M08_2_FREEZE_VERIFICATION_20261108.txt`
11. `app/evidence/m08/M08_2_NODE_FOCUSED_20261108.txt`
12. `app/evidence/m08/M08_2_NODE_FULL_REGRESSION_20261108.txt`
13. `app/evidence/m08/M08_2_SOURCE_AUDIT_20261108.txt`
14. `app/qa/M08_2_ACCESS_RETENTION_BACKUP_20261108.md`
15. `app/qa/M08_2_API_CONTRACT_DRAFT_20261108.yaml`
16. `app/qa/M08_2_DATA_CONTRACT_20261108.md`
17. `app/qa/M08_2_DATA_DICTIONARY_20261108.md`
18. `app/qa/M08_2_DESIGN_MANIFEST_20261108.json`
19. `app/qa/M08_2_ERD_20261108.md`
20. `app/qa/M08_2_SCHEMA_REVIEW_CHECKLIST_20261108.md`
21. `app/qa/m08_database_design_audit.py`
22. `app/run_m08_2_design_audit.bat`
23. `app/tests/finrisk-m08-database-design.test.js`

**Modified — 6 files**
- `M08_START_HERE_VI.md` — M08.2 entry point and audit runner.
- `app/.gitignore` — exclude local `.env`/secrets and environment backups.
- `app/CHANGELOG.md` — record M08.2 design and security hardening.
- `app/evidence/m08/M08_MOCK_REAL_AUDIT_20261107.json` — distinguish draft SQL proposals from active migrations.
- `app/qa/m08_mock_real_audit.py` — audit only `database/migrations/` as active migration files; count proposals separately.
- `app/tests/finrisk-m08-audit.test.js` — regression for proposal/migration separation.

**Deleted — 0 files.** No runtime UI/API files, model artifacts, CORE4 data or protected H16/H18 files are modified. Draft SQL resides under `database/proposals/`, not `database/migrations/`.

## 9. GitHub Desktop

**Summary**
```text
Thiết kế Data Contract và PostgreSQL cho M08.2
```

**Description**
```text
- Bổ sung logical ERD, data contract và data dictionary PostgreSQL.
- Đề xuất 12 bảng dữ liệu ứng dụng trong schema finrisk_app.
- Bổ sung SQL schema, role bootstrap và grants proposal (chưa apply).
- Thiết kế RLS owner scope, verified identity resolver và audit append-only.
- Giới hạn quyền runtime theo bảng/cột; H18/validation snapshots immutable.
- Tách validation INPUT_QUALITY khỏi credit policy; W04 luôn HYPOTHETICAL.
- Giữ H18 NOT_APPROVED và automatic_credit_decision=false.
- Giữ CORE4/H16 ngoài application database, read-only.
- Tách Psycopg 3.3.6 khỏi H16 requirements lock.
- Static design audit 19/19; M08.2 tests 16/16; full Node 124/124.
- Freeze 39/39 MATCH; M08.1 source audit 13/13.
- PostgreSQL live server chưa được tạo; SQL chưa apply.
```

**Git add — chạy từ repository root:**
```bash
git add M08_START_HERE_VI.md app/.gitignore app/CHANGELOG.md app/FINRISK_M08_2_HANDOFF_20261108.md app/database/.env.example app/database/M08_2_POSTGRES_SETUP_DRAFT.md app/database/proposals/001_app_schema_draft.sql app/database/proposals/002_create_roles_draft.sql app/database/proposals/003_grants_draft.sql app/database/requirements-postgres.txt app/evidence/m08/M08_2_DESIGN_AUDIT_20261108.json app/evidence/m08/M08_2_DESIGN_AUDIT_20261108.txt app/evidence/m08/M08_2_FREEZE_VERIFICATION_20261108.txt app/evidence/m08/M08_2_NODE_FOCUSED_20261108.txt app/evidence/m08/M08_2_NODE_FULL_REGRESSION_20261108.txt app/evidence/m08/M08_2_SOURCE_AUDIT_20261108.txt app/evidence/m08/M08_MOCK_REAL_AUDIT_20261107.json app/qa/M08_2_ACCESS_RETENTION_BACKUP_20261108.md app/qa/M08_2_API_CONTRACT_DRAFT_20261108.yaml app/qa/M08_2_DATA_CONTRACT_20261108.md app/qa/M08_2_DATA_DICTIONARY_20261108.md app/qa/M08_2_DESIGN_MANIFEST_20261108.json app/qa/M08_2_ERD_20261108.md app/qa/M08_2_SCHEMA_REVIEW_CHECKLIST_20261108.md app/qa/m08_database_design_audit.py app/qa/m08_mock_real_audit.py app/run_m08_2_design_audit.bat app/tests/finrisk-m08-audit.test.js app/tests/finrisk-m08-database-design.test.js
```

## 10. Next stage

After user/team review and sign-off, M08.3 applies the approved schema through versioned migrations, installs the separate Psycopg adapter, implements verified authentication/authorization, connection health, repository and persistence APIs, RLS ownership tests, idempotency, and backup/restore validation. Do not switch UI from localStorage to PostgreSQL before those tests pass.
