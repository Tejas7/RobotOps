-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('robot_state', 'robot_event', 'task_status');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('info', 'warning', 'major', 'critical');

-- CreateEnum
CREATE TYPE "Category" AS ENUM ('navigation', 'traffic', 'battery', 'connectivity', 'hardware', 'safety', 'integration');

-- CreateTable
CREATE TABLE "CanonicalMessage" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL,
    "messageType" "MessageType" NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "protocol" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "robotId" TEXT NOT NULL,
    "severity" "Severity",
    "category" "Category",
    "payload" JSONB NOT NULL,
    "rawEnvelope" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CanonicalMessage_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "IngestionEvent" ADD COLUMN "canonicalMessageId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "CanonicalMessage_tenantId_messageId_key" ON "CanonicalMessage"("tenantId", "messageId");

-- CreateIndex
CREATE INDEX "CanonicalMessage_tenantId_siteId_messageType_timestamp_idx" ON "CanonicalMessage"("tenantId", "siteId", "messageType", "timestamp");

-- CreateIndex
CREATE INDEX "CanonicalMessage_tenantId_sourceId_timestamp_idx" ON "CanonicalMessage"("tenantId", "sourceId", "timestamp");

-- CreateIndex
CREATE INDEX "IngestionEvent_tenantId_canonicalMessageId_idx" ON "IngestionEvent"("tenantId", "canonicalMessageId");

-- AddForeignKey
ALTER TABLE "CanonicalMessage" ADD CONSTRAINT "CanonicalMessage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestionEvent" ADD CONSTRAINT "IngestionEvent_canonicalMessageId_fkey" FOREIGN KEY ("canonicalMessageId") REFERENCES "CanonicalMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
