import { prisma } from "@/lib/db";
import { UBEREATS_STORE_IDS } from "@/lib/ubereats-stores";
import {
  combineWeek,
  effectiveCommissionPct,
  latestSharedWeek,
  previousWeeks,
  reportsForLocations,
  type UberEatsWeek,
} from "@/lib/ubereats-weekly";
import { formatPhoenixDateTime, formatShortDate } from "@/lib/dates";
import { moneyExact, number, pct } from "@/lib/format";
import { isCombinedScope, locationIdsForScope, type LocationId } from "@/lib/location";
import { getLocationScope } from "@/lib/scope";
import { Card, CombinedBadge, LocationDot, SampleBadge } from "@/components/ui";

export async function UberEatsWeeklySection() {
  const scope = await getLocationScope();
  const ids = locationIdsForScope(scope);
  const rows = reportsForLocations(
    (
      await prisma.uberEatsWeeklyReport.findMany({
        where: { locationId: { in: ids } },
        orderBy: { weekStart: "desc" },
        take: 80,
      })
    ).map(toReport),
    ids,
  );
  const latest = latestSharedWeek(rows);
  const latestRows = latest ? rows.filter((row) => row.weekStart === latest) : [];
  const combined = isCombinedScope(scope) ? combineWeek(latestRows) : null;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Weekly reports</h2>
        {rows.some((row) => row.source === "sample") ? <SampleBadge /> : null}
      </div>
      {rows.length === 0 ? (
        <Card>
          <p className="text-base font-medium">No weekly Uber Eats reports yet.</p>
          <p className="mt-1 text-sm text-muted">
            Glendale store {UBEREATS_STORE_IDS.glendale}. Avondale store {UBEREATS_STORE_IDS.avondale}. Uber may
            label the Avondale store Phoenix. Import keeps each store on its own row.
          </p>
        </Card>
      ) : (
        <>
          {latestRows.map((row) => (
            <WeekCard key={row.locationId} row={row} />
          ))}
          {ids
            .filter((id) => !latestRows.some((row) => row.locationId === id))
            .map((id) => (
              <Card key={id}>
                <LocationDot id={id} />
                <p className="mt-2 text-sm text-muted">
                  No report for the week of {latest ? formatShortDate(latest) : "—"}. Store{" "}
                  {UBEREATS_STORE_IDS[id]}.
                </p>
              </Card>
            ))}
          {combined ? (
            <Card>
              <CombinedBadge />
              <p className="font-display mt-2 text-4xl font-extrabold tabular">{moneyExact(combined.netPayout)}</p>
              <p className="text-sm text-muted">{combined.label} · net payout</p>
              <p className="mt-1 text-base font-semibold">
                Effective commission {pct(combined.effectiveCommissionPct)}
              </p>
              <p className="text-sm text-muted">
                {moneyExact(combined.commission)} commission on {moneyExact(combined.subtotal)} subtotal ·{" "}
                {number(combined.orderCount)} orders
              </p>
              <p className="text-sm text-muted">
                Tax {moneyExact(combined.tax)} · Marketing {moneyExact(combined.marketingFees)} · Promo{" "}
                {moneyExact(combined.promoFees)} · Adjustments {moneyExact(combined.adjustments)}
                {combined.errorCharges == null ? "" : ` · Error charges ${moneyExact(combined.errorCharges)}`}
              </p>
              <p className="text-sm text-muted">
                Delivery {number(combined.deliveryOrders)} · Pickup {number(combined.pickupOrders)}
              </p>
              {combined.locationsIncluded.length < ids.length ? (
                <p className="mt-2 text-xs text-muted">
                  Combined total includes only locations that have this week.
                </p>
              ) : null}
            </Card>
          ) : null}
          {ids.map((id) => (
            <Trend key={id} rows={previousWeeks(rows, id, latest)} locationId={id} />
          ))}
        </>
      )}
    </section>
  );
}

