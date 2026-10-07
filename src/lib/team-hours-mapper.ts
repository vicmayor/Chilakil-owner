import { z } from "zod";
import { phoenixSunday, shiftIsoDate } from "@/lib/dates";
import type { LocationId } from "@/lib/location";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .refine(isRealIsoDate, "Invalid calendar date");

/** Decimal(10, 2) column limit. */
const amount = z.number().finite().nonnegative().max(99_999_999.99);

const punchTime = z.string().trim().min(1).max(40).nullable();

const breakSchema = z.object({
  start: z.string().trim().min(1).max(40),
  end: z.string().trim().min(1).max(40),
});

const daySchema = z.object({
  date: isoDate,
  clockIn: punchTime.optional(),
  clockOut: punchTime.optional(),
  breaks: z.array(breakSchema).max(20),
  hours: amount,
});

const employeeSchema = z.object({
  employeeId: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(120),
  location: z.enum(["glendale", "avondale"]),
  hourlyRate: amount,
  status: z.enum(["pending", "approved"]),
  totalHours: amount,
  grossPayEstimate: amount,
  days: z.array(daySchema).max(7),
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

export type MappedHoursDay = {
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  hours: number;
  breaks: MappedHoursBreak[];
};

export type MappedHoursEmployee = {
  locationId: LocationId;
  employeeId: string;
  employeeName: string;
  hourlyRate: number;
  status: TeamHoursStatus;
  totalHours: number;
  grossPayEstimate: number;
  days: MappedHoursDay[];
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
    const dates = new Set<string>();
    const days: MappedHoursDay[] = [];
    for (const day of employee.days) {
      if (day.date < data.periodStart || day.date > data.periodEnd) {
        return {
          ok: false,
          error: `Employee ${index + 1} day ${day.date} is outside ${data.periodStart}–${data.periodEnd}.`,
        };
      }
      if (dates.has(day.date)) {
        return { ok: false, error: `Employee ${employee.employeeId} has two punches on ${day.date}.` };
      }
      dates.add(day.date);
      days.push({
        date: day.date,
        clockIn: day.clockIn ?? null,
        clockOut: day.clockOut ?? null,
        hours: round2(day.hours),
        breaks: day.breaks.map((brk) => ({ start: brk.start, end: brk.end })),
      });
    }
    days.sort((a, b) => a.date.localeCompare(b.date));
    employees.push({
      locationId: employee.location,
      employeeId: employee.employeeId,
      employeeName: employee.name,
      hourlyRate: round2(employee.hourlyRate),
      status: employee.status,
      totalHours: round2(employee.totalHours),
      grossPayEstimate: round2(employee.grossPayEstimate),
      days,
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
