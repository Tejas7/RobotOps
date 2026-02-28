-- AlterTable
ALTER TABLE "RobotLastState"
  ADD COLUMN "lastStateTimestamp" TIMESTAMP(3),
  ADD COLUMN "lastStateSequence" INTEGER,
  ADD COLUMN "lastStateMessageId" TEXT;

-- CreateTable
CREATE TABLE "TaskLastStatus" (
    "tenantId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "percentComplete" INTEGER,
    "updatedAtLogical" TIMESTAMP(3) NOT NULL,
    "lastSequence" INTEGER,
    "lastMessageId" TEXT,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskLastStatus_pkey" PRIMARY KEY ("tenantId","siteId","taskId")
);

-- CreateTable
CREATE TABLE "MessageDedupeWindow" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "messageType" "MessageType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "windowSeconds" INTEGER NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageDedupeWindow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskLastStatus_tenantId_siteId_updatedAtLogical_idx" ON "TaskLastStatus"("tenantId", "siteId", "updatedAtLogical");

-- CreateIndex
CREATE INDEX "TaskLastStatus_tenantId_taskId_idx" ON "TaskLastStatus"("tenantId", "taskId");

-- CreateIndex
CREATE UNIQUE INDEX "MessageDedupeWindow_tenantId_siteId_messageType_entityId_dedupeKey_key" ON "MessageDedupeWindow"("tenantId", "siteId", "messageType", "entityId", "dedupeKey");

-- CreateIndex
CREATE INDEX "MessageDedupeWindow_tenantId_expiresAt_idx" ON "MessageDedupeWindow"("tenantId", "expiresAt");

-- CreateIndex
CREATE INDEX "MessageDedupeWindow_tenantId_siteId_messageType_entityId_idx" ON "MessageDedupeWindow"("tenantId", "siteId", "messageType", "entityId");

-- AddForeignKey
ALTER TABLE "TaskLastStatus" ADD CONSTRAINT "TaskLastStatus_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskLastStatus" ADD CONSTRAINT "TaskLastStatus_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskLastStatus" ADD CONSTRAINT "TaskLastStatus_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageDedupeWindow" ADD CONSTRAINT "MessageDedupeWindow_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageDedupeWindow" ADD CONSTRAINT "MessageDedupeWindow_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill RobotLastState cursor timestamps from existing lastSeenAt
UPDATE "RobotLastState"
SET "lastStateTimestamp" = "lastSeenAt"
WHERE "lastStateTimestamp" IS NULL;

-- Backfill TaskLastStatus from latest state_change MissionEvent rows when available
INSERT INTO "TaskLastStatus" (
  "tenantId",
  "siteId",
  "taskId",
  "state",
  "percentComplete",
  "updatedAtLogical",
  "lastSequence",
  "lastMessageId",
  "message",
  "createdAt",
  "updatedAt"
)
SELECT
  m."tenantId",
  m."siteId",
  m."id" AS "taskId",
  COALESCE((latest."payload" ->> 'state'), m."state") AS "state",
  CASE
    WHEN (latest."payload" ->> 'percent_complete') ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN ROUND((latest."payload" ->> 'percent_complete')::numeric)::integer
    ELSE NULL
  END AS "percentComplete",
  COALESCE(latest."timestamp", m."createdAt") AS "updatedAtLogical",
  NULL AS "lastSequence",
  NULL AS "lastMessageId",
  latest."payload" ->> 'message' AS "message",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Mission" m
LEFT JOIN LATERAL (
  SELECT me."timestamp", me."payload"
  FROM "MissionEvent" me
  WHERE me."missionId" = m."id"
    AND me."type" = 'state_change'
  ORDER BY me."timestamp" DESC, me."id" DESC
  LIMIT 1
) AS latest ON TRUE
ON CONFLICT ("tenantId", "siteId", "taskId") DO NOTHING;
