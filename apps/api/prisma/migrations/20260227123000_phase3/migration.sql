-- CreateTable
CREATE TABLE "IngestionEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "IngestionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelemetryDeadLetter" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "error" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelemetryDeadLetter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteAnalyticsRollupHourly" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "bucketStart" TIMESTAMP(3) NOT NULL,
    "missionsTotal" INTEGER NOT NULL,
    "missionsSucceeded" INTEGER NOT NULL,
    "incidentsOpen" INTEGER NOT NULL,
    "interventionsCount" INTEGER NOT NULL,
    "fleetSize" INTEGER NOT NULL,
    "uptimePercent" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteAnalyticsRollupHourly_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantAnalyticsRollupHourly" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "bucketStart" TIMESTAMP(3) NOT NULL,
    "missionsTotal" INTEGER NOT NULL,
    "missionsSucceeded" INTEGER NOT NULL,
    "incidentsOpen" INTEGER NOT NULL,
    "interventionsCount" INTEGER NOT NULL,
    "fleetSize" INTEGER NOT NULL,
    "uptimePercent" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantAnalyticsRollupHourly_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertPolicy" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertPolicyStep" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "delaySeconds" INTEGER NOT NULL,
    "channel" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "severityMin" TEXT,
    "template" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertPolicyStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertRule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "severity" TEXT,
    "category" TEXT,
    "siteId" TEXT,
    "conditions" JSONB NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ruleId" TEXT,
    "policyId" TEXT,
    "incidentId" TEXT,
    "state" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "triggeredAt" TIMESTAMP(3) NOT NULL,
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertDelivery" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "alertEventId" TEXT NOT NULL,
    "policyStepId" TEXT,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "state" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "message" TEXT NOT NULL,
    "error" TEXT,
    "details" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleScopeOverride" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "allowScopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "denyScopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoleScopeOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IngestionEvent_tenantId_dedupeKey_key" ON "IngestionEvent"("tenantId", "dedupeKey");

-- CreateIndex
CREATE INDEX "IngestionEvent_tenantId_status_createdAt_idx" ON "IngestionEvent"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "TelemetryDeadLetter_tenantId_createdAt_idx" ON "TelemetryDeadLetter"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SiteAnalyticsRollupHourly_tenantId_siteId_bucketStart_key" ON "SiteAnalyticsRollupHourly"("tenantId", "siteId", "bucketStart");

-- CreateIndex
CREATE INDEX "SiteAnalyticsRollupHourly_tenantId_bucketStart_idx" ON "SiteAnalyticsRollupHourly"("tenantId", "bucketStart");

-- CreateIndex
CREATE INDEX "SiteAnalyticsRollupHourly_tenantId_siteId_bucketStart_idx" ON "SiteAnalyticsRollupHourly"("tenantId", "siteId", "bucketStart");

-- CreateIndex
CREATE UNIQUE INDEX "TenantAnalyticsRollupHourly_tenantId_bucketStart_key" ON "TenantAnalyticsRollupHourly"("tenantId", "bucketStart");

-- CreateIndex
CREATE INDEX "TenantAnalyticsRollupHourly_tenantId_bucketStart_idx" ON "TenantAnalyticsRollupHourly"("tenantId", "bucketStart");

-- CreateIndex
CREATE INDEX "AlertPolicy_tenantId_isActive_idx" ON "AlertPolicy"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "AlertPolicyStep_policyId_orderIndex_key" ON "AlertPolicyStep"("policyId", "orderIndex");

-- CreateIndex
CREATE INDEX "AlertPolicyStep_tenantId_policyId_idx" ON "AlertPolicyStep"("tenantId", "policyId");

-- CreateIndex
CREATE INDEX "AlertRule_tenantId_isActive_priority_idx" ON "AlertRule"("tenantId", "isActive", "priority");

-- CreateIndex
CREATE INDEX "AlertRule_tenantId_eventType_idx" ON "AlertRule"("tenantId", "eventType");

-- CreateIndex
CREATE INDEX "AlertEvent_tenantId_state_triggeredAt_idx" ON "AlertEvent"("tenantId", "state", "triggeredAt");

-- CreateIndex
CREATE INDEX "AlertEvent_tenantId_incidentId_idx" ON "AlertEvent"("tenantId", "incidentId");

-- CreateIndex
CREATE INDEX "AlertDelivery_tenantId_state_scheduledFor_idx" ON "AlertDelivery"("tenantId", "state", "scheduledFor");

-- CreateIndex
CREATE INDEX "AlertDelivery_tenantId_alertEventId_idx" ON "AlertDelivery"("tenantId", "alertEventId");

-- CreateIndex
CREATE UNIQUE INDEX "RoleScopeOverride_tenantId_role_key" ON "RoleScopeOverride"("tenantId", "role");

-- CreateIndex
CREATE INDEX "RoleScopeOverride_tenantId_role_idx" ON "RoleScopeOverride"("tenantId", "role");

