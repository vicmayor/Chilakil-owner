-- Read-only Team inventory. Does not alter Ingredient or other catalogs.

CREATE TABLE "TeamInventoryItem" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "unit" TEXT,
    "unitLabel" TEXT,
    "supplier" TEXT,
    "quantityOnHand" DECIMAL(14,3),
    "status" TEXT NOT NULL,
    "lowStock" BOOLEAN NOT NULL,
    "parLevel" DECIMAL(14,3),
    "minimumLevel" DECIMAL(14,3),
    "unitCost" DECIMAL(12,2),
    "purchase" TEXT,
    "deliveryStatus" TEXT,
    "neededBy" TEXT,
    "neededDate" TEXT,
    "lastCountedAt" TEXT,
    "lastCountedBy" TEXT,
    "lastUpdatedAt" TEXT,
    "lastUpdatedBy" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamInventoryItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TeamInventoryItem_locationId_itemId_key" ON "TeamInventoryItem"("locationId", "itemId");

CREATE INDEX "TeamInventoryItem_locationId_status_idx" ON "TeamInventoryItem"("locationId", "status");

ALTER TABLE "TeamInventoryItem" ADD CONSTRAINT "TeamInventoryItem_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "TeamInventorySummary" (
    "locationId" TEXT NOT NULL,
    "out" INTEGER NOT NULL,
    "low" INTEGER NOT NULL,
    "toBuy" INTEGER NOT NULL,
    "onTheWay" INTEGER NOT NULL,
    "unreviewed" INTEGER NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamInventorySummary_pkey" PRIMARY KEY ("locationId")
);

ALTER TABLE "TeamInventorySummary" ADD CONSTRAINT "TeamInventorySummary_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "TeamInventorySyncState" (
    "id" TEXT NOT NULL,
    "lastSuccessAt" TIMESTAMP(3),
    "lastError" TEXT,
    "lastStatus" INTEGER,
    "generatedAt" TIMESTAMP(3),

    CONSTRAINT "TeamInventorySyncState_pkey" PRIMARY KEY ("id")
);
