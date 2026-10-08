import { prisma } from "@/lib/db";
import { getLocationScope } from "@/lib/scope";
import { LOCATIONS, isLocationId, locationIdsForScope } from "@/lib/location";
import { moneyExact, pct } from "@/lib/format";
import { menuUnitCost, pricedRecipeCost } from "@/lib/food-cost";
import { Accordion } from "@/components/design/accordion";
import { TopBar } from "@/components/top-bar";
import { Card, LocationDot } from "@/components/ui";
export const metadata = { title: "Menu & Recipes" };

function moneyOrBlank(amount: number | null): string {
  return amount == null ? "—" : moneyExact(amount);
}

export default async function MenuPage() {
  const scope = await getLocationScope();
  const ids = locationIdsForScope(scope);
  const recipes = await prisma.recipe.findMany({
    where: { locationId: { in: ids } },
    include: {
      ingredients: { include: { ingredient: true }, orderBy: { sortOrder: "asc" } },
      menuItems: true,
    },
    orderBy: { name: "asc" },
  });
  const lowStock = await prisma.ingredient.findMany({
    where: { locationId: { in: ids } },
    orderBy: { name: "asc" },
  });

  return (
    <>
      <TopBar title="Menu & recipes" subtitle="Each kitchen has its own costing" scope={scope} />
      <main className="space-y-4 px-4 py-4 md:grid md:grid-cols-2 md:px-6">
        {ids.map((id) => {
          const locRecipes = recipes.filter((r) => r.locationId === id);
          const locIng = lowStock.filter((i) => i.locationId === id);
          const lowCount = locIng.filter((ing) => ing.reorderPoint > 0 && ing.onHand <= ing.reorderPoint).length;
          return (
            <Accordion
              key={id}
              title={isLocationId(id) ? LOCATIONS[id].name : id}
              count={locRecipes.length}
              pending={lowCount}
              defaultOpen
            >
              <div className="mb-3">
                <LocationDot id={id} />
              </div>
              {locRecipes.map((recipe) => {
                const cost = pricedRecipeCost(
                  recipe.ingredients.map((line) => ({
                    quantity: line.quantity,
                    sheetUnitCost: line.sheetUnitCost,
                    catalogUnitCost: line.ingredient.costPerUnit,
                  })),
                  recipe.packagingCost,
                );
                const price = recipe.menuItems[0]?.price ?? null;
                return (
                  <Card key={recipe.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{recipe.name}</p>
                        <p className="text-xs text-muted">{recipe.notes}</p>
                      </div>
                      <div className="text-right">
                        <p className="tabular text-sm font-semibold">{price == null ? "—" : moneyExact(price)}</p>
                        <p className="text-xs text-muted">
                          {price != null && price > 0 && cost != null
                            ? `${pct(cost / price)} food`
                            : price == null
                              ? "Not priced"
                              : "Cost incomplete"}
                        </p>
                      </div>
                    </div>
                    <ul className="mt-3 space-y-1 text-sm">
                      {recipe.ingredients.map((line) => {
                        const unitCost = menuUnitCost(line.sheetUnitCost, line.ingredient.costPerUnit);
                        return (
                          <li key={line.id} className="flex justify-between text-muted">
                            <span>
                              {line.ingredient.name}
                              <span className="ml-1 text-xs">
                                {line.quantity} {line.ingredient.unit}
                              </span>
                            </span>
                            <span className="tabular">{moneyOrBlank(unitCost == null ? null : line.quantity * unitCost)}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </Card>
                );
              })}
              <Card>
                <h3 className="text-sm font-semibold">On-hand highlights</h3>
                <ul className="mt-2 divide-y divide-line">
                  {locIng
                    .filter((ing) => ing.reorderPoint > 0 || ing.onHand > 0)
                    .map((ing) => {
                      const low = ing.reorderPoint > 0 && ing.onHand <= ing.reorderPoint;
                      return (
                        <li key={ing.id} className="flex justify-between py-2 text-sm">
                          <span>
                            {ing.name}
                            {low ? (
                              <span className="ml-2 text-[10px] font-bold uppercase text-warn">reorder</span>
                            ) : null}
                          </span>
                          <span className="tabular text-muted">
                            {ing.onHand} {ing.unit}
                          </span>
                        </li>
                      );
                    })}
                </ul>
                {locIng.every((ing) => ing.reorderPoint === 0 && ing.onHand === 0) ? (
                  <p className="mt-2 text-sm text-muted">No on-hand counts for this kitchen.</p>
                ) : null}
              </Card>
            </Accordion>
          );
        })}
      </main>
    </>
  );
}
