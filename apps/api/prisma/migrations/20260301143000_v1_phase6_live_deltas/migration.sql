-- AlterTable
ALTER TABLE "Mission" ADD COLUMN "updatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Incident" ADD COLUMN "updatedAt" TIMESTAMP(3);

-- Backfill
UPDATE "Mission" SET "updatedAt" = COALESCE("createdAt", NOW()) WHERE "updatedAt" IS NULL;
UPDATE "Incident" SET "updatedAt" = COALESCE("createdAt", NOW()) WHERE "updatedAt" IS NULL;

-- AlterTable
ALTER TABLE "Mission" ALTER COLUMN "updatedAt" SET NOT NULL;

-- AlterTable
ALTER TABLE "Incident" ALTER COLUMN "updatedAt" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Mission_tenantId_siteId_updatedAt_id_idx" ON "Mission"("tenantId", "siteId", "updatedAt", "id");

-- CreateIndex
CREATE INDEX "Incident_tenantId_siteId_updatedAt_id_idx" ON "Incident"("tenantId", "siteId", "updatedAt", "id");
