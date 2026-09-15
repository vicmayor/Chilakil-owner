import { prisma } from "@/lib/db";
import { getLocationScope } from "@/lib/scope";
import { locationIdsForScope, isCombinedScope, COMBINED_LABEL } from "@/lib/location";
import { phoenixToday, formatShortDate, shiftIsoDate } from "@/lib/dates";
import { moneyExact, number, pct, platformLabel } from "@/lib/format";
import { TopBar } from "@/components/top-bar";
import { Card, CombinedBadge, LocationDot } from "@/components/ui";

export async function DeliveryPlatformPage({
  platform,
}: {
  platform: "doordash" | "ubereats" | "grubhub";
}) {
  const scope = await getLocationScope();
  const ids = locationIdsForScope(scope);
  const today = phoenixToday();
  const dates = [0, -1, -2, -3, -4].map((d) => shiftIsoDate(today, d));

  const [summaries, integrations] = await Promise.all([
    prisma.deliverySummary.findMany({
      where: { locationId: { in: ids }, platform, date: { in: dates } },
      orderBy: { date: "desc" },
    }),
    prisma.integrationConfig.findMany({
      where: { locationId: { in: ids }, provider: platform },
    }),
  ]);

  const todayRows = summaries.filter((s) => s.date === today);
  const name = platformLabel(platform);

  return (
    <>
      <TopBar
        title={name}
        subtitle="Seeded daily summaries. Live API is Phase 2."
        scope={scope}
      />
      <main className="space-y-4 px-4 py-4">
        {isCombinedScope(scope) && todayRows.length > 1 ? (
          <Card>
            <CombinedBadge />
            <p className="font-display mt-2 text-3xl font-semibold tabular">
              {moneyExact(todayRows.reduce((s, r) => s + r.gross, 0))}
            </p>
            <p className="text-sm text-muted">
              {COMBINED_LABEL} · {name} gross today
            </p>
          </Card>
        ) : null}

        {ids.map((id) => {
          const row = todayRows.find((r) => r.locationId === id);
          const integration = integrations.find((i) => i.locationId === id);
          if (!row) {
            return (
              <Card key={id}>
                <LocationDot id={id} />
                <p className="mt-2 text-sm text-muted">No {name} orders today.</p>
              </Card>
            );
          }
          const feeRate = row.gross > 0 ? (row.commission + row.otherFees) / row.gross : 0;
          return (
            <Card key={id}>
              <LocationDot id={id} />
              <p className="font-display mt-2 text-3xl font-semibold tabular">{moneyExact(row.gross)}</p>
              <p className="text-sm text-muted">
                {number(row.orderCount)} orders · net {moneyExact(row.net)}
              </p>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-muted">Commission</dt>
                  <dd className="tabular font-medium">{moneyExact(row.commission)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Other fees</dt>
                  <dd className="tabular font-medium">{moneyExact(row.otherFees)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Fee rate</dt>
                  <dd className="tabular font-medium">{pct(feeRate)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Avg prep</dt>
                  <dd className="tabular font-medium">{row.avgPrepMinutes ?? "—"} min</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Cancelled</dt>
                  <dd className="tabular font-medium">{row.cancelledOrders}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Refunds</dt>
                  <dd className="tabular font-medium">{moneyExact(row.refunds)}</dd>
                </div>
              </dl>
              {integration ? (
                <p className="mt-3 rounded-xl bg-paper-2 px-3 py-2 text-xs text-muted">
                  Integration: {integration.status}. Secret ref{" "}
                  <span className="font-medium text-ink">{integration.secretRef}</span>
                  {integration.storeRef ? ` · store ref ${integration.storeRef}` : ""}. No live
                  calls in Phase 1.
                </p>
              ) : null}
            </Card>
          );
        })}

        <Card>
          <h2 className="text-sm font-semibold">Last 5 days</h2>
          <ul className="mt-2 space-y-2">
            {dates.map((date) => {
              const rows = summaries.filter((s) => s.date === date);
              return (
                <li key={date} className="rounded-xl bg-paper-2 px-3 py-2 text-sm">
                  <p className="text-xs font-semibold text-muted">{formatShortDate(date)}</p>
                  {ids.map((id) => {
                    const row = rows.find((r) => r.locationId === id);
                    return (
                      <p key={id} className="flex justify-between">
                        <LocationDot id={id} />
                        <span className="tabular">
                          {row ? `${moneyExact(row.gross)} · ${row.orderCount}` : "—"}
                        </span>
                      </p>
                    );
                  })}
                </li>
              );
            })}
          </ul>
        </Card>
      </main>
    </>
  );
}
