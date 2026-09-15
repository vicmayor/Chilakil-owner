import { prisma } from "@/lib/db";
import { getLocationScope } from "@/lib/scope";
import { locationIdsForScope, isCombinedScope, COMBINED_LABEL } from "@/lib/location";
import { phoenixToday } from "@/lib/dates";
import { moneyExact, pct } from "@/lib/format";
import { getDashboardData } from "@/lib/metrics";
import { TopBar } from "@/components/top-bar";
import { Card, CombinedBadge, LocationDot } from "@/components/ui";

export const metadata = { title: "Employees" };

export default async function EmployeesPage() {
  const scope = await getLocationScope();
  const ids = locationIdsForScope(scope);
  const today = phoenixToday();
  const data = await getDashboardData(scope, today);
  const employees = await prisma.employee.findMany({
    where: { locationId: { in: ids }, active: true },
    include: { shifts: { where: { date: today } } },
    orderBy: { name: "asc" },
  });

  return (
    <>
      <TopBar title="Employees" subtitle="Labor hours and cost by location" scope={scope} />
      <main className="space-y-4 px-4 py-4">
        {isCombinedScope(scope) && data.combined ? (
          <Card>
            <CombinedBadge />
            <p className="font-display mt-2 text-3xl font-semibold tabular">
              {moneyExact(data.combined.labor)}
            </p>
            <p className="text-sm text-muted">
              {COMBINED_LABEL} · {data.combined.laborHours} hrs · {pct(data.combined.laborPct)} of combined gross
            </p>
          </Card>
        ) : null}

        {data.locations.map((loc) => (
          <Card key={loc.locationId}>
            <LocationDot id={loc.locationId} />
            <p className="font-display mt-2 text-3xl font-semibold tabular">{moneyExact(loc.labor)}</p>
            <p className="text-sm text-muted">
              {loc.laborHours} hrs · {pct(loc.laborPct)} of gross · target {pct(loc.targetLaborPct)}
            </p>
            <ul className="mt-3 divide-y divide-line">
              {employees
                .filter((e) => e.locationId === loc.locationId)
                .map((e) => {
                  const shift = e.shifts[0];
                  return (
                    <li key={e.id} className="flex items-start justify-between py-2.5">
                      <div>
                        <p className="text-sm font-medium">{e.name}</p>
                        <p className="text-xs text-muted">
                          {e.role} · {moneyExact(e.hourlyRate)}/hr
                          {shift ? ` · ${shift.startTime}–${shift.endTime}` : " · off today"}
                        </p>
                      </div>
                      <p className="tabular text-sm font-semibold">
                        {shift ? moneyExact(shift.laborCost) : "—"}
                      </p>
                    </li>
                  );
                })}
            </ul>
          </Card>
        ))}
      </main>
    </>
  );
}
