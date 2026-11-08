# M08.2 — Schema/security review checklist

This checklist is a design review. Do not apply SQL until all blocking decisions are accepted.

- [ ] Confirm database name `finrisk_app_db` and schema `finrisk_app`.
- [ ] Confirm PostgreSQL 16–18 target on local Windows.
- [ ] Confirm application-owned data only; CORE4 stays external/read-only.
- [ ] Confirm `customer_id` maps to `applicant_reference`, never `sk_id_curr`.
- [ ] Confirm applicant name is stored as application-layer ciphertext only.
- [ ] Select identity provider/authentication method before M08.3 write routes.
- [ ] Approve application roles and role assignment owner.
- [ ] Approve RLS owner scope, transaction-local actor derivation and exact LOGIN-to-group-role membership.
- [ ] Confirm runtime can call only the narrow `resolve_identity` SECURITY DEFINER function, not SELECT `app_users`.
- [ ] Review column-level UPDATE grants: no update to H18 snapshots/validation records; report update limited to archive fields; scenarios only soft-delete.
- [ ] Confirm validation records are technical/input-quality only.
- [ ] Confirm W04 records are hypothetical and never modify risk score.
- [ ] Confirm H18 snapshots are explicitly saved, policy NOT_APPROVED and no auto-decision.
- [ ] Confirm W06 reports use the 38-field allowlist and forbidden-key validation.
- [ ] Approve business-rule registry with `is_executable=false` in M08.2.
- [ ] Decide retention for applications, assessments, reports and audit events.
- [ ] Decide backup frequency, RPO/RTO, restore owner and encryption.
- [ ] Confirm secrets/key-management method; no credential in Git.
- [ ] Review SQL draft, database bootstrap order, login principals and role grants with a PostgreSQL-capable reviewer.
- [ ] Confirm AES-256-GCM envelope format and key-management/rotation design before storing applicant names.
- [ ] Only then authorize M08.3 migrations, adapter, auth and persistence APIs.

- [ ] Verify `003_grants_draft.sql` first revokes any prior broad grants and then applies only the column/table permissions documented.
- [ ] Verify `current_actor_id`, `resolve_identity` and JSON guard functions have only the required explicit EXECUTE grants after PUBLIC function privileges are revoked.