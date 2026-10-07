import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  isLocationId,
  LOCATION_IDS,
  locationIdsForScope,
  type LocationId,
  type LocationScope,
} from "@/lib/location";
import type { TeamHoursStatus } from "@/lib/team-hours-mapper";

export type EmployeeHoursBreak = {
  start: string;
  end: string;
};

export type EmployeeHoursDay = {
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  hours: number;
  breaks: EmployeeHoursBreak[];
};

export type EmployeeHoursRow = {
  locationId: LocationId;
  periodStart: string;
  periodEnd: string;
  employeeId: string;
  employeeName: string;
  hourlyRate: number;
  totalHours: number;
  grossPayEstimate: number;
  status: TeamHoursStatus;
  syncedAt?: string;
  days: EmployeeHoursDay[];
};

export type SquareSalesDay = {
  locationId: LocationId;
  date: string;
  grossSales: number;
};

export type EmployeeHoursLine = {
  employeeId: string;
  employeeName: string;
  hours: number;
  hourlyRate: number;
  grossPayEstimate: number;
  status: TeamHoursStatus;
  days: EmployeeHoursDay[];
};

export type LocationHoursBlock = {
  locationId: LocationId;
  hours: number;
  grossPayEstimate: number;
  squareSales: number;
  salesDaysOnFile: number;
  periodDays: number;
  /** Gross pay estimate divided by this location's Square gross. Null when sales are zero. */
  laborPct: number | null;
  review: "pending" | "approved" | "mixed";
  pendingCount: number;
  approvedCount: number;
  employees: EmployeeHoursLine[];
};

export type PayPeriodHours = {
  periodStart: string;
  periodEnd: string;
  locations: LocationHoursBlock[];
};

export type EmployeeHoursView = {
  periods: PayPeriodHours[];
  latestSyncedAt: string | null;
};

/**
 * Pay periods for the location switcher.
 * ALL returns one labeled block per location that has rows. It does not add
 * hours, gross pay, or labor % across Glendale and Avondale.
 * Labor % uses that location's Square gross (daily sales) on the pay-period dates.
 */
export function buildEmployeeHoursView(
  rows: EmployeeHoursRow[],
  sales: SquareSalesDay[],
  scope: LocationScope,
): EmployeeHoursView {
  const allowed = new Set(locationIdsForScope(scope));
  const scoped = rows.filter((row) => allowed.has(row.locationId));
  const groups = new Map<string, EmployeeHoursRow[]>();
  for (const row of scoped) {
    const key = `${row.periodStart}|${row.periodEnd}`;
    const list = groups.get(key);
    if (list) list.push(row);
    else groups.set(key, [row]);
  }

  const periods = [...groups.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([, periodRows]) => {
      const periodStart = periodRows[0].periodStart;
      const periodEnd = periodRows[0].periodEnd;
      const locations = LOCATION_IDS.filter((id) => allowed.has(id)).flatMap((locationId) => {
        const employees = periodRows
          .filter((row) => row.locationId === locationId)
          .sort((a, b) => a.employeeName.localeCompare(b.employeeName, "en") || a.employeeId.localeCompare(b.employeeId));
        if (employees.length === 0) return [];
        const hours = round2(employees.reduce((sum, row) => sum + row.totalHours, 0));
        const grossPayEstimate = round2(employees.reduce((sum, row) => sum + row.grossPayEstimate, 0));
        const salesByDate = new Map<string, number>();
        for (const day of sales) {
          if (day.locationId !== locationId) continue;
          if (day.date < periodStart || day.date > periodEnd) continue;
          salesByDate.set(day.date, day.grossSales);
        }
        const squareSales = round2([...salesByDate.values()].reduce((sum, gross) => sum + gross, 0));
        const pendingCount = employees.filter((row) => row.status === "pending").length;
        const approvedCount = employees.length - pendingCount;
        const block: LocationHoursBlock = {
          locationId,
          hours,
          grossPayEstimate,
          squareSales,
          salesDaysOnFile: salesByDate.size,
          periodDays: inclusiveIsoDays(periodStart, periodEnd),
          laborPct: squareSales > 0 ? grossPayEstimate / squareSales : null,
          review: pendingCount === 0 ? "approved" : approvedCount === 0 ? "pending" : "mixed",
          pendingCount,
          approvedCount,
          employees: employees.map((row) => ({
            employeeId: row.employeeId,
            employeeName: row.employeeName,
            hours: row.totalHours,
            hourlyRate: row.hourlyRate,
            grossPayEstimate: row.grossPayEstimate,
            status: row.status,
            days: row.days,
          })),
        };
        return [block];
      });
      return { periodStart, periodEnd, locations };
    });

  let latestSyncedAt: string | null = null;
  for (const row of scoped) {
    if (!row.syncedAt) continue;
    if (!latestSyncedAt || row.syncedAt > latestSyncedAt) latestSyncedAt = row.syncedAt;
  }

  return { periods, latestSyncedAt };
}

export async function loadEmployeeHoursView(scope: LocationScope): Promise<EmployeeHoursView> {
  const ids = locationIdsForScope(scope);
  const rows = await prisma.employeeHoursPeriod.findMany({
    where: { locationId: { in: ids } },
    include: {
      days: {
        orderBy: { date: "asc" },
        include: { breaks: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });
  if (rows.length === 0) return buildEmployeeHoursView([], [], scope);

  const periodStart = rows.reduce(
    (min, row) => (row.periodStart < min ? row.periodStart : min),
    rows[0].periodStart,
  );
  const periodEnd = rows.reduce(
    (max, row) => (row.periodEnd > max ? row.periodEnd : max),
    rows[0].periodEnd,
  );
  const sales = await prisma.dailySalesRecord.findMany({
    where: {
      locationId: { in: ids },
      date: { gte: periodStart, lte: periodEnd },
    },
    select: { locationId: true, date: true, grossSales: true },
  });

  return buildEmployeeHoursView(
    rows.flatMap((row) => {
      if (!isLocationId(row.locationId)) return [];
      return [
        {
          locationId: row.locationId,
          periodStart: row.periodStart,
          periodEnd: row.periodEnd,
          employeeId: row.employeeId,
          employeeName: row.employeeName,
          hourlyRate: decimalToNumber(row.hourlyRate),
          totalHours: decimalToNumber(row.totalHours),
          grossPayEstimate: decimalToNumber(row.grossPayEstimate),
          status: row.status,
          syncedAt: row.syncedAt.toISOString(),
          days: row.days.map((day) => ({
            date: day.date,
            clockIn: day.clockIn,
            clockOut: day.clockOut,
            hours: decimalToNumber(day.hours),
            breaks: day.breaks.map((brk) => ({ start: brk.start, end: brk.end })),
          })),
        },
      ];
    }),
    sales.flatMap((day) => {
      if (!isLocationId(day.locationId)) return [];
      return [{ locationId: day.locationId, date: day.date, grossSales: day.grossSales }];
    }),
    scope,
  );
}

function decimalToNumber(value: Prisma.Decimal): number {
  return value.toNumber();
}

function inclusiveIsoDays(start: string, end: string): number {
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  const days = Math.round((Date.UTC(ey, em - 1, ed) - Date.UTC(sy, sm - 1, sd)) / 86_400_000);
  return Math.max(0, days + 1);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
