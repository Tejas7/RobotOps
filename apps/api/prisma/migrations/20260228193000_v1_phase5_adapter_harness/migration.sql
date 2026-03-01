-- CreateTable
CREATE TABLE "AdapterHealthState" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "adapterName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "lastSuccessAt" TIMESTAMP(3),
    "lastErrorAt" TIMESTAMP(3),
    "lastError" TEXT,
    "lastRunId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdapterHealthState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdapterReplayRun" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "captureId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "acceptedCount" INTEGER NOT NULL DEFAULT 0,
    "duplicateCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "options" JSONB NOT NULL,
    "errorSummary" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdapterReplayRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdapterReplayRunEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "messageId" TEXT,
    "messageType" "MessageType",
    "result" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdapterReplayRunEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdapterHealthState_tenantId_siteId_vendor_adapterName_key" ON "AdapterHealthState"("tenantId", "siteId", "vendor", "adapterName");

-- CreateIndex
CREATE INDEX "AdapterHealthState_tenantId_updatedAt_idx" ON "AdapterHealthState"("tenantId", "updatedAt");

-- CreateIndex
CREATE INDEX "AdapterReplayRun_tenantId_startedAt_idx" ON "AdapterReplayRun"("tenantId", "startedAt");

-- CreateIndex
CREATE INDEX "AdapterReplayRunEvent_runId_messageId_idx" ON "AdapterReplayRunEvent"("runId", "messageId");

-- CreateIndex
CREATE INDEX "AdapterReplayRunEvent_tenantId_createdAt_idx" ON "AdapterReplayRunEvent"("tenantId", "createdAt");

-- AddForeignKey
ALTER TABLE "AdapterHealthState" ADD CONSTRAINT "AdapterHealthState_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdapterHealthState" ADD CONSTRAINT "AdapterHealthState_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdapterReplayRun" ADD CONSTRAINT "AdapterReplayRun_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdapterReplayRunEvent" ADD CONSTRAINT "AdapterReplayRunEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdapterReplayRunEvent" ADD CONSTRAINT "AdapterReplayRunEvent_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AdapterReplayRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
