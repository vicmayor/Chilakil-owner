import { prisma } from "@/lib/db";
import { phoenixToday } from "@/lib/dates";
import { locationIdsForScope, type LocationId, type LocationScope } from "@/lib/location";
import {
  blocksForScope,
  deliveryLabel,
  neededByLabel,
  neededDatePresentation,
  purchaseLabel,
  quantityLabel,
  statusLabel,
  type InventoryItemView,
  type InventoryLocationBlock,
  type InventoryPageData,
} from "@/lib/team-inventory";
import type {
  InventoryDelivery,
  InventoryNeededBy,
  InventoryPurchase,
  InventoryStatus,
  InventoryUnit,
} from "@/lib/team-inventory-mapper";

const SYNC_STATE_ID = "default";

export async function loadInventoryPage(scope: LocationScope, today = phoenixToday()): Promise<InventoryPageData> {
  const ids = locationIdsForScope(scope);
  const [items, summaries, state] = await Promise.all([
    prisma.teamInventoryItem.findMany({
      where: { locationId: { in: ids } },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    }),
    prisma.teamInventorySummary.findMany({ where: { locationId: { in: ids } } }),
    prisma.teamInventorySyncState.findUnique({ where: { id: SYNC_STATE_ID } }),
  ]);

  const stored: InventoryLocationBlock[] = ids.map((locationId) => {
    const summary = summaries.find((row) => row.locationId === locationId);
    return {
      locationId,
      hasSummary: summary != null,
      summary: summary
        ? {
            out: summary.out,
            low: summary.low,
            toBuy: summary.toBuy,
            onTheWay: summary.onTheWay,
            unreviewed: summary.unreviewed,
          }
        : { out: 0, low: 0, toBuy: 0, onTheWay: 0, unreviewed: 0 },
      generatedAt: summary ? summary.generatedAt.toISOString() : null,
      items: items.filter((row) => row.locationId === locationId).map((row) => toItemView(row, today)),
    };
  });

  return {
    stale: state?.lastError != null,
    lastError: state?.lastError ?? null,
    lastStatus: state?.lastStatus ?? null,
    lastSuccessAt: state?.lastSuccessAt?.toISOString() ?? null,
    blocks: blocksForScope(stored, scope),
  };
}

export async function loadInventoryWatch(
  scope: LocationScope,
): Promise<{ locationId: LocationId; out: number; low: number }[]> {
  const ids = locationIdsForScope(scope);
  const summaries = await prisma.teamInventorySummary.findMany({
    where: { locationId: { in: ids } },
    orderBy: { locationId: "asc" },
  });
  const order = new Map(ids.map((id, index) => [id, index]));
  return summaries
    .filter((row) => row.out > 0 || row.low > 0)
    .sort((a, b) => (order.get(a.locationId as LocationId) ?? 0) - (order.get(b.locationId as LocationId) ?? 0))
    .map((row) => ({
      locationId: row.locationId as LocationId,
      out: row.out,
      low: row.low,
    }));
}

function toItemView(
  row: {
    itemId: string;
    name: string;
    nameEn: string;
    category: string;
    unit: string | null;
    unitLabel: string | null;
    supplier: string | null;
    quantityOnHand: { toNumber(): number } | null;
    status: string;
    lowStock: boolean;
    purchase: string | null;
    deliveryStatus: string | null;
    neededBy: string | null;
    neededDate: string | null;
    lastCountedAt: string | null;
    lastCountedBy: string | null;
    lastUpdatedAt: string | null;
    lastUpdatedBy: string | null;
  },
  today: string,
): InventoryItemView {
  const unit = isUnit(row.unit) ? row.unit : null;
  const status = isStatus(row.status) ? row.status : "unreviewed";
  const purchase = isPurchase(row.purchase) ? row.purchase : null;
  const deliveryStatus = isDelivery(row.deliveryStatus) ? row.deliveryStatus : null;
  const neededBy = isNeededBy(row.neededBy) ? row.neededBy : null;
  const quantityOnHand = row.quantityOnHand == null ? null : row.quantityOnHand.toNumber();
  const needed = neededDatePresentation(row.neededDate, today);
  return {
    itemId: row.itemId,
    name: row.name,
    nameEn: row.nameEn,
    category: row.category,
    unit,
    unitLabel: row.unitLabel,
    supplier: row.supplier,
    quantityOnHand,
    quantityText: quantityLabel(quantityOnHand, unit),
    status,
    statusLabel: statusLabel(status),
    lowStock: row.lowStock,
    purchase,
    purchaseLabel: purchaseLabel(purchase),
    deliveryStatus,
    deliveryLabel: deliveryLabel(deliveryStatus),
    neededBy,
    neededByLabel: neededByLabel(neededBy),
    neededDate: row.neededDate,
    neededLabel: needed.label,
    neededOverdue: needed.overdue,
    lastCountedAt: row.lastCountedAt,
    lastCountedBy: row.lastCountedBy,
    lastUpdatedAt: row.lastUpdatedAt,
    lastUpdatedBy: row.lastUpdatedBy,
  };
}

function isUnit(value: string | null): value is InventoryUnit {
  return value === "piece" || value === "lb";
}

function isStatus(value: string): value is InventoryStatus {
  return value === "unreviewed" || value === "sufficient" || value === "low" || value === "out";
}

function isPurchase(value: string | null): value is InventoryPurchase {
  return value === "needed" || value === "purchased" || value === "shipped" || value === "received";
}

function isDelivery(value: string | null): value is InventoryDelivery {
  return value === "ordered" || value === "shipped";
}

function isNeededBy(value: string | null): value is InventoryNeededBy {
  return value === "tomorrow" || value === "this_week";
}
