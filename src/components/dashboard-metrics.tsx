import { CombinedBadge, LocationDot, SampleBadge } from "@/components/ui";
import { EmptyState } from "@/components/design/empty-state";
import { money, moneyExact, number, pct } from "@/lib/format";
import type { DashboardData, LocationMetrics } from "@/lib/metrics";
import { isCombinedScope } from "@/lib/location";

function Block({ m, combined = false }: { m: LocationMetrics; combined?: boolean }) {
  const laborTone = m.laborPct > m.targetLaborPct ? "text-warn" : "text-sage";
  const foodTone = m.foodCostPct > m.targetFoodCostPct ? "text-warn" : "text-sage";
  return (
    <article className="overflow-hidden rounded-[1.75rem] border border-line bg-card shadow-[0_16px_40px_-28px_rgba(17,17,17,0.55)]">
      <div className="bg-chile px-4 py-4 text-ink">
        <div className="flex items-center justify-between gap-2">
          {combined ? <CombinedBadge /> : <LocationDot id={m.locationId} />}
          {m.sample ? <SampleBadge /> : null}
        </div>
        <p className="mt-3 text-[11px] font-bold uppercase tracking-wide">Gross sales</p>
        <p className="font-display mt-1 text-5xl font-black tabular leading-none">{money(m.gross)}</p>
        <p className="mt-1 text-xs font-semibold text-ink/70">
          {moneyExact(m.gross)} · {m.name}
        </p>
      </div>
      <dl className="grid grid-cols-2">
        <Cell
          label="Delivery sales"
          value={m.deliveryGross == null ? "—" : money(m.deliveryGross)}
          hint={m.channelsKnown ? undefined : "Channel split not imported"}
        />
        <Cell
          label="Est. net after fees"
          value={money(m.net)}
          hint={`${moneyExact(m.fees)} commissions/fees`}
        />
        <Cell
          label="Labor"
          value={money(m.labor)}
          hint={`${pct(m.laborPct)} of gross · target ${pct(m.targetLaborPct)}`}
          valueClass={laborTone}
        />
        <Cell
          label="Est. food cost"
          value={money(m.foodCost)}
          hint={`${pct(m.foodCostPct)} theoretical · target ${pct(m.targetFoodCostPct)}`}
          valueClass={foodTone}
        />
        <Cell label="Orders" value={number(m.orderCount)} />
        <Cell label="Average ticket" value={moneyExact(m.averageTicket)} />
      </dl>
    </article>
  );
}

function Cell({
  label,
  value,
  hint,
  valueClass = "text-ink",
}: {
  label: string;
  value: string;
  hint?: string;
  valueClass?: string;
}) {
  return (
    <div className="border-t border-line px-4 py-3 odd:border-r">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className={`font-display tabular mt-1 text-[1.55rem] font-extrabold leading-none ${valueClass}`}>{value}</dd>
      {hint ? <p className="mt-1 text-xs leading-4 text-muted">{hint}</p> : null}
    </div>
  );
}

export function DashboardMetrics({ data }: { data: DashboardData }) {
  if (isCombinedScope(data.scope) && data.combined) {
    return (
      <div className="space-y-3">
        {data.sample ? <SampleBadge /> : null}
        <Block m={data.combined} combined />
        <div className="grid gap-3 md:grid-cols-2">
          {data.locations.map((m) => (
            <Block key={m.locationId} m={m} />
          ))}
        </div>
      </div>
    );
  }

  const m = data.locations[0];
  if (!m) {
    return <EmptyState title="No sales for this date." body="This location has no imported day yet." />;
  }
  return (
    <div className="space-y-3">
      {data.sample ? <SampleBadge /> : null}
      <Block m={m} />
    </div>
  );
}
