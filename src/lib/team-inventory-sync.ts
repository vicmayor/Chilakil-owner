import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { LocationId } from "@/lib/location";
import { INVENTORY_FORBIDDEN_HINT } from "@/lib/team-inventory";
import {
  createTeamInventoryClient,
  TeamInventoryApiError,
  type TeamInventoryClient,
  type TeamInventoryLocationQuery,
} from "@/lib/team-inventory-client";
import {
  mapTeamInventoryResponse,
  type MappedInventoryItem,
  type MappedInventoryReport,
} from "@/lib/team-inventory-mapper";

const SYNC_STATE_ID = "default";

export type SyncTeamInventoryResult = {
  ok: boolean;
  connected: boolean;
  counts: { locationId: LocationId; items: number }[];
  error?: string;
  status?: number;
};

/**
 * Pull current inventory and replace only the locations that came back.
 * 401, 403, 400, 405, 503, and network failures keep the last valid rows.
 */
export async function syncTeamInventory(options?: {
  client?: TeamInventoryClient | null;
  location?: TeamInventoryLocationQuery;
}): Promise<SyncTeamInventoryResult> {
  const client = options && "client" in options ? options.client : createTeamInventoryClient();
  const location = options?.location ?? "all";
  if (!client) {
    return { ok: false, connected: false, counts: [] };
  }

  try {
    const payload = await client.fetchInventory(location);
    const mapped = mapTeamInventoryResponse(payload);
    if (!mapped.ok) throw new Error(mapped.error);
    const counts = await replaceQueriedLocations(mapped.report, location);
    await recordSyncSuccess(new Date(mapped.report.generatedAt), new Date());
    return { ok: true, connected: true, counts };
  } catch (error) {
    const retained = retainMessage(error);
    await recordSyncError(retained.message, retained.status);
    return {
      ok: false,
      connected: true,
      counts: [],
      error: retained.message,
      status: retained.status ?? undefined,
    };
  }
}

function retainMessage(error: unknown): { message: string; status: number | null } {
  if (error instanceof TeamInventoryApiError) {
    const status = error.status;
    if (status === 401) return { message: "Team API rejected the key. Last inventory is unchanged.", status };
    if (status === 403) {
      return { message: `${INVENTORY_FORBIDDEN_HINT} Last inventory is unchanged.`, status };
    }
    if (status === 400) {
      return { message: "Team API rejected the inventory location. Last inventory is unchanged.", status };
    }
    if (status === 405) {
      return { message: "Team inventory only accepts GET. Last inventory is unchanged.", status };
    }
    if (status === 503) {
      return { message: "Team inventory is temporarily unavailable. Last inventory is unchanged.", status };
    }
    return { message: `Team inventory API returned ${status}. Last inventory is unchanged.`, status };
  }
  if (error instanceof TypeError || isNetworkError(error)) {
    return { message: "Couldn't reach the Team API. Last inventory is unchanged.", status: null };
  }
  if (error instanceof Error) {
    return { message: `${error.message} Last inventory is unchanged.`, status: null };
  }
  return { message: "Couldn't sync inventory. Last inventory is unchanged.", status: null };
}

function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.name === "AbortError" || error.name === "TimeoutError") return true;
  return /fetch failed|network|ECONNREFUSED|ENOTFOUND|ETIMEDOUT/i.test(error.message);
}

async function recordSyncSuccess(generatedAt: Date, at: Date): Promise<void> {
  await prisma.teamInventorySyncState.upsert({
    where: { id: SYNC_STATE_ID },
    create: {
      id: SYNC_STATE_ID,
      lastSuccessAt: at,
      lastError: null,
      lastStatus: null,
      generatedAt,
    },
    update: { lastSuccessAt: at, lastError: null, lastStatus: null, generatedAt },
  });
}

async function recordSyncError(message: string, status: number | null): Promise<void> {
  await prisma.teamInventorySyncState.upsert({
    where: { id: SYNC_STATE_ID },
    create: { id: SYNC_STATE_ID, lastError: message, lastStatus: status },
    update: { lastError: message, lastStatus: status },
  });
}

async function replaceQueriedLocations(
  report: MappedInventoryReport,
  requested: TeamInventoryLocationQuery,
): Promise<{ locationId: LocationId; items: number }[]> {
  const blocks = report.locations.filter((block) => requested === "all" || block.location === requested);
  const generatedAt = new Date(report.generatedAt);
  const syncedAt = new Date();
  await prisma.$transaction(
    async (tx) => {
      for (const block of blocks) {
        await tx.teamInventorySummary.upsert({
          where: { locationId: block.location },
          create: {
            locationId: block.location,
            out: block.summary.out,
            low: block.summary.low,
            toBuy: block.summary.toBuy,
            onTheWay: block.summary.onTheWay,
            unreviewed: block.summary.unreviewed,
            generatedAt,
            syncedAt,
          },
          update: {
            out: block.summary.out,
            low: block.summary.low,
            toBuy: block.summary.toBuy,
            onTheWay: block.summary.onTheWay,
            unreviewed: block.summary.unreviewed,
            generatedAt,
            syncedAt,
          },
        });
        for (const item of block.items) {
          const data = itemData(item, syncedAt);
          await tx.teamInventoryItem.upsert({
            where: { locationId_itemId: { locationId: block.location, itemId: item.itemId } },
            create: { locationId: block.location, itemId: item.itemId, ...data },
            update: data,
          });
        }
        const keep = block.items.map((item) => item.itemId);
        await tx.teamInventoryItem.deleteMany({
          where:
            keep.length === 0
              ? { locationId: block.location }
              : { locationId: block.location, itemId: { notIn: keep } },
        });
      }
    },
    { timeout: 20_000 },
  );
  return blocks.map((block) => ({ locationId: block.location, items: block.items.length }));
}

function itemData(item: MappedInventoryItem, syncedAt: Date) {
  return {
    name: item.name,
    nameEn: item.nameEn,
    category: item.category,
    unit: item.unit,
    unitLabel: item.unitLabel,
    supplier: item.supplier,
    quantityOnHand: decimalOrNull(item.quantityOnHand),
    status: item.status,
    lowStock: item.lowStock,
    parLevel: decimalOrNull(item.parLevel),
    minimumLevel: decimalOrNull(item.minimumLevel),
    unitCost: decimalOrNull(item.unitCost),
    purchase: item.purchase,
    deliveryStatus: item.deliveryStatus,
    neededBy: item.neededBy,
    neededDate: item.neededDate,
    lastCountedAt: item.lastCountedAt,
    lastCountedBy: item.lastCountedBy,
    lastUpdatedAt: item.lastUpdatedAt,
    lastUpdatedBy: item.lastUpdatedBy,
    syncedAt,
  };
}

function decimalOrNull(value: number | null): Prisma.Decimal | null {
  if (value == null) return null;
  return new Prisma.Decimal(value.toString());
}
