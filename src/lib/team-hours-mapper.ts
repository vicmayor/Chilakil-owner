import { z } from "zod";
import { phoenixSunday, shiftIsoDate } from "@/lib/dates";
import type { LocationId } from "@/lib/location";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .refine(isRealIsoDate, "Invalid calendar date");

/** Decimal(10, 2) money column. */
const money = z.number().finite().nonnegative().max(99_999_999.99);

/** Hours keep up to six decimal places. */
const hoursAmount = z.number().finite().nonnegative().max(999_999.999999);

const punchTimeMessage = "Use HH:MM or an ISO timestamp with an offset";

/** Plain clock, or a full timestamp such as 2026-10-04T07:58:00-07:00. Stored as sent. */
const punchTimeText = z.string().trim().min(1).max(40).refine(isPunchTime, punchTimeMessage);

const punchTime = punchTimeText.nullable();

const breakSchema = z.object({
  start: punchTimeText,
  end: punchTimeText,
});

const shiftId = z.string().trim().min(1).max(80);

const daySchema = z.object({
  date: isoDate,
  shiftId,
  clockIn: punchTime.optional(),
  clockOut: punchTime.optional(),
  breaks: z.array(breakSchema).max(20),
  unpaidBreakMinutes: z.number().int().nonnegative().max(10_080),
  breakTimesRecorded: z.boolean(),
  hourlyRate: money,
  hours: hoursAmount,
});

const openShiftSchema = z
  .object({
    shiftId: shiftId.optional(),
    id: shiftId.optional(),
    clockIn: punchTimeText,
  })
  .refine((value) => Boolean(value.shiftId || value.id), "Open shift needs a shiftId");

const employeeSchema = z.object({
  employeeId: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(120),
  location: z.enum(["glendale", "avondale"]),
  hourlyRate: money,
  status: z.enum(["pending", "approved"]),
  totalHours: hoursAmount,
  grossPayEstimate: money,
  appliedHourlyRates: z.array(money).max(20),
  openShifts: z.array(openShiftSchema).max(50),
  days: z.array(daySchema).max(40),
});

const responseSchema = z.object({
  periodStart: isoDate,
  periodEnd: isoDate,
  timezone: z.literal("America/Phoenix"),
  employees: z.array(employeeSchema).max(400),
});

export type TeamHoursStatus = "pending" | "approved";

export type MappedHoursBreak = {
  start: string;
  end: string;
};

export type MappedHoursSegment = {
  shiftId: string;
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  hours: number;
  hourlyRate: number;
  unpaidBreakMinutes: number;
  breakTimesRecorded: boolean;
  /** clockOut is null and hours are 0. Not included in counted hours. */
  open: boolean;
  breaks: MappedHoursBreak[];
};

export type MappedHoursOpenShift = {
  shiftId: string;
  clockIn: string;
};

export type MappedHoursEmployee = {
  locationId: LocationId;
  employeeId: string;
  employeeName: string;
  hourlyRate: number;
  status: TeamHoursStatus;
  totalHours: number;
  grossPayEstimate: number;
  appliedHourlyRates: number[];
  segments: MappedHoursSegment[];
  openShifts: MappedHoursOpenShift[];
};

export type MappedHoursPeriod = {
  periodStart: string;
  periodEnd: string;
  timezone: "America/Phoenix";
  employees: MappedHoursEmployee[];
};

export type MapHoursSuccess = { ok: true; period: MappedHoursPeriod };
export type MapHoursFailure = { ok: false; error: string };
export type MapHoursResult = MapHoursSuccess | MapHoursFailure;

/**
 * Turns one Team API hours payload into rows keyed by employee id and location.
 * Endpoint field names live here so a later API change stays in this file.
 */
