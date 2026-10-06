import { prisma } from "@/lib/db";
import { phoenixToday, shiftIsoDate } from "@/lib/dates";
import { locationIdsForScope, type LocationId, type LocationScope } from "@/lib/location";
import { buildSalesView, type SalesRecord, type SalesView } from "@/lib/sales-view";

export async function getSalesView(scope: LocationScope, today = phoenixToday()): Promise<SalesView> {
  const ids = locationIdsForScope(scope);
  const rows = await prisma.dailySalesRecord.findMany({
    where: {
      locationId: { in: ids },
      date: { gte: shiftIsoDate(today, -120), lte: today },
    },
    orderBy: { date: "desc" },
  });
  return buildSalesView(rows.map(toSalesRecord), ids, today);
}

function toSalesRecord(row: {
  locationId: string;
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
  importedAt: Date;
}): SalesRecord {
  return {
    locationId: row.locationId as LocationId,
    date: row.date,
    grossSales: row.grossSales,
    netSales: row.netSales,
    discounts: row.discounts,
    refunds: row.refunds,
    tips: row.tips,
    tax: row.tax,
    orderCount: row.orderCount,
    averageTicket: row.averageTicket,
    inStoreGross: row.inStoreGross,
    inStoreOrders: row.inStoreOrders,
    doorDashGross: row.doorDashGross,
    doorDashOrders: row.doorDashOrders,
    uberEatsGross: row.uberEatsGross,
    uberEatsOrders: row.uberEatsOrders,
    grubhubGross: row.grubhubGross,
    grubhubOrders: row.grubhubOrders,
    source: row.source,
    importedAt: row.importedAt.toISOString(),
  };
}
