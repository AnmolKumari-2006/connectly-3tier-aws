-- ============================================================================
--  One-time LOCAL setup: creates the Connectly database user and database.
--  (Not needed on AWS: RDS creates both when you create the instance.)
--
--  Run it as the PostgreSQL superuser:
--    psql -U postgres -f database/create-local-db.sql
--
--  The values match backend/.env.example. If you change the password here,
--  change DB_PASSWORD in backend/.env too.
-- ============================================================================

CREATE USER connectly WITH PASSWORD 'connectly_pass';
CREATE DATABASE connectly OWNER connectly;
