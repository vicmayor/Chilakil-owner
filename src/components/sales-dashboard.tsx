import { TopBar } from "@/components/top-bar";
import { Card, CombinedBadge, LocationDot, SampleBadge } from "@/components/ui";
import { formatPhoenixDateTime, formatShortDate } from "@/lib/dates";
import { channelLabel, moneyExact, number, pct } from "@/lib/format";
import { isCombinedScope, type LocationId, type LocationScope } from "@/lib/location";
import { grossChange, type LocationDay, type SalesView } from "@/lib/sales-view";

export function SalesDashboard({ view, scope }: { view: SalesView; scope: LocationScope }) {
  const subtitle = view.featuredDate
    ? view.featuredIsToday
      ? "Today · America/Phoenix"
      : `Latest imported day · ${formatShortDate(view.featuredDate)}`
    : "No daily sales imported yet";

  return (
    <>
      <TopBar title="Sales" subtitle={subtitle} scope={scope} />
      <main className="space-y-4 px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {view.sampleOnFeatured || view.anySample ? <SampleBadge /> : null}
          <p className="text-sm text-muted">
            {view.latestImportAt
              ? `Last updated ${formatPhoenixDateTime(new Date(view.latestImportAt))}`
              : "No import timestamp"}
          </p>
        </div>

        {!view.featuredDate ? (
          <Card>
            <p className="text-base font-medium">No daily sales yet.</p>
            <p className="mt-1 text-sm text-muted">
              Import a day with the ingest script. Glendale and Avondale stay in separate rows.
            </p>
          </Card>
        ) : (
          <FeaturedDay view={view} scope={scope} />
        )}

        <Card>
          <h2 className="text-sm font-semibold">Yesterday</h2>
          <p className="text-xs text-muted">{formatShortDate(view.yesterdayDate)}</p>
          <DayLines days={view.yesterday} ids={view.scopeIds} combined={isCombinedScope(scope)} />
        </Card>

        <Card>
          <h2 className="text-sm font-semibold">Last 7 days</h2>
          <SevenDayChart view={view} ids={view.scopeIds} />
          <ul className="mt-3 space-y-2">
            {[...view.last7].reverse().map((day) => (
              <li key={day.date} className="rounded-xl bg-paper-2 px-3 py-2">
                <p className="text-xs font-semibold text-muted">{formatShortDate(day.date)}</p>
                {view.scopeIds.map((id, index) => (
                  <p key={id} className="flex items-center justify-between gap-3 py-1 text-base">
                    <LocationDot id={id} />
                    <span className="tabular font-semibold">
                      {day.grossByLocation[index] == null ? "—" : moneyExact(day.grossByLocation[index])}
                    </span>
                  </p>
                ))}
                {isCombinedScope(scope) && day.grossByLocation.every((value) => value != null) ? (
                  <p className="flex items-center justify-between text-sm font-semibold text-muted">
                    <span>Combined</span>
                    <span className="tabular">
                      {moneyExact(
                        day.grossByLocation.reduce<number>((sum, value) => sum + (value ?? 0), 0),
                      )}
                    </span>
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>

        <WeekCompare view={view} scope={scope} />

        <Card>
          <h2 className="text-sm font-semibold">History</h2>
          <p className="text-xs text-muted">Phoenix days, newest first</p>
          {view.history.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Nothing imported in the last 120 days.</p>
          ) : (
            <ul className="mt-2 max-h-80 space-y-2 overflow-y-auto pr-1">
              {view.history.map((day) => (
                <li key={day.date} className="rounded-xl bg-paper-2 px-3 py-2">
                  <p className="text-xs font-semibold text-muted">{formatShortDate(day.date)}</p>
                  <DayLines days={day.days} ids={view.scopeIds} combined={isCombinedScope(scope)} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </main>
    </>
  );
}

function FeaturedDay({ view, scope }: { view: SalesView; scope: LocationScope }) {
  const combinedGross = view.featured.reduce((sum, day) => sum + (day?.grossSales ?? 0), 0);
  return (
    <>
      {isCombinedScope(scope) && view.featured.every((day) => day != null) ? (
        <Card>
          <div className="flex items-center justify-between">
            <CombinedBadge />
            {view.sampleOnFeatured ? <SampleBadge /> : null}
          </div>
          <p className="font-display mt-2 text-4xl font-semibold tabular">{moneyExact(combinedGross)}</p>
          <p className="text-sm text-muted">Combined total (Glendale + Avondale)</p>
        </Card>
      ) : null}
      {view.featured.map((day, index) => (
        <Card key={view.scopeIds[index]}>
          <div className="flex items-center justify-between">
            <LocationDot id={view.scopeIds[index]} />
            {day?.sample ? <SampleBadge /> : null}
          </div>
          {day ? <DayDetail day={day} /> : <p className="mt-2 text-sm text-muted">No report for this day.</p>}
        </Card>
      ))}
    </>
  );
}

function DayDetail({ day }: { day: LocationDay }) {
  const channels = [
    ["in_store", day.inStoreGross, day.inStoreOrders],
    ["doordash", day.doorDashGross, day.doorDashOrders],
    ["ubereats", day.uberEatsGross, day.uberEatsOrders],
    ["grubhub", day.grubhubGross, day.grubhubOrders],
  ] as const;
  return (
    <>
      <p className="font-display mt-2 text-4xl font-semibold tabular">{moneyExact(day.grossSales)}</p>
      <p className="text-base text-muted">
        Net {moneyExact(day.netSales)} · {number(day.orderCount)} orders · avg {moneyExact(day.averageTicket)}
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-base">
        <Mini label="Discounts" value={moneyExact(day.discounts)} />
        <Mini label="Refunds" value={moneyExact(day.refunds)} />
        <Mini label="Tips" value={moneyExact(day.tips)} />
        <Mini label="Tax" value={day.tax == null ? "—" : moneyExact(day.tax)} />
      </dl>
      {channels.some(([, gross]) => gross != null) ? (
        <ul className="mt-3 divide-y divide-line">
          {channels.map(([channel, gross, orders]) =>
            gross == null && orders == null ? null : (
              <li key={channel} className="flex items-center justify-between py-2 text-base">
                <span>{channelLabel(channel)}</span>
                <span className="tabular font-semibold">
                  {gross == null ? "—" : moneyExact(gross)}
                  {orders != null ? <span className="ml-2 text-sm text-muted">{number(orders)}</span> : null}
                </span>
              </li>
            ),
          )}
        </ul>
      ) : null}
    </>
  );
}

function DayLines({
  days,
  ids,
  combined,
}: {
  days: Array<LocationDay | null>;
  ids: LocationId[];
  combined: boolean;
}) {
  const gross = days.reduce((sum, day) => sum + (day?.grossSales ?? 0), 0);
  return (
    <div className="mt-1">
      {days.map((day, index) => (
        <p key={ids[index]} className="flex items-center justify-between gap-3 py-1 text-base">
          <span className="inline-flex items-center gap-2">
            <LocationDot id={ids[index]} />
            {day?.sample ? <SampleBadge /> : null}
          </span>
          <span className="tabular font-semibold">{day ? moneyExact(day.grossSales) : "—"}</span>
        </p>
      ))}
      {combined && days.every((day) => day != null) ? (
        <p className="flex items-center justify-between text-sm font-semibold text-muted">
          <span>Combined</span>
          <span className="tabular">{moneyExact(gross)}</span>
        </p>
      ) : null}
    </div>
  );
}

function SevenDayChart({ view, ids }: { view: SalesView; ids: LocationId[] }) {
  const max = Math.max(1, ...view.last7.flatMap((day) => day.grossByLocation.map((value) => value ?? 0)));
  return (
    <div className="mt-3 flex h-28 items-end gap-1" aria-hidden="true">
      {view.last7.map((day) => (
        <div key={day.date} className="flex h-full flex-1 items-end justify-center gap-0.5">
          {day.grossByLocation.map((gross, index) => (
            <div
              key={`${day.date}-${ids[index]}`}
              className={`w-full max-w-3 rounded-t-md ${ids[index] === "avondale" ? "bg-avondale" : "bg-glendale"}`}
              style={{ height: `${Math.max(4, ((gross ?? 0) / max) * 100)}%` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function WeekCompare({ view, scope }: { view: SalesView; scope: LocationScope }) {
  return (
    <Card>
      <h2 className="text-sm font-semibold">This week vs last week</h2>
      <p className="text-xs text-muted">
        {formatShortDate(view.weekToDate.start)} – {formatShortDate(view.weekToDate.end)} vs{" "}
        {formatShortDate(view.lastWeek.start)} – {formatShortDate(view.lastWeek.end)}
      </p>
      <ul className="mt-3 space-y-3">
        {view.weekToDate.byLocation.map((current, index) => {
          const previous = view.lastWeek.byLocation[index];
          const change = grossChange(current.gross, previous?.gross ?? 0);
          return (
            <li key={current.locationId} className="rounded-xl bg-paper-2 px-3 py-3">
              <LocationDot id={current.locationId} />
              <p className="font-display mt-1 text-3xl font-semibold tabular">{moneyExact(current.gross)}</p>
              <p className="text-sm text-muted">
                Week to date · {number(current.orders)} orders · {current.days} imported{" "}
                {current.days === 1 ? "day" : "days"}
              </p>
              <p className="mt-1 text-base">
                Last week {moneyExact(previous?.gross ?? 0)}
                {change == null ? "" : ` · ${change >= 0 ? "+" : ""}${pct(change, 0)}`}
              </p>
            </li>
          );
        })}
        {isCombinedScope(scope) && view.weekToDate.combined && view.lastWeek.combined ? (
          <li className="rounded-xl border border-line px-3 py-3">
            <CombinedBadge />
            <p className="font-display mt-1 text-3xl font-semibold tabular">
              {moneyExact(view.weekToDate.combined.gross)}
            </p>
            <p className="text-sm text-muted">{view.weekToDate.combined.label}</p>
            <p className="mt-1 text-base">Last week {moneyExact(view.lastWeek.combined.gross)}</p>
          </li>
        ) : null}
      </ul>
    </Card>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="tabular text-base font-semibold">{value}</dd>
    </div>
  );
}
