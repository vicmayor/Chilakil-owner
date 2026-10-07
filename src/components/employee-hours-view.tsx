import { SyncHoursButton } from "@/components/sync-hours-button";
import { TopBar } from "@/components/top-bar";
import { Card, LocationDot, Metric } from "@/components/ui";
import { formatPhoenixDateTime, formatShortDate, formatTime } from "@/lib/dates";
import type { EmployeeHoursView, LocationHoursBlock } from "@/lib/employee-hours";
import { moneyExact, pct } from "@/lib/format";
import type { LocationScope } from "@/lib/location";

export function EmployeeHoursScreen({
  view,
  scope,
  connected,
}: {
  view: EmployeeHoursView;
  scope: LocationScope;
  connected: boolean;
}) {
  return (
    <>
      <TopBar title="Employees" subtitle="Pay period hours by location" scope={scope} />
      <main className="space-y-4 px-4 py-4">
        <p className="text-sm text-muted">
          Gross pay estimate excludes overtime, tips, and taxes. Labor % is that location&apos;s estimate
          divided by its Square sales for the same dates. Hours are read-only.
        </p>
        {connected ? (
          <SyncHoursButton />
        ) : (
          <Card>
            <p className="text-base font-medium">Not connected</p>
            <p className="mt-1 text-sm text-muted">
              Set CHILAKIL_TEAM_API_URL and CHILAKIL_TEAM_API_TOKEN to pull hours from the team site.
            </p>
          </Card>
        )}
        <p className="text-sm text-muted">
          {view.latestSyncedAt
            ? `Last synced ${formatPhoenixDateTime(new Date(view.latestSyncedAt))}`
            : connected
              ? "No pay periods synced yet"
              : "No hours on file"}
        </p>

        {view.periods.length === 0 ? (
          connected ? (
            <Card>
              <p className="text-base font-medium">No employee hours yet.</p>
              <p className="mt-1 text-sm text-muted">
                Sync now pulls Sunday–Saturday pay periods. Glendale and Avondale stay in separate blocks.
              </p>
            </Card>
          ) : null
        ) : (
          view.periods.map((period) => (
            <section key={`${period.periodStart}|${period.periodEnd}`} className="space-y-3">
              <div>
                <h2 className="text-sm font-semibold">
                  Pay period {formatPayPeriod(period.periodStart, period.periodEnd)}
                </h2>
                <p className="text-xs text-muted">Sunday–Saturday · each location is listed on its own.</p>
              </div>
              {period.locations.map((block) => (
                <LocationBlock key={block.locationId} block={block} />
              ))}
            </section>
          ))
        )}
      </main>
    </>
  );
}

function LocationBlock({ block }: { block: LocationHoursBlock }) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <LocationDot id={block.locationId} />
        <ReviewBadge review={block.review} />
      </div>
      {block.review === "mixed" ? (
        <p className="mt-2 text-xs text-muted">
          {block.pendingCount} pending review · {block.approvedCount} approved
        </p>
      ) : null}
      <div className="mt-3 grid grid-cols-2 gap-4">
        <Metric label="Hours" value={formatHourCount(block.hours)} hint="hours" />
        <Metric
          label="Gross pay estimate"
          value={moneyExact(block.grossPayEstimate)}
          hint="Excludes OT, tips, taxes"
        />
      </div>
      <div className="mt-4">
        <Metric
          label="Labor % of Square sales"
          value={block.laborPct == null ? "—" : pct(block.laborPct)}
          hint={squareSalesHint(block)}
        />
      </div>
      <ul className="mt-3 divide-y divide-line">
        {block.employees.map((employee) => (
          <li key={employee.employeeId} className="py-2.5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{employee.employeeName}</p>
                <p className="text-xs text-muted">
                  {formatHourCount(employee.hours)} hrs · {moneyExact(employee.hourlyRate)}/hr ·{" "}
                  {employee.status === "approved" ? "Approved" : "Pending review"}
                </p>
              </div>
              <p className="tabular text-sm font-semibold">{moneyExact(employee.grossPayEstimate)}</p>
            </div>
            {employee.days.length > 0 ? (
              <details className="mt-1">
                <summary className="cursor-pointer text-xs font-semibold text-muted">Punches</summary>
                <ul className="mt-1 space-y-1">
                  {employee.days.map((day) => (
                    <li key={day.date} className="text-xs text-muted">
                      <span className="font-medium text-ink">{formatShortDate(day.date)}</span>
                      {" · "}
                      {formatPunch(day.clockIn)}–{formatPunch(day.clockOut)}
                      {" · "}
                      {formatHourCount(day.hours)} hrs
                      {day.breaks.length > 0
                        ? ` · Break ${day.breaks.map((brk) => `${formatPunch(brk.start)}–${formatPunch(brk.end)}`).join(", ")}`
                        : ""}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ReviewBadge({ review }: { review: LocationHoursBlock["review"] }) {
  const pending = review !== "approved";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
        pending ? "bg-chile text-ink" : "bg-sage-soft text-sage"
      }`}
    >
      {pending ? "Pending review" : "Approved"}
    </span>
  );
}

function squareSalesHint(block: LocationHoursBlock): string {
  if (block.squareSales <= 0) {
    return "No Square sales on file for these dates";
  }
  const coverage =
    block.salesDaysOnFile === block.periodDays
      ? `${block.periodDays} days`
      : `${block.salesDaysOnFile} of ${block.periodDays} days on file`;
  return `${moneyExact(block.squareSales)} gross · ${coverage}`;
}

function formatHourCount(hours: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(hours);
}

function formatPunch(value: string | null): string {
  if (!value) return "—";
  if (/^\d{2}:\d{2}/.test(value) && !value.includes("T")) return value.slice(0, 5);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return formatTime(parsed);
}

function formatPayPeriod(start: string, end: string): string {
  const startDate = utcNoon(start);
  const endDate = utcNoon(end);
  const sameYear = startDate.getUTCFullYear() === endDate.getUTCFullYear();
  const startText = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
    ...(sameYear ? {} : { year: "numeric" }),
  }).format(startDate);
  const endText = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(endDate);
  return `${startText} – ${endText}`;
}

function utcNoon(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}
