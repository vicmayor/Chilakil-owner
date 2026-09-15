import { prisma } from "@/lib/db";
import { getLocationScope } from "@/lib/scope";
import { locationIdsForScope, isCombinedScope, COMBINED_LABEL } from "@/lib/location";
import { phoenixToday, formatShortDate, shiftIsoDate, formatTime } from "@/lib/dates";
import { moneyExact, number, channelLabel } from "@/lib/format";
import { TopBar } from "@/components/top-bar";
import { Card, CombinedBadge, LocationDot } from "@/components/ui";

export const metadata = { title: "Sales" };

export default async function SalesPage() {
  const scope = await getLocationScope();
  const ids = locationIdsForScope(scope);
  const today = phoenixToday();
  const dates = [0, -1, -2, -3, -4].map((d) => shiftIsoDate(today, d));

  const [daily, orders] = await Promise.all([
    prisma.dailySales.findMany({
      where: { locationId: { in: ids }, date: { in: dates } },
      orderBy: [{ date: "desc" }, { locationId: "asc" }],
    }),
    prisma.order.findMany({
      where: { locationId: { in: ids } },
      orderBy: { orderedAt: "desc" },
      take: 20,
    }),
  ]);

  const todayRows = daily.filter((r) => r.date === today);
  const byLocation = ids.map((id) => {
    const rows = todayRows.filter((r) => r.locationId === id);
    const gross = rows.reduce((s, r) => s + r.gross, 0);
    const fees = rows.reduce((s, r) => s + r.fees, 0);
    const net = rows.reduce((s, r) => s + r.net, 0);
    const ordersCount = rows.reduce((s, r) => s + r.orderCount, 0);
    return { id, rows, gross, fees, net, ordersCount };
  });

  return (
    <>
      <TopBar title="Sales" subtitle="Channel mix from seeded orders — not live POS" scope={scope} />
      <main className="space-y-4 px-4 py-4">
        {isCombinedScope(scope) ? (
          <Card>
            <div className="flex items-center justify-between">
              <CombinedBadge />
              <p className="text-xs text-muted">Today</p>
            </div>
            <p className="font-display mt-2 text-3xl font-semibold tabular">
              {moneyExact(byLocation.reduce((s, l) => s + l.gross, 0))}
            </p>
            <p className="text-sm text-muted">{COMBINED_LABEL}</p>
          </Card>
        ) : null}

        {byLocation.map((loc) => (
          <Card key={loc.id}>
            <LocationDot id={loc.id} />
            <p className="font-display mt-2 text-3xl font-semibold tabular">{moneyExact(loc.gross)}</p>
            <p className="text-sm text-muted">
              {number(loc.ordersCount)} orders · net {moneyExact(loc.net)} after {moneyExact(loc.fees)} fees
            </p>
            <ul className="mt-3 divide-y divide-line">
              {loc.rows.map((row) => (
                <li key={row.id} className="flex items-center justify-between py-2 text-sm">
                  <span>{channelLabel(row.channel)}</span>
                  <span className="tabular font-medium">
                    {moneyExact(row.gross)}
                    <span className="ml-2 text-muted">{number(row.orderCount)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        ))}

        <Card>
          <h2 className="text-sm font-semibold">Last 5 days</h2>
          <ul className="mt-2 space-y-2">
            {dates.map((date) => {
              const rows = daily.filter((r) => r.date === date);
              return (
                <li key={date} className="rounded-xl bg-paper-2 px-3 py-2">
                  <p className="text-xs font-semibold text-muted">{formatShortDate(date)}</p>
                  {ids.map((id) => {
                    const slice = rows.filter((r) => r.locationId === id);
                    const gross = slice.reduce((s, r) => s + r.gross, 0);
                    const ordersCount = slice.reduce((s, r) => s + r.orderCount, 0);
                    return (
                      <p key={id} className="flex justify-between text-sm">
                        <LocationDot id={id} />
                        <span className="tabular">
                          {moneyExact(gross)} · {ordersCount}
                        </span>
                      </p>
                    );
                  })}
                  {isCombinedScope(scope) ? (
                    <p className="mt-1 flex justify-between text-xs font-semibold text-muted">
                      <span>Combined</span>
                      <span className="tabular">
                        {moneyExact(rows.reduce((s, r) => s + r.gross, 0))}
                      </span>
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold">Recent tickets</h2>
          <ul className="mt-2 divide-y divide-line">
            {orders.map((order) => (
              <li key={order.id} className="py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <LocationDot id={order.locationId} />
                  <span className="tabular text-sm font-semibold">{moneyExact(order.gross)}</span>
                </div>
                <p className="text-sm">
                  {channelLabel(order.channel)} · {order.itemSummary}
                </p>
                <p className="text-xs text-muted">
                  {formatTime(order.orderedAt)} · {order.guestName}
                  {order.fees > 0 ? ` · fees ${moneyExact(order.fees)}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      </main>
    </>
  );
}
