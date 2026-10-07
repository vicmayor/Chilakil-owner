import { TopBar } from "@/components/top-bar";
import { Card, LocationDot, Metric } from "@/components/ui";
import { formatPhoenixDateTime } from "@/lib/dates";
import type { EmployeeHoursView, LocationHoursBlock } from "@/lib/employee-hours";
import { moneyExact, pct } from "@/lib/format";
import type { LocationScope } from "@/lib/location";

export function EmployeeHoursScreen({
  view,
  scope,
}: {
  view: EmployeeHoursView;
  scope: LocationScope;
}) {
  return (
    <>
      <TopBar title="Employees" subtitle="Pay period hours and base pay by location" scope={scope} />
      <main className="space-y-4 px-4 py-4">
        <p className="text-sm text-muted">
          Base pay excludes overtime, tips, and taxes. Labor % is that location&apos;s base pay divided by
          its Square sales for the same dates.
        </p>
        <p className="text-sm text-muted">
          {view.latestSyncedAt
            ? `Last synced ${formatPhoenixDateTime(new Date(view.latestSyncedAt))}`
            : "No pay periods synced yet"}
        </p>

        {view.periods.length === 0 ? (
          <Card>
            <p className="text-base font-medium">No employee hours yet.</p>
            <p className="mt-1 text-sm text-muted">
              Hours come from the team site pay periods summary. Glendale and Avondale stay in separate
              blocks.
            </p>
          </Card>
        ) : (
          view.periods.map((period) => (
            <section key={`${period.periodStart}|${period.periodEnd}`} className="space-y-3">
              <div>
                <h2 className="text-sm font-semibold">Pay period {formatPayPeriod(period.periodStart, period.periodEnd)}</h2>
                <p className="text-xs text-muted">Each location is listed on its own.</p>
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
        <Metric label="Base pay" value={moneyExact(block.basePay)} hint="Excludes OT, tips, taxes" />
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
          <li key={employee.employeeName} className="flex items-start justify-between gap-3 py-2.5">
            <div>
              <p className="text-sm font-medium">{employee.employeeName}</p>
              <p className="text-xs text-muted">
                {formatHourCount(employee.hours)} hrs · {moneyExact(employee.hourlyRate)}/hr ·{" "}
                {employee.status === "approved" ? "Approved" : "Pending review"}
              </p>
            </div>
            <p className="tabular text-sm font-semibold">{moneyExact(employee.basePay)}</p>
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
