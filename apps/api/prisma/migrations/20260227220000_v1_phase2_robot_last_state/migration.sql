-- CreateTable
CREATE TABLE "SiteSetting" (
    "tenantId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "robotOfflineAfterSeconds" INTEGER NOT NULL DEFAULT 15,
    "robotStatePublishPeriodSeconds" INTEGER NOT NULL DEFAULT 2,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteSetting_pkey" PRIMARY KEY ("tenantId","siteId")
);

-- CreateTable
CREATE TABLE "RobotLastState" (
    "tenantId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "robotId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "serial" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL,
    "batteryPercent" INTEGER NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "floorplanId" TEXT NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "headingDegrees" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "healthScore" INTEGER NOT NULL,
    "cpuPercent" INTEGER NOT NULL,
    "memoryPercent" INTEGER NOT NULL,
    "tempC" INTEGER NOT NULL,
    "diskPercent" INTEGER NOT NULL,
    "networkRssi" INTEGER NOT NULL,
    "currentTaskId" TEXT,
    "currentTaskState" TEXT,
    "currentTaskPercentComplete" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RobotLastState_pkey" PRIMARY KEY ("tenantId","siteId","robotId")
);

-- CreateIndex
CREATE INDEX "RobotLastState_tenantId_siteId_status_idx" ON "RobotLastState"("tenantId", "siteId", "status");

-- CreateIndex
CREATE INDEX "RobotLastState_tenantId_siteId_vendor_idx" ON "RobotLastState"("tenantId", "siteId", "vendor");

-- CreateIndex
CREATE INDEX "RobotLastState_tenantId_siteId_floorplanId_idx" ON "RobotLastState"("tenantId", "siteId", "floorplanId");

-- CreateIndex
CREATE INDEX "RobotLastState_tenantId_siteId_updatedAt_idx" ON "RobotLastState"("tenantId", "siteId", "updatedAt");

-- AddForeignKey
ALTER TABLE "SiteSetting" ADD CONSTRAINT "SiteSetting_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteSetting" ADD CONSTRAINT "SiteSetting_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RobotLastState" ADD CONSTRAINT "RobotLastState_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RobotLastState" ADD CONSTRAINT "RobotLastState_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RobotLastState" ADD CONSTRAINT "RobotLastState_robotId_fkey" FOREIGN KEY ("robotId") REFERENCES "Robot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill default site settings for all existing sites
INSERT INTO "SiteSetting" (
  "tenantId",
  "siteId",
  "robotOfflineAfterSeconds",
  "robotStatePublishPeriodSeconds",
  "createdAt",
  "updatedAt"
)
SELECT
  s."tenantId",
  s."id",
  15,
  2,
  NOW(),
  NOW()
FROM "Site" s
ON CONFLICT ("tenantId", "siteId") DO NOTHING;

-- Backfill read model from existing robot table
INSERT INTO "RobotLastState" (
  "tenantId",
  "siteId",
  "robotId",
  "name",
  "vendor",
  "model",
  "serial",
  "tags",
  "status",
  "batteryPercent",
  "lastSeenAt",
  "floorplanId",
  "x",
  "y",
  "headingDegrees",
  "confidence",
  "healthScore",
  "cpuPercent",
  "memoryPercent",
  "tempC",
  "diskPercent",
  "networkRssi",
  "currentTaskId",
  "currentTaskState",
  "currentTaskPercentComplete",
  "updatedAt"
)
SELECT
  r."tenantId",
  r."siteId",
  r."id",
  r."name",
  r."vendorId",
  r."model",
  r."serial",
  r."tags",
  r."status",
  r."batteryPercent",
  r."lastSeenAt",
  r."floorplanId",
  r."x",
  r."y",
  r."headingDegrees",
  r."confidence",
  GREATEST(0, LEAST(100, 100 - ROUND(((r."cpuPercent" + r."memoryPercent" + r."diskPercent")::numeric / 3.0))::int)),
  r."cpuPercent",
  r."memoryPercent",
  r."tempC",
  r."diskPercent",
  r."networkRssi",
  NULL,
  NULL,
  NULL,
  NOW()
FROM "Robot" r
ON CONFLICT ("tenantId", "siteId", "robotId") DO UPDATE SET
  "name" = EXCLUDED."name",
  "vendor" = EXCLUDED."vendor",
  "model" = EXCLUDED."model",
  "serial" = EXCLUDED."serial",
  "tags" = EXCLUDED."tags",
  "status" = EXCLUDED."status",
  "batteryPercent" = EXCLUDED."batteryPercent",
  "lastSeenAt" = EXCLUDED."lastSeenAt",
  "floorplanId" = EXCLUDED."floorplanId",
  "x" = EXCLUDED."x",
  "y" = EXCLUDED."y",
  "headingDegrees" = EXCLUDED."headingDegrees",
  "confidence" = EXCLUDED."confidence",
  "healthScore" = EXCLUDED."healthScore",
  "cpuPercent" = EXCLUDED."cpuPercent",
  "memoryPercent" = EXCLUDED."memoryPercent",
  "tempC" = EXCLUDED."tempC",
  "diskPercent" = EXCLUDED."diskPercent",
  "networkRssi" = EXCLUDED."networkRssi",
  "updatedAt" = NOW();
