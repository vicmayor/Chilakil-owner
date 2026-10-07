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

export type EmployeeHoursSegment = {
  shiftId: string;
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  hours: number;
  hourlyRate: number;
  unpaidBreakMinutes: number;
  breakTimesRecorded: boolean;
  open: boolean;
  breaks: EmployeeHoursBreak[];
};

export type EmployeeHoursOpenShift = {
  shiftId: string;
  clockIn: string;
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
  appliedHourlyRates: number[];
  segments: EmployeeHoursSegment[];
  openShifts: EmployeeHoursOpenShift[];
  syncedAt?: string;
};

export type SquareSalesDay = {
  locationId: LocationId;
  date: string;
  grossSales: number;
};

export type EmployeeDateHours = {
  date: string;
  hours: number;
};

export type EmployeeHoursLine = {
  employeeId: string;
  employeeName: string;
  hours: number;
  hourlyRate: number;
  grossPayEstimate: number;
  appliedHourlyRates: number[];
  segments: EmployeeHoursSegment[];
  openShifts: EmployeeHoursOpenShift[];
  /** Closed segments only. Open shifts are listed separately and add nothing. */
  dateHours: EmployeeDateHours[];
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
  employees: EmployeeHoursLine[];
};

export type PayPeriodHours = {
  periodStart: string;
  periodEnd: string;
  /** Team approval for the whole pay period. It is not per location or per employee. */
  status: TeamHoursStatus;
  statusCoversBothLocations: true;
  locations: LocationHoursBlock[];
};

export type EmployeeHoursView = {
  periods: PayPeriodHours[];
  latestSyncedAt: string | null;
  lastError: string | null;
};

/**
 * Pay periods for the location switcher.
 * ALL returns one labeled block per location that has rows. It does not add
 * hours, gross pay, or labor % across Glendale and Avondale.
 * Period status is computed from every location's rows, then the other store's
 * hours are hidden when a single location is selected.
 * Labor % uses that location's Square gross (daily sales) on the pay-period dates.
 * Hours and gross pay come from Team. Open shifts are not added in.
 */
export function buildEmployeeHoursView(
  rows: EmployeeHoursRow[],
  sales: SquareSalesDay[],
  scope: LocationScope,
): EmployeeHoursView {
  const allowed = new Set(locationIdsForScope(scope));
  const groups = new Map<string, EmployeeHoursRow[]>();
  for (const row of rows) {
    const key = `${row.periodStart}|${row.periodEnd}`;
    const list = groups.get(key);
    if (list) list.push(row);
    else groups.set(key, [row]);
  }

  const periods = [...groups.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .flatMap(([, periodRows]) => {
      const periodStart = periodRows[0].periodStart;
      const periodEnd = periodRows[0].periodEnd;
      const visible = periodRows.filter((row) => allowed.has(row.locationId));
      if (visible.length === 0) return [];
      const locations = LOCATION_IDS.filter((id) => allowed.has(id)).flatMap((locationId) => {
        const employees = visible
          .filter((row) => row.locationId === locationId)
          .sort((a, b) => a.employeeName.localeCompare(b.employeeName, "en") || a.employeeId.localeCompare(b.employeeId));
        if (employees.length === 0) return [];
        const hours = round6(employees.reduce((sum, row) => sum + row.totalHours, 0));
        const grossPayEstimate = round2(employees.reduce((sum, row) => sum + row.grossPayEstimate, 0));
        const salesByDate = new Map<string, number>();
        for (const day of sales) {
          if (day.locationId !== locationId) continue;
          if (day.date < periodStart || day.date > periodEnd) continue;
          salesByDate.set(day.date, day.grossSales);
        }
        const squareSales = round2([...salesByDate.values()].reduce((sum, gross) => sum + gross, 0));
        const block: LocationHoursBlock = {
          locationId,
          hours,
          grossPayEstimate,
          squareSales,
          salesDaysOnFile: salesByDate.size,
          periodDays: inclusiveIsoDays(periodStart, periodEnd),
          laborPct: squareSales > 0 ? grossPayEstimate / squareSales : null,
          employees: employees.map((row) => ({
            employeeId: row.employeeId,
            employeeName: row.employeeName,
            hours: row.totalHours,
            hourlyRate: row.hourlyRate,
            grossPayEstimate: row.grossPayEstimate,
            appliedHourlyRates: row.appliedHourlyRates,
            segments: row.segments,
            openShifts: row.openShifts,
            dateHours: dateHours(row.segments),
          })),
        };
        return [block];
      });
      const period: PayPeriodHours = {
        periodStart,
        periodEnd,
        status: periodRows.some((row) => row.status === "pending") ? "pending" : "approved",
        statusCoversBothLocations: true,
        locations,
      };
      return [period];
    });

  let latestSyncedAt: string | null = null;
  for (const row of rows) {
    if (!row.syncedAt) continue;
    if (!latestSyncedAt || row.syncedAt > latestSyncedAt) latestSyncedAt = row.syncedAt;
  }

  return { periods, latestSyncedAt, lastError: null };
}

export function dateHours(segments: EmployeeHoursSegment[]): EmployeeDateHours[] {
  const totals = new Map<string, number>();
  for (const segment of segments) {
    if (segment.open) continue;
    totals.set(segment.date, (totals.get(segment.date) ?? 0) + segment.hours);
  }
  return [...totals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, hours]) => ({ date, hours: round6(hours) }));
}

