import { prisma } from "@/lib/db";
import { getLocationScope } from "@/lib/scope";
import { locationIdsForScope, isCombinedScope } from "@/lib/location";
import { phoenixToday, formatShortDate, shiftIsoDate } from "@/lib/dates";
import { moneyExact, number, platformLabel } from "@/lib/format";
import { TopBar } from "@/components/top-bar";
import { Card, CombinedBadge, LocationDot } from "@/components/ui";
import { MetaAdsSection, type MetaCampaignView } from "@/components/meta-ads-section";
import {
  META_PLATFORM,
  businessWideCampaigns,
  campaignsForScope,
  emptyMetaTotals,
  storeCampaigns,
  sumDailyStats,
} from "@/lib/marketing";

export const metadata = { title: "Marketing" };

export default async function MarketingPage() {
  const scope = await getLocationScope();
  const ids = locationIdsForScope(scope);
  const today = phoenixToday();
  const dates = [0, -1, -2, -3, -4].map((d) => shiftIsoDate(today, d));

  const [campaigns, dailyStats, integrations] = await Promise.all([
    prisma.marketingCampaign.findMany({
      orderBy: [{ status: "asc" }, { startDate: "desc" }],
    }),
    prisma.metaAdDailyStats.findMany({
      where: { date: { in: dates } },
    }),
    prisma.integrationConfig.findMany({
      where: { locationId: { in: ids }, provider: "meta" },
    }),
  ]);

  const scoped = campaignsForScope(campaigns, scope);
  const metaCampaigns = scoped.filter((c) => c.platform === META_PLATFORM);
  const otherCampaigns = scoped.filter((c) => c.platform !== META_PLATFORM);

  const metaIds = new Set(metaCampaigns.map((c) => c.id));
  const storeIds = new Set(storeCampaigns(metaCampaigns).map((c) => c.id));
  const brandIds = new Set(businessWideCampaigns(metaCampaigns).map((c) => c.id));

  const inWindow = dailyStats.filter((row) => metaIds.has(row.campaignId));
  const storeToday = sumDailyStats(
    dailyStats.filter((row) => storeIds.has(row.campaignId) && row.date === today),
  );
  const storePeriod = sumDailyStats(dailyStats.filter((row) => storeIds.has(row.campaignId)));
  const businessToday = sumDailyStats(
    dailyStats.filter((row) => brandIds.has(row.campaignId) && row.date === today),
  );
  const businessPeriod = sumDailyStats(dailyStats.filter((row) => brandIds.has(row.campaignId)));

  const byLocationToday = ids.map((id) => {
    const locIds = new Set(metaCampaigns.filter((c) => c.locationId === id).map((c) => c.id));
    return {
      id,
      totals: sumDailyStats(
        dailyStats.filter((row) => locIds.has(row.campaignId) && row.date === today),
      ),
      period: sumDailyStats(dailyStats.filter((row) => locIds.has(row.campaignId))),
    };
  });

  const campaignViews: MetaCampaignView[] = metaCampaigns
    .map((campaign) => {
      const rows = inWindow.filter((row) => row.campaignId === campaign.id);
      const todayRows = rows.filter((row) => row.date === today);
      return {
        id: campaign.id,
        locationId: campaign.locationId,
        name: campaign.name,
        channel: campaign.channel,
        status: campaign.status,
        startDate: campaign.startDate,
        endDate: campaign.endDate,
        resultType: campaign.resultType,
        notes: campaign.notes,
        today: todayRows.length ? sumDailyStats(todayRows) : emptyMetaTotals(),
        period: rows.length ? sumDailyStats(rows) : emptyMetaTotals(),
      };
    })
    .sort((a, b) => {
      if (a.locationId === b.locationId) return b.today.spend - a.today.spend;
      if (a.locationId == null) return 1;
      if (b.locationId == null) return -1;
      return a.locationId.localeCompare(b.locationId);
    });

  const otherSpend = otherCampaigns
    .filter((c) => c.locationId !== null)
    .reduce((s, c) => s + c.spend, 0);

  return (
    <>
      <TopBar
        title="Marketing"
        subtitle="Meta spend stays on the location that bought it"
        scope={scope}
      />
      <main className="space-y-6 px-4 py-4">
        <MetaAdsSection
          scope={scope}
          ids={ids}
          today={today}
          periodLabel="5 days"
          storeToday={storeToday}
          storePeriod={storePeriod}
          businessToday={businessToday}
          businessPeriod={businessPeriod}
          byLocationToday={byLocationToday}
          campaigns={campaignViews}
          secretRefs={integrations.map((i) => ({
            locationId: i.locationId,
            secretRef: i.secretRef,
            storeRef: i.storeRef,
            status: i.status,
          }))}
        />

        {otherCampaigns.length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold">Other channels</h2>
            <Card>
              {isCombinedScope(scope) ? <CombinedBadge /> : <LocationDot id={ids[0]} />}
              <p className="font-display mt-2 text-3xl font-semibold tabular">
                {moneyExact(otherSpend)}
              </p>
              <p className="text-sm text-muted">Location-assigned non-Meta spend in this list</p>
            </Card>
            {otherCampaigns.map((c) => (
              <Card key={c.id}>
                <div className="flex items-center justify-between gap-2">
                  {c.locationId ? (
                    <LocationDot id={c.locationId} />
                  ) : (
                    <span className="text-xs font-bold uppercase tracking-wide text-muted">
                      Brand — no location spend
                    </span>
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
          </section>
        ) : null}
      </main>
    </>
  );
}