-- CreateIndex
CREATE INDEX "TelemetryPoint_tenantId_metric_timestamp_idx" ON "TelemetryPoint"("tenantId", "metric", "timestamp");

-- CreateIndex
CREATE INDEX "TelemetryPoint_tenantId_metric_timestamp_desc_idx" ON "TelemetryPoint"("tenantId", "metric", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "TelemetryPoint_tenantId_robotId_metric_timestamp_desc_idx" ON "TelemetryPoint"("tenantId", "robotId", "metric", "timestamp" DESC);

-- AddForeignKey
ALTER TABLE "IngestionEvent" ADD CONSTRAINT "IngestionEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelemetryDeadLetter" ADD CONSTRAINT "TelemetryDeadLetter_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteAnalyticsRollupHourly" ADD CONSTRAINT "SiteAnalyticsRollupHourly_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteAnalyticsRollupHourly" ADD CONSTRAINT "SiteAnalyticsRollupHourly_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantAnalyticsRollupHourly" ADD CONSTRAINT "TenantAnalyticsRollupHourly_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertPolicy" ADD CONSTRAINT "AlertPolicy_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertPolicyStep" ADD CONSTRAINT "AlertPolicyStep_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertPolicyStep" ADD CONSTRAINT "AlertPolicyStep_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "AlertPolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertRule" ADD CONSTRAINT "AlertRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertRule" ADD CONSTRAINT "AlertRule_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "AlertPolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertEvent" ADD CONSTRAINT "AlertEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertEvent" ADD CONSTRAINT "AlertEvent_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "AlertRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertEvent" ADD CONSTRAINT "AlertEvent_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "AlertPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertDelivery" ADD CONSTRAINT "AlertDelivery_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertDelivery" ADD CONSTRAINT "AlertDelivery_alertEventId_fkey" FOREIGN KEY ("alertEventId") REFERENCES "AlertEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertDelivery" ADD CONSTRAINT "AlertDelivery_policyStepId_fkey" FOREIGN KEY ("policyStepId") REFERENCES "AlertPolicyStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleScopeOverride" ADD CONSTRAINT "RoleScopeOverride_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Timescale extension and hypertable conversion (safe no-op when extension is unavailable)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'timescaledb') THEN
    CREATE EXTENSION IF NOT EXISTS timescaledb;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'timescaledb extension setup skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'create_hypertable') THEN
    PERFORM create_hypertable('"TelemetryPoint"', 'timestamp', if_not_exists => TRUE, migrate_data => TRUE);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'hypertable conversion skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'time_bucket') THEN
    EXECUTE '
      CREATE MATERIALIZED VIEW IF NOT EXISTS telemetry_rollup_5m
      WITH (timescaledb.continuous) AS
      SELECT
        "tenantId",
        "robotId",
        metric,
        time_bucket(INTERVAL ''5 minutes'', "timestamp") AS bucket_start,
        avg(value) AS avg_value,
        min(value) AS min_value,
        max(value) AS max_value,
        count(*)::BIGINT AS sample_count
      FROM "TelemetryPoint"
      GROUP BY "tenantId", "robotId", metric, bucket_start
      WITH NO DATA';

    EXECUTE '
      CREATE MATERIALIZED VIEW IF NOT EXISTS telemetry_rollup_1h
      WITH (timescaledb.continuous) AS
      SELECT
        "tenantId",
        "robotId",
        metric,
        time_bucket(INTERVAL ''1 hour'', "timestamp") AS bucket_start,
        avg(value) AS avg_value,
        min(value) AS min_value,
        max(value) AS max_value,
        count(*)::BIGINT AS sample_count
      FROM "TelemetryPoint"
      GROUP BY "tenantId", "robotId", metric, bucket_start
      WITH NO DATA';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'continuous aggregate setup skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'add_continuous_aggregate_policy') THEN
    BEGIN
      PERFORM add_continuous_aggregate_policy('telemetry_rollup_5m',
        start_offset => INTERVAL '30 days',
        end_offset => INTERVAL '5 minutes',
        schedule_interval => INTERVAL '5 minutes');
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '5m aggregate policy skipped: %', SQLERRM;
    END;

    BEGIN
      PERFORM add_continuous_aggregate_policy('telemetry_rollup_1h',
        start_offset => INTERVAL '730 days',
        end_offset => INTERVAL '1 hour',
        schedule_interval => INTERVAL '1 hour');
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '1h aggregate policy skipped: %', SQLERRM;
    END;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'aggregate policy setup skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'add_retention_policy') THEN
    BEGIN
      PERFORM add_retention_policy('"TelemetryPoint"', INTERVAL '30 days', if_not_exists => TRUE);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'raw retention policy skipped: %', SQLERRM;
    END;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'retention policy setup skipped: %', SQLERRM;
END $$;
