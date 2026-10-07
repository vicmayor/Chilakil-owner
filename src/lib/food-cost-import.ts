import type { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { FOOD_COST_WORKBOOK_FILE } from "@/lib/food-cost";
import { FOOD_COST_WORKBOOK_PATH, parseFoodCostWorkbook } from "@/lib/food-cost-workbook";
import { LOCATION_IDS } from "@/lib/location";

export async function importFoodCostWorkbook(
  prisma: PrismaClient,
  filePath = FOOD_COST_WORKBOOK_PATH,
  locationIds: readonly string[] = LOCATION_IDS,
) {
  const workbook = parseFoodCostWorkbook(readFileSync(filePath));
  for (const locationId of locationIds) {
    await prisma.$transaction(
      async (tx) => {
        const ingredientIds = new Map<string, string>();
        for (const row of workbook.ingredients) {
          const data = {
            name: row.name,
            unit: row.unit,
            costPerUnit: row.costPerUnit,
            vendor: row.vendor,
            purchaseQty: row.purchaseQty,
            purchaseCost: row.purchaseCost,
            yieldPct: row.yieldPct,
            addonPrice: row.addonPrice,
            portionQty: row.portionQty,
            notes: row.notes,
            sortOrder: row.sortOrder,
            isStandardTopping: row.isStandardTopping,
          };
          const saved = await tx.ingredient.upsert({
            where: { locationId_sourceKey: { locationId, sourceKey: row.sourceKey } },
            create: {
              locationId,
              sourceKey: row.sourceKey,
              onHand: 0,
              reorderPoint: 0,
              ...data,
            },
            update: data,
          });
          ingredientIds.set(row.sourceKey, saved.id);
        }

        const recipeIds = new Map<string, string>();
        for (const item of workbook.menuItems) {
          const saved = await tx.recipe.upsert({
            where: { locationId_sourceKey: { locationId, sourceKey: item.recipeKey } },
            create: {
              locationId,
              sourceKey: item.recipeKey,
              name: item.name,
              yieldQty: 1,
              yieldUnit: "serving",
              notes: item.notes,
              packagingCost: item.packagingCost,
              standardToppings: item.standardToppings,
              sortOrder: item.sortOrder,
            },
            update: {
              name: item.name,
              notes: item.notes,
              packagingCost: item.packagingCost,
              standardToppings: item.standardToppings,
              sortOrder: item.sortOrder,
            },
          });
          recipeIds.set(item.recipeKey, saved.id);
          await tx.recipeIngredient.deleteMany({ where: { recipeId: saved.id } });
          if (item.lines.length > 0) {
            await tx.recipeIngredient.createMany({
              data: item.lines.map((line) => ({
                recipeId: saved.id,
                ingredientId: requiredId(ingredientIds, line.ingredientKey, item.name),
                quantity: line.quantity,
                sortOrder: line.sortOrder,
                notes: line.notes,
                sheetUnitCost: line.sheetUnitCost,
                kind: line.kind,
              })),
            });
          }
          await tx.menuItem.upsert({
            where: { locationId_sourceKey: { locationId, sourceKey: item.sourceKey } },
            create: {
              locationId,
              sourceKey: item.sourceKey,
              name: item.name,
              category: item.category,
              price: item.price,
              recipeId: saved.id,
              active: true,
              sortOrder: item.sortOrder,
            },
            update: {
              name: item.name,
              category: item.category,
              price: item.price,
              recipeId: saved.id,
              active: true,
              sortOrder: item.sortOrder,
            },
          });
        }

        const menuKeys = workbook.menuItems.map((item) => item.sourceKey);
        const recipeKeys = workbook.menuItems.map((item) => item.recipeKey);
        const ingredientKeys = workbook.ingredients.map((row) => row.sourceKey);
        await tx.menuItem.deleteMany({
          where: { locationId, sourceKey: { startsWith: "workbook:menu:", notIn: menuKeys } },
        });
        await tx.recipe.deleteMany({
          where: { locationId, sourceKey: { startsWith: "workbook:recipe:", notIn: recipeKeys } },
        });
        await tx.ingredient.deleteMany({
          where: { locationId, sourceKey: { startsWith: "workbook:ingredient:", notIn: ingredientKeys } },
        });
        await tx.foodCostProfile.upsert({
          where: { locationId },
          create: {
            locationId,
            targetFoodCostPct: workbook.targetFoodCostPct,
            caveat: workbook.caveat,
            workbook: FOOD_COST_WORKBOOK_FILE,
          },
          update: {
            targetFoodCostPct: workbook.targetFoodCostPct,
            caveat: workbook.caveat,
            workbook: FOOD_COST_WORKBOOK_FILE,
          },
        });
      },
      { timeout: 30_000 },
    );
  }

  return {
    locations: locationIds.length,
    ingredients: workbook.ingredients.length,
    menuItems: workbook.menuItems.length,
  };
}

function requiredId(ids: Map<string, string>, key: string, recipeName: string): string {
  const id = ids.get(key);
  if (!id) throw new Error(`Missing ingredient ${key} for ${recipeName}`);
  return id;
}
