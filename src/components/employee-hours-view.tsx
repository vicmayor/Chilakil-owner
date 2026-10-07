import { SyncHoursButton } from "@/components/sync-hours-button";
import { TopBar } from "@/components/top-bar";
import { Card, LocationDot, Metric } from "@/components/ui";
import { formatPhoenixDateTime, formatShortDate, formatTime } from "@/lib/dates";
import { unpaidBreakNote, type EmployeeHoursView, type LocationHoursBlock } from "@/lib/employee-hours";
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
              Set CHILAKIL_TEAM_API_KEY to pull hours from the team site. The base URL defaults to
              https://team.chilakiltogo.com.
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
        {view.lastError ? <p className="text-sm text-danger">{view.lastError}</p> : null}

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
                <div className="mt-2">
                  <ReviewBadge pending={period.status === "pending"} />
                  <p className="mt-1 text-xs text-muted">This approval covers both locations.</p>
                </div>
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
      <LocationDot id={block.locationId} />
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
                  {formatHourCount(employee.hours)} hrs · current rate {moneyExact(employee.hourlyRate)}/hr
                </p>
                <p className="text-xs text-muted">Rates applied {formatRates(employee.appliedHourlyRates)}</p>
              </div>
              <p className="tabular text-sm font-semibold">{moneyExact(employee.grossPayEstimate)}</p>
            </div>
            {employee.segments.length > 0 || employee.openShifts.length > 0 ? (
              <details className="mt-1">
                <summary className="cursor-pointer text-xs font-semibold text-muted">Punches</summary>
                <ul className="mt-1 space-y-2">
                  {employee.dateHours.map((day) => (
                    <li key={day.date} className="text-xs text-muted">
                      <span className="font-medium text-ink">{formatShortDate(day.date)}</span>
                      {" · "}
                      {formatHourCount(day.hours)} hrs
                    </li>
                  ))}
                  {employee.segments.map((segment) => (
                    <li key={`${segment.shiftId}|${segment.date}`} className="text-xs text-muted">
                      {segment.open ? (
                        <>
                          <span className="font-medium text-ink">Open shift</span>
                          {" · "}
                          {formatShortDate(segment.date)}
                          {" · "}
                          {formatPunch(segment.clockIn)}
                          {" · not counted"}
                        </>
                      ) : (
                        <>
                          <span className="font-medium text-ink">{formatShortDate(segment.date)}</span>
                          {" · "}
                          {formatPunch(segment.clockIn)}–{formatPunch(segment.clockOut)}
                          {" · "}
                          {formatHourCount(segment.hours)} hrs
                          {segment.breaks.length > 0
                            ? ` · Break ${segment.breaks.map((brk) => `${formatPunch(brk.start)}–${formatPunch(brk.end)}`).join(", ")}`
                            : ""}
                        </>
                      )}
                      {unpaidBreakNote(segment) ? <span className="block">{unpaidBreakNote(segment)}</span> : null}
                    </li>
                  ))}
                </ul>
                {employee.openShifts.length > 0 ? (
                  <div className="mt-2">
                    <p className="text-xs font-semibold text-ink">Open shifts</p>
                    <ul className="mt-1 space-y-1">
                      {employee.openShifts.map((shift) => (
                        <li key={shift.shiftId} className="text-xs text-muted">
                          {shift.shiftId} · clock in {formatPunch(shift.clockIn)} · not counted
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </details>
            ) : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ReviewBadge({ pending }: { pending: boolean }) {
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
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(hours);
}

function formatRates(rates: number[]): string {
  if (rates.length === 0) return "—";
  return rates.map((rate) => moneyExact(rate)).join(", ");
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
