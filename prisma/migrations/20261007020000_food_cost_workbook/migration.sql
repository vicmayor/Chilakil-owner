-- Food cost workbook: blank purchase costs stay null, and rows upsert by source key.

ALTER TABLE "Ingredient" ALTER COLUMN "costPerUnit" DROP NOT NULL;
ALTER TABLE "Ingredient" ADD COLUMN "purchaseQty" DOUBLE PRECISION;
ALTER TABLE "Ingredient" ADD COLUMN "purchaseCost" DOUBLE PRECISION;
ALTER TABLE "Ingredient" ADD COLUMN "yieldPct" DOUBLE PRECISION;
ALTER TABLE "Ingredient" ADD COLUMN "addonPrice" DOUBLE PRECISION;
ALTER TABLE "Ingredient" ADD COLUMN "portionQty" DOUBLE PRECISION;
ALTER TABLE "Ingredient" ADD COLUMN "notes" TEXT;
ALTER TABLE "Ingredient" ADD COLUMN "sourceKey" TEXT;
ALTER TABLE "Ingredient" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Ingredient" ADD COLUMN "isStandardTopping" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX "Ingredient_locationId_sourceKey_key" ON "Ingredient"("locationId", "sourceKey");

ALTER TABLE "Recipe" ADD COLUMN "packagingCost" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Recipe" ADD COLUMN "standardToppings" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Recipe" ADD COLUMN "sourceKey" TEXT;
ALTER TABLE "Recipe" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX "Recipe_locationId_sourceKey_key" ON "Recipe"("locationId", "sourceKey");

ALTER TABLE "RecipeIngredient" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "RecipeIngredient" ADD COLUMN "notes" TEXT;
ALTER TABLE "RecipeIngredient" ADD COLUMN "sheetUnitCost" DOUBLE PRECISION;
ALTER TABLE "RecipeIngredient" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'component';

ALTER TABLE "MenuItem" ALTER COLUMN "price" DROP NOT NULL;
ALTER TABLE "MenuItem" ADD COLUMN "sourceKey" TEXT;
ALTER TABLE "MenuItem" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX "MenuItem_locationId_sourceKey_key" ON "MenuItem"("locationId", "sourceKey");

CREATE TABLE "FoodCostProfile" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "targetFoodCostPct" DOUBLE PRECISION NOT NULL,
    "caveat" TEXT,
    "workbook" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FoodCostProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FoodCostProfile_locationId_key" ON "FoodCostProfile"("locationId");

ALTER TABLE "FoodCostProfile" ADD CONSTRAINT "FoodCostProfile_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
