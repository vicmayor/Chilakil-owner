import { prisma } from "@/lib/db";
import { getLocationScope } from "@/lib/scope";
import { locationIdsForScope, isCombinedScope, COMBINED_LABEL } from "@/lib/location";
import { phoenixToday } from "@/lib/dates";
import { moneyExact, pct } from "@/lib/format";
import { getDashboardData } from "@/lib/metrics";
import { TopBar } from "@/components/top-bar";
import { Card, CombinedBadge, LocationDot } from "@/components/ui";

export const metadata = { title: "Food Cost" };

export default async function FoodCostPage() {
  const scope = await getLocationScope();
  const ids = locationIdsForScope(scope);
  const data = await getDashboardData(scope);
  const items = await prisma.menuItem.findMany({
    where: { locationId: { in: ids }, active: true },
    include: { recipe: { include: { ingredients: { include: { ingredient: true } } } } },
    orderBy: { name: "asc" },
  });

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
            <p className="font-display mt-2 text-3xl font-semibold tabular">
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
            <p className="font-display mt-2 text-3xl font-semibold tabular">{moneyExact(loc.foodCost)}</p>
            <p className="text-sm text-muted">
              Theoretical {pct(loc.foodCostPct)} · target {pct(loc.targetFoodCostPct)}
            </p>
            <p className="mt-1 text-sm">
              Actual purchases today {moneyExact(loc.actualFoodPurchases)} — weekly drops make
              actual lumpy; theoretical is the daily decision number.
            </p>
          </Card>
        ))}

        {ids.map((id) => {
          const rows = items
            .filter((i) => i.locationId === id)
            .map((item) => {
              const cost =
                item.recipe?.ingredients.reduce(
                  (s, line) => s + line.quantity * line.ingredient.costPerUnit,
                  0,
                ) ?? 0;
              return { item, cost, pct: item.price > 0 ? cost / item.price : 0 };
            })
            .sort((a, b) => b.pct - a.pct);
          return (
            <Card key={id}>
              <h2 className="text-sm font-semibold">
                <LocationDot id={id} />
              </h2>
              <ul className="mt-2 divide-y divide-line">
                {rows.map(({ item, cost, pct: p }) => (
                  <li key={item.id} className="flex items-center justify-between py-2.5">
                    <div>
                      <p className="text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-muted">
                        Sell {moneyExact(item.price)} · recipe {moneyExact(cost)}
                      </p>
                    </div>
                    <p className={`tabular text-sm font-semibold ${p > 0.32 ? "text-warn" : "text-sage"}`}>
                      {pct(p)}
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
