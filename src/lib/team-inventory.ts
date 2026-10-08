import type { LocationId, LocationScope } from "@/lib/location";
import { locationIdsForScope } from "@/lib/location";
import type {
  InventoryDelivery,
  InventoryNeededBy,
  InventoryPurchase,
  InventoryStatus,
  InventoryUnit,
  MappedInventorySummary,
} from "@/lib/team-inventory-mapper";

export const INVENTORY_FORBIDDEN_HINT =
  "Activa el permiso de inventario en Team → Owner API. Turn on inventory access in Team → Owner API.";

export type InventoryChip = "out" | "low" | "toBuy" | "onTheWay" | "unreviewed";

export const INVENTORY_CHIPS: { id: InventoryChip; label: string }[] = [
  { id: "out", label: "Se terminó" },
  { id: "low", label: "Queda poco" },
  { id: "toBuy", label: "Por comprar" },
  { id: "onTheWay", label: "En camino" },
  { id: "unreviewed", label: "Sin revisar" },
];

export type InventoryItemView = {
  itemId: string;
  name: string;
  nameEn: string;
  category: string;
  unit: InventoryUnit;
  unitLabel: string | null;
  supplier: string | null;
  quantityOnHand: number | null;
  quantityText: string;
  status: InventoryStatus;
  statusLabel: string;
  lowStock: boolean;
  purchase: InventoryPurchase;
  purchaseLabel: string;
  deliveryStatus: InventoryDelivery;
  deliveryLabel: string;
  neededBy: InventoryNeededBy;
  neededByLabel: string | null;
  neededDate: string | null;
  neededLabel: string | null;
  neededOverdue: boolean;
  lastCountedAt: string | null;
  lastCountedBy: string | null;
  lastUpdatedAt: string | null;
  lastUpdatedBy: string | null;
};

export type InventoryLocationBlock = {
  locationId: LocationId;
  hasSummary: boolean;
  summary: MappedInventorySummary;
  generatedAt: string | null;
  items: InventoryItemView[];
};

export type InventoryPageData = {
  stale: boolean;
  lastError: string | null;
  lastStatus: number | null;
  lastSuccessAt: string | null;
  blocks: InventoryLocationBlock[];
};

const STATUS_LABELS: Record<InventoryStatus, string> = {
  out: "Se terminó",
  low: "Queda poco",
  unreviewed: "Sin revisar",
  sufficient: "Suficiente",
};

const PURCHASE_LABELS: Record<Exclude<InventoryPurchase, null>, string> = {
  needed: "Por comprar",
  purchased: "Comprado",
  shipped: "Enviado",
  received: "Recibido",
};

const DELIVERY_LABELS: Record<Exclude<InventoryDelivery, null>, string> = {
  ordered: "Pedido",
  shipped: "En camino",
};

const NEEDED_BY_LABELS: Record<Exclude<InventoryNeededBy, null>, string> = {
  tomorrow: "Mañana",
  this_week: "Esta semana",
};

/** Unknown quantity stays "Sin contar". A real zero stays zero. Unit null is "desconocido". */
export function quantityLabel(quantity: number | null, unit: InventoryUnit): string {
  if (quantity == null) return "Sin contar";
  const qty = formatQuantity(quantity);
  if (unit === "piece") return `${qty} pzas`;
  if (unit === "lb") return `${qty} lb`;
  return `${qty} desconocido`;
}

export function statusLabel(status: InventoryStatus): string {
  return STATUS_LABELS[status];
}

export function purchaseLabel(purchase: InventoryPurchase): string {
  return purchase ? PURCHASE_LABELS[purchase] : "—";
}

export function deliveryLabel(delivery: InventoryDelivery): string {
  return delivery ? DELIVERY_LABELS[delivery] : "—";
}

export function neededByLabel(neededBy: InventoryNeededBy): string | null {
  return neededBy ? NEEDED_BY_LABELS[neededBy] : null;
}

/**
 * neededDate is fixed. A past date stays overdue and is not moved to a new day.
 * `today` is an America/Phoenix YYYY-MM-DD.
 */
export function neededDatePresentation(
  neededDate: string | null,
  today: string,
): { label: string | null; overdue: boolean } {
  if (!neededDate) return { label: null, overdue: false };
  const overdue = neededDate < today;
  return { label: overdue ? `${neededDate} vencido` : neededDate, overdue };
}

export function filterInventoryItems(
  items: InventoryItemView[],
  options: { chip: InventoryChip | null; category: string | null; search: string },
): InventoryItemView[] {
  const search = options.search.trim().toLowerCase();
  return items.filter((item) => {
    if (options.chip && !itemMatchesChip(item, options.chip)) return false;
    if (options.category && item.category !== options.category) return false;
    if (!search) return true;
    const haystack = [item.name, item.nameEn, item.category, item.supplier ?? "", item.itemId]
      .join(" ")
      .toLowerCase();
    return haystack.includes(search);
  });
}

export function itemMatchesChip(item: InventoryItemView, chip: InventoryChip): boolean {
  if (chip === "out") return item.status === "out";
  if (chip === "low") return item.status === "low";
  if (chip === "toBuy") return item.purchase === "needed";
  if (chip === "onTheWay") return item.deliveryStatus === "ordered" || item.deliveryStatus === "shipped";
  return item.status === "unreviewed";
}

/** Visible locations only. Missing locations are empty shells, never another store's rows. */
export function blocksForScope(
  blocks: InventoryLocationBlock[],
  scope: LocationScope,
): InventoryLocationBlock[] {
  const byId = new Map(blocks.map((block) => [block.locationId, block]));
  return locationIdsForScope(scope).map(
    (locationId) =>
      byId.get(locationId) ?? {
        locationId,
        hasSummary: false,
        summary: { out: 0, low: 0, toBuy: 0, onTheWay: 0, unreviewed: 0 },
        generatedAt: null,
        items: [],
      },
  );
}

function formatQuantity(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}
