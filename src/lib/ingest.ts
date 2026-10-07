import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { DOORDASH_STORE_IDS, locationForDoorDashStore } from "@/lib/doordash-stores";
import { UBEREATS_STORE_IDS, locationForUberStore } from "@/lib/ubereats-stores";
import type { LocationId } from "@/lib/location";

const MAX_BATCH = 400;

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .refine(isRealIsoDate, "Invalid calendar date");

const money = z.number().finite();
const nonNegMoney = z.number().finite().nonnegative();
const count = z.number().int().nonnegative();

const channelSlice = z.object({
  gross: nonNegMoney,
  orders: count,
});

const channelsSchema = z.object({
  inStore: channelSlice.optional(),
  in_store: channelSlice.optional(),
  doorDash: channelSlice.optional(),
  doordash: channelSlice.optional(),
  uberEats: channelSlice.optional(),
  ubereats: channelSlice.optional(),
  grubhub: channelSlice.optional(),
});

export const dailySalesRecordSchema = z.object({
  location: z.enum(["glendale", "avondale"]),
  date: isoDate,
  grossSales: nonNegMoney,
  netSales: money,
  discounts: nonNegMoney.optional(),
  refunds: nonNegMoney.optional(),
  tips: nonNegMoney.optional(),
  tax: nonNegMoney.nullable().optional(),
  orderCount: count,
  averageTicket: nonNegMoney.optional(),
  channels: channelsSchema.optional(),
  inStoreGross: nonNegMoney.optional(),
  inStoreOrders: count.optional(),
  doorDashGross: nonNegMoney.optional(),
  doorDashOrders: count.optional(),
  uberEatsGross: nonNegMoney.optional(),
  uberEatsOrders: count.optional(),
  grubhubGross: nonNegMoney.optional(),
  grubhubOrders: count.optional(),
  source: z.string().trim().min(1).max(80),
});

export const doorDashWeeklyRecordSchema = z
  .object({
    location: z.enum(["glendale", "avondale"]),
    doorDashStoreId: z.union([z.string(), z.number()]).transform((value) => String(value).trim()),
    weekStart: isoDate,
    weekEnd: isoDate,
    subtotal: nonNegMoney.optional(),
    gross: nonNegMoney.optional(),
    orderCount: count,
    commission: nonNegMoney,
    marketingFees: nonNegMoney.optional(),
    promoFees: nonNegMoney.optional(),
    errorCharges: nonNegMoney.optional(),
    adjustments: nonNegMoney.optional(),
    netPayout: money,
    effectiveCommissionPct: z.number().finite().nonnegative().max(100).optional(),
    deliveryOrders: count.optional(),
    pickupOrders: count.optional(),
    deliverySubtotal: nonNegMoney.optional(),
    pickupSubtotal: nonNegMoney.optional(),
    deliveryGross: nonNegMoney.optional(),
    pickupGross: nonNegMoney.optional(),
    source: z.string().trim().min(1).max(80),
  })
  .refine((data) => data.subtotal !== undefined || data.gross !== undefined, {
    message: "subtotal or gross is required",
    path: ["subtotal"],
  });

const signedMoney = z.number().finite();

export const uberEatsWeeklyRecordSchema = z.object({
  location: z.enum(["glendale", "avondale"]),
  uberStoreId: z.string().trim().min(1),
  weekStart: isoDate,
  weekEnd: isoDate,
  subtotal: nonNegMoney,
  tax: nonNegMoney,
  gross: nonNegMoney,
  orderCount: count,
  deliveryOrders: count,
  pickupOrders: count,
  commission: signedMoney,
  marketingFees: signedMoney,
  promoFees: signedMoney,
  adjustments: signedMoney,
  errorCharges: signedMoney.nullable().optional(),
  netPayout: money,
  source: z.string().trim().min(1).max(80),
});

const ingestLocation = z
  .string()
  .trim()
  .transform((value) => value.toLowerCase())
  .pipe(z.enum(["glendale", "avondale"]));

const employeeHoursStatus = z
  .string()
  .trim()
  .transform((value) => value.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " "))
  .transform((value) => (value === "pending review" ? "pending" : value))
  .pipe(z.enum(["pending", "approved"]));

/** Decimal(10, 2) column limit: 99,999,999.99 */
const payrollAmount = z.number().finite().nonnegative().max(99_999_999.99);

export const employeeHoursRecordSchema = z.object({
  location: ingestLocation,
  periodStart: isoDate,
  periodEnd: isoDate,
  employeeName: z.string().trim().min(1).max(120),
  hours: payrollAmount,
  hourlyRate: payrollAmount,
  basePay: payrollAmount,
  status: employeeHoursStatus,
  source: z.string().trim().min(1).max(80),
});

