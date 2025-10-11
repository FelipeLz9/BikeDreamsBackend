-- Performance optimization indexes for events table

-- Index for date-based queries (most common)
CREATE INDEX IF NOT EXISTS "events_date_idx" ON "Event"("date");
CREATE INDEX IF NOT EXISTS "events_start_date_idx" ON "Event"("start_date");
CREATE INDEX IF NOT EXISTS "events_end_date_idx" ON "Event"("end_date");

-- Index for source filtering
CREATE INDEX IF NOT EXISTS "events_source_idx" ON "Event"("source");

-- Index for geographical queries
CREATE INDEX IF NOT EXISTS "events_country_idx" ON "Event"("country");
CREATE INDEX IF NOT EXISTS "events_continent_idx" ON "Event"("continent");
CREATE INDEX IF NOT EXISTS "events_coordinates_idx" ON "Event"("latitude", "longitude");

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS "events_source_date_idx" ON "Event"("source", "start_date", "date");
CREATE INDEX IF NOT EXISTS "events_upcoming_idx" ON "Event"("start_date", "date") WHERE "start_date" >= NOW() OR ("start_date" IS NULL AND "date" >= NOW());

-- Text search indexes (using GIN for better performance on text searches)
CREATE INDEX IF NOT EXISTS "events_title_gin_idx" ON "Event" USING gin(to_tsvector('english', COALESCE("title", '')));
CREATE INDEX IF NOT EXISTS "events_location_gin_idx" ON "Event" USING gin(to_tsvector('english', COALESCE("location", '')));
CREATE INDEX IF NOT EXISTS "events_city_gin_idx" ON "Event" USING gin(to_tsvector('english', COALESCE("city", '')));

-- Index for recent events (created_at based)
CREATE INDEX IF NOT EXISTS "events_created_at_idx" ON "Event"("createdAt");

-- Index for external_id for faster lookups
CREATE INDEX IF NOT EXISTS "events_external_id_idx" ON "Event"("external_id");

-- Similar indexes for news table
CREATE INDEX IF NOT EXISTS "news_published_at_idx" ON "News"("published_at");
CREATE INDEX IF NOT EXISTS "news_date_idx" ON "News"("date");
CREATE INDEX IF NOT EXISTS "news_source_idx" ON "News"("source");
CREATE INDEX IF NOT EXISTS "news_category_idx" ON "News"("category");
CREATE INDEX IF NOT EXISTS "news_created_at_idx" ON "News"("createdAt");

-- Text search indexes for news
CREATE INDEX IF NOT EXISTS "news_title_gin_idx" ON "News" USING gin(to_tsvector('english', COALESCE("title", '')));
CREATE INDEX IF NOT EXISTS "news_content_gin_idx" ON "News" USING gin(to_tsvector('english', COALESCE("content", '')));

-- Composite index for news queries
CREATE INDEX IF NOT EXISTS "news_source_date_idx" ON "News"("source", "published_at", "date");

-- Index for sync logs performance
CREATE INDEX IF NOT EXISTS "sync_logs_started_at_idx" ON "sync_logs"("started_at");
CREATE INDEX IF NOT EXISTS "sync_logs_status_started_at_idx" ON "sync_logs"("status", "started_at");

-- Index for user queries
CREATE INDEX IF NOT EXISTS "users_role_idx" ON "User"("role");
CREATE INDEX IF NOT EXISTS "users_created_at_idx" ON "User"("createdAt");
