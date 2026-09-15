import { prisma } from "@/lib/db";
import { getLocationScope } from "@/lib/scope";
import { locationIdsForScope, isCombinedScope, COMBINED_LABEL } from "@/lib/location";
import { phoenixToday, formatShortDate } from "@/lib/dates";
import { expenseCategoryLabel, moneyExact } from "@/lib/format";
import { TopBar } from "@/components/top-bar";
import { Card, CombinedBadge, LocationDot } from "@/components/ui";

export const metadata = { title: "Expenses" };

export default async function ExpensesPage() {
  const scope = await getLocationScope();
  const ids = locationIdsForScope(scope);
  const today = phoenixToday();
  const expenses = await prisma.expense.findMany({
    where: { locationId: { in: ids } },
    orderBy: [{ date: "desc" }, { amount: "desc" }],
  });

  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const todayTotal = expenses.filter((e) => e.date === today).reduce((s, e) => s + e.amount, 0);

  return (
    <>
      <TopBar title="Expenses" subtitle="Books by location — never mixed unless ALL" scope={scope} />
      <main className="space-y-4 px-4 py-4">
        <Card>
          {isCombinedScope(scope) ? <CombinedBadge /> : <LocationDot id={ids[0]} />}
          <p className="font-display mt-2 text-3xl font-semibold tabular">{moneyExact(todayTotal)}</p>
          <p className="text-sm text-muted">
            Booked today{isCombinedScope(scope) ? ` · ${COMBINED_LABEL}` : ""}
          </p>
          <p className="mt-2 text-xs text-muted">Window total {moneyExact(total)}</p>
        </Card>

        {ids.map((id) => {
          const rows = expenses.filter((e) => e.locationId === id);
          const sum = rows.reduce((s, e) => s + e.amount, 0);
          return (
            <Card key={id}>
              <div className="flex items-center justify-between">
                <LocationDot id={id} />
                <span className="tabular text-sm font-semibold">{moneyExact(sum)}</span>
              </div>
              <ul className="mt-2 divide-y divide-line">
                {rows.map((e) => (
                  <li key={e.id} className="flex items-start justify-between gap-3 py-2.5">
                    <div>
                      <p className="text-sm font-medium">
                        {e.vendor}
                        {e.recurring ? (
                          <span className="ml-2 text-[10px] font-bold uppercase text-muted">recurring</span>
                        ) : null}
                      </p>
                      <p className="text-xs text-muted">
                        {expenseCategoryLabel(e.category)} · {formatShortDate(e.date)}
                        {e.notes ? ` · ${e.notes}` : ""}
                      </p>
                    </div>
                    <p className="tabular text-sm font-semibold">{moneyExact(e.amount)}</p>
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
