"use client";

import { useState } from "react";
import type { LocationId, LocationScope } from "@/lib/location";
import type { PaidAdPlatform, PaidAdsBundle } from "@/lib/marketing";
import { PAID_ADS_COPY, PaidAdsSection } from "@/components/paid-ads-section";
import { Card, CombinedBadge, LocationDot } from "@/components/ui";
import { formatShortDate } from "@/lib/dates";
import { moneyExact, number, platformLabel } from "@/lib/format";
import { isCombinedScope } from "@/lib/location";

const TABS: { id: PaidAdPlatform; label: string }[] = [
  { id: "meta", label: "META" },
  { id: "google", label: "GOOGLE" },
  { id: "tiktok", label: "TIKTOK" },
];

type OtherCampaign = {
  id: string;
  locationId: string | null;
  name: string;
  channel: string;
  status: string;
  startDate: string;
  endDate: string | null;
  spend: number;
  impressions: number | null;
  clicks: number | null;
  notes: string | null;
};

type SecretRef = {
  locationId: string;
  provider: string;
  secretRef: string;
  storeRef: string | null;
  status: string;
};

export function MarketingHub({
  scope,
  ids,
  today,
  periodLabel,
  bundles,
  secretRefs,
  otherCampaigns,
  otherSpend,
}: {
  scope: LocationScope;
  ids: LocationId[];
  today: string;
  periodLabel: string;
  bundles: Record<PaidAdPlatform, PaidAdsBundle>;
  secretRefs: SecretRef[];
  otherCampaigns: OtherCampaign[];
  otherSpend: number;
}) {
  const [platform, setPlatform] = useState<PaidAdPlatform>("meta");
  const bundle = bundles[platform];
  const copy = PAID_ADS_COPY[platform];
  const refs = secretRefs.filter((row) => row.provider === platform);

  return (
    <div className="space-y-6">
      <div
        role="tablist"
        aria-label="Ad platform"
        className="grid grid-cols-3 gap-1 rounded-2xl bg-paper-2 p-1"
      >
        {TABS.map((tab) => {
          const active = platform === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setPlatform(tab.id)}
              className={`flex min-h-11 items-center justify-center rounded-xl px-1 text-[11px] font-extrabold tracking-wide ${
                active ? "bg-brand-yellow text-brand" : "text-muted"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <PaidAdsSection
        copy={copy}
        scope={scope}
        ids={ids}
        today={today}
        periodLabel={periodLabel}
        storeToday={bundle.storeToday}
        storePeriod={bundle.storePeriod}
        businessToday={bundle.businessToday}
        businessPeriod={bundle.businessPeriod}
        byLocationToday={bundle.byLocationToday}
        campaigns={bundle.campaigns}
        secretRefs={refs}
      />

      {otherCampaigns.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Other channels</h2>
          <Card>
            {isCombinedScope(scope) ? <CombinedBadge /> : <LocationDot id={ids[0]} />}
            <p className="font-display mt-2 text-3xl font-semibold tabular">
              {moneyExact(otherSpend)}
            </p>
            <p className="text-sm text-muted">Location-assigned non-ad spend in this list</p>
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
    </div>
  );
}