function WeekCard({ row }: { row: UberEatsWeek }) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <LocationDot id={row.locationId} />
        {row.source === "sample" ? <SampleBadge /> : null}
      </div>
      <p className="mt-1 text-xs text-muted">
        Store {row.uberStoreId} · {formatShortDate(row.weekStart)} – {formatShortDate(row.weekEnd)}
      </p>
      <p className="font-display mt-2 text-4xl font-extrabold tabular">{moneyExact(row.netPayout)}</p>
      <p className="text-sm text-muted">Net payout</p>
      <p className="mt-2 text-2xl font-semibold tabular">{pct(row.effectiveCommissionPct)}</p>
      <p className="text-sm text-muted">Effective commission</p>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-base">
        <Mini label="Subtotal" value={moneyExact(row.subtotal)} />
        <Mini label="Tax" value={moneyExact(row.tax)} />
        <Mini label="Gross" value={moneyExact(row.gross)} />
        <Mini label="Orders" value={number(row.orderCount)} />
        <Mini label="Commission" value={moneyExact(row.commission)} />
        <Mini label="Marketing" value={moneyExact(row.marketingFees)} />
        <Mini label="Promo fees" value={moneyExact(row.promoFees)} />
        <Mini label="Adjustments" value={moneyExact(row.adjustments)} />
        <Mini label="Error charges" value={row.errorCharges == null ? "—" : moneyExact(row.errorCharges)} />
      </dl>
      <p className="mt-3 text-sm text-muted">
        Delivery {number(row.deliveryOrders)} · Pickup {number(row.pickupOrders)}
      </p>
      <p className="mt-2 text-xs text-muted">
        Last updated {formatPhoenixDateTime(new Date(row.importedAt))}
      </p>
    </Card>
  );
}

function Trend({ rows, locationId }: { rows: UberEatsWeek[]; locationId: LocationId }) {
  if (rows.length === 0) return null;
  return (
    <Card>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Previous weeks</h3>
        <LocationDot id={locationId} />
      </div>
      <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto">
        {rows.map((row) => (
          <li key={row.weekStart} className="rounded-xl bg-paper-2 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-muted">
                {formatShortDate(row.weekStart)} – {formatShortDate(row.weekEnd)}
              </p>
              {row.source === "sample" ? <SampleBadge /> : null}
            </div>
            <p className="flex items-end justify-between gap-3">
              <span className="tabular text-xl font-semibold">{pct(row.effectiveCommissionPct)}</span>
              <span className="text-right text-sm">
                <span className="tabular block font-semibold">{moneyExact(row.netPayout)}</span>
                <span className="text-muted">{number(row.orderCount)} orders</span>
              </span>
            </p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="tabular font-semibold">{value}</dd>
    </div>
  );
}

function toReport(row: {
  locationId: string;
  uberStoreId: string;
  weekStart: string;
  weekEnd: string;
  subtotal: number;
  tax: number;
  gross: number;
  orderCount: number;
  deliveryOrders: number;
  pickupOrders: number;
  commission: number;
  marketingFees: number;
  promoFees: number;
  adjustments: number;
  errorCharges: number | null;
  netPayout: number;
  source: string;
  importedAt: Date;
}): UberEatsWeek {
  return {
    locationId: row.locationId as LocationId,
    uberStoreId: row.uberStoreId,
    weekStart: row.weekStart,
    weekEnd: row.weekEnd,
    subtotal: row.subtotal,
    tax: row.tax,
    gross: row.gross,
    orderCount: row.orderCount,
    deliveryOrders: row.deliveryOrders,
    pickupOrders: row.pickupOrders,
    commission: row.commission,
    marketingFees: row.marketingFees,
    promoFees: row.promoFees,
    adjustments: row.adjustments,
    errorCharges: row.errorCharges,
    netPayout: row.netPayout,
    effectiveCommissionPct: effectiveCommissionPct(row.commission, row.subtotal),
    source: row.source,
    importedAt: row.importedAt.toISOString(),
  };
}
