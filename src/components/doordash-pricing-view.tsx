import type { ReactNode } from "react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getLocationScope } from "@/lib/scope";
import {
  isCombinedScope,
  locationIdsForScope,
  LOCATIONS,
  type LocationId,
} from "@/lib/location";
import { moneyExact, number } from "@/lib/format";
import { TopBar } from "@/components/top-bar";
import { Card, LocationDot } from "@/components/ui";

type LineStatus = "losing" | "ok" | "review" | "not_on_menu";

const STATUS_LABEL: Record<LineStatus, string> = {
  losing: "Losing vs in-store",
  ok: "OK",
  review: "Needs review",
  not_on_menu: "Not on DoorDash",
};

const STATUS_CLASS: Record<LineStatus, string> = {
  losing: "bg-red-600 text-white",
  ok: "bg-green-600 text-white",
  review: "bg-[#FCC444] text-black",
  not_on_menu: "bg-white text-black ring-1 ring-black/20",
};

const NOTE_LABEL: Record<string, string> = {
  check: "Check",
  commission: "Commission",
  exclusion: "Excluded",
  info: "Note",
};

function isStatus(value: string): value is LineStatus {
  return value === "losing" || value === "ok" || value === "review" || value === "not_on_menu";
}

function formatReportDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

function dashMoney(value: number | null) {
  return value === null ? "—" : moneyExact(value);
}

function plusMoney(value: number | null) {
  return value === null ? "—" : `+${moneyExact(value)}`;
}

function deltaMoney(value: number | null) {
  if (value === null) return "—";
  if (value > 0) return `+${moneyExact(value)}`;
  return moneyExact(value);
}

function markupLabel(value: number | null) {
  return value === null ? "—" : `+${value}%`;
}

function StatusBadge({ status }: { status: string }) {
  const key = isStatus(status) ? status : "not_on_menu";
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-center text-[11px] font-bold leading-4 ${STATUS_CLASS[key]}`}
    >
      {STATUS_LABEL[key]}
    </span>
  );
}

function Stat({
  label,
  value,
  tone = "default",
  emphasis = false,
}: {
  label: string;
  value: string;
  tone?: "default" | "bad" | "good";
  emphasis?: boolean;
}) {
  const valueColor =
    tone === "bad" ? "text-red-600" : tone === "good" ? "text-green-700" : "text-ink";
  return (
    <div className={`min-w-0 rounded-xl px-2.5 py-2 ${emphasis ? "bg-[#FCC444] text-black" : "bg-paper"}`}>
      <p className={`text-[11px] font-semibold leading-4 ${emphasis ? "text-black/70" : "text-muted"}`}>
        {label}
      </p>
      <p
        className={`tabular mt-0.5 font-semibold leading-6 ${
          value.length > 10 ? "text-sm" : "text-lg"
        } ${emphasis ? "text-black" : valueColor}`}
      >
        {value}
      </p>
    </div>
  );
}

export async function DoorDashPricingView({ tabs }: { tabs?: ReactNode }) {
  const scope = await getLocationScope();
  const ids = locationIdsForScope(scope);
  const reports = await prisma.doorDashPricingReport.findMany({
    where: { locationId: { in: ids } },
    include: {
      lines: { orderBy: { sortOrder: "asc" } },
      notes: { orderBy: { sortOrder: "asc" } },
    },
    orderBy: { reportDate: "desc" },
  });

  return (
    <>
      <TopBar
        title="DoorDash"
        subtitle="Pricing vs in-store. Recommendations only."
        scope={scope}
      />
      {tabs}
      <main className="space-y-4 overflow-x-hidden px-4 py-4">
        <div className="rounded-2xl bg-[#FCC444] px-4 py-3 text-black">
          <p className="text-base font-bold leading-5">
            Recommendations only. No DoorDash prices have been changed.
          </p>
          <p className="mt-1 text-sm leading-5">
            Read-only report from October 6, 2026. This screen does not call DoorDash and cannot
            edit a price.
          </p>
        </div>

        {isCombinedScope(scope) ? (
          <div className="space-y-2">
            <p className="text-sm leading-5 text-muted">
              Glendale and Avondale are separate reports below. They are not added together.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {ids.map((id) => (
                <a
                  key={id}
                  href={`#pricing-${id}`}
                  className="flex min-h-11 items-center justify-center rounded-2xl border border-line bg-card px-3 text-sm font-bold"
                >
                  {LOCATIONS[id].shortName} report
                </a>
              ))}
            </div>
          </div>
        ) : null}

        {ids.map((id) => {
          const locationReports = reports.filter((report) => report.locationId === id);
          return (
            <LocationReportList key={id} locationId={id} reports={locationReports} />
          );
        })}
      </main>
    </>
  );
}

