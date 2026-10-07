import { CombinedBadge, LocationDot, Metric, SampleBadge } from "@/components/ui";
import { money, moneyExact, number, pct } from "@/lib/format";
import type { DashboardData, LocationMetrics } from "@/lib/metrics";
import { isCombinedScope } from "@/lib/location";
import { formatPhoenixDateTime } from "@/lib/dates";

function Block({ m, combined = false }: { m: LocationMetrics; combined?: boolean }) {
  const laborTone = m.laborPct > m.targetLaborPct ? "warn" : "good";
  const foodTone = m.foodCostPct > m.targetFoodCostPct ? "warn" : "good";
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        {combined ? <CombinedBadge /> : <LocationDot id={m.locationId} />}
        {m.sample ? <SampleBadge /> : null}
      </div>
      <p className="text-xs text-muted">{m.name}</p>
      <Metric label="Gross sales" value={money(m.gross)} hint={moneyExact(m.gross)} />
      <div className="grid grid-cols-2 gap-4">
        <Metric
          label="Delivery sales"
          value={m.deliveryGross == null ? "—" : money(m.deliveryGross)}
          hint={m.channelsKnown ? undefined : "Channel split not imported"}
        />
        <Metric
          label="Est. net after fees"
          value={money(m.net)}
          hint={`${moneyExact(m.fees)} commissions/fees`}
        />
        <Metric
          label="Labor"
          value={money(m.labor)}
          hint={`${pct(m.laborPct)} of gross · target ${pct(m.targetLaborPct)}`}
          tone={laborTone}
        />
        <Metric
          label="Est. food cost"
          value={money(m.foodCost)}
          hint={`${pct(m.foodCostPct)} theoretical · target ${pct(m.targetFoodCostPct)}`}
          tone={foodTone}
        />
        <Metric label="Orders" value={number(m.orderCount)} />
        <Metric label="Average ticket" value={moneyExact(m.averageTicket)} />
      </div>
    </div>
  );
}

export function DashboardMetrics({ data }: { data: DashboardData }) {
  const stamp = (
    <div className="flex flex-wrap items-center justify-between gap-2 px-1">
      {data.sample ? <SampleBadge /> : null}
      <p className="text-sm text-muted">
        {data.updatedAt
          ? `Last updated ${formatPhoenixDateTime(new Date(data.updatedAt))}`
          : "No daily sales import for this date"}
      </p>
    </div>
  );

  if (isCombinedScope(data.scope) && data.combined) {
    return (
      <div className="space-y-3">
        {stamp}
        <div className="rounded-2xl border border-chile bg-card p-4">
          <Block m={data.combined} combined />
        </div>
        {data.locations.map((m) => (
          <div key={m.locationId} className="rounded-2xl border border-line bg-card p-4">
            <Block m={m} />
          </div>
        ))}
      </div>
    );
  }

  const m = data.locations[0];
  if (!m) return <p className="text-sm text-muted">No sales for this date.</p>;
  return (
    <div className="space-y-3">
      {stamp}
      <div className="rounded-2xl border border-line bg-card p-4">
        <Block m={m} />
      </div>
    </div>
  );
}
