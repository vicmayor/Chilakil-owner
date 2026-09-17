import { prisma } from "@/lib/db";
import { getLocationScope } from "@/lib/scope";
import { locationIdsForScope } from "@/lib/location";
import { phoenixToday, shiftIsoDate } from "@/lib/dates";
import { TopBar } from "@/components/top-bar";
import { MarketingHub } from "@/components/marketing-hub";
import {
  PAID_AD_PLATFORMS,
  buildPaidAdsBundle,
  campaignsForPlatform,
  campaignsForScope,
  isPaidAdPlatform,
  type PaidAdPlatform,
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
    prisma.adDailyStats.findMany({
      where: { date: { in: dates } },
    }),
    prisma.integrationConfig.findMany({
      where: { locationId: { in: ids }, provider: { in: [...PAID_AD_PLATFORMS] } },
    }),
  ]);

  const scoped = campaignsForScope(campaigns, scope);
  const otherCampaigns = scoped.filter((c) => !isPaidAdPlatform(c.platform));
  const otherSpend = otherCampaigns
    .filter((c) => c.locationId !== null)
    .reduce((s, c) => s + c.spend, 0);

  const bundles = Object.fromEntries(
    PAID_AD_PLATFORMS.map((platform) => [
      platform,
      buildPaidAdsBundle(campaignsForPlatform(scoped, platform), dailyStats, ids, today),
    ]),
  ) as Record<PaidAdPlatform, ReturnType<typeof buildPaidAdsBundle>>;

  return (
    <>
      <TopBar
        title="Marketing"
        subtitle="Ad spend stays on the location that bought it"
        scope={scope}
      />
      <main className="px-4 py-4">
        <MarketingHub
          scope={scope}
          ids={ids}
          today={today}
          periodLabel="5 days"
          bundles={bundles}
          secretRefs={integrations.map((i) => ({
            locationId: i.locationId,
            provider: i.provider,
            secretRef: i.secretRef,
            storeRef: i.storeRef,
            status: i.status,
          }))}
          otherCampaigns={otherCampaigns}
          otherSpend={otherSpend}
        />
      </main>
    </>
  );
}
