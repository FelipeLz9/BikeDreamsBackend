-- ==============================================
-- BikeDreams Backend - PostgreSQL Development Configuration
-- ==============================================
-- This file contains development-specific PostgreSQL configurations
-- and initial data for the development environment.

-- ==============================================
-- Development Database Configuration
-- ==============================================

-- Set development-specific settings
ALTER SYSTEM SET log_statement = 'all';
ALTER SYSTEM SET log_min_duration_statement = 100;
ALTER SYSTEM SET log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h ';
ALTER SYSTEM SET log_checkpoints = on;
ALTER SYSTEM SET log_connections = on;
ALTER SYSTEM SET log_disconnections = on;
ALTER SYSTEM SET log_lock_waits = on;
ALTER SYSTEM SET log_temp_files = 0;

-- Development-specific performance settings
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
ALTER SYSTEM SET pg_stat_statements.max = 1000;
ALTER SYSTEM SET pg_stat_statements.track = 'all';
ALTER SYSTEM SET max_connections = 50;
ALTER SYSTEM SET shared_buffers = '128MB';
ALTER SYSTEM SET effective_cache_size = '512MB';
ALTER SYSTEM SET maintenance_work_mem = '32MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.7;
ALTER SYSTEM SET wal_buffers = '8MB';
ALTER SYSTEM SET default_statistics_target = 50;
ALTER SYSTEM SET random_page_cost = 1.1;
ALTER SYSTEM SET effective_io_concurrency = 100;

-- Development-specific logging
ALTER SYSTEM SET log_destination = 'stderr';
ALTER SYSTEM SET logging_collector = on;
ALTER SYSTEM SET log_directory = 'log';
ALTER SYSTEM SET log_filename = 'postgresql-%Y-%m-%d_%H%M%S.log';
ALTER SYSTEM SET log_rotation_age = '1d';
ALTER SYSTEM SET log_rotation_size = '100MB';
ALTER SYSTEM SET log_truncate_on_rotation = on;

-- ==============================================
-- Development Extensions
-- ==============================================

-- Enable useful extensions for development
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "btree_gin";
CREATE EXTENSION IF NOT EXISTS "btree_gist";
CREATE EXTENSION IF NOT EXISTS "citext";
CREATE EXTENSION IF NOT EXISTS "hstore";
CREATE EXTENSION IF NOT EXISTS "ltree";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- ==============================================
-- Development Roles and Permissions
-- ==============================================

-- Create development-specific roles
DO $$
BEGIN
    -- Development role with full permissions
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bikedreams_dev') THEN
        CREATE ROLE bikedreams_dev WITH LOGIN PASSWORD 'dev_password';
    END IF;
    
    -- Test role for testing
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bikedreams_test') THEN
        CREATE ROLE bikedreams_test WITH LOGIN PASSWORD 'test_password';
    END IF;
    
    -- Read-only role for development tools
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bikedreams_readonly') THEN
        CREATE ROLE bikedreams_readonly WITH LOGIN PASSWORD 'readonly_password';
    END IF;
END
$$;

-- Grant permissions to development roles
GRANT ALL PRIVILEGES ON DATABASE bikedreams_dev TO bikedreams_dev;
GRANT ALL PRIVILEGES ON DATABASE bikedreams_dev TO bikedreams_test;
GRANT CONNECT ON DATABASE bikedreams_dev TO bikedreams_readonly;

-- ==============================================
-- Development Functions
-- ==============================================

-- Function to reset sequences (useful for development)
CREATE OR REPLACE FUNCTION reset_sequences()
RETURNS void AS $$
DECLARE
    seq_record RECORD;
BEGIN
    FOR seq_record IN 
        SELECT schemaname, sequencename 
        FROM pg_sequences 
        WHERE schemaname = 'public'
    LOOP
        EXECUTE 'ALTER SEQUENCE ' || seq_record.schemaname || '.' || seq_record.sequencename || ' RESTART WITH 1';
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to clear all tables (useful for development)
CREATE OR REPLACE FUNCTION clear_all_tables()
RETURNS void AS $$
DECLARE
    table_record RECORD;
BEGIN
    FOR table_record IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
    LOOP
        EXECUTE 'TRUNCATE TABLE ' || table_record.tablename || ' CASCADE';
    END LOOP;
    PERFORM reset_sequences();
END;
$$ LANGUAGE plpgsql;

-- Function to get table sizes (useful for development monitoring)
CREATE OR REPLACE FUNCTION get_table_sizes()
RETURNS TABLE(
    table_name text,
    row_count bigint,
    total_size text,
    data_size text,
    index_size text
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        schemaname||'.'||tablename as table_name,
        n_tup_ins - n_tup_del as row_count,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
        pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as data_size,
        pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) as index_size
    FROM pg_stat_user_tables
    ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
END;
$$ LANGUAGE plpgsql;

-- ==============================================
-- Development Views
-- ==============================================

-- View for monitoring active connections
CREATE OR REPLACE VIEW active_connections AS
SELECT 
    pid,
    usename,
    application_name,
    client_addr,
    client_port,
    backend_start,
    state,
    query
FROM pg_stat_activity
WHERE state = 'active'
ORDER BY backend_start;

-- View for monitoring slow queries
CREATE OR REPLACE VIEW slow_queries AS
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    stddev_time,
    rows,
    100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
FROM pg_stat_statements
WHERE mean_time > 1000  -- Queries taking more than 1 second
ORDER BY mean_time DESC;

-- View for monitoring table statistics
CREATE OR REPLACE VIEW table_stats AS
SELECT 
    schemaname,
    tablename,
    n_tup_ins as inserts,
    n_tup_upd as updates,
    n_tup_del as deletes,
    n_live_tup as live_tuples,
    n_dead_tup as dead_tuples,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;

-- ==============================================
-- Development Data
-- ==============================================

-- Insert development-specific data
-- This will be populated after the main schema is created

-- ==============================================
-- Development Indexes
-- ==============================================

-- Create development-specific indexes for better performance
-- These will be created after the main schema is available

-- ==============================================
-- Development Triggers
-- ==============================================

-- Create development-specific triggers
-- These will be created after the main schema is available

-- ==============================================
-- Development Comments
-- ==============================================

COMMENT ON FUNCTION reset_sequences() IS 'Resets all sequences in the public schema to start from 1';
COMMENT ON FUNCTION clear_all_tables() IS 'Truncates all tables in the public schema and resets sequences';
COMMENT ON FUNCTION get_table_sizes() IS 'Returns size information for all tables in the public schema';
COMMENT ON VIEW active_connections IS 'Shows currently active database connections';
COMMENT ON VIEW slow_queries IS 'Shows queries that take more than 1 second on average';
COMMENT ON VIEW table_stats IS 'Shows statistics for all tables in the public schema';

-- ==============================================
-- Development Configuration Summary
-- ==============================================

-- Log the configuration
DO $$
BEGIN
    RAISE NOTICE 'PostgreSQL Development Configuration Applied Successfully';
    RAISE NOTICE 'Max Connections: %', current_setting('max_connections');
    RAISE NOTICE 'Shared Buffers: %', current_setting('shared_buffers');
    RAISE NOTICE 'Effective Cache Size: %', current_setting('effective_cache_size');
    RAISE NOTICE 'Log Statement: %', current_setting('log_statement');
    RAISE NOTICE 'Log Min Duration Statement: %', current_setting('log_min_duration_statement');
END
$$;
