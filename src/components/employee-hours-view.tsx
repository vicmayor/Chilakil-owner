import { AlertCard } from "@/components/design/alert-card";
import { formatSyncStamp } from "@/components/design/sync-status";
import { StatPill } from "@/components/design/stat-pill";
import { SyncHoursButton } from "@/components/sync-hours-button";
import { TopBar } from "@/components/top-bar";
import { LocationDot } from "@/components/ui";
import { formatShortDate, formatTime, shiftIsoDate } from "@/lib/dates";
import { unpaidBreakNote, type EmployeeHoursLine, type EmployeeHoursView, type LocationHoursBlock } from "@/lib/employee-hours";
import { moneyExact, pct } from "@/lib/format";
import { LOCATIONS, type LocationScope } from "@/lib/location";
import type { TeamHoursStatus } from "@/lib/team-hours-mapper";

export function EmployeeHoursScreen({
  view,
  scope,
  connected,
}: {
  view: EmployeeHoursView;
  scope: LocationScope;
  connected: boolean;
}) {
  const syncedLabel = view.latestSyncedAt
    ? `Last synced: ${formatSyncStamp(new Date(view.latestSyncedAt))}`
    : connected
      ? "No pay periods synced yet"
      : "No hours on file";

  return (
    <>
      <TopBar
        title="Employees"
        subtitle="Pay period hours by location"
        scope={scope}
        syncLabel={connected ? syncedLabel : "Not connected"}
        syncAction={connected ? <SyncHoursButton /> : undefined}
      />
      <main className="space-y-6 px-4 py-5 md:px-6">
        {connected ? null : (
          <AlertCard tone="notice" title="Not connected">
            Set CHILAKIL_TEAM_API_KEY to pull hours from the team site. The base URL defaults to
            https://team.chilakiltogo.com. {syncedLabel}
          </AlertCard>
        )}

        <p className="px-1 text-sm leading-5 text-muted">
          Gross pay estimate excludes overtime, tips, and taxes. Labor % is that location&apos;s estimate
          divided by its Square sales for the same dates. Hours are read-only.
        </p>
        {view.lastError ? <AlertCard tone="problem" title={view.lastError} /> : null}

        {view.periods.length === 0 ? (
          connected ? (
            <article className="rounded-[1.75rem] border border-line bg-card px-5 py-6 shadow-[0_16px_40px_-24px_rgba(0,0,0,0.35)]">
              <p className="font-display text-2xl font-extrabold tracking-tight">No employee hours yet.</p>
              <p className="mt-2 text-sm leading-6 text-muted">
                Sync now pulls Sunday–Saturday pay periods. Glendale and Avondale stay in separate blocks.
              </p>
            </article>
          ) : null
        ) : (
          <div className="space-y-8">
            {view.periods.map((period) => (
              <section key={`${period.periodStart}|${period.periodEnd}`} className="space-y-4">
                <div className="px-1">
                  <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-muted">Pay period</p>
                  <h2 className="font-display mt-1 text-[1.85rem] font-extrabold leading-none tracking-tight">
                    {formatPayPeriod(period.periodStart, period.periodEnd)}
                  </h2>
                  <span className="mt-3 block h-1.5 w-14 rounded-full bg-chile" />
                  <p className="mt-3 text-sm leading-5 text-muted">
                    Sunday–Saturday · each location is listed on its own.
                  </p>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  {period.locations.map((block) => (
                    <LocationBlock
                      key={block.locationId}
                      block={block}
                      status={period.status}
                      periodStart={period.periodStart}
                      periodEnd={period.periodEnd}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </>
  );
}

function LocationBlock({
  block,
  status,
  periodStart,
  periodEnd,
}: {
  block: LocationHoursBlock;
  status: TeamHoursStatus;
  periodStart: string;
  periodEnd: string;
}) {
  const place = LOCATIONS[block.locationId];
  const index = block.locationId === "glendale" ? "01" : "02";
  const avondale = block.locationId === "avondale";

  return (
    <div className="space-y-3">
      <article className="overflow-hidden rounded-[1.75rem] border border-line bg-card shadow-[0_16px_40px_-24px_rgba(0,0,0,0.35)]">
        <div className={`h-2 ${avondale ? "bg-chile" : "bg-ink"}`} />
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <LocationDot id={block.locationId} />
            <StatPill tone={status === "pending" ? "pending" : "ok"}>{status === "pending" ? "Pending" : "Approved"}</StatPill>
          </div>
          <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.18em] text-muted">
            {index} / {place.typeLabel}
          </p>
          <h3 className="font-display mt-1 text-[1.7rem] font-extrabold leading-none tracking-tight">
            {place.shortName}
          </h3>
          <dl className="mt-5 grid grid-cols-3 gap-2 border-t border-line pt-4">
            <Stat label="Hours" value={formatHourCount(block.hours)} />
            <Stat label="Base pay" value={moneyExact(block.grossPayEstimate)} />
            <Stat label="Labor %" value={block.laborPct == null ? "—" : pct(block.laborPct)} />
          </dl>
          <p className="mt-3 text-xs leading-5 text-muted">{squareSalesHint(block)}</p>
          <p className="text-xs leading-5 text-muted">Base pay excludes overtime, tips, and taxes.</p>
          <p className="mt-2 text-xs font-semibold leading-5 text-ink">This approval covers both locations.</p>
        </div>
      </article>

      <ul className="space-y-3">
        {block.employees.map((employee) => (
          <li key={employee.employeeId}>
            <EmployeeCard employee={employee} periodStart={periodStart} periodEnd={periodEnd} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function EmployeeCard({
  employee,
  periodStart,
  periodEnd,
}: {
  employee: EmployeeHoursLine;
  periodStart: string;
  periodEnd: string;
}) {
  const openCount = employee.openShifts.length || employee.segments.filter((segment) => segment.open).length;
  const openDates = new Set(employee.segments.filter((segment) => segment.open).map((segment) => segment.date));
  const showDays = employee.dateHours.length > 0 || employee.segments.length > 0;
  const showPunches = employee.segments.length > 0 || employee.openShifts.length > 0;

  return (
    <article className="rounded-3xl border border-line bg-card p-4 shadow-[0_12px_32px_-20px_rgba(0,0,0,0.3)]">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-chile text-sm font-extrabold tracking-tight text-ink"
        >
          {initials(employee.employeeName)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-extrabold leading-tight">{employee.employeeName}</p>
          <p className="mt-0.5 text-xs leading-5 text-muted">
            {formatHourCount(employee.hours)} hrs · current rate {moneyExact(employee.hourlyRate)}/hr
          </p>
        </div>
        <p className="tabular shrink-0 text-lg font-extrabold leading-none">{moneyExact(employee.grossPayEstimate)}</p>
      </div>
      <p className="mt-3 text-xs text-muted">Rates applied {formatRates(employee.appliedHourlyRates)}</p>

      {showDays ? (
        <DayStrip
          periodStart={periodStart}
          periodEnd={periodEnd}
          hoursByDate={new Map(employee.dateHours.map((day) => [day.date, day.hours]))}
          openDates={openDates}
        />
      ) : null}

      {openCount > 0 ? (
        <div className="mt-3">
          <StatPill tone="pending">
            {openCount === 1 ? "Open shift" : `${openCount} open shifts`} · not counted
          </StatPill>
        </div>
      ) : null}

      {showPunches ? (
        <details className="mt-3 rounded-2xl bg-paper-2 px-3">
          <summary className="flex min-h-11 cursor-pointer items-center text-sm font-bold text-ink">Punches</summary>
          <ul className="space-y-2 pb-3">
            {employee.segments.map((segment) => (
              <li
                key={`${segment.shiftId}|${segment.date}`}
                className="rounded-2xl bg-card px-3 py-2.5 text-xs leading-5 text-muted"
              >
                {segment.open ? (
                  <>
                    <p className="font-bold text-ink">Open shift</p>
                    <p>
                      {formatShortDate(segment.date)} · {formatPunch(segment.clockIn)} · not counted
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-bold text-ink">{formatShortDate(segment.date)}</p>
                    <p>
                      {formatPunch(segment.clockIn)}–{formatPunch(segment.clockOut)} · {formatHourCount(segment.hours)} hrs
                      {segment.breaks.length > 0
                        ? ` · Break ${segment.breaks.map((brk) => `${formatPunch(brk.start)}–${formatPunch(brk.end)}`).join(", ")}`
                        : ""}
                    </p>
                  </>
                )}
                {unpaidBreakNote(segment) ? <p>{unpaidBreakNote(segment)}</p> : null}
              </li>
            ))}
          </ul>
          {employee.openShifts.length > 0 ? (
            <div className="pb-3">
              <p className="text-xs font-bold text-ink">Open shifts</p>
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
    </article>
  );
}

function DayStrip({
  periodStart,
  periodEnd,
  hoursByDate,
  openDates,
}: {
  periodStart: string;
  periodEnd: string;
  hoursByDate: Map<string, number>;
  openDates: Set<string>;
}) {
  const dates = periodDates(periodStart, periodEnd);
  return (
    <div className="mt-3 rounded-2xl bg-paper-2 p-2" role="list" aria-label="Hours by day">
      <div className="grid grid-cols-7 gap-1">
        {dates.map((date) => {
          const hours = hoursByDate.get(date) ?? 0;
          const open = openDates.has(date);
          return (
            <div
              key={date}
              role="listitem"
              aria-label={`${formatShortDate(date)}, ${hours > 0 ? `${formatHourCount(hours)} hours` : "no hours"}${open ? ", open shift" : ""}`}
              className={`rounded-xl px-0.5 py-1.5 text-center ${open ? "bg-chile" : "bg-card"}`}
            >
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted">{weekdayLabel(date)}</p>
              <p className="text-[10px] font-semibold text-ink/70">{Number(date.slice(8))}</p>
              <p className={`tabular text-[11px] font-extrabold leading-tight ${hours > 0 ? "text-ink" : "text-muted"}`}>
                {hours > 0 ? compactHours(hours) : "—"}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-bold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="font-display tabular mt-1 break-words text-[1.05rem] font-extrabold leading-tight tracking-tight">
        {value}
      </dd>
    </div>
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

function compactHours(hours: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(hours);
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

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

function weekdayLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" })
    .format(utcNoon(iso))
    .slice(0, 2);
}

function periodDates(start: string, end: string): string[] {
  const dates: string[] = [];
  let cursor = start;
  while (cursor <= end && dates.length < 14) {
    dates.push(cursor);
    cursor = shiftIsoDate(cursor, 1);
  }
  return dates;
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