/** Empty break times are not "no break" when Team did not record the clock times. */
export function unpaidBreakNote(segment: Pick<EmployeeHoursSegment, "unpaidBreakMinutes" | "breakTimesRecorded">): string | null {
  if (!segment.breakTimesRecorded) {
    if (segment.unpaidBreakMinutes > 0) {
      return `${segment.unpaidBreakMinutes} min unpaid break, already deducted. Break times were not recorded.`;
    }
    return "Break times were not recorded.";
  }
  if (segment.unpaidBreakMinutes > 0) {
    return `${segment.unpaidBreakMinutes} min unpaid break, already deducted.`;
  }
  return null;
}

export async function loadEmployeeHoursView(scope: LocationScope): Promise<EmployeeHoursView> {
  const ids = locationIdsForScope(scope);
  const [rows, state] = await Promise.all([
    prisma.employeeHoursPeriod.findMany({
      include: {
        days: {
          orderBy: [{ date: "asc" }, { shiftId: "asc" }],
          include: { breaks: { orderBy: { sortOrder: "asc" } } },
        },
        appliedHourlyRates: { orderBy: { sortOrder: "asc" } },
        openShifts: { orderBy: { shiftId: "asc" } },
      },
    }),
    prisma.teamHoursSyncState.findUnique({ where: { id: "default" } }),
  ]);
  if (rows.length === 0) {
    return {
      periods: [],
      latestSyncedAt: state?.lastSuccessAt?.toISOString() ?? null,
      lastError: state?.lastError ?? null,
    };
  }

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

  const view = buildEmployeeHoursView(
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
          appliedHourlyRates: row.appliedHourlyRates.map((rate) => decimalToNumber(rate.hourlyRate)),
          openShifts: row.openShifts.map((shift) => ({ shiftId: shift.shiftId, clockIn: shift.clockIn })),
          syncedAt: row.syncedAt.toISOString(),
          segments: row.days.map((day) => {
            const hours = decimalToNumber(day.hours);
            return {
              shiftId: day.shiftId,
              date: day.date,
              clockIn: day.clockIn,
              clockOut: day.clockOut,
              hours,
              hourlyRate: decimalToNumber(day.hourlyRate),
              unpaidBreakMinutes: day.unpaidBreakMinutes,
              breakTimesRecorded: day.breakTimesRecorded,
              open: day.clockOut == null && hours === 0,
              breaks: day.breaks.map((brk) => ({ start: brk.start, end: brk.end })),
            };
          }),
        },
      ];
    }),
    sales.flatMap((day) => {
      if (!isLocationId(day.locationId)) return [];
      return [{ locationId: day.locationId, date: day.date, grossSales: day.grossSales }];
    }),
    scope,
  );
  return {
    ...view,
    latestSyncedAt: state?.lastSuccessAt?.toISOString() ?? view.latestSyncedAt,
    lastError: state?.lastError ?? null,
  };
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

function round6(n: number): number {
  return Number(n.toFixed(6));
}