type PricingReport = Prisma.DoorDashPricingReportGetPayload<{
  include: { lines: true; notes: true };
}>;

function LocationReportList({
  locationId,
  reports,
}: {
  locationId: LocationId;
  reports: PricingReport[];
}) {
  const place = LOCATIONS[locationId];

  if (reports.length === 0) {
    return (
      <Card>
        <LocationDot id={locationId} />
        <p className="mt-2 text-sm text-muted">No DoorDash pricing report for {place.shortName}.</p>
      </Card>
    );
  }

  return (
    <div id={`pricing-${locationId}`} className="scroll-mt-28 space-y-4">
      {reports.map((report) => (
        <PricingReportSection key={report.id} locationId={locationId} report={report} />
      ))}
    </div>
  );
}

function PricingReportSection({
  locationId,
  report,
}: {
  locationId: LocationId;
  report: PricingReport;
}) {
  const place = LOCATIONS[locationId];
  const items = report.lines.filter((line) => line.kind === "item");
  const addons = report.lines.filter((line) => line.kind === "addon");
  const losing = items.filter((line) => line.status === "losing").length;
  const review = items.filter((line) => line.status === "review").length;
  const ok = items.filter((line) => line.status === "ok").length;
  const popular = items
    .filter((line) => line.squareSold30d !== null)
    .slice()
    .sort((a, b) => (b.squareSold30d ?? 0) - (a.squareSold30d ?? 0));

  return (
    <section className="space-y-3" aria-labelledby={`pricing-${report.id}`}>
      <div className="rounded-2xl border border-[#FCC444] bg-black px-4 py-3 text-white">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#FCC444]">
          {place.shortName} · {place.typeLabel}
        </p>
        <h2 id={`pricing-${report.id}`} className="mt-1 text-xl font-semibold leading-6">
          {place.name}
        </h2>
        <p className="mt-1 text-sm leading-5 text-white/80">
          DoorDash store {report.doorDashStoreId} · {formatReportDate(report.reportDate)}
        </p>
      </div>

      <Card>
        <p className="text-base font-semibold leading-6">
          {place.shortName}: {report.headline}
        </p>
        <p className="mt-2 text-sm leading-5 text-muted">{report.summary}</p>
        <ul className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold">
          <li className="rounded-full bg-red-600 px-2.5 py-1 text-white">{losing} losing</li>
          <li className="rounded-full bg-green-600 px-2.5 py-1 text-white">{ok} OK</li>
          <li className="rounded-full bg-[#FCC444] px-2.5 py-1 text-black">{review} needs review</li>
        </ul>
      </Card>

      <Card>
        <h3 className="text-sm font-semibold">Assumptions for this store</h3>
        <p className="mt-2 text-sm leading-5">{report.commissionNote}</p>
        <p className="mt-2 text-sm leading-5 text-muted">{report.exclusionNote}</p>
      </Card>

      <div className="space-y-3">
        <h3 className="px-1 text-sm font-semibold">Menu items</h3>
        {items.map((line) => (
          <PricingLineCard key={line.id} line={line} />
        ))}
        <p className="px-1 text-xs leading-5 text-muted">{report.methodNote}</p>
      </div>

      <div className="space-y-3">
        <h3 className="px-1 text-sm font-semibold">Add-ons / proteins</h3>
        {addons.map((line) => (
          <PricingLineCard key={line.id} line={line} />
        ))}
        {report.addonNote ? (
          <p
            className={`rounded-2xl px-4 py-3 text-sm leading-5 ${
              report.addonNoteTone === "review"
                ? "bg-[#FCC444] font-medium text-black"
                : "bg-paper-2 text-ink"
            }`}
          >
            {report.addonNote}
          </p>
        ) : null}
      </div>

      <Card>
        <h3 className="text-sm font-semibold">Popularity · in-store Square, last 30 days</h3>
        <ul className="mt-2 divide-y divide-line">
          {popular.map((line) => (
            <li key={line.id} className="flex items-baseline justify-between gap-3 py-2">
              <span className="text-sm leading-5">{line.name}</span>
              <span className="tabular text-lg font-semibold">{number(line.squareSold30d ?? 0)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-sm leading-5 text-muted">{report.popularityLead}</p>
        <p className="mt-2 text-sm font-medium leading-5">{report.tenOrderExample}</p>
      </Card>

      <Card>
        <h3 className="text-sm font-semibold">Notes and things to check</h3>
        <ul className="mt-3 space-y-3">
          {report.notes.map((note) => (
            <li key={note.id} className="text-sm leading-5">
              <span
                className={`mb-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                  note.kind === "commission"
                    ? "bg-[#FCC444] text-black"
                    : note.kind === "check"
                      ? "bg-[#FCC444] text-black"
                      : note.kind === "exclusion"
                        ? "bg-black text-white"
                        : "bg-paper-2 text-muted"
                }`}
              >
                {NOTE_LABEL[note.kind] ?? "Note"}
              </span>
              <p className="mt-1">{note.body}</p>
            </li>
          ))}
        </ul>
      </Card>

      {report.pdfPath ? (
        <a
          href={report.pdfPath}
          download
          className="flex min-h-11 items-center justify-center rounded-2xl bg-black px-4 text-sm font-bold text-[#FCC444]"
        >
          Download {place.shortName} PDF
        </a>
      ) : null}
    </section>
  );
}

function PricingLineCard({ line }: { line: PricingReport["lines"][number] }) {
  const addon = line.kind === "addon";
  const price = addon ? plusMoney : dashMoney;
  const vsTone = line.vsInStore !== null && line.vsInStore < 0 ? "bad" : line.vsInStore !== null && line.vsInStore >= 0 ? "good" : "default";

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="text-base font-semibold leading-5 break-words">{line.name}</h4>
          {line.squareSold30d !== null ? (
            <p className="mt-1 text-xs text-muted">
              {number(line.squareSold30d)} sold in-store · last 30 days
            </p>
          ) : null}
        </div>
        <StatusBadge status={line.status} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Stat label="In-store (Square)" value={price(line.inStorePrice)} />
        <Stat
          label="DoorDash now"
          value={line.onDoorDash ? price(line.doorDashPrice) : "Not on menu"}
        />
        <Stat label="Markup" value={markupLabel(line.markupPct)} />
        <Stat label="You keep now" value={dashMoney(line.keepNow)} />
        <Stat label="vs in-store" value={deltaMoney(line.vsInStore)} tone={vsTone} />
        <Stat label="Break-even DD" value={price(line.breakEvenPrice)} />
        <Stat label="Change needed" value={deltaMoney(line.changeNeeded)} />
        <Stat label="You'd keep" value={dashMoney(line.keepRecommended)} />
      </div>
      <div className="mt-2">
        <Stat label="Recommended DD price" value={price(line.recommendedPrice)} emphasis />
      </div>
      {line.footnote ? (
        <p className="mt-3 rounded-xl bg-[#FCC444] px-3 py-2 text-sm leading-5 font-medium text-black">
          {line.footnote}
        </p>
      ) : null}
    </Card>
  );
}
