import {
  BUSINESS_WIDE_LABEL,
  isCombinedScope,
  locationIdsForScope,
  type LocationId,
  type LocationScope,
} from "@/lib/location";

export const META_PLATFORM = "meta";

export type MetaTotals = {
  spend: number;
  reach: number;
  impressions: number;
  clicks: number;
  results: number;
};

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

export function emptyMetaTotals(): MetaTotals {
  return { spend: 0, reach: 0, impressions: 0, clicks: 0, results: 0 };
}

export function addMetaTotals(a: MetaTotals, b: MetaTotals): MetaTotals {
  return {
    spend: a.spend + b.spend,
    reach: a.reach + b.reach,
    impressions: a.impressions + b.impressions,
    clicks: a.clicks + b.clicks,
    results: a.results + b.results,
  };
}

export function sumDailyStats(rows: DailyStatLike[]): MetaTotals {
  return rows.reduce(
    (acc, row) => addMetaTotals(acc, {
      spend: row.spend,
      reach: row.reach,
      impressions: row.impressions,
      clicks: row.clicks,
      results: row.results,
    }),
    emptyMetaTotals(),
  );
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
