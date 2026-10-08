import { CombinedBadge, LocationDot, Metric, SampleBadge } from "@/components/ui";
import { money, moneyExact, number, pct } from "@/lib/format";
import type { DashboardData, LocationMetrics } from "@/lib/metrics";
import { isCombinedScope } from "@/lib/location";

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
  const sample = data.sample ? <SampleBadge /> : null;

  if (isCombinedScope(data.scope) && data.combined) {
    return (
      <div className="space-y-3">
        {sample}
        <div className="rounded-3xl border border-ink bg-card p-4 md:col-span-2">
          <Block m={data.combined} combined />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {data.locations.map((m) => (
            <div key={m.locationId} className="rounded-3xl border border-line bg-card p-4">
              <Block m={m} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const m = data.locations[0];
  if (!m) return <p className="text-sm text-muted">No sales for this date.</p>;
  return (
    <div className="space-y-3">
      {sample}
      <div className="rounded-3xl border border-line bg-card p-4">
        <Block m={m} />
      </div>
    </div>
  );
}
