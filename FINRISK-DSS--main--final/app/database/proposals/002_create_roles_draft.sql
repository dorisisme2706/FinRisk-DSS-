-- FINRISK DSS — M08.2 DB group-role creation proposal (DRAFT, NOT APPLIED)
-- Run against maintenance DB `postgres` as a DBA. No LOGIN principals or passwords.
DO $roles$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'finrisk_owner') THEN
        EXECUTE 'CREATE ROLE finrisk_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'finrisk_migrator') THEN
        EXECUTE 'CREATE ROLE finrisk_migrator NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'finrisk_app') THEN
        EXECUTE 'CREATE ROLE finrisk_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'finrisk_auditor') THEN
        EXECUTE 'CREATE ROLE finrisk_auditor NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'finrisk_readonly') THEN
        EXECUTE 'CREATE ROLE finrisk_readonly NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS';
    END IF;
END
$roles$;
GRANT finrisk_owner TO finrisk_migrator;
