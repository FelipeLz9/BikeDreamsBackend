-- ==============================================
-- BikeDreams Backend - PostgreSQL Staging Configuration
-- ==============================================
-- This file contains staging-specific PostgreSQL configurations
-- optimized for testing and pre-production environments.

-- ==============================================
-- Staging Database Configuration
-- ==============================================

-- Set staging-specific settings
ALTER SYSTEM SET log_statement = 'mod';
ALTER SYSTEM SET log_min_duration_statement = 500;
ALTER SYSTEM SET log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h ';
ALTER SYSTEM SET log_checkpoints = on;
ALTER SYSTEM SET log_connections = on;
ALTER SYSTEM SET log_disconnections = on;
ALTER SYSTEM SET log_lock_waits = on;
ALTER SYSTEM SET log_temp_files = 0;

-- Staging-specific performance settings
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
ALTER SYSTEM SET pg_stat_statements.max = 5000;
ALTER SYSTEM SET pg_stat_statements.track = 'all';
ALTER SYSTEM SET max_connections = 75;
ALTER SYSTEM SET shared_buffers = '192MB';
ALTER SYSTEM SET effective_cache_size = '768MB';
ALTER SYSTEM SET maintenance_work_mem = '48MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.8;
ALTER SYSTEM SET wal_buffers = '12MB';
ALTER SYSTEM SET default_statistics_target = 75;
ALTER SYSTEM SET random_page_cost = 1.1;
ALTER SYSTEM SET effective_io_concurrency = 150;

-- Staging-specific logging
ALTER SYSTEM SET log_destination = 'stderr';
ALTER SYSTEM SET logging_collector = on;
ALTER SYSTEM SET log_directory = 'log';
ALTER SYSTEM SET log_filename = 'postgresql-%Y-%m-%d_%H%M%S.log';
ALTER SYSTEM SET log_rotation_age = '1d';
ALTER SYSTEM SET log_rotation_size = '100MB';
ALTER SYSTEM SET log_truncate_on_rotation = on;

-- ==============================================
-- Staging Extensions
-- ==============================================

-- Enable useful extensions for staging
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
-- Staging Roles and Permissions
-- ==============================================

-- Create staging-specific roles
DO $$
BEGIN
    -- Staging role with limited permissions
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bikedreams_staging') THEN
        CREATE ROLE bikedreams_staging WITH LOGIN PASSWORD 'staging_password';
    END IF;
    
    -- Monitoring role for observability
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bikedreams_monitor') THEN
        CREATE ROLE bikedreams_monitor WITH LOGIN PASSWORD 'monitor_password';
    END IF;
    
    -- Read-only role for staging tools
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bikedreams_readonly') THEN
        CREATE ROLE bikedreams_readonly WITH LOGIN PASSWORD 'readonly_password';
    END IF;
    
    -- Backup role for automated backups
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bikedreams_backup') THEN
        CREATE ROLE bikedreams_backup WITH LOGIN PASSWORD 'backup_password';
    END IF;
END
$$;

-- Grant permissions to staging roles
GRANT ALL PRIVILEGES ON DATABASE bikedreams_staging TO bikedreams_staging;
GRANT CONNECT ON DATABASE bikedreams_staging TO bikedreams_monitor;
GRANT CONNECT ON DATABASE bikedreams_staging TO bikedreams_readonly;
GRANT CONNECT ON DATABASE bikedreams_staging TO bikedreams_backup;

-- Grant monitoring permissions
GRANT SELECT ON pg_stat_activity TO bikedreams_monitor;
GRANT SELECT ON pg_stat_database TO bikedreams_monitor;
GRANT SELECT ON pg_stat_user_tables TO bikedreams_monitor;
GRANT SELECT ON pg_stat_user_indexes TO bikedreams_monitor;
GRANT SELECT ON pg_stat_statements TO bikedreams_monitor;

-- Grant backup permissions
GRANT SELECT ON ALL TABLES IN SCHEMA public TO bikedreams_backup;

-- ==============================================
-- Staging Functions
-- ==============================================

