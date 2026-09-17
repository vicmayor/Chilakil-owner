import {
  BUSINESS_WIDE_LABEL,
  isCombinedScope,
  locationIdsForScope,
  type LocationId,
  type LocationScope,
} from "@/lib/location";

export const META_PLATFORM = "meta";
export const GOOGLE_ADS_PLATFORM = "google";
export const TIKTOK_PLATFORM = "tiktok";

export const PAID_AD_PLATFORMS = [META_PLATFORM, GOOGLE_ADS_PLATFORM, TIKTOK_PLATFORM] as const;
export type PaidAdPlatform = (typeof PAID_AD_PLATFORMS)[number];

export type AdTotals = {
  spend: number;
  reach: number;
  impressions: number;
  clicks: number;
  results: number;
};

/** @deprecated Use AdTotals — kept so existing Meta helpers stay readable. */
export type MetaTotals = AdTotals;

export type ScopedCampaign = {
  locationId: string | null;
};

export type DailyStatLike = {
  campaignId: string;
  date: string;
  spend: number;
  reach: number;
  impressions: number;
  clicks: number;
  results: number;
};

export type PaidCampaignLike = ScopedCampaign & {
  id: string;
  name: string;
  channel: string;
  platform?: string;
  status: string;
  startDate: string;
  endDate: string | null;
  resultType: string | null;
  notes: string | null;
};

export type PaidCampaignView = {
  id: string;
  locationId: string | null;
  name: string;
  channel: string;
  status: string;
  startDate: string;
  endDate: string | null;
  resultType: string | null;
  notes: string | null;
  today: AdTotals;
  period: AdTotals;
};

export type PaidAdsBundle = {
  storeToday: AdTotals;
  storePeriod: AdTotals;
  businessToday: AdTotals;
  businessPeriod: AdTotals;
  byLocationToday: { id: LocationId; totals: AdTotals; period: AdTotals }[];
  campaigns: PaidCampaignView[];
};

export function isPaidAdPlatform(value: string): value is PaidAdPlatform {
  return (PAID_AD_PLATFORMS as readonly string[]).includes(value);
}

export function isBusinessWideCampaign(locationId: string | null): boolean {
  return locationId == null;
}

/**
 * Location-assigned campaigns for this scope, plus business-wide rows only on ALL.
 * A single store never inherits brand/business-wide spend.
 */
export function campaignsForScope<T extends ScopedCampaign>(
  campaigns: T[],
  scope: LocationScope,
): T[] {
  const ids = locationIdsForScope(scope);
  return campaigns.filter((campaign) => {
    if (isBusinessWideCampaign(campaign.locationId)) return isCombinedScope(scope);
    return ids.includes(campaign.locationId as LocationId);
  });
}

export function storeCampaigns<T extends ScopedCampaign>(campaigns: T[]): T[] {
  return campaigns.filter((campaign) => !isBusinessWideCampaign(campaign.locationId));
}

export function businessWideCampaigns<T extends ScopedCampaign>(campaigns: T[]): T[] {
  return campaigns.filter((campaign) => isBusinessWideCampaign(campaign.locationId));
}

export function campaignsForPlatform<T extends { platform: string }>(
  campaigns: T[],
  platform: PaidAdPlatform,
): T[] {
  return campaigns.filter((campaign) => campaign.platform === platform);
}

export function emptyAdTotals(): AdTotals {
  return { spend: 0, reach: 0, impressions: 0, clicks: 0, results: 0 };
}

export const emptyMetaTotals = emptyAdTotals;

export function addAdTotals(a: AdTotals, b: AdTotals): AdTotals {
  return {
    spend: a.spend + b.spend,
    reach: a.reach + b.reach,
    impressions: a.impressions + b.impressions,
    clicks: a.clicks + b.clicks,
    results: a.results + b.results,
  };
}

export const addMetaTotals = addAdTotals;

export function sumDailyStats(rows: DailyStatLike[]): AdTotals {
  return rows.reduce(
    (acc, row) => addAdTotals(acc, {
      spend: row.spend,
      reach: row.reach,
      impressions: row.impressions,
      clicks: row.clicks,
      results: row.results,
    }),
    emptyAdTotals(),
  );
}

export function buildPaidAdsBundle(
  campaigns: PaidCampaignLike[],
  dailyStats: DailyStatLike[],
  ids: LocationId[],
  today: string,
): PaidAdsBundle {
  const storeIds = new Set(storeCampaigns(campaigns).map((c) => c.id));
  const brandIds = new Set(businessWideCampaigns(campaigns).map((c) => c.id));
  const campaignIds = new Set(campaigns.map((c) => c.id));
  const inWindow = dailyStats.filter((row) => campaignIds.has(row.campaignId));

  const campaignViews: PaidCampaignView[] = campaigns
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
        today: todayRows.length ? sumDailyStats(todayRows) : emptyAdTotals(),
        period: rows.length ? sumDailyStats(rows) : emptyAdTotals(),
      };
    })
    .sort((a, b) => {
      if (a.locationId === b.locationId) return b.today.spend - a.today.spend;
      if (a.locationId == null) return 1;
      if (b.locationId == null) return -1;
      return a.locationId.localeCompare(b.locationId);
    });

  return {
    storeToday: sumDailyStats(
      dailyStats.filter((row) => storeIds.has(row.campaignId) && row.date === today),
    ),
    storePeriod: sumDailyStats(dailyStats.filter((row) => storeIds.has(row.campaignId))),
    businessToday: sumDailyStats(
      dailyStats.filter((row) => brandIds.has(row.campaignId) && row.date === today),
    ),
    businessPeriod: sumDailyStats(dailyStats.filter((row) => brandIds.has(row.campaignId))),
    byLocationToday: ids.map((id) => {
      const locIds = new Set(campaigns.filter((c) => c.locationId === id).map((c) => c.id));
      return {
        id,
        totals: sumDailyStats(
          dailyStats.filter((row) => locIds.has(row.campaignId) && row.date === today),
        ),
        period: sumDailyStats(dailyStats.filter((row) => locIds.has(row.campaignId))),
      };
    }),
    campaigns: campaignViews,
  };
}

export function campaignScopeLabel(locationId: string | null): string {
  if (locationId == null) return BUSINESS_WIDE_LABEL;
  if (locationId === "avondale") return "Avondale";
  return "Glendale";
}

export function clickThroughRate(clicks: number, impressions: number): number {
  return impressions > 0 ? clicks / impressions : 0;
}

export function costPerClick(spend: number, clicks: number): number {
  return clicks > 0 ? spend / clicks : 0;
}

export function costPerResult(spend: number, results: number): number {
  return results > 0 ? spend / results : 0;
}
