-- CreateTable
CREATE TABLE "Integration" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationTestRun" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "details" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "IntegrationTestRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedView" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "page" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "layout" JSONB NOT NULL,
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SavedView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleDashboardDefault" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "page" TEXT NOT NULL,
    "savedViewId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RoleDashboardDefault_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DashboardConfig" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "schemaVersion" TEXT NOT NULL,
    "widgets" JSONB NOT NULL,
    "rules" JSONB NOT NULL,
    "appliesTo" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DashboardConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RobotPathPoint" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "robotId" TEXT NOT NULL,
    "floorplanId" TEXT NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "headingDegrees" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RobotPathPoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Integration_tenantId_name_idx" ON "Integration"("tenantId", "name");

-- CreateIndex
CREATE INDEX "IntegrationTestRun_tenantId_createdAt_idx" ON "IntegrationTestRun"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "SavedView_tenantId_page_idx" ON "SavedView"("tenantId", "page");

-- CreateIndex
CREATE INDEX "SavedView_tenantId_createdBy_idx" ON "SavedView"("tenantId", "createdBy");

-- CreateIndex
CREATE UNIQUE INDEX "RoleDashboardDefault_tenantId_role_page_key" ON "RoleDashboardDefault"("tenantId", "role", "page");

-- CreateIndex
CREATE INDEX "DashboardConfig_tenantId_isActive_idx" ON "DashboardConfig"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "RobotPathPoint_tenantId_robotId_timestamp_idx" ON "RobotPathPoint"("tenantId", "robotId", "timestamp");

-- CreateIndex
CREATE INDEX "RobotPathPoint_tenantId_floorplanId_timestamp_idx" ON "RobotPathPoint"("tenantId", "floorplanId", "timestamp");

-- CreateIndex
CREATE INDEX "TelemetryPoint_tenantId_robotId_metric_timestamp_idx" ON "TelemetryPoint"("tenantId", "robotId", "metric", "timestamp");

-- AddForeignKey
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationTestRun" ADD CONSTRAINT "IntegrationTestRun_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationTestRun" ADD CONSTRAINT "IntegrationTestRun_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedView" ADD CONSTRAINT "SavedView_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleDashboardDefault" ADD CONSTRAINT "RoleDashboardDefault_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleDashboardDefault" ADD CONSTRAINT "RoleDashboardDefault_savedViewId_fkey" FOREIGN KEY ("savedViewId") REFERENCES "SavedView"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DashboardConfig" ADD CONSTRAINT "DashboardConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RobotPathPoint" ADD CONSTRAINT "RobotPathPoint_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RobotPathPoint" ADD CONSTRAINT "RobotPathPoint_robotId_fkey" FOREIGN KEY ("robotId") REFERENCES "Robot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
