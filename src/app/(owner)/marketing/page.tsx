import { prisma } from "@/lib/db";
import { getLocationScope } from "@/lib/scope";
import { locationIdsForScope, isCombinedScope } from "@/lib/location";
import { formatShortDate } from "@/lib/dates";
import { moneyExact, number, platformLabel } from "@/lib/format";
import { TopBar } from "@/components/top-bar";
import { Card, CombinedBadge, LocationDot } from "@/components/ui";

export const metadata = { title: "Marketing" };

export default async function MarketingPage() {
  const scope = await getLocationScope();
  const ids = locationIdsForScope(scope);
  const campaigns = await prisma.marketingCampaign.findMany({
    where: {
      OR: [{ locationId: { in: ids } }, { locationId: null }],
    },
    orderBy: { startDate: "desc" },
  });

  const scoped = campaigns.filter((c) => {
    if (c.locationId === null) return true;
    return ids.includes(c.locationId as "glendale" | "avondale");
  });
  const spend = scoped
    .filter((c) => c.locationId !== null)
    .reduce((s, c) => s + c.spend, 0);

  return (
    <>
      <TopBar title="Marketing" subtitle="Spend stays on the location that bought it" scope={scope} />
      <main className="space-y-4 px-4 py-4">
        <Card>
          {isCombinedScope(scope) ? <CombinedBadge /> : <LocationDot id={ids[0]} />}
          <p className="font-display mt-2 text-3xl font-semibold tabular">{moneyExact(spend)}</p>
          <p className="text-sm text-muted">Location-assigned spend in this list (brand drafts = $0)</p>
        </Card>
        {scoped.map((c) => (
          <Card key={c.id}>
            <div className="flex items-center justify-between gap-2">
              {c.locationId ? (
                <LocationDot id={c.locationId} />
              ) : (
                <span className="text-xs font-bold uppercase tracking-wide text-muted">Brand — no location spend</span>
              )}
              <span className="text-[11px] font-bold uppercase text-muted">{c.status}</span>
            </div>
            <p className="mt-1 font-semibold">{c.name}</p>
            <p className="text-sm text-muted">
              {platformLabel(c.channel)} · {formatShortDate(c.startDate)}
              {c.endDate ? ` – ${formatShortDate(c.endDate)}` : ""}
            </p>
            <p className="mt-2 tabular text-sm">
              Spend {moneyExact(c.spend)}
              {c.impressions != null ? ` · ${number(c.impressions)} impr` : ""}
              {c.clicks != null ? ` · ${number(c.clicks)} taps` : ""}
            </p>
            {c.notes ? <p className="mt-2 text-sm leading-5 text-muted">{c.notes}</p> : null}
          </Card>
        ))}
      </main>
    </>
  );
}
