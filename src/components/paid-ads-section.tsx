import type { LocationId, LocationScope } from "@/lib/location";
import { COMBINED_LABEL, BUSINESS_WIDE_BANNER, isCombinedScope } from "@/lib/location";
import {
  type AdTotals,
  type PaidAdPlatform,
  type PaidCampaignView,
  clickThroughRate,
  costPerClick,
  costPerResult,
} from "@/lib/marketing";
import { formatShortDate } from "@/lib/dates";
import {
  campaignStatusLabel,
  moneyExact,
  number,
  pct,
  platformLabel,
  resultTypeLabel,
} from "@/lib/format";
import { BusinessWideBadge, Card, CombinedBadge, LocationDot, Metric } from "@/components/ui";

export type PaidAdsCopy = {
  platform: PaidAdPlatform;
  eyebrow: string;
  title: string;
  spendNoun: string;
  phase2: string;
  empty: string;
  primary?: boolean;
};

export const PAID_ADS_COPY: Record<PaidAdPlatform, PaidAdsCopy> = {
  meta: {
    platform: "meta",
    eyebrow: "Meta Ads",
    title: "Facebook & Instagram",
    spendNoun: "Meta",
    phase2:
      "Live Meta Graph API is Phase 2 — these rows are seeded, not pulled from Ads Manager.",
    empty: "No Meta campaigns in this location scope.",
    primary: true,
  },
  google: {
    platform: "google",
    eyebrow: "Google Ads",
    title: "Search & Maps",
    spendNoun: "Google Ads",
    phase2: "Live Google Ads API is Phase 2 — these rows are seeded, not pulled from Google Ads.",
    empty: "No Google Ads campaigns in this location scope.",
  },
  tiktok: {
    platform: "tiktok",
    eyebrow: "TikTok Ads",
    title: "In-feed & Spark",
    spendNoun: "TikTok",
    phase2: "Live TikTok Marketing API is Phase 2 — these rows are seeded, not pulled from TikTok.",
    empty: "No TikTok campaigns in this location scope.",
  },
};

export type PaidAdsSectionProps = {
  copy: PaidAdsCopy;
  scope: LocationScope;
  ids: LocationId[];
  today: string;
  periodLabel: string;
  storeToday: AdTotals;
  storePeriod: AdTotals;
  businessToday: AdTotals;
  businessPeriod: AdTotals;
  byLocationToday: { id: LocationId; totals: AdTotals; period: AdTotals }[];
  campaigns: PaidCampaignView[];
  secretRefs: { locationId: string; secretRef: string; storeRef: string | null; status: string }[];
};

function StatusPill({ status }: { status: string }) {
  const active = status === "active";
  return (
    <span
      className={`inline-flex min-h-8 items-center rounded-full px-3 text-[11px] font-extrabold uppercase tracking-wide ${
        active ? "bg-brand-yellow text-brand" : "bg-paper-2 text-muted"
      }`}
    >
      {campaignStatusLabel(status)}
    </span>
  );
}

function MetricGrid({ totals, hint }: { totals: AdTotals; hint?: string }) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-4">
      <Metric label="Reach" value={number(totals.reach)} hint={hint} />
      <Metric label="Impressions" value={number(totals.impressions)} />
      <Metric label="Clicks" value={number(totals.clicks)} />
      <Metric
        label="Results"
        value={number(totals.results)}
        hint={
          totals.results > 0
            ? `${moneyExact(costPerResult(totals.spend, totals.results))} / result`
            : undefined
        }
      />
    </div>
  );
}

function ScopeMark({ locationId }: { locationId: string | null }) {
  if (!locationId) return <BusinessWideBadge />;
  return <LocationDot id={locationId} />;
}