export const DAILY_SALES_NUMERIC_COLUMNS = new Set([
  "grossSales",
  "netSales",
  "discounts",
  "refunds",
  "tips",
  "tax",
  "orderCount",
  "averageTicket",
  "inStoreGross",
  "inStoreOrders",
  "doorDashGross",
  "doorDashOrders",
  "uberEatsGross",
  "uberEatsOrders",
  "grubhubGross",
  "grubhubOrders",
]);

export const DOORDASH_WEEKLY_NUMERIC_COLUMNS = new Set([
  "subtotal",
  "gross",
  "orderCount",
  "commission",
  "marketingFees",
  "promoFees",
  "errorCharges",
  "adjustments",
  "netPayout",
  "effectiveCommissionPct",
  "deliveryOrders",
  "pickupOrders",
  "deliverySubtotal",
  "pickupSubtotal",
  "deliveryGross",
  "pickupGross",
]);

export const UBEREATS_WEEKLY_NUMERIC_COLUMNS = new Set([
  "subtotal",
  "tax",
  "gross",
  "orderCount",
  "deliveryOrders",
  "pickupOrders",
  "commission",
  "marketingFees",
  "promoFees",
  "adjustments",
  "errorCharges",
  "netPayout",
]);

export const EMPLOYEE_HOURS_NUMERIC_COLUMNS = new Set(["hours", "hourlyRate", "basePay"]);

export type NormalizedDailySale = {
  locationId: LocationId;
  date: string;
  grossSales: number;
  netSales: number;
  discounts: number;
  refunds: number;
  tips: number;
  tax: number | null;
  orderCount: number;
  averageTicket: number;
  inStoreGross: number | null;
  inStoreOrders: number | null;
  doorDashGross: number | null;
  doorDashOrders: number | null;
  uberEatsGross: number | null;
  uberEatsOrders: number | null;
  grubhubGross: number | null;
  grubhubOrders: number | null;
  source: string;
};

export type NormalizedWeeklyReport = {
  locationId: LocationId;
  doorDashStoreId: string;
  weekStart: string;
  weekEnd: string;
  subtotal: number;
  gross: number;
  orderCount: number;
  commission: number;
  marketingFees: number;
  errorCharges: number;
  adjustments: number;
  netPayout: number;
  effectiveCommissionPct: number;
  deliveryOrders: number | null;
  pickupOrders: number | null;
  deliverySubtotal: number | null;
  pickupSubtotal: number | null;
  source: string;
};

export type NormalizedUberEatsWeek = {
  locationId: LocationId;
  uberStoreId: string;
  weekStart: string;
  weekEnd: string;
  subtotal: number;
  tax: number;
  gross: number;
  orderCount: number;
  deliveryOrders: number;
  pickupOrders: number;
  commission: number;
  marketingFees: number;
  promoFees: number;
  adjustments: number;
  errorCharges: number | null;
  netPayout: number;
  source: string;
};

export type EmployeeHoursStatus = "pending" | "approved";

export type NormalizedEmployeeHours = {
  locationId: LocationId;
  periodStart: string;
  periodEnd: string;
  employeeName: string;
  hours: number;
  hourlyRate: number;
  basePay: number;
  status: EmployeeHoursStatus;
  source: string;
};

export type ParseSuccess<T> = { ok: true; records: T[] };
export type ParseFailure = { ok: false; error: string; issues: string[] };
export type ParseResult<T> = ParseSuccess<T> | ParseFailure;

