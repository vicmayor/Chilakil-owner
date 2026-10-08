import { prisma } from "@/lib/db";
import { getLocationScope } from "@/lib/scope";
import { locationIdsForScope, isCombinedScope } from "@/lib/location";
import { formatShortDate } from "@/lib/dates";
import { moneyExact, number, platformLabel } from "@/lib/format";
import { RecordCard } from "@/components/design/record-card";
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
      <main className="grid gap-4 px-4 py-4 md:grid-cols-2 md:px-6">
        <Card className="md:col-span-2">
          {isCombinedScope(scope) ? <CombinedBadge /> : <LocationDot id={ids[0]} />}
          <p className="font-display mt-2 text-3xl font-extrabold tabular">{moneyExact(spend)}</p>
          <p className="text-sm text-muted">Location-assigned spend in this list (brand drafts = $0)</p>
        </Card>
        {scoped.map((c) => (
          <RecordCard
            key={c.id}
            title={c.name}
            status={c.status}
            statusTone={c.status === "active" ? "ok" : "muted"}
            kicker={
              c.locationId ? (
                <LocationDot id={c.locationId} />
              ) : (
                <span>Brand — no location spend</span>
              )
            }
            fields={[
              { label: "Channel", value: platformLabel(c.channel) },
              {
                label: "Dates",
                value: `${formatShortDate(c.startDate)}${c.endDate ? ` – ${formatShortDate(c.endDate)}` : ""}`,
              },
              { label: "Spend", value: moneyExact(c.spend) },
              {
                label: "Reach",
                value: `${c.impressions != null ? number(c.impressions) : "—"} impr · ${c.clicks != null ? number(c.clicks) : "—"} taps`,
              },
            ]}
          >
            {c.notes ? <p className="text-sm leading-5 text-muted">{c.notes}</p> : null}
          </RecordCard>
        ))}
      </main>
    </>
  );
}