export function PaidAdsSection({
  copy,
  scope,
  ids,
  today,
  periodLabel,
  storeToday,
  storePeriod,
  businessToday,
  businessPeriod,
  byLocationToday,
  campaigns,
  secretRefs,
}: PaidAdsSectionProps) {
  const combined = isCombinedScope(scope);

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-brand-yellow">
            {copy.eyebrow}
          </p>
          <h2 className="mt-1 text-lg font-semibold">{copy.title}</h2>
        </div>
        <p className="text-right text-xs text-muted">{formatShortDate(today)}</p>
      </div>

      <Card className={copy.primary ? "border-brand-yellow/40" : undefined}>
        <p className="text-sm leading-5 text-muted">
          Sample {copy.spendNoun} numbers so you can check spend on the phone.{" "}
          <span className="font-semibold text-ink">{copy.phase2}</span>
        </p>
      </Card>

      {combined ? (
        <Card>
          <div className="flex items-center justify-between gap-2">
            <CombinedBadge />
            <p className="text-xs text-muted">Today · store spend</p>
          </div>
          <p className="font-display mt-2 text-3xl font-semibold tabular">
            {moneyExact(storeToday.spend)}
          </p>
          <p className="text-sm text-muted">
            {COMBINED_LABEL} · {copy.spendNoun} spend today
          </p>
          <p className="mt-1 text-xs text-muted">
            Last {periodLabel}: {moneyExact(storePeriod.spend)} · CTR{" "}
            {pct(clickThroughRate(storeToday.clicks, storeToday.impressions))} · CPC{" "}
            {storeToday.clicks > 0 ? moneyExact(costPerClick(storeToday.spend, storeToday.clicks)) : "—"}
          </p>
          <MetricGrid totals={storeToday} />
        </Card>
      ) : null}

      {ids.map((id) => {
        const row = byLocationToday.find((item) => item.id === id);
        const totals = row?.totals ?? storeToday;
        const period = row?.period ?? storePeriod;
        const integration = secretRefs.find((s) => s.locationId === id);
        return (
          <Card key={id}>
            <div className="flex items-center justify-between gap-2">
              <LocationDot id={id} />
              <p className="text-xs text-muted">Today</p>
            </div>
            <p className="font-display mt-2 text-3xl font-semibold tabular">
              {moneyExact(totals.spend)}
            </p>
            <p className="text-sm text-muted">{copy.spendNoun} spend · this location only</p>
            <p className="mt-1 text-xs text-muted">
              Last {periodLabel}: {moneyExact(period.spend)} · CTR{" "}
              {pct(clickThroughRate(totals.clicks, totals.impressions))} · CPC{" "}
              {totals.clicks > 0 ? moneyExact(costPerClick(totals.spend, totals.clicks)) : "—"}
            </p>
            <MetricGrid totals={totals} />
            {integration ? (
              <p className="mt-3 rounded-xl bg-paper-2 px-3 py-2 text-xs leading-5 text-muted">
                Integration: {integration.status}. Secret ref{" "}
                <span className="font-medium text-ink">{integration.secretRef}</span>
                {integration.storeRef ? ` · account ref ${integration.storeRef}` : ""}. No live
                calls.
              </p>
            ) : null}
          </Card>
        );
      })}

      {combined ? (
        <Card>
          <div className="flex items-center justify-between gap-2">
            <BusinessWideBadge />
            <p className="text-xs text-muted">Today</p>
          </div>
          <p className="font-display mt-2 text-3xl font-semibold tabular">
            {moneyExact(businessToday.spend)}
          </p>
          <p className="text-sm text-muted">{BUSINESS_WIDE_BANNER}</p>
          <p className="mt-1 text-xs text-muted">
            Last {periodLabel}: {moneyExact(businessPeriod.spend)}
          </p>
          <MetricGrid totals={businessToday} />
        </Card>
      ) : null}

      <div>
        <h3 className="mb-2 text-sm font-semibold">Campaigns</h3>
        {campaigns.length === 0 ? (
          <Card>
            <p className="text-sm text-muted">{copy.empty}</p>
          </Card>
        ) : (
          <ul className="space-y-3">
            {campaigns.map((campaign) => (
              <li key={campaign.id}>
                <Card>
                  <div className="flex items-start justify-between gap-3">
                    <ScopeMark locationId={campaign.locationId} />
                    <StatusPill status={campaign.status} />
                  </div>
                  <p className="mt-2 text-base font-semibold leading-5">{campaign.name}</p>
                  <p className="mt-1 text-sm text-muted">
                    {platformLabel(campaign.channel)} · {formatShortDate(campaign.startDate)}
                    {campaign.endDate ? ` – ${formatShortDate(campaign.endDate)}` : ""}
                  </p>
                  <p className="font-display mt-3 text-2xl font-semibold tabular">
                    {moneyExact(campaign.today.spend)}
                  </p>
                  <p className="text-xs text-muted">
                    Spend today · {periodLabel} {moneyExact(campaign.period.spend)}
                  </p>
                  <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-xs text-muted">Reach</dt>
                      <dd className="tabular font-medium">{number(campaign.today.reach)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted">Clicks</dt>
                      <dd className="tabular font-medium">{number(campaign.today.clicks)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted">{resultTypeLabel(campaign.resultType)}</dt>
                      <dd className="tabular font-medium">{number(campaign.today.results)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted">Impressions</dt>
                      <dd className="tabular font-medium">{number(campaign.today.impressions)}</dd>
                    </div>
                  </dl>
                  {campaign.notes ? (
                    <p className="mt-3 text-sm leading-5 text-muted">{campaign.notes}</p>
                  ) : null}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
