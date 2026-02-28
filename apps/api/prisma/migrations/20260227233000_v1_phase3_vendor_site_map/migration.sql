-- CreateTable
CREATE TABLE "VendorSiteMap" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "vendorMapId" TEXT,
    "vendorMapName" TEXT,
    "robotopsFloorplanId" TEXT NOT NULL,
    "scale" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "rotationDegrees" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "translateX" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "translateY" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorSiteMap_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VendorSiteMap_tenantId_siteId_vendor_vendorMapId_idx" ON "VendorSiteMap"("tenantId", "siteId", "vendor", "vendorMapId");

-- CreateIndex
CREATE INDEX "VendorSiteMap_tenantId_siteId_vendor_vendorMapName_idx" ON "VendorSiteMap"("tenantId", "siteId", "vendor", "vendorMapName");

-- AddForeignKey
ALTER TABLE "VendorSiteMap" ADD CONSTRAINT "VendorSiteMap_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorSiteMap" ADD CONSTRAINT "VendorSiteMap_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorSiteMap" ADD CONSTRAINT "VendorSiteMap_robotopsFloorplanId_fkey" FOREIGN KEY ("robotopsFloorplanId") REFERENCES "Floorplan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Partial unique indexes for nullable vendor map keys.
CREATE UNIQUE INDEX "VendorSiteMap_tenant_site_vendor_map_id_unique"
  ON "VendorSiteMap"("tenantId", "siteId", "vendor", "vendorMapId")
  WHERE "vendorMapId" IS NOT NULL;

CREATE UNIQUE INDEX "VendorSiteMap_tenant_site_vendor_map_name_unique"
  ON "VendorSiteMap"("tenantId", "siteId", "vendor", "vendorMapName")
  WHERE "vendorMapName" IS NOT NULL;
