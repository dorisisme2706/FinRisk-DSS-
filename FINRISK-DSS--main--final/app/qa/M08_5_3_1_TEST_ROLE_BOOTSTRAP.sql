-- Exact M08.2/M08.3 technical group-role bootstrap, for the isolated test cluster only.
-- Run as the isolated cluster's postgres superuser on the maintenance database.
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
