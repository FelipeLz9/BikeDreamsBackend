-- CreateTable
CREATE TABLE "sync_configurations" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sync_frequency" TEXT NOT NULL DEFAULT 'daily',
    "sync_time" TEXT DEFAULT '02:00',
    "sync_events" BOOLEAN NOT NULL DEFAULT true,
    "sync_news" BOOLEAN NOT NULL DEFAULT true,
    "sync_usabmx" BOOLEAN NOT NULL DEFAULT true,
    "sync_uci" BOOLEAN NOT NULL DEFAULT true,
    "auto_sync_enabled" BOOLEAN NOT NULL DEFAULT false,
    "notifications_enabled" BOOLEAN NOT NULL DEFAULT true,
    "notification_email" TEXT,
    "max_retries" INTEGER NOT NULL DEFAULT 3,
    "timeout_minutes" INTEGER NOT NULL DEFAULT 30,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" INTEGER,

    CONSTRAINT "sync_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_logs" (
    "id" SERIAL NOT NULL,
    "sync_type" TEXT NOT NULL,
    "trigger_type" TEXT NOT NULL DEFAULT 'manual',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "duration_ms" INTEGER,
    "events_synced" INTEGER DEFAULT 0,
    "news_synced" INTEGER DEFAULT 0,
    "events_usabmx" INTEGER DEFAULT 0,
    "events_uci" INTEGER DEFAULT 0,
    "news_usabmx" INTEGER DEFAULT 0,
    "news_uci" INTEGER DEFAULT 0,
    "total_errors" INTEGER DEFAULT 0,
    "error_details" TEXT[],
    "configuration_id" INTEGER,
    "triggered_by" INTEGER,
    "scraper_health" BOOLEAN,
    "metadata" JSONB,

    CONSTRAINT "sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_schedules" (
    "id" SERIAL NOT NULL,
    "configuration_id" INTEGER NOT NULL,
    "cron_expression" TEXT NOT NULL,
    "next_run" TIMESTAMP(3),
    "last_run" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sync_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sync_configurations_name_key" ON "sync_configurations"("name");

-- CreateIndex
CREATE INDEX "sync_logs_status_idx" ON "sync_logs"("status");
CREATE INDEX "sync_logs_started_at_idx" ON "sync_logs"("started_at");
CREATE INDEX "sync_logs_sync_type_idx" ON "sync_logs"("sync_type");

-- CreateIndex
CREATE UNIQUE INDEX "sync_schedules_configuration_id_key" ON "sync_schedules"("configuration_id");

-- AddForeignKey
ALTER TABLE "sync_configurations" ADD CONSTRAINT "sync_configurations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_logs" ADD CONSTRAINT "sync_logs_configuration_id_fkey" FOREIGN KEY ("configuration_id") REFERENCES "sync_configurations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_logs" ADD CONSTRAINT "sync_logs_triggered_by_fkey" FOREIGN KEY ("triggered_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_schedules" ADD CONSTRAINT "sync_schedules_configuration_id_fkey" FOREIGN KEY ("configuration_id") REFERENCES "sync_configurations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Insert default configuration
INSERT INTO "sync_configurations" (
    "name", 
    "description", 
    "sync_frequency", 
    "sync_time",
    "auto_sync_enabled",
    "notifications_enabled"
) VALUES (
    'Default Configuration', 
    'Configuración por defecto del sistema de sincronización', 
    'daily', 
    '02:00',
    false,
    true
);
