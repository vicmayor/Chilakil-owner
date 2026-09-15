import { prisma } from "@/lib/db";
import { getLocationScope } from "@/lib/scope";
import { locationIdsForScope } from "@/lib/location";
import { moneyExact, pct } from "@/lib/format";
import { TopBar } from "@/components/top-bar";
import { Card, LocationDot } from "@/components/ui";

export const metadata = { title: "Menu & Recipes" };

export default async function MenuPage() {
  const scope = await getLocationScope();
  const ids = locationIdsForScope(scope);
  const recipes = await prisma.recipe.findMany({
    where: { locationId: { in: ids } },
    include: {
      ingredients: { include: { ingredient: true } },
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
      <main className="space-y-4 px-4 py-4">
        {ids.map((id) => {
          const locRecipes = recipes.filter((r) => r.locationId === id);
          const locIng = lowStock.filter((i) => i.locationId === id);
          return (
            <div key={id} className="space-y-3">
              <h2 className="px-1 text-sm font-semibold">
                <LocationDot id={id} />
              </h2>
              {locRecipes.map((recipe) => {
                const cost = recipe.ingredients.reduce(
                  (s, line) => s + line.quantity * line.ingredient.costPerUnit,
                  0,
                );
                const price = recipe.menuItems[0]?.price ?? 0;
                return (
                  <Card key={recipe.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{recipe.name}</p>
                        <p className="text-xs text-muted">{recipe.notes}</p>
                      </div>
                      <div className="text-right">
                        <p className="tabular text-sm font-semibold">{moneyExact(price)}</p>
                        <p className="text-xs text-muted">{pct(price ? cost / price : 0)} food</p>
                      </div>
                    </div>
                    <ul className="mt-3 space-y-1 text-sm">
                      {recipe.ingredients.map((line) => (
                        <li key={line.id} className="flex justify-between text-muted">
                          <span>
                            {line.ingredient.name}
                            <span className="ml-1 text-xs">
                              {line.quantity} {line.ingredient.unit}
                            </span>
                          </span>
                          <span className="tabular">
                            {moneyExact(line.quantity * line.ingredient.costPerUnit)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                );
              })}
              <Card>
                <h3 className="text-sm font-semibold">On-hand highlights</h3>
                <ul className="mt-2 divide-y divide-line">
                  {locIng.map((ing) => {
                    const low = ing.onHand <= ing.reorderPoint;
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
              </Card>
            </div>
          );
        })}
      </main>
    </>
  );
}
