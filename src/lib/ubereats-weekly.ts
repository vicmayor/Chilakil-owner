import { COMBINED_LABEL, type LocationId } from "@/lib/location";

export type UberEatsWeek = {
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
  /** Absolute commission divided by subtotal. Statement commission is often negative. */
  effectiveCommissionPct: number;
  source: string;
  importedAt: string;
};

export type CombinedUberEatsWeek = {
  label: string;
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
  effectiveCommissionPct: number;
  locationsIncluded: LocationId[];
};

/** Marketplace fee rate. Uses the absolute commission so a negative statement fee still reads as a rate. */
export function effectiveCommissionPct(commission: number, subtotal: number): number {
  if (subtotal <= 0) return 0;
  return Math.abs(commission) / subtotal;
}

export function reportsForLocations(rows: UberEatsWeek[], ids: LocationId[]): UberEatsWeek[] {
  const allowed = new Set(ids);
  return rows.filter((row) => allowed.has(row.locationId));
}

export function latestSharedWeek(rows: UberEatsWeek[]): string | null {
  return rows.reduce<string | null>((latest, row) => {
    if (!latest || row.weekStart > latest) return row.weekStart;
    return latest;
  }, null);
}

/** Commission rate is total commission divided by total subtotal, not an average of percents. */
export function combineWeek(rows: UberEatsWeek[]): CombinedUberEatsWeek | null {
  if (rows.length === 0) return null;
  const subtotal = rows.reduce((sum, row) => sum + row.subtotal, 0);
  const commission = rows.reduce((sum, row) => sum + row.commission, 0);
  const errorCharges = rows.some((row) => row.errorCharges == null)
    ? null
    : round2(rows.reduce((sum, row) => sum + (row.errorCharges ?? 0), 0));
  return {
    label: COMBINED_LABEL,
    weekStart: rows[0].weekStart,
    weekEnd: rows[0].weekEnd,
    subtotal: round2(subtotal),
    tax: round2(rows.reduce((sum, row) => sum + row.tax, 0)),
    gross: round2(rows.reduce((sum, row) => sum + row.gross, 0)),
    orderCount: rows.reduce((sum, row) => sum + row.orderCount, 0),
    deliveryOrders: rows.reduce((sum, row) => sum + row.deliveryOrders, 0),
    pickupOrders: rows.reduce((sum, row) => sum + row.pickupOrders, 0),
    commission: round2(commission),
    marketingFees: round2(rows.reduce((sum, row) => sum + row.marketingFees, 0)),
    promoFees: round2(rows.reduce((sum, row) => sum + row.promoFees, 0)),
    adjustments: round2(rows.reduce((sum, row) => sum + row.adjustments, 0)),
    errorCharges,
    netPayout: round2(rows.reduce((sum, row) => sum + row.netPayout, 0)),
    effectiveCommissionPct: effectiveCommissionPct(commission, subtotal),
    locationsIncluded: rows.map((row) => row.locationId),
  };
}

export function previousWeeks(rows: UberEatsWeek[], locationId: LocationId, latest: string | null): UberEatsWeek[] {
  return rows
    .filter((row) => row.locationId === locationId && row.weekStart !== latest)
    .sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