-- Function to get database health metrics
CREATE OR REPLACE FUNCTION get_db_health()
RETURNS TABLE(
    metric_name text,
    metric_value text,
    status text
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        'active_connections'::text,
        count(*)::text,
        CASE 
            WHEN count(*) > 50 THEN 'WARNING'
            WHEN count(*) > 70 THEN 'CRITICAL'
            ELSE 'OK'
        END
    FROM pg_stat_activity
    WHERE state = 'active'
    
    UNION ALL
    
    SELECT 
        'idle_connections'::text,
        count(*)::text,
        CASE 
            WHEN count(*) > 20 THEN 'WARNING'
            WHEN count(*) > 40 THEN 'CRITICAL'
            ELSE 'OK'
        END
    FROM pg_stat_activity
    WHERE state = 'idle'
    
    UNION ALL
    
    SELECT 
        'database_size'::text,
        pg_size_pretty(pg_database_size(current_database())),
        CASE 
            WHEN pg_database_size(current_database()) > 1073741824 THEN 'WARNING'  -- 1GB
            WHEN pg_database_size(current_database()) > 5368709120 THEN 'CRITICAL'  -- 5GB
            ELSE 'OK'
        END;
END;
$$ LANGUAGE plpgsql;

-- Function to get performance metrics
CREATE OR REPLACE FUNCTION get_performance_metrics()
RETURNS TABLE(
    query_text text,
    calls bigint,
    total_time double precision,
    mean_time double precision,
    max_time double precision,
    min_time double precision,
    stddev_time double precision,
    rows bigint,
    hit_percent numeric
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        LEFT(query, 100) as query_text,
        calls,
        total_time,
        mean_time,
        max_time,
        min_time,
        stddev_time,
        rows,
        CASE 
            WHEN shared_blks_hit + shared_blks_read > 0 
            THEN 100.0 * shared_blks_hit / (shared_blks_hit + shared_blks_read)
            ELSE 0
        END as hit_percent
    FROM pg_stat_statements
    ORDER BY mean_time DESC
    LIMIT 20;
END;
$$ LANGUAGE plpgsql;

-- Function to get table bloat information
CREATE OR REPLACE FUNCTION get_table_bloat()
RETURNS TABLE(
    table_name text,
    total_size text,
    data_size text,
    index_size text,
    bloat_percent numeric
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        schemaname||'.'||tablename as table_name,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
        pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as data_size,
        pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) as index_size,
        CASE 
            WHEN pg_relation_size(schemaname||'.'||tablename) > 0 
            THEN 100.0 * (n_dead_tup::float / n_live_tup::float)
            ELSE 0
        END as bloat_percent
    FROM pg_stat_user_tables
    WHERE n_live_tup > 0
    ORDER BY bloat_percent DESC;
END;
$$ LANGUAGE plpgsql;

-- ==============================================
-- Staging Views
-- ==============================================

-- View for monitoring database health
CREATE OR REPLACE VIEW db_health_monitor AS
SELECT * FROM get_db_health();

-- View for monitoring performance
CREATE OR REPLACE VIEW performance_monitor AS
SELECT * FROM get_performance_metrics();

-- View for monitoring table bloat
CREATE OR REPLACE VIEW table_bloat_monitor AS
SELECT * FROM get_table_bloat();

-- View for monitoring locks
CREATE OR REPLACE VIEW lock_monitor AS
SELECT 
    l.locktype,
    l.database,
    l.relation,
    l.page,
    l.tuple,
    l.virtualxid,
    l.transactionid,
    l.classid,
    l.objid,
    l.objsubid,
    l.virtualtransaction,
    l.pid,
    l.mode,
    l.granted,
    a.usename,
    a.query,
    a.query_start,
    a.state
FROM pg_locks l
LEFT JOIN pg_stat_activity a ON l.pid = a.pid
WHERE NOT l.granted
ORDER BY l.pid;

-- View for monitoring replication (if applicable)
CREATE OR REPLACE VIEW replication_monitor AS
SELECT 
    client_addr,
    state,
    sent_lsn,
    write_lsn,
    flush_lsn,
    replay_lsn,
    write_lag,
    flush_lag,
    replay_lag,
    sync_priority,
    sync_state
FROM pg_stat_replication;

-- ==============================================
-- Staging Indexes
-- ==============================================

-- Create staging-specific indexes for better performance
-- These will be created after the main schema is available

-- ==============================================
-- Staging Triggers
-- ==============================================

-- Create staging-specific triggers for monitoring
-- These will be created after the main schema is available

-- ==============================================
-- Staging Data
-- ==============================================

-- Insert staging-specific data
-- This will be populated after the main schema is created

-- ==============================================
-- Staging Comments
-- ==============================================

COMMENT ON FUNCTION get_db_health() IS 'Returns database health metrics for monitoring';
COMMENT ON FUNCTION get_performance_metrics() IS 'Returns performance metrics for the top 20 queries';
COMMENT ON FUNCTION get_table_bloat() IS 'Returns table bloat information for maintenance planning';
COMMENT ON VIEW db_health_monitor IS 'Shows current database health status';
COMMENT ON VIEW performance_monitor IS 'Shows performance metrics for monitoring';
COMMENT ON VIEW table_bloat_monitor IS 'Shows table bloat information for maintenance';
COMMENT ON VIEW lock_monitor IS 'Shows current database locks and blocking queries';
COMMENT ON VIEW replication_monitor IS 'Shows replication status if applicable';

-- ==============================================
-- Staging Configuration Summary
-- ==============================================

-- Log the configuration
DO $$
BEGIN
    RAISE NOTICE 'PostgreSQL Staging Configuration Applied Successfully';
    RAISE NOTICE 'Max Connections: %', current_setting('max_connections');
    RAISE NOTICE 'Shared Buffers: %', current_setting('shared_buffers');
    RAISE NOTICE 'Effective Cache Size: %', current_setting('effective_cache_size');
    RAISE NOTICE 'Log Statement: %', current_setting('log_statement');
    RAISE NOTICE 'Log Min Duration Statement: %', current_setting('log_min_duration_statement');
    RAISE NOTICE 'Staging Environment Ready for Testing';
END
$$;
