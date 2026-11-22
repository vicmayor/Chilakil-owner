import { EmptyState } from "@/components/design/empty-state";
import { formatSyncStamp } from "@/components/design/sync-status";
import { TopBar } from "@/components/top-bar";
import { Card, CombinedBadge, LocationDot, SampleBadge } from "@/components/ui";
import { formatShortDate } from "@/lib/dates";
import { channelLabel, countOrDash, moneyExact, number, pct } from "@/lib/format";
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
      <TopBar
        title="Sales"
        subtitle={subtitle}
        scope={scope}
        syncLabel={
          view.latestImportAt
            ? `Last synced: ${formatSyncStamp(new Date(view.latestImportAt))}`
            : "No import timestamp"
        }
      />
      <main className="space-y-4 px-4 py-4 md:px-6">
        {view.sampleOnFeatured || view.anySample ? <SampleBadge /> : null}

        {!view.featuredDate ? (
          <EmptyState
            title="No daily sales yet."
            body="Import a day with the ingest script. Glendale and Avondale stay in separate rows."
          />
        ) : (
          <FeaturedDay view={view} scope={scope} />
        )}

        <Card>
          <h2 className="text-base font-extrabold">Yesterday</h2>
          <p className="text-xs text-muted">{formatShortDate(view.yesterdayDate)}</p>
          <DayLines days={view.yesterday} ids={view.scopeIds} combined={isCombinedScope(scope)} />
        </Card>

        <Card>
          <h2 className="text-base font-extrabold">Last 7 days</h2>
          <TrendChart
            title="Gross sales"
            days={view.last7.map((day) => day.date)}
            ids={view.scopeIds}
            values={view.last7.map((day) => day.grossByLocation)}
            format={moneyExact}
          />
          <div className="mt-5">
            <TrendChart
              title="New customers"
              days={view.last7.map((day) => day.date)}
              ids={view.scopeIds}
              values={view.last7.map((day) => day.newCustomersByLocation)}
              format={(value) => number(value)}
              emptyLabel="No new-customer counts for these days."
            />
          </div>
          <ul className="mt-4 space-y-2">
            {[...view.last7].reverse().map((day) => (
              <li key={day.date} className="rounded-2xl bg-paper px-3 py-2">
                <p className="text-xs font-semibold text-muted">{formatShortDate(day.date)}</p>
                {view.scopeIds.map((id, index) => (
                  <p key={id} className="flex items-center justify-between gap-3 py-1 text-base">
                    <LocationDot id={id} />
                    <span className="text-right">
                      <span className="tabular font-semibold">
                        {day.grossByLocation[index] == null ? "—" : moneyExact(day.grossByLocation[index])}
                      </span>
                      <span className="block text-xs font-semibold text-muted">
                        {day.newCustomersByLocation[index] == null
                          ? "New —"
                          : `${number(day.newCustomersByLocation[index])} new`}
                      </span>
                    </span>
                  </p>
                ))}
                {isCombinedScope(scope) && day.grossByLocation.every((value) => value != null) ? (
                  <p className="flex items-center justify-between text-sm font-semibold text-muted">
                    <span>Combined</span>
                    <span className="text-right">
                      <span className="tabular">
                        {moneyExact(day.grossByLocation.reduce<number>((sum, value) => sum + (value ?? 0), 0))}
                      </span>
                      <span className="block text-xs">
                        {combinedFrom(day.newCustomersByLocation) == null
                          ? "New —"
                          : `${number(combinedFrom(day.newCustomersByLocation) ?? 0)} new`}
                      </span>
                    </span>
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>

        <WeekCompare view={view} scope={scope} />

        <Card>
          <h2 className="text-base font-extrabold">History</h2>
          <p className="text-xs text-muted">Phoenix days, newest first</p>
          {view.history.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Nothing imported in the last 120 days.</p>
          ) : (
            <ul className="mt-3 max-h-96 space-y-2 overflow-y-auto pr-1">
              {view.history.map((day) => (
                <li key={day.date} className="rounded-2xl bg-paper px-3 py-2">
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
  const showCombined = isCombinedScope(scope) && view.featured.every((day) => day != null);
  return (
    <>
      {showCombined ? (
        <Card className="border-ink bg-chile text-ink">
          <div className="flex items-center justify-between">
            <CombinedBadge />
            {view.sampleOnFeatured ? <SampleBadge /> : null}
          </div>
          <p className="font-display mt-2 text-5xl font-black tabular leading-none">{moneyExact(combinedGross)}</p>
          <p className="mt-1 text-sm font-semibold">Combined total (Glendale + Avondale)</p>
          <CustomerStrip
            tone="yellow"
            newCustomers={combinedCount(view.featured, (day) => day.newCustomers)}
            returningCustomers={combinedCount(view.featured, (day) => day.returningCustomers)}
            identifiedCustomers={combinedCount(view.featured, (day) => day.identifiedCustomers)}
          />
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
      <p className="font-display mt-2 text-5xl font-black tabular leading-none">{moneyExact(day.grossSales)}</p>
      <p className="mt-1 text-base text-muted">
        Net {moneyExact(day.netSales)} · {number(day.orderCount)} orders · avg {moneyExact(day.averageTicket)}
      </p>
      <CustomerStrip
        newCustomers={day.newCustomers}
        returningCustomers={day.returningCustomers}
        identifiedCustomers={day.identifiedCustomers}
      />
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

function CustomerStrip({
  newCustomers,
  returningCustomers,
  identifiedCustomers,
  tone = "paper",
}: {
  newCustomers: number | null;
  returningCustomers: number | null;
  identifiedCustomers: number | null;
  tone?: "paper" | "yellow";
}) {
  const cell = tone === "yellow" ? "bg-ink text-chile" : "bg-paper text-ink";
  const label = tone === "yellow" ? "text-chile/70" : "text-muted";
  return (
    <dl className="mt-3 grid grid-cols-3 gap-2">
      <CountCell label="New" value={newCustomers} cell={cell} labelClass={label} />
      <CountCell label="Returning" value={returningCustomers} cell={cell} labelClass={label} />
      <CountCell label="Identified" value={identifiedCustomers} cell={cell} labelClass={label} />
    </dl>
  );
}

function CountCell({
  label,
  value,
  cell,
  labelClass,
}: {
  label: string;
  value: number | null;
  cell: string;
  labelClass: string;
}) {
  return (
    <div className={`rounded-2xl px-2 py-2 ${cell}`}>
      <dt className={`text-[10px] font-bold uppercase tracking-wide ${labelClass}`}>{label}</dt>
      <dd className="font-display mt-1 text-[1.65rem] font-black tabular leading-none">{countOrDash(value)}</dd>
    </div>
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
  const news = combined ? combinedCount(days, (day) => day.newCustomers) : null;
  return (
    <div className="mt-1">
      {days.map((day, index) => (
        <p key={ids[index]} className="flex items-center justify-between gap-3 py-1 text-base">
          <span className="inline-flex items-center gap-2">
            <LocationDot id={ids[index]} />
            {day?.sample ? <SampleBadge /> : null}
          </span>
          <span className="text-right">
            <span className="tabular font-semibold">{day ? moneyExact(day.grossSales) : "—"}</span>
            <span className="block text-xs font-semibold text-muted">
              {day?.newCustomers == null ? "New —" : `${number(day.newCustomers)} new`}
            </span>
          </span>
        </p>
      ))}
      {combined && days.every((day) => day != null) ? (
        <p className="flex items-center justify-between text-sm font-semibold text-muted">
          <span>Combined</span>
          <span className="text-right">
            <span className="tabular">{moneyExact(gross)}</span>
            <span className="block text-xs">{news == null ? "New —" : `${number(news)} new`}</span>
          </span>
        </p>
      ) : null}
    </div>
  );
}

function TrendChart({
  title,
  days,
  ids,
  values,
  format,
  emptyLabel,
}: {
  title: string;
  days: string[];
  ids: LocationId[];
  values: Array<Array<number | null>>;
  format: (value: number) => string;
  emptyLabel?: string;
}) {
  const flat = values.flat();
  const allEmpty = flat.every((value) => value == null);
  const max = Math.max(1, ...flat.map((value) => value ?? 0));
  return (
    <div className="mt-4">
      <div className="flex items-end justify-between gap-3">
        <h3 className="text-sm font-extrabold">{title}</h3>
        <div className="flex gap-2 text-[10px] font-bold uppercase tracking-wide text-muted">
          {ids.map((id) => (
            <span key={id} className="inline-flex items-center gap-1">
              <span
                className={`h-2.5 w-2.5 rounded-full ${id === "avondale" ? "bg-chile ring-1 ring-ink" : "bg-ink"}`}
                aria-hidden
              />
              {id === "avondale" ? "Avondale" : "Glendale"}
            </span>
          ))}
        </div>
      </div>
      {allEmpty ? (
        <p className="mt-3 text-sm text-muted">{emptyLabel ?? "—"}</p>
      ) : (
        <div className="mt-3 flex h-32 items-end gap-1.5" role="img" aria-label={title}>
          {days.map((date, dayIndex) => (
            <div key={date} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end">
              <div className="flex h-full w-full items-end justify-center gap-0.5">
                {ids.map((id, index) => {
                  const value = values[dayIndex]?.[index] ?? null;
                  const height = value == null ? 0 : Math.max(8, (value / max) * 100);
                  return (
                    <div
                      key={id}
                      title={value == null ? `${labelFor(id)} · no data` : `${labelFor(id)} · ${format(value)}`}
                      className={`w-full max-w-3 rounded-t-lg ${
                        value == null
                          ? "h-1 bg-line"
                          : id === "avondale"
                            ? "bg-chile ring-1 ring-inset ring-ink/25"
                            : "bg-ink"
                      }`}
                      style={value == null ? undefined : { height: `${height}%` }}
                    />
                  );
                })}
              </div>
              <span className="mt-1 text-[10px] font-bold text-muted">{formatShortDate(date).split(",")[0]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WeekCompare({ view, scope }: { view: SalesView; scope: LocationScope }) {
  return (
    <Card>
      <h2 className="text-base font-extrabold">This week vs last week</h2>
      <p className="text-xs text-muted">
        {formatShortDate(view.weekToDate.start)} – {formatShortDate(view.weekToDate.end)} vs{" "}
        {formatShortDate(view.lastWeek.start)} – {formatShortDate(view.lastWeek.end)}
      </p>
      <ul className="mt-3 space-y-3">
        {view.weekToDate.byLocation.map((current, index) => {
          const previous = view.lastWeek.byLocation[index];
          const change = grossChange(current.gross, previous?.gross ?? 0);
          return (
            <li key={current.locationId} className="rounded-2xl bg-paper px-3 py-3">
              <LocationDot id={current.locationId} />
              <p className="font-display mt-1 text-4xl font-black tabular leading-none">{moneyExact(current.gross)}</p>
              <p className="mt-1 text-sm text-muted">
                Week to date · {number(current.orders)} orders · {current.days} imported{" "}
                {current.days === 1 ? "day" : "days"}
              </p>
              <p className="mt-2 text-base font-extrabold">New customers {countOrDash(current.newCustomers)}</p>
              <p className="text-sm text-muted">
                Returning {countOrDash(current.returningCustomers)} · Identified{" "}
                {countOrDash(current.identifiedCustomers)}
              </p>
              <p className="mt-1 text-sm text-muted">
                Last week {moneyExact(previous?.gross ?? 0)}
                {change == null ? "" : ` · ${change >= 0 ? "+" : ""}${pct(change, 0)}`}
                {" · "}
                {countOrDash(previous?.newCustomers)} new
              </p>
            </li>
          );
        })}
        {isCombinedScope(scope) && view.weekToDate.combined && view.lastWeek.combined ? (
          <li className="rounded-2xl border border-ink bg-chile px-3 py-3 text-ink">
            <CombinedBadge />
            <p className="font-display mt-1 text-4xl font-black tabular leading-none">
              {moneyExact(view.weekToDate.combined.gross)}
            </p>
            <p className="mt-1 text-sm font-semibold">{view.weekToDate.combined.label}</p>
            <p className="mt-2 text-base font-extrabold">
              New customers {countOrDash(view.weekToDate.combined.newCustomers)}
            </p>
            <p className="text-sm font-semibold text-ink/70">
              Last week {moneyExact(view.lastWeek.combined.gross)} · {countOrDash(view.lastWeek.combined.newCustomers)}{" "}
              new
            </p>
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

function combinedCount(days: Array<LocationDay | null>, pick: (day: LocationDay) => number | null): number | null {
  const values = days.map((day) => (day ? pick(day) : null));
  if (values.some((value) => value == null)) return null;
  return values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
}

function combinedFrom(values: Array<number | null>): number | null {
  if (values.some((value) => value == null)) return null;
  return values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
}

function labelFor(id: LocationId): string {
  return id === "avondale" ? "Avondale" : "Glendale";
}
