-- CreateTable
CREATE TABLE "UberEatsWeeklyReport" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "uberStoreId" TEXT NOT NULL,
    "weekStart" TEXT NOT NULL,
    "weekEnd" TEXT NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "tax" DOUBLE PRECISION NOT NULL,
    "gross" DOUBLE PRECISION NOT NULL,
    "orderCount" INTEGER NOT NULL,
    "deliveryOrders" INTEGER NOT NULL,
    "pickupOrders" INTEGER NOT NULL,
    "commission" DOUBLE PRECISION NOT NULL,
    "marketingFees" DOUBLE PRECISION NOT NULL,
    "promoFees" DOUBLE PRECISION NOT NULL,
    "adjustments" DOUBLE PRECISION NOT NULL,
    "errorCharges" DOUBLE PRECISION,
    "netPayout" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UberEatsWeeklyReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UberEatsWeeklyReport_locationId_weekStart_idx" ON "UberEatsWeeklyReport"("locationId", "weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "UberEatsWeeklyReport_locationId_weekStart_key" ON "UberEatsWeeklyReport"("locationId", "weekStart");

-- AddForeignKey
ALTER TABLE "UberEatsWeeklyReport" ADD CONSTRAINT "UberEatsWeeklyReport_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
