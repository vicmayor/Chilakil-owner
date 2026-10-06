-- CreateTable
CREATE TABLE "DoorDashPricingReport" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "reportDate" TEXT NOT NULL,
    "doorDashStoreId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "commissionRate" DOUBLE PRECISION NOT NULL,
    "commissionNote" TEXT NOT NULL,
    "exclusionNote" TEXT NOT NULL,
    "methodNote" TEXT NOT NULL,
    "addonNote" TEXT,
    "addonNoteTone" TEXT,
    "popularityLead" TEXT NOT NULL,
    "tenOrderExample" TEXT NOT NULL,
    "pdfPath" TEXT,

    CONSTRAINT "DoorDashPricingReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoorDashPricingLine" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "inStorePrice" DOUBLE PRECISION NOT NULL,
    "doorDashPrice" DOUBLE PRECISION,
    "onDoorDash" BOOLEAN NOT NULL DEFAULT true,
    "markupPct" DOUBLE PRECISION,
    "keepNow" DOUBLE PRECISION,
    "vsInStore" DOUBLE PRECISION,
    "breakEvenPrice" DOUBLE PRECISION,
    "recommendedPrice" DOUBLE PRECISION,
    "changeNeeded" DOUBLE PRECISION,
    "keepRecommended" DOUBLE PRECISION,
    "status" TEXT NOT NULL,
    "footnote" TEXT,
    "squareSold30d" INTEGER,

    CONSTRAINT "DoorDashPricingLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoorDashPricingNote" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "body" TEXT NOT NULL,

    CONSTRAINT "DoorDashPricingNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DoorDashPricingReport_locationId_reportDate_idx" ON "DoorDashPricingReport"("locationId", "reportDate");

-- CreateIndex
CREATE UNIQUE INDEX "DoorDashPricingReport_locationId_reportDate_doorDashStoreId_key" ON "DoorDashPricingReport"("locationId", "reportDate", "doorDashStoreId");

-- CreateIndex
CREATE INDEX "DoorDashPricingLine_reportId_kind_sortOrder_idx" ON "DoorDashPricingLine"("reportId", "kind", "sortOrder");

-- CreateIndex
CREATE INDEX "DoorDashPricingNote_reportId_sortOrder_idx" ON "DoorDashPricingNote"("reportId", "sortOrder");

-- AddForeignKey
ALTER TABLE "DoorDashPricingReport" ADD CONSTRAINT "DoorDashPricingReport_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoorDashPricingLine" ADD CONSTRAINT "DoorDashPricingLine_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "DoorDashPricingReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoorDashPricingNote" ADD CONSTRAINT "DoorDashPricingNote_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "DoorDashPricingReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