export function mapTeamHoursResponse(input: unknown): MapHoursResult {
  const parsed = responseSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: `Invalid team hours payload: ${formatZod(parsed.error)}` };
  }
  const data = parsed.data;
  if (phoenixSunday(data.periodStart) !== data.periodStart) {
    return { ok: false, error: "periodStart must be a Sunday in America/Phoenix." };
  }
  const saturday = shiftIsoDate(data.periodStart, 6);
  if (data.periodEnd !== saturday) {
    return { ok: false, error: "periodEnd must be the Saturday of that Sunday–Saturday pay period." };
  }

  const employees: MappedHoursEmployee[] = [];
  const seen = new Set<string>();
  for (const [index, employee] of data.employees.entries()) {
    const key = `${employee.location}|${employee.employeeId}`;
    if (seen.has(key)) {
      return {
        ok: false,
        error: `Duplicate employee ${employee.employeeId} at ${employee.location}.`,
      };
    }
    seen.add(key);
    const segmentKeys = new Set<string>();
    const segments: MappedHoursSegment[] = [];
    for (const day of employee.days) {
      if (day.date < data.periodStart || day.date > data.periodEnd) {
        return {
          ok: false,
          error: `Employee ${index + 1} day ${day.date} is outside ${data.periodStart}–${data.periodEnd}.`,
        };
      }
      const segmentKey = `${day.shiftId}|${day.date}`;
      if (segmentKeys.has(segmentKey)) {
        return {
          ok: false,
          error: `Employee ${employee.employeeId} has two segments for shift ${day.shiftId} on ${day.date}.`,
        };
      }
      segmentKeys.add(segmentKey);
      const hours = round6(day.hours);
      const clockOut = day.clockOut ?? null;
      segments.push({
        shiftId: day.shiftId,
        date: day.date,
        clockIn: day.clockIn ?? null,
        clockOut,
        hours,
        hourlyRate: round2(day.hourlyRate),
        unpaidBreakMinutes: day.unpaidBreakMinutes,
        breakTimesRecorded: day.breakTimesRecorded,
        open: clockOut == null && hours === 0,
        breaks: day.breaks.map((brk) => ({ start: brk.start, end: brk.end })),
      });
    }
    segments.sort((a, b) => a.date.localeCompare(b.date) || a.shiftId.localeCompare(b.shiftId));

    const openKeys = new Set<string>();
    const openShifts: MappedHoursOpenShift[] = [];
    for (const shift of employee.openShifts) {
      const id = shift.shiftId ?? shift.id;
      if (!id) {
        return { ok: false, error: `Employee ${employee.employeeId} has an open shift without an id.` };
      }
      if (openKeys.has(id)) {
        return { ok: false, error: `Employee ${employee.employeeId} lists open shift ${id} twice.` };
      }
      openKeys.add(id);
      openShifts.push({ shiftId: id, clockIn: shift.clockIn });
    }

    employees.push({
      locationId: employee.location,
      employeeId: employee.employeeId,
      employeeName: employee.name,
      hourlyRate: round2(employee.hourlyRate),
      status: employee.status,
      totalHours: round6(employee.totalHours),
      grossPayEstimate: round2(employee.grossPayEstimate),
      appliedHourlyRates: employee.appliedHourlyRates.map(round2),
      segments,
      openShifts,
    });
  }

  return {
    ok: true,
    period: {
      periodStart: data.periodStart,
      periodEnd: data.periodEnd,
      timezone: "America/Phoenix",
      employees,
    },
  };
}

function formatZod(error: z.ZodError): string {
  return error.issues.map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`).join("; ");
}

const CLOCK_HH_MM = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const CLOCK_ISO =
  /^(\d{4}-\d{2}-\d{2})T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;

function isPunchTime(value: string): boolean {
  if (CLOCK_HH_MM.test(value)) return true;
  const iso = CLOCK_ISO.exec(value);
  return iso != null && isRealIsoDate(iso[1]);
}

function isRealIsoDate(iso: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const dt = new Date(Date.UTC(year, month - 1, day));
  return dt.getUTCFullYear() === year && dt.getUTCMonth() === month - 1 && dt.getUTCDate() === day;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round6(n: number): number {
  return Number(n.toFixed(6));
}
