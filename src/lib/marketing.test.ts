import test from "node:test";
import assert from "node:assert/strict";
import { BUSINESS_WIDE_LABEL, COMBINED_LABEL, locationIdsForScope } from "./location";
import {
  buildPaidAdsBundle,
  businessWideCampaigns,
  campaignsForPlatform,
  campaignsForScope,
  campaignScopeLabel,
  clickThroughRate,
  costPerResult,
  GOOGLE_ADS_PLATFORM,
  isPaidAdPlatform,
  META_PLATFORM,
  storeCampaigns,
  sumDailyStats,
  TIKTOK_PLATFORM,
} from "./marketing";

const glendaleLunch = { id: "g1", locationId: "glendale" as const, name: "Glendale lunch specials" };
const avondaleFence = { id: "a1", locationId: "avondale" as const, name: "Trailer tonight geo-fence" };
const brand = { id: "b1", locationId: null, name: "Chilakil To Go brand awareness" };
const all = [glendaleLunch, avondaleFence, brand];

test("ALL includes both stores and business-wide, without collapsing them", () => {
  const scoped = campaignsForScope(all, "all");
  assert.equal(scoped.length, 3);
  assert.deepEqual(
    scoped.map((c) => c.id).sort(),
    ["a1", "b1", "g1"],
  );
  assert.equal(campaignScopeLabel(null), BUSINESS_WIDE_LABEL);
  assert.match(COMBINED_LABEL, /Glendale/i);
  assert.match(COMBINED_LABEL, /Avondale/i);
});

test("Glendale never includes Avondale or business-wide spend", () => {
  const scoped = campaignsForScope(all, "glendale");
  assert.deepEqual(scoped.map((c) => c.id), ["g1"]);
  assert.equal(storeCampaigns(scoped).length, 1);
  assert.equal(businessWideCampaigns(scoped).length, 0);
  assert.deepEqual(locationIdsForScope("glendale"), ["glendale"]);
});

test("Avondale never includes Glendale or business-wide spend", () => {
  const scoped = campaignsForScope(all, "avondale");
  assert.deepEqual(scoped.map((c) => c.id), ["a1"]);
  assert.equal(campaignScopeLabel("avondale"), "Avondale");
});

test("store totals exclude business-wide so brand spend is never silently attributed", () => {
  const scoped = campaignsForScope(all, "all");
  const store = storeCampaigns(scoped);
  const brandOnly = businessWideCampaigns(scoped);
  assert.equal(store.length, 2);
  assert.equal(brandOnly.length, 1);
  assert.equal(brandOnly[0]?.locationId, null);
  assert.equal(campaignScopeLabel(brandOnly[0]?.locationId ?? null), BUSINESS_WIDE_LABEL);
});

test("paid platforms are meta, google, and tiktok — organic google is not a paid tab", () => {
  assert.equal(isPaidAdPlatform("meta"), true);
  assert.equal(isPaidAdPlatform("google"), true);
  assert.equal(isPaidAdPlatform("tiktok"), true);
  assert.equal(isPaidAdPlatform("google_business"), false);
  assert.equal(isPaidAdPlatform("sms"), false);
  const mixed = [
    { platform: META_PLATFORM },
    { platform: GOOGLE_ADS_PLATFORM },
    { platform: TIKTOK_PLATFORM },
    { platform: "sms" },
  ];
  assert.deepEqual(
    campaignsForPlatform(mixed, "google").map((c) => c.platform),
    ["google"],
  );
});

test("Google/TikTok bundles keep business-wide out of store spend", () => {
  const campaigns = [
    {
      id: "g-search",
      locationId: "glendale",
      name: "Glendale tacos near me",
      channel: "search",
      status: "active",
      startDate: "2026-09-01",
      endDate: null,
      resultType: "purchases",
      notes: null,
    },
    {
      id: "brand-search",
      locationId: null,
      name: "Chilakil brand search",
      channel: "search",
      status: "active",
      startDate: "2026-09-01",
      endDate: null,
      resultType: "reach",
      notes: null,
    },
  ];
  const bundle = buildPaidAdsBundle(
    campaigns,
    [
      { campaignId: "g-search", date: "2026-09-16", spend: 22.4, reach: 420, impressions: 1800, clicks: 64, results: 3 },
      { campaignId: "brand-search", date: "2026-09-16", spend: 14, reach: 900, impressions: 2400, clicks: 40, results: 0 },
    ],
    ["glendale", "avondale"],
    "2026-09-16",
  );
  assert.equal(bundle.storeToday.spend, 22.4);
  assert.equal(bundle.businessToday.spend, 14);
  assert.equal(bundle.byLocationToday.find((r) => r.id === "glendale")?.totals.spend, 22.4);
  assert.equal(bundle.byLocationToday.find((r) => r.id === "avondale")?.totals.spend, 0);
});

test("daily Meta stats add spend, reach, clicks, and results", () => {
  const totals = sumDailyStats([
    { campaignId: "g1", date: "2026-09-17", spend: 48.2, reach: 2100, impressions: 6200, clicks: 86, results: 4 },
    { campaignId: "a1", date: "2026-09-17", spend: 18.75, reach: 4200, impressions: 5100, clicks: 64, results: 0 },
  ]);
  assert.equal(totals.spend, 66.95);
  assert.equal(totals.reach, 6300);
  assert.equal(totals.clicks, 150);
  assert.equal(totals.results, 4);
  assert.equal(clickThroughRate(86, 6200).toFixed(4), "0.0139");
  assert.equal(costPerResult(48.2, 4), 12.05);
});
