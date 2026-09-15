import { CombinedBadge, LocationDot, Metric } from "@/components/ui";
import { money, moneyExact, number, pct } from "@/lib/format";
import type { DashboardData, LocationMetrics } from "@/lib/metrics";
import { isCombinedScope } from "@/lib/location";

function Block({ m, combined = false }: { m: LocationMetrics; combined?: boolean }) {
  const laborTone = m.laborPct > m.targetLaborPct ? "warn" : "good";
  const foodTone = m.foodCostPct > m.targetFoodCostPct ? "warn" : "good";
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        {combined ? <CombinedBadge /> : <LocationDot id={m.locationId} />}
        <p className="text-xs text-muted">{combined ? m.name : m.name}</p>
      </div>
      <Metric label="Gross sales" value={money(m.gross)} hint={moneyExact(m.gross)} />
      <div className="grid grid-cols-2 gap-4">
        <Metric label="Delivery sales" value={money(m.deliveryGross)} />
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
  if (isCombinedScope(data.scope) && data.combined) {
    return (
      <div className="space-y-3">
        <div className="rounded-2xl border border-chile/20 bg-card p-4">
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
    <div className="rounded-2xl border border-line bg-card p-4">
      <Block m={m} />
    </div>
  );
}
