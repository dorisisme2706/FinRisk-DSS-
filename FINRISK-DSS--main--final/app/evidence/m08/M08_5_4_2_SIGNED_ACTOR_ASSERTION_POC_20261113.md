# BI?N B?N NGHI?M THU M08.5.4.2 ? SIGNED ACTOR ASSERTION POC

- **Giai ?o?n:** M08.5.4.2 ? Thi?t k? & Th? nghi?m Signed Actor Assertion (POC)
- **Ng?y nghi?m thu:** 2026-11-13
- **M?i tr??ng th?c thi:** Isolated PostgreSQL 17.11 Test Cluster (`127.0.0.1:55432`, DB: `finrisk_app_db`)
- **Tr?ng th?i Production (`5432`):** `NOT USED` / `NOT CONNECTED`
- **Tr?ng th?i V?ng ??ng b?ng (`H16 / CORE4 / H18`):** `NOT MODIFIED`
- **Tr?ng th?i D?n d?p POC (`POC_OBJECTS`):** `CLEANED UP` (?? kh?i ph?c `finrisk_app.current_actor_id()` v? tr?ng th?i fail-closed `SELECT NULL::uuid`)
- **K?t qu? t?ng th?:** **PASS (11/11 Scenarios ? 17/17 Assertions, 0 Failures)**

---

## 1. Ki?n tr?c C? ch? ?? Ki?m ch?ng

1. **Transaction-Bound HMAC-SHA256 Assertion:**
   - S? d?ng `pgcrypto` ?? x?c minh ch? k? ??i x?ng HMAC-SHA256 tr?n t? h?p claims: `user_id`, `key_id`, `issued_at`, `expires_at` (t?i ?a 60 gi?y), `nonce`, v? `postgres_xid` (`pg_current_xact_id_if_assigned()`).
2. **H?m x?c minh `finrisk_app.current_actor_id()`:**
   - Ki?m tra ??y ?? ch? k? HMAC, hi?u l?c th?i gian (`issued_at` / `expires_at`), tr?ng th?i t?i kho?n (`ACTIVE`), v? s? tr?ng kh?p c?a m? giao d?ch (`xid`).
3. **C? l?p Kh?a B? m?t (`finrisk_private.actor_assertion_keys`):**
   - Runtime role (`finrisk_app` / `finrisk_api_login`) b? thu h?i to?n b? quy?n `USAGE` tr?n schema `finrisk_private` v? quy?n `SELECT` tr?n b?ng ch?a kh?a.

---

## 2. K?t qu? Chi ti?t 11 K?ch b?n B?o m?t & RLS

| STT | K?ch b?n ki?m th? (Scenario) | K?t qu? `current_actor_id()` | K?t qu? RLS / Policy | ??nh gi? |
| :-: | :--- | :--- | :--- | :-: |
| 1 | Gi? m?o bi?n `app.actor_id` (Legacy GUC spoof) | `None` | `actual_allowed = False` | **PASS** |
| 2 | T? khai b?o c?c tr??ng assertion nh?ng kh?ng c? ch? k? HMAC | `None` | `actual_allowed = False` | **PASS** |
| 3 | Thay ??i `user_id` (UUID) sau khi ?? k? HMAC | `None` | `actual_allowed = False` | **PASS** |
| 4 | Assertion h?p l? nh?ng t?i kho?n ? tr?ng th?i `DISABLED` | `None` | `actual_allowed = False` | **PASS** |
| 5 | Assertion h?p l? c?a user kh?ng c? quy?n `RULE_MANAGER` | `ef8559ea-49cf-48a8-bde4-f4c62952877b` | `actual_allowed = False` | **PASS** |
| 6 | `RULE_MANAGER` c? assertion h?p l? nh?ng gi? m?o c?t `created_by` | `443f75fc-b397-4547-a9de-c9903d82a9b6` | `actual_allowed = False` | **PASS** |
| 7 | `RULE_MANAGER` c? assertion h?p l? g?n ??ng transaction & `created_by` | `443f75fc-b397-4547-a9de-c9903d82a9b6` | `actual_allowed = True` | **PASS** |
| 8 | Ng? c?nh ??nh danh t? ??ng x?a s?ch sau khi `COMMIT` | H?p l? tr??c `COMMIT` | `cleared_after_commit = True` | **PASS** |
| 9 | Ph?t l?i (Replay) assertion h?p l? sang m?t transaction (`xid`) kh?c | `None` (`replay_denied = True`) | B? t? ch?i | **PASS** |
| 10 | S? d?ng assertion c? ch? k? ??ng nh?ng ?? h?t h?n (`expires_at`) | `None` | B? t? ch?i | **PASS** |
| 11 | Runtime role truy c?p schema `finrisk_private` ho?c ??c b?ng kh?a HMAC | N/A | `schema_usage = False`, `key_table_select = False`, `direct_read_denied = True` | **PASS** |

---

## 3. Ghi ch? K? thu?t & Gi?i h?n Ph?m vi (M08.5.4.2)

- **Ghi ch? x? l? K?ch b?n 11 (Fix v3):** Do `finrisk_app` b? ch?n quy?n `USAGE` ngay t?i ranh gi?i schema `finrisk_private`, b?i ki?m th? ph?n gi?i `OID` c?a b?ng `finrisk_private.actor_assertion_keys` tr??c khi chuy?n sang runtime role ?? ki?m tra `has_table_privilege(current_user, oid, 'SELECT')`, ??ng th?i x?c nh?n l?nh `SELECT` tr?c ti?p b? ch?n b?i `InsufficientPrivilege`.
- **Gi?i h?n hi?n t?i:** ??y l? k?t qu? POC tr?n c?m PostgreSQL c? l?p v?i kh?a sinh ng?u nhi?n trong b? nh? v? t? d?n d?p sau khi ch?y. Ch?a t?ch h?p IdP/OIDC th?c t?, ch?a tri?n khai c? ch? l?u tr?/lu?n chuy?n kh?a (Key Management/Rotation) cho m?i tr??ng production, v? ch?a m? quy?n ghi tr?n c?ng `5432`.