export function bearerMatches(authorization: string | null, expected: string | undefined): boolean {
  if (!expected) return false;
  const header = authorization ?? "";
  const prefix = "Bearer ";
  if (!header.startsWith(prefix)) return false;
  const presented = header.slice(prefix.length);
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  if (a.length === 0 || a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function isIngestAuthorized(request: Request): boolean {
  return bearerMatches(request.headers.get("authorization"), process.env.INGEST_TOKEN);
}

export function parseDailySalesBody(input: unknown): ParseResult<NormalizedDailySale> {
  const unwrapped = unwrapRecords(input);
  if (!unwrapped.ok) return unwrapped;
  const records: NormalizedDailySale[] = [];
  const issues: string[] = [];
  unwrapped.records.forEach((raw, index) => {
    const parsed = dailySalesRecordSchema.safeParse(raw);
    if (!parsed.success) {
      issues.push(`Record ${index + 1}: ${formatZod(parsed.error)}`);
      return;
    }
    const reserved = reservedSource(parsed.data.source, index);
    if (reserved) {
      issues.push(reserved);
      return;
    }
    records.push(normalizeDaily(parsed.data));
  });
  if (issues.length) return { ok: false, error: "Invalid daily sales payload", issues };
  const duplicate = duplicateKey(records.map((record) => `${record.locationId}|${record.date}`));
  if (duplicate) {
    return { ok: false, error: "Duplicate location and date in batch", issues: [duplicate] };
  }
  return { ok: true, records };
}

export function parseDoorDashWeeklyBody(input: unknown): ParseResult<NormalizedWeeklyReport> {
  const unwrapped = unwrapRecords(input);
  if (!unwrapped.ok) return unwrapped;
  const records: NormalizedWeeklyReport[] = [];
  const issues: string[] = [];
  unwrapped.records.forEach((raw, index) => {
    const parsed = doorDashWeeklyRecordSchema.safeParse(raw);
    if (!parsed.success) {
      issues.push(`Record ${index + 1}: ${formatZod(parsed.error)}`);
      return;
    }
    const reserved = reservedSource(parsed.data.source, index);
    if (reserved) {
      issues.push(reserved);
      return;
    }
    const isolated = isolateWeekly(parsed.data, index);
    if (!isolated.ok) {
      issues.push(isolated.issue);
      return;
    }
    records.push(isolated.record);
  });
  if (issues.length) return { ok: false, error: "Invalid DoorDash weekly payload", issues };
  const duplicate = duplicateKey(records.map((record) => `${record.locationId}|${record.weekStart}`));
  if (duplicate) {
    return { ok: false, error: "Duplicate location and week start in batch", issues: [duplicate] };
  }
  return { ok: true, records };
}

export function parseUberEatsWeeklyBody(input: unknown): ParseResult<NormalizedUberEatsWeek> {
  const unwrapped = unwrapRecords(input);
  if (!unwrapped.ok) return unwrapped;
  const records: NormalizedUberEatsWeek[] = [];
  const issues: string[] = [];
  unwrapped.records.forEach((raw, index) => {
    const parsed = uberEatsWeeklyRecordSchema.safeParse(raw);
    if (!parsed.success) {
      issues.push(`Record ${index + 1}: ${formatZod(parsed.error)}`);
      return;
    }
    const reserved = reservedSource(parsed.data.source, index);
    if (reserved) {
      issues.push(reserved);
      return;
    }
    const isolated = isolateUberWeekly(parsed.data, index);
    if (!isolated.ok) {
      issues.push(isolated.issue);
      return;
    }
    records.push(isolated.record);
  });
  if (issues.length) return { ok: false, error: "Invalid Uber Eats weekly payload", issues };
  const duplicate = duplicateKey(records.map((record) => `${record.locationId}|${record.weekStart}`));
  if (duplicate) {
    return { ok: false, error: "Duplicate location and week start in batch", issues: [duplicate] };
  }
  return { ok: true, records };
}

export function parseEmployeeHoursBody(input: unknown): ParseResult<NormalizedEmployeeHours> {
  const unwrapped = unwrapRecords(input);
  if (!unwrapped.ok) return unwrapped;
  const records: NormalizedEmployeeHours[] = [];
  const issues: string[] = [];
  unwrapped.records.forEach((raw, index) => {
    const parsed = employeeHoursRecordSchema.safeParse(raw);
    if (!parsed.success) {
      issues.push(`Record ${index + 1}: ${formatZod(parsed.error)}`);
      return;
    }
    const reserved = reservedSource(parsed.data.source, index);
    if (reserved) {
      issues.push(reserved);
      return;
    }
    if (parsed.data.periodEnd < parsed.data.periodStart) {
      issues.push(`Record ${index + 1}: periodEnd must be on or after periodStart.`);
      return;
    }
    records.push({
      locationId: parsed.data.location,
      periodStart: parsed.data.periodStart,
      periodEnd: parsed.data.periodEnd,
      employeeName: parsed.data.employeeName,
      hours: round2(parsed.data.hours),
      hourlyRate: round2(parsed.data.hourlyRate),
      basePay: round2(parsed.data.basePay),
      status: parsed.data.status,
      source: parsed.data.source,
    });
  });
  if (issues.length) return { ok: false, error: "Invalid employee hours payload", issues };
  const duplicate = duplicateKey(
    records.map((record) => `${record.locationId}|${record.periodStart}|${record.employeeName}`),
  );
  if (duplicate) {
    return {
      ok: false,
      error: "Duplicate location, period start, and employee in batch",
      issues: [duplicate],
    };
  }
  return { ok: true, records };
}

export async function upsertDailySales(records: NormalizedDailySale[]) {
  const importedAt = new Date();
  return prisma.$transaction(
    records.map((record) =>
      prisma.dailySalesRecord.upsert({
        where: {
          locationId_date: { locationId: record.locationId, date: record.date },
        },
        create: { ...record, importedAt },
        update: { ...record, importedAt },
      }),
    ),
  );
}

export async function upsertDoorDashWeekly(records: NormalizedWeeklyReport[]) {
  const importedAt = new Date();
  return prisma.$transaction(
    records.map((record) =>
      prisma.doorDashWeeklyReport.upsert({
        where: {
          locationId_weekStart: {
            locationId: record.locationId,
            weekStart: record.weekStart,
          },
        },
        create: { ...record, importedAt },
        update: { ...record, importedAt },
      }),
    ),
  );
}

export async function upsertEmployeeHours(records: NormalizedEmployeeHours[]) {
  const syncedAt = new Date();
  return prisma.$transaction(
    records.map((record) =>
      prisma.employeeHoursPeriod.upsert({
        where: {
          locationId_periodStart_employeeName: {
            locationId: record.locationId,
            periodStart: record.periodStart,
            employeeName: record.employeeName,
          },
        },
        create: { ...record, syncedAt },
        update: { ...record, syncedAt },
      }),
    ),
  );
}

export async function upsertUberEatsWeekly(records: NormalizedUberEatsWeek[]) {
  const importedAt = new Date();
  return prisma.$transaction(
    records.map((record) =>
      prisma.uberEatsWeeklyReport.upsert({
        where: {
          locationId_weekStart: {
            locationId: record.locationId,
            weekStart: record.weekStart,
          },
        },
        create: { ...record, importedAt },
        update: { ...record, importedAt },
      }),
    ),
  );
}

function normalizeDaily(data: z.infer<typeof dailySalesRecordSchema>): NormalizedDailySale {
  const channels = data.channels;
  const inStore = channels?.inStore ?? channels?.in_store;
  const doorDash = channels?.doorDash ?? channels?.doordash;
  const uberEats = channels?.uberEats ?? channels?.ubereats;
  const grubhub = channels?.grubhub;
  const orderCount = data.orderCount;
  return {
    locationId: data.location,
    date: data.date,
    grossSales: round2(data.grossSales),
    netSales: round2(data.netSales),
    discounts: round2(data.discounts ?? 0),
    refunds: round2(data.refunds ?? 0),
    tips: round2(data.tips ?? 0),
    tax: data.tax == null ? null : round2(data.tax),
    orderCount,
    averageTicket:
      data.averageTicket != null
        ? round2(data.averageTicket)
        : orderCount > 0
          ? round2(data.grossSales / orderCount)
          : 0,
    inStoreGross: inStore?.gross ?? data.inStoreGross ?? null,
    inStoreOrders: inStore?.orders ?? data.inStoreOrders ?? null,
    doorDashGross: doorDash?.gross ?? data.doorDashGross ?? null,
    doorDashOrders: doorDash?.orders ?? data.doorDashOrders ?? null,
    uberEatsGross: uberEats?.gross ?? data.uberEatsGross ?? null,
    uberEatsOrders: uberEats?.orders ?? data.uberEatsOrders ?? null,
    grubhubGross: grubhub?.gross ?? data.grubhubGross ?? null,
    grubhubOrders: grubhub?.orders ?? data.grubhubOrders ?? null,
    source: data.source,
  };
}

function isolateWeekly(
  data: z.infer<typeof doorDashWeeklyRecordSchema>,
  index: number,
): { ok: true; record: NormalizedWeeklyReport } | { ok: false; issue: string } {
  const span = daysBetween(data.weekStart, data.weekEnd);
  if (span !== 6) {
    return {
      ok: false,
      issue: `Record ${index + 1}: weekEnd must be 6 days after weekStart (a 7-day week).`,
    };
  }
  const owner = locationForDoorDashStore(data.doorDashStoreId);
  if (!owner) {
    return {
      ok: false,
      issue: `Record ${index + 1}: DoorDash store ${data.doorDashStoreId} is not a Chilakil store. Glendale is ${DOORDASH_STORE_IDS.glendale} and Avondale is ${DOORDASH_STORE_IDS.avondale}.`,
    };
  }
  if (owner !== data.location) {
    return {
      ok: false,
      issue: `Record ${index + 1}: DoorDash store ${data.doorDashStoreId} belongs to ${owner}, not ${data.location}. Refusing to write across locations.`,
    };
  }
  const subtotal = data.subtotal ?? data.gross ?? 0;
  const gross = data.gross ?? subtotal;
  const marketingFees = data.marketingFees ?? data.promoFees ?? 0;
  const effective =
    data.effectiveCommissionPct != null
      ? data.effectiveCommissionPct / 100
      : subtotal > 0
        ? data.commission / subtotal
        : 0;
  return {
    ok: true,
    record: {
      locationId: data.location,
      doorDashStoreId: data.doorDashStoreId,
      weekStart: data.weekStart,
      weekEnd: data.weekEnd,
      subtotal: round2(subtotal),
      gross: round2(gross),
      orderCount: data.orderCount,
      commission: round2(data.commission),
      marketingFees: round2(marketingFees),
      errorCharges: round2(data.errorCharges ?? 0),
      adjustments: round2(data.adjustments ?? 0),
      netPayout: round2(data.netPayout),
      effectiveCommissionPct: round4(effective),
      deliveryOrders: data.deliveryOrders ?? null,
      pickupOrders: data.pickupOrders ?? null,
      deliverySubtotal: data.deliverySubtotal ?? data.deliveryGross ?? null,
      pickupSubtotal: data.pickupSubtotal ?? data.pickupGross ?? null,
      source: data.source,
    },
  };
}

function isolateUberWeekly(
  data: z.infer<typeof uberEatsWeeklyRecordSchema>,
  index: number,
): { ok: true; record: NormalizedUberEatsWeek } | { ok: false; issue: string } {
  const span = daysBetween(data.weekStart, data.weekEnd);
  if (span !== 6) {
    return {
      ok: false,
      issue: `Record ${index + 1}: weekEnd must be 6 days after weekStart (a 7-day week).`,
    };
  }
  const owner = locationForUberStore(data.uberStoreId);
  if (!owner) {
    return {
      ok: false,
      issue: `Record ${index + 1}: Uber Eats store ${data.uberStoreId} is not a Chilakil store. Glendale is ${UBEREATS_STORE_IDS.glendale} and Avondale is ${UBEREATS_STORE_IDS.avondale}.`,
    };
  }
  if (owner !== data.location) {
    return {
      ok: false,
      issue: `Record ${index + 1}: Uber Eats store ${data.uberStoreId} belongs to ${owner}, not ${data.location}. Refusing to write across locations.`,
    };
  }
  return {
    ok: true,
    record: {
      locationId: data.location,
      uberStoreId: UBEREATS_STORE_IDS[owner],
      weekStart: data.weekStart,
      weekEnd: data.weekEnd,
      subtotal: round2(data.subtotal),
      tax: round2(data.tax),
      gross: round2(data.gross),
      orderCount: data.orderCount,
      deliveryOrders: data.deliveryOrders,
      pickupOrders: data.pickupOrders,
      commission: round2(data.commission),
      marketingFees: round2(data.marketingFees),
      promoFees: round2(data.promoFees),
      adjustments: round2(data.adjustments),
      errorCharges: data.errorCharges == null ? null : round2(data.errorCharges),
      netPayout: round2(data.netPayout),
      source: data.source,
    },
  };
}

function unwrapRecords(input: unknown): ParseSuccess<unknown> | ParseFailure {
  if (Array.isArray(input)) return bounded(input);
  if (input && typeof input === "object" && "records" in input) {
    const records = (input as { records: unknown }).records;
    if (!Array.isArray(records)) {
      return { ok: false, error: "Invalid payload", issues: ["records must be an array."] };
    }
    return bounded(records);
  }
  if (input && typeof input === "object") return { ok: true, records: [input] };
  return {
    ok: false,
    error: "Invalid payload",
    issues: ["Expected a JSON object, an array, or { records: [...] }."],
  };
}

function bounded(records: unknown[]): ParseSuccess<unknown> | ParseFailure {
  if (records.length === 0) {
    return { ok: false, error: "Empty batch", issues: ["Provide at least one record."] };
  }
  if (records.length > MAX_BATCH) {
    return { ok: false, error: "Batch too large", issues: [`Maximum ${MAX_BATCH} records.`] };
  }
  return { ok: true, records };
}

function reservedSource(source: string, index: number): string | null {
  if (source.toLowerCase() === "sample") {
    return `Record ${index + 1}: source "sample" is reserved for the local demo seed.`;
  }
  return null;
}

function duplicateKey(keys: string[]): string | null {
  const seen = new Set<string>();
  for (const key of keys) {
    if (seen.has(key)) return `Duplicate key ${key.replaceAll("|", " / ")} in the same batch.`;
    seen.add(key);
  }
  return null;
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

function daysBetween(start: string, end: string): number {
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  return Math.round((Date.UTC(ey, em - 1, ed) - Date.UTC(sy, sm - 1, sd)) / 86_400_000);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}
