import { prisma } from "@/lib/db";
import { getLocationScope } from "@/lib/scope";
import { locationIdsForScope, isCombinedScope, COMBINED_LABEL, isLocationId } from "@/lib/location";
import { phoenixToday } from "@/lib/dates";
import { moneyExact, pct } from "@/lib/format";
import { pricedRecipeCost, type LineKind } from "@/lib/food-cost";
import { getDashboardData } from "@/lib/metrics";
import { TopBar } from "@/components/top-bar";
import { Card, CombinedBadge, LocationDot } from "@/components/ui";
import { FoodCostSimulator, type SimulatorLocation } from "@/components/food-cost-simulator";

export const metadata = { title: "Food Cost" };

function asKind(value: string): LineKind {
  if (value === "average_protein" || value === "packaging") return value;
  return "component";
}

export default async function FoodCostPage() {
  const scope = await getLocationScope();
  const ids = locationIdsForScope(scope);
  const [data, items, ingredients, profiles] = await Promise.all([
    getDashboardData(scope),
    prisma.menuItem.findMany({
      where: { locationId: { in: ids }, active: true },
      include: {
        recipe: {
          include: {
            ingredients: { include: { ingredient: true }, orderBy: { sortOrder: "asc" } },
          },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.ingredient.findMany({
      where: { locationId: { in: ids }, sourceKey: { startsWith: "workbook:" } },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.foodCostProfile.findMany({ where: { locationId: { in: ids } } }),
  ]);

  const kitchens: SimulatorLocation[] = [];
  for (const id of ids) {
    if (!isLocationId(id)) continue;
    const profile = profiles.find((row) => row.locationId === id);
    const locationIngredients = ingredients.filter((row) => row.locationId === id && row.sourceKey);
    const locationItems = items.filter((row) => row.locationId === id && row.sourceKey && row.recipe?.sourceKey);
    if (!profile || locationIngredients.length === 0) continue;
    kitchens.push({
      locationId: id,
      targetFoodCostPct: profile.targetFoodCostPct,
      caveat: profile.caveat,
      ingredients: locationIngredients.map((row) => ({
        id: row.id,
        sourceKey: row.sourceKey ?? "",
        sortOrder: row.sortOrder,
        name: row.name,
        vendor: row.vendor,
        purchaseQty: row.purchaseQty,
        unit: row.unit,
        purchaseCost: row.purchaseCost,
        yieldPct: row.yieldPct,
        costPerUnit: row.costPerUnit,
        notes: row.notes,
        addonPrice: row.addonPrice,
        portionQty: row.portionQty,
        isStandardTopping: row.isStandardTopping,
      })),
      items: locationItems.map((item) => ({
        id: item.id,
        sourceKey: item.sourceKey ?? "",
        recipeKey: item.recipe?.sourceKey ?? "",
        sortOrder: item.sortOrder,
        name: item.name,
        category: item.category,
        price: item.price,
        packagingCost: item.recipe?.packagingCost ?? 0,
        standardToppings: item.recipe?.standardToppings ?? false,
        notes: item.recipe?.notes ?? null,
        lines: (item.recipe?.ingredients ?? []).map((line) => ({
          ingredientKey: line.ingredient.sourceKey ?? line.ingredientId,
          quantity: line.quantity,
          unit: line.ingredient.unit,
          sheetUnitCost: line.sheetUnitCost,
          notes: line.notes,
          kind: asKind(line.kind),
          sortOrder: line.sortOrder,
        })),
      })),
    });
  }

  const otherItems = items.filter((item) => !item.sourceKey);

  return (
    <>
      <TopBar
        title="Food cost"
        subtitle={`Menu costing · target from the workbook · ${phoenixToday()}`}
        scope={scope}
      />
      <main className="space-y-4 px-4 py-4 md:px-6">
        {isCombinedScope(scope) && data.combined ? (
          <Card>
            <CombinedBadge />
            <p className="font-display mt-2 text-3xl font-extrabold tabular">
              {moneyExact(data.combined.foodCost)}
            </p>
            <p className="text-sm text-muted">
              {COMBINED_LABEL} theoretical · {pct(data.combined.foodCostPct)} of combined gross
            </p>
          </Card>
        ) : null}

        {data.locations.map((loc) => (
          <Card key={loc.locationId}>
            <LocationDot id={loc.locationId} />
            <p className="font-display mt-2 text-3xl font-extrabold tabular">{moneyExact(loc.foodCost)}</p>
            <p className="text-sm text-muted">
              Theoretical {pct(loc.foodCostPct)} · target {pct(loc.targetFoodCostPct)}
            </p>
            <p className="mt-1 text-sm">
              Actual purchases today {moneyExact(loc.actualFoodPurchases)} — weekly drops make
              actual lumpy; theoretical is the daily decision number.
            </p>
          </Card>
        ))}

        {kitchens.length === 0 ? (
          <Card>
            <h2 className="text-sm font-semibold">Chilakil menu costing</h2>
            <p className="mt-1 text-sm text-muted">
              The food cost workbook is not in this database yet. Run the seed to load it.
            </p>
          </Card>
        ) : (
          <FoodCostSimulator key={ids.join("-")} locations={kitchens} />
        )}

        {ids.map((id) => {
          const rows = otherItems
            .filter((item) => item.locationId === id)
            .map((item) => {
              const cost = item.recipe
                ? pricedRecipeCost(
                    item.recipe.ingredients.map((line) => ({
                      quantity: line.quantity,
                      sheetUnitCost: line.sheetUnitCost,
                      catalogUnitCost: line.ingredient.costPerUnit,
                    })),
                    item.recipe.packagingCost,
                  )
                : null;
              const foodPct = item.price != null && item.price > 0 && cost != null ? cost / item.price : null;
              return { item, cost, foodPct };
            })
            .sort((a, b) => (b.foodPct ?? -1) - (a.foodPct ?? -1));
          if (rows.length === 0) return null;
          return (
            <Card key={id}>
              <h2 className="text-sm font-semibold">
                <LocationDot id={id} /> other recipes
              </h2>
              <ul className="mt-2 divide-y divide-line">
                {rows.map(({ item, cost, foodPct }) => (
                  <li key={item.id} className="flex items-center justify-between py-2.5">
                    <div>
                      <p className="text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-muted">
                        Sell {item.price == null ? "—" : moneyExact(item.price)} · recipe{" "}
                        {cost == null ? "—" : moneyExact(cost)}
                      </p>
                    </div>
                    <p
                      className={`tabular text-sm font-semibold ${foodPct != null && foodPct > 0.32 ? "text-warn" : "text-sage"}`}
                    >
                      {foodPct == null ? "—" : pct(foodPct)}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          );
        })}
      </main>
    </>
  );
}
