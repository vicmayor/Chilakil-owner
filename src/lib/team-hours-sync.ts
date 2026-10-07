import { prisma } from "@/lib/db";
import { phoenixSunday, phoenixToday, shiftIsoDate } from "@/lib/dates";
import {
  createTeamHoursClient,
  type TeamHoursClient,
  type TeamHoursLocationQuery,
} from "@/lib/team-hours-client";
import { mapTeamHoursResponse, type MappedHoursEmployee } from "@/lib/team-hours-mapper";

/** How many Sunday–Saturday periods Sync now and cron pull, newest first. */
export const PAY_PERIODS_TO_SYNC = 8;

export type SyncTeamHoursResult = {
  ok: boolean;
  connected: boolean;
  upserted: number;
  periods: number;
};

export function recentPayPeriodStarts(today = phoenixToday(), count = PAY_PERIODS_TO_SYNC): string[] {
  const current = phoenixSunday(today);
  return Array.from({ length: count }, (_, index) => shiftIsoDate(current, -7 * index));
}

/**
 * Pull hours from the Team API and replace stored punches for those periods.
 * A missing client means the env vars are unset: connected is false and nothing is thrown.
 */
export async function syncTeamHours(options?: {
  client?: TeamHoursClient | null;
  periodStarts?: string[];
  location?: TeamHoursLocationQuery;
}): Promise<SyncTeamHoursResult> {
  const client = options && "client" in options ? options.client : createTeamHoursClient();
  const location = options?.location ?? "all";
  const periodStarts = options?.periodStarts ?? recentPayPeriodStarts();
  if (!client) {
    return { ok: false, connected: false, upserted: 0, periods: 0 };
  }

  let upserted = 0;
  for (const periodStart of periodStarts) {
    const payload = await client.fetchHours({ periodStart, location });
    const mapped = mapTeamHoursResponse(payload);
    if (!mapped.ok) {
      throw new Error(mapped.error);
    }
    if (mapped.period.periodStart !== periodStart) {
      throw new Error(`Team hours period ${mapped.period.periodStart} did not match requested ${periodStart}.`);
    }
    upserted += await replacePeriod(mapped.period.periodStart, mapped.period.periodEnd, mapped.period.employees, location);
  }

  return { ok: true, connected: true, upserted, periods: periodStarts.length };
}

async function replacePeriod(
  periodStart: string,
  periodEnd: string,
  employees: MappedHoursEmployee[],
  location: TeamHoursLocationQuery,
): Promise<number> {
  const rows = employees.filter((employee) => location === "all" || employee.locationId === location);
  const syncedAt = new Date();
  await prisma.$transaction(
    async (tx) => {
      for (const employee of rows) {
        const saved = await tx.employeeHoursPeriod.upsert({
          where: {
            locationId_periodStart_employeeId: {
              locationId: employee.locationId,
              periodStart,
              employeeId: employee.employeeId,
            },
          },
          create: {
            locationId: employee.locationId,
            periodStart,
            periodEnd,
            employeeId: employee.employeeId,
            employeeName: employee.employeeName,
            hourlyRate: employee.hourlyRate,
            totalHours: employee.totalHours,
            grossPayEstimate: employee.grossPayEstimate,
            status: employee.status,
            syncedAt,
          },
          update: {
            periodEnd,
            employeeName: employee.employeeName,
            hourlyRate: employee.hourlyRate,
            totalHours: employee.totalHours,
            grossPayEstimate: employee.grossPayEstimate,
            status: employee.status,
            syncedAt,
          },
        });
        await tx.employeeHoursDay.deleteMany({ where: { periodId: saved.id } });
        for (const day of employee.days) {
          await tx.employeeHoursDay.create({
            data: {
              periodId: saved.id,
              date: day.date,
              clockIn: day.clockIn,
              clockOut: day.clockOut,
              hours: day.hours,
              breaks: {
                create: day.breaks.map((brk, index) => ({
                  start: brk.start,
                  end: brk.end,
                  sortOrder: index,
                })),
              },
            },
          });
        }
      }

      const keep = new Set(rows.map((employee) => `${employee.locationId}|${employee.employeeId}`));
      const existing = await tx.employeeHoursPeriod.findMany({
        where: {
          periodStart,
          ...(location === "all" ? {} : { locationId: location }),
        },
        select: { id: true, locationId: true, employeeId: true },
      });
      const staleIds = existing
        .filter((row) => !keep.has(`${row.locationId}|${row.employeeId}`))
        .map((row) => row.id);
      if (staleIds.length > 0) {
        await tx.employeeHoursPeriod.deleteMany({ where: { id: { in: staleIds } } });
      }
    },
    { timeout: 20_000 },
  );
  return rows.length;
}
