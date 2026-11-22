import { phoenixMonday, shiftIsoDate } from "@/lib/dates";
import { COMBINED_LABEL, type LocationId } from "@/lib/location";

export type SalesRecord = {
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
  newCustomers: number | null;
  returningCustomers: number | null;
  identifiedCustomers: number | null;
  source: string;
  importedAt: string;
};

export type LocationDay = {
  locationId: LocationId;
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
  newCustomers: number | null;
  returningCustomers: number | null;
  identifiedCustomers: number | null;
  source: string;
  importedAt: string;
  sample: boolean;
};

export type PeriodSlice = {
  locationId: LocationId;
  gross: number;
  net: number;
  orders: number;
  days: number;
  newCustomers: number | null;
  returningCustomers: number | null;
  identifiedCustomers: number | null;
};

export type CustomerCounts = {
  newCustomers: number | null;
  returningCustomers: number | null;
  identifiedCustomers: number | null;
};

export type PeriodSummary = {
  start: string;
  end: string;
  byLocation: PeriodSlice[];
  combined: ({ gross: number; net: number; orders: number; label: string } & CustomerCounts) | null;
};

export type SalesView = {
  today: string;
  featuredDate: string | null;
  featuredIsToday: boolean;
  yesterdayDate: string;
  scopeIds: LocationId[];
  featured: Array<LocationDay | null>;
  yesterday: Array<LocationDay | null>;
  last7: Array<{
    date: string;
    grossByLocation: Array<number | null>;
    newCustomersByLocation: Array<number | null>;
  }>;
  weekToDate: PeriodSummary;
  lastWeek: PeriodSummary;
  history: Array<{ date: string; days: Array<LocationDay | null> }>;
  sampleOnFeatured: boolean;
  anySample: boolean;
  latestImportAt: string | null;
};

export function buildSalesView(records: SalesRecord[], ids: LocationId[], today: string): SalesView {
  const allowed = new Set(ids);
  const scoped = records.filter((record) => allowed.has(record.locationId));
  const featuredDate = scoped.some((record) => record.date === today)
    ? today
    : scoped.reduce<string | null>((latest, record) => {
        if (!latest || record.date > latest) return record.date;
        return latest;
      }, null);
  const yesterdayDate = shiftIsoDate(today, -1);
  const last7Dates = Array.from({ length: 7 }, (_, index) => shiftIsoDate(today, index - 6));
  const weekStart = phoenixMonday(today);
  const lastWeekStart = shiftIsoDate(weekStart, -7);
  const lastWeekEnd = shiftIsoDate(weekStart, -1);

  const historyDates = [...new Set(scoped.map((record) => record.date))].sort((a, b) =>
    a < b ? 1 : a > b ? -1 : 0,
  );

  return {
    today,
    featuredDate,
    featuredIsToday: featuredDate === today,
    yesterdayDate,
    scopeIds: ids,
    featured: ids.map((id) => dayFor(scoped, id, featuredDate)),
    yesterday: ids.map((id) => dayFor(scoped, id, yesterdayDate)),
    last7: last7Dates.map((date) => ({
      date,
      grossByLocation: ids.map((id) => dayFor(scoped, id, date)?.grossSales ?? null),
      newCustomersByLocation: ids.map((id) => dayFor(scoped, id, date)?.newCustomers ?? null),
    })),
    weekToDate: summarize(scoped, ids, weekStart, today),
    lastWeek: summarize(scoped, ids, lastWeekStart, lastWeekEnd),
    history: historyDates.map((date) => ({
      date,
      days: ids.map((id) => dayFor(scoped, id, date)),
    })),
    sampleOnFeatured: ids.some((id) => dayFor(scoped, id, featuredDate)?.sample ?? false),
    anySample: scoped.some((record) => record.source === "sample"),
    latestImportAt: scoped.reduce<string | null>((latest, record) => {
      if (!latest || record.importedAt > latest) return record.importedAt;
      return latest;
    }, null),
  };
}

export function grossChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return (current - previous) / previous;
}

function dayFor(records: SalesRecord[], locationId: LocationId, date: string | null): LocationDay | null {
  if (!date) return null;
  const record = records.find((row) => row.locationId === locationId && row.date === date);
  if (!record) return null;
  return {
    locationId: record.locationId,
    grossSales: record.grossSales,
    netSales: record.netSales,
    discounts: record.discounts,
    refunds: record.refunds,
    tips: record.tips,
    tax: record.tax,
    orderCount: record.orderCount,
    averageTicket: record.averageTicket,
    inStoreGross: record.inStoreGross,
    inStoreOrders: record.inStoreOrders,
    doorDashGross: record.doorDashGross,
    doorDashOrders: record.doorDashOrders,
    uberEatsGross: record.uberEatsGross,
    uberEatsOrders: record.uberEatsOrders,
    grubhubGross: record.grubhubGross,
    grubhubOrders: record.grubhubOrders,
    newCustomers: record.newCustomers,
    returningCustomers: record.returningCustomers,
    identifiedCustomers: record.identifiedCustomers,
    source: record.source,
    importedAt: record.importedAt,
    sample: record.source === "sample",
  };
}

function summarize(records: SalesRecord[], ids: LocationId[], start: string, end: string): PeriodSummary {
  const byLocation = ids.map((locationId) => {
    const rows = records.filter(
      (record) => record.locationId === locationId && record.date >= start && record.date <= end,
    );
    return {
      locationId,
      gross: round2(rows.reduce((sum, row) => sum + row.grossSales, 0)),
      net: round2(rows.reduce((sum, row) => sum + row.netSales, 0)),
      orders: rows.reduce((sum, row) => sum + row.orderCount, 0),
      days: rows.length,
      newCustomers: sumReported(rows.map((row) => row.newCustomers)),
      returningCustomers: sumReported(rows.map((row) => row.returningCustomers)),
      identifiedCustomers: sumReported(rows.map((row) => row.identifiedCustomers)),
    };
  });
  const combined =
    ids.length > 1
      ? {
          gross: round2(byLocation.reduce((sum, row) => sum + row.gross, 0)),
          net: round2(byLocation.reduce((sum, row) => sum + row.net, 0)),
          orders: byLocation.reduce((sum, row) => sum + row.orders, 0),
          label: COMBINED_LABEL,
          newCustomers: sumEvery(byLocation.map((row) => row.newCustomers)),
          returningCustomers: sumEvery(byLocation.map((row) => row.returningCustomers)),
          identifiedCustomers: sumEvery(byLocation.map((row) => row.identifiedCustomers)),
        }
      : null;
  return { start, end, byLocation, combined };
}

/** Sum the numbers that were actually reported. No reports means no data, not zero. */
function sumReported(values: Array<number | null>): number | null {
  const present = values.filter((value): value is number => value != null);
  if (present.length === 0) return null;
  return present.reduce((sum, value) => sum + value, 0);
}

/** Combined total only when every location reported a number. */
function sumEvery(values: Array<number | null>): number | null {
  if (values.length === 0 || values.some((value) => value == null)) return null;
  return values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
