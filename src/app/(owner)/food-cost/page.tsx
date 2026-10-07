import { prisma } from "@/lib/db";
import { getLocationScope } from "@/lib/scope";
import { locationIdsForScope, isCombinedScope, COMBINED_LABEL } from "@/lib/location";
import { phoenixToday } from "@/lib/dates";
import { moneyExact, pct } from "@/lib/format";
import { getDashboardData } from "@/lib/metrics";
import { groupFoodCostLocations } from "@/lib/food-cost";
import { TopBar } from "@/components/top-bar";
import { Card, CombinedBadge, LocationDot } from "@/components/ui";
import { FoodCostSimulator } from "@/components/food-cost-simulator";

export const metadata = { title: "Food Cost" };

export default async function FoodCostPage() {
  const scope = await getLocationScope();
  const ids = locationIdsForScope(scope);
  const [data, items, ingredients] = await Promise.all([
    getDashboardData(scope),
    prisma.menuItem.findMany({
      where: { locationId: { in: ids }, active: true },
      include: { recipe: { include: { ingredients: { include: { ingredient: true } } } } },
      orderBy: { name: "asc" },
    }),
    prisma.ingredient.findMany({
      where: { locationId: { in: ids } },
      orderBy: { name: "asc" },
    }),
  ]);

  const workbook = groupFoodCostLocations(
    ids,
    ingredients.map((ingredient) => ({
      id: ingredient.id,
      locationId: ingredient.locationId,
      name: ingredient.name,
      unit: ingredient.unit,
      costPerUnit: ingredient.costPerUnit,
    })),
    items.map((item) => ({
      id: item.id,
      locationId: item.locationId,
      name: item.name,
      category: item.category,
      price: item.price,
      lines: (item.recipe?.ingredients ?? []).map((line) => ({
        ingredientId: line.ingredientId,
        name: line.ingredient.name,
        unit: line.ingredient.unit,
        quantity: line.quantity,
      })),
    })),
  );

  return (
    <>
      <TopBar
        title="Food cost"
        subtitle={`Theoretical vs purchases · ${phoenixToday()}`}
        scope={scope}
      />
      <main className="space-y-4 px-4 py-4">
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

        <FoodCostSimulator key={ids.join("-")} locations={workbook} />
      </main>
    </>
  );
}
