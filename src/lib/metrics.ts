import { prisma } from "@/lib/db";
import { phoenixToday } from "@/lib/dates";
import {
  COMBINED_LABEL,
  isCombinedScope,
  locationIdsForScope,
  LOCATIONS,
  type LocationId,
  type LocationScope,
} from "@/lib/location";

export type LocationMetrics = {
  locationId: LocationId;
  name: string;
  shortName: string;
  gross: number;
  deliveryGross: number;
  inStoreGross: number;
  fees: number;
  net: number;
  labor: number;
  laborHours: number;
  foodCost: number;
  actualFoodPurchases: number;
  orderCount: number;
  averageTicket: number;
  targetLaborPct: number;
  targetFoodCostPct: number;
  laborPct: number;
  foodCostPct: number;
  netPct: number;
};

export type DashboardData = {
  date: string;
  scope: LocationScope;
  locations: LocationMetrics[];
  combined: LocationMetrics | null;
  combinedLabel: string;
};

const DELIVERY_CHANNELS = ["doordash", "ubereats", "grubhub"] as const;

function emptyMetrics(id: LocationId): LocationMetrics {
  const loc = LOCATIONS[id];
  return {
    locationId: id,
    name: loc.name,
    shortName: loc.shortName,
    gross: 0,
    deliveryGross: 0,
    inStoreGross: 0,
    fees: 0,
    net: 0,
    labor: 0,
    laborHours: 0,
    foodCost: 0,
    actualFoodPurchases: 0,
    orderCount: 0,
    averageTicket: 0,
    targetLaborPct: id === "glendale" ? 0.25 : 0.22,
    targetFoodCostPct: id === "glendale" ? 0.3 : 0.32,
    laborPct: 0,
    foodCostPct: 0,
    netPct: 0,
  };
}

function withRates(m: LocationMetrics): LocationMetrics {
  return {
    ...m,
    averageTicket: m.orderCount > 0 ? m.gross / m.orderCount : 0,
    laborPct: m.gross > 0 ? m.labor / m.gross : 0,
    foodCostPct: m.gross > 0 ? m.foodCost / m.gross : 0,
    netPct: m.gross > 0 ? m.net / m.gross : 0,
  };
}

export function sumMetrics(
  parts: LocationMetrics[],
  labelName = COMBINED_LABEL,
): LocationMetrics {
  const acc = parts.reduce(
    (sum, m) => ({
      locationId: "glendale" as LocationId,
      name: labelName,
      shortName: "Combined",
      gross: sum.gross + m.gross,
      deliveryGross: sum.deliveryGross + m.deliveryGross,
      inStoreGross: sum.inStoreGross + m.inStoreGross,
      fees: sum.fees + m.fees,
      net: sum.net + m.net,
      labor: sum.labor + m.labor,
      laborHours: sum.laborHours + m.laborHours,
      foodCost: sum.foodCost + m.foodCost,
      actualFoodPurchases: sum.actualFoodPurchases + m.actualFoodPurchases,
      orderCount: sum.orderCount + m.orderCount,
      averageTicket: 0,
      targetLaborPct: 0,
      targetFoodCostPct: 0,
      laborPct: 0,
      foodCostPct: 0,
      netPct: 0,
    }),
    emptyMetrics("glendale"),
  );
  acc.name = labelName;
  acc.shortName = "Combined";
  const laborTargets = parts.map((p) => p.targetLaborPct);
  const foodTargets = parts.map((p) => p.targetFoodCostPct);
  acc.targetLaborPct =
    laborTargets.reduce((a, b) => a + b, 0) / Math.max(laborTargets.length, 1);
  acc.targetFoodCostPct =
    foodTargets.reduce((a, b) => a + b, 0) / Math.max(foodTargets.length, 1);
  return withRates(acc);
}

export async function getDashboardData(
  scope: LocationScope,
  date = phoenixToday(),
): Promise<DashboardData> {
  const ids = locationIdsForScope(scope);
  const locations: LocationMetrics[] = [];

  for (const id of ids) {
    const [sales, ops] = await Promise.all([
      prisma.dailySales.findMany({ where: { locationId: id, date } }),
      prisma.dailyOps.findUnique({ where: { locationId_date: { locationId: id, date } } }),
    ]);
    const m = emptyMetrics(id);
    for (const row of sales) {
      m.gross += row.gross;
      m.fees += row.fees;
      m.net += row.net;
      m.orderCount += row.orderCount;
      if (row.channel === "in_store") m.inStoreGross += row.gross;
      if ((DELIVERY_CHANNELS as readonly string[]).includes(row.channel)) {
        m.deliveryGross += row.gross;
      }
    }
    if (ops) {
      m.labor = ops.laborCost;
      m.laborHours = ops.laborHours;
      m.foodCost = ops.theoreticalFoodCost;
      m.actualFoodPurchases = ops.actualFoodPurchases;
      m.targetLaborPct = ops.targetLaborPct;
      m.targetFoodCostPct = ops.targetFoodCostPct;
    }
    locations.push(withRates(m));
  }

  const combined = isCombinedScope(scope) ? sumMetrics(locations) : null;

  return {
    date,
    scope,
    locations,
    combined,
    combinedLabel: COMBINED_LABEL,
  };
}

export async function getSalesTrend(scope: LocationScope, dates: string[]) {
  const ids = locationIdsForScope(scope);
  const rows = await prisma.dailySales.findMany({
    where: { locationId: { in: ids }, date: { in: dates } },
    orderBy: { date: "asc" },
  });
  return rows;
}

export async function getAlerts(scope: LocationScope, date = phoenixToday()) {
  const ids = locationIdsForScope(scope);
  return prisma.alert.findMany({
    where: { locationId: { in: ids }, date: { in: [date, date] } },
    orderBy: [{ severity: "asc" }, { title: "asc" }],
  }).then(async (todayAlerts) => {
    const extra = await prisma.alert.findMany({
      where: {
        locationId: { in: ids },
        date: { not: date },
      },
      orderBy: { date: "desc" },
      take: 3,
    });
    const seen = new Set(todayAlerts.map((a) => a.id));
    return [...todayAlerts, ...extra.filter((a) => !seen.has(a.id))];
  });
}
