-- =============================================
-- BikeDreams PostgreSQL Initialization Script
-- =============================================

-- Create extensions if they don't exist
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create additional database user if needed
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'bikedreams_readonly') THEN
        CREATE ROLE bikedreams_readonly WITH LOGIN PASSWORD 'readonly_password';
    END IF;
END
$$;

-- Grant appropriate permissions
GRANT CONNECT ON DATABASE bikedreams_prod TO bikedreams_readonly;
GRANT USAGE ON SCHEMA public TO bikedreams_readonly;

-- Create logging table for application logs if needed
CREATE TABLE IF NOT EXISTS app_logs (
    id SERIAL PRIMARY KEY,
    level VARCHAR(10) NOT NULL,
    message TEXT NOT NULL,
    meta JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_app_logs_timestamp ON app_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_app_logs_level ON app_logs(level);

-- Set timezone
SET timezone = 'UTC';
