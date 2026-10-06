import { COMBINED_LABEL, type LocationId } from "@/lib/location";

export type WeeklyReport = {
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
  importedAt: string;
};

export type CombinedWeek = {
  label: string;
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
  locationsIncluded: LocationId[];
};

export function reportsForLocations(rows: WeeklyReport[], ids: LocationId[]): WeeklyReport[] {
  const allowed = new Set(ids);
  return rows.filter((row) => allowed.has(row.locationId));
}

export function latestSharedWeek(rows: WeeklyReport[]): string | null {
  return rows.reduce<string | null>((latest, row) => {
    if (!latest || row.weekStart > latest) return row.weekStart;
    return latest;
  }, null);
}

/** Commission rate is total commission divided by total subtotal, not an average of percents. */
export function combineWeek(rows: WeeklyReport[]): CombinedWeek | null {
  if (rows.length === 0) return null;
  const subtotal = rows.reduce((sum, row) => sum + row.subtotal, 0);
  const commission = rows.reduce((sum, row) => sum + row.commission, 0);
  return {
    label: COMBINED_LABEL,
    weekStart: rows[0].weekStart,
    weekEnd: rows[0].weekEnd,
    subtotal: round2(subtotal),
    gross: round2(rows.reduce((sum, row) => sum + row.gross, 0)),
    orderCount: rows.reduce((sum, row) => sum + row.orderCount, 0),
    commission: round2(commission),
    marketingFees: round2(rows.reduce((sum, row) => sum + row.marketingFees, 0)),
    errorCharges: round2(rows.reduce((sum, row) => sum + row.errorCharges, 0)),
    adjustments: round2(rows.reduce((sum, row) => sum + row.adjustments, 0)),
    netPayout: round2(rows.reduce((sum, row) => sum + row.netPayout, 0)),
    effectiveCommissionPct: subtotal > 0 ? commission / subtotal : 0,
    locationsIncluded: rows.map((row) => row.locationId),
  };
}

export function previousWeeks(rows: WeeklyReport[], locationId: LocationId, latest: string | null): WeeklyReport[] {
  return rows
    .filter((row) => row.locationId === locationId && row.weekStart !== latest)
    .sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
