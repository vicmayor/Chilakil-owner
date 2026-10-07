import { prisma } from "@/lib/db";
import { phoenixSunday, phoenixToday, shiftIsoDate } from "@/lib/dates";
import {
  createTeamHoursClient,
  TeamHoursApiError,
  type TeamHoursClient,
  type TeamHoursLocationQuery,
} from "@/lib/team-hours-client";
import { mapTeamHoursResponse, type MappedHoursEmployee, type MappedHoursPeriod } from "@/lib/team-hours-mapper";

/** How many Sunday–Saturday periods Sync now and cron pull, newest first. */
export const PAY_PERIODS_TO_SYNC = 8;

const SYNC_STATE_ID = "default";

export type SyncTeamHoursResult = {
  ok: boolean;
  connected: boolean;
  upserted: number;
  periods: number;
  error?: string;
};

export function recentPayPeriodStarts(today = phoenixToday(), count = PAY_PERIODS_TO_SYNC): string[] {
  const current = phoenixSunday(today);
  return Array.from({ length: count }, (_, index) => shiftIsoDate(current, -7 * index));
}

/**
 * Pull hours from the Team API and replace stored rows for those periods.
 * A missing client means the key is unset: connected is false and nothing is thrown.
 * 401, 400, 503, and network failures keep the last stored week and record the error.
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

  const ready: MappedHoursPeriod[] = [];
  for (const periodStart of periodStarts) {
    try {
      const payload = await client.fetchHours({ periodStart, location });
      const mapped = mapTeamHoursResponse(payload);
      if (!mapped.ok) throw new Error(mapped.error);
      if (mapped.period.periodStart !== periodStart) {
        throw new Error(`Team hours period ${mapped.period.periodStart} did not match requested ${periodStart}.`);
      }
      ready.push(mapped.period);
    } catch (error) {
      const message = retainMessage(error);
      if (!message) throw error;
      await recordSyncError(message);
      return { ok: false, connected: true, upserted: 0, periods: 0, error: message };
    }
  }

  const syncedAt = new Date();
  let upserted = 0;
  for (const period of ready) {
    upserted += await replacePeriod(period.periodStart, period.periodEnd, period.employees, location, syncedAt);
  }
  await recordSyncSuccess(syncedAt);
  return { ok: true, connected: true, upserted, periods: ready.length };
}

function retainMessage(error: unknown): string | null {
  if (error instanceof TeamHoursApiError) {
    if (error.status === 401) return "Team API rejected the key. Last hours are unchanged.";
    if (error.status === 400) return "Team API rejected the pay period. Last hours are unchanged.";
    if (error.status === 503) return "Team hours are temporarily unavailable. Last hours are unchanged.";
    return null;
  }
  if (error instanceof TypeError || isNetworkError(error)) {
    return "Couldn't reach the Team API. Last hours are unchanged.";
  }
  if (error instanceof Error) {
    return `${error.message} Last hours are unchanged.`;
  }
  return "Couldn't sync hours. Last hours are unchanged.";
}

function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.name === "AbortError" || error.name === "TimeoutError") return true;
  return /fetch failed|network|ECONNREFUSED|ENOTFOUND|ETIMEDOUT/i.test(error.message);
}

async function recordSyncSuccess(at: Date): Promise<void> {
  await prisma.teamHoursSyncState.upsert({
    where: { id: SYNC_STATE_ID },
    create: { id: SYNC_STATE_ID, lastSuccessAt: at, lastError: null, lastErrorAt: null },
    update: { lastSuccessAt: at, lastError: null, lastErrorAt: null },
  });
}

async function recordSyncError(message: string): Promise<void> {
  const at = new Date();
  await prisma.teamHoursSyncState.upsert({
    where: { id: SYNC_STATE_ID },
    create: { id: SYNC_STATE_ID, lastError: message, lastErrorAt: at },
    update: { lastError: message, lastErrorAt: at },
  });
}

async function replacePeriod(
  periodStart: string,
  periodEnd: string,
  employees: MappedHoursEmployee[],
  location: TeamHoursLocationQuery,
  syncedAt: Date,
): Promise<number> {
  const rows = employees.filter((employee) => location === "all" || employee.locationId === location);
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
        await tx.employeeHoursAppliedRate.deleteMany({ where: { periodId: saved.id } });
        await tx.employeeHoursOpenShift.deleteMany({ where: { periodId: saved.id } });
        await tx.employeeHoursDay.deleteMany({ where: { periodId: saved.id } });
        if (employee.appliedHourlyRates.length > 0) {
          await tx.employeeHoursAppliedRate.createMany({
            data: employee.appliedHourlyRates.map((hourlyRate, index) => ({
              periodId: saved.id,
              hourlyRate,
              sortOrder: index,
            })),
          });
        }
        if (employee.openShifts.length > 0) {
          await tx.employeeHoursOpenShift.createMany({
            data: employee.openShifts.map((shift) => ({
              periodId: saved.id,
              shiftId: shift.shiftId,
              clockIn: shift.clockIn,
            })),
          });
        }
        for (const segment of employee.segments) {
          await tx.employeeHoursDay.create({
            data: {
              periodId: saved.id,
              shiftId: segment.shiftId,
              date: segment.date,
              clockIn: segment.clockIn,
              clockOut: segment.clockOut,
              hours: segment.hours,
              hourlyRate: segment.hourlyRate,
              unpaidBreakMinutes: segment.unpaidBreakMinutes,
              breakTimesRecorded: segment.breakTimesRecorded,
              breaks: {
                create: segment.breaks.map((brk, index) => ({
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
