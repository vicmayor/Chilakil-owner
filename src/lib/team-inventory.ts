import { BUSINESS_TZ } from "@/lib/dates";
import type { LocationId, LocationScope } from "@/lib/location";
import { LOCATIONS, locationIdsForScope } from "@/lib/location";
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
 * A page-open pull can skip the network when the last success is still inside
 * minIntervalMs and that sync is not marked stale. A stale row is never fresh.
 */
export function inventorySyncIsFresh(
  lastSuccessAt: Date | null,
  lastError: string | null,
  now: Date,
  minIntervalMs: number,
): boolean {
  if (lastError) return false;
  if (!lastSuccessAt) return false;
  return now.getTime() - lastSuccessAt.getTime() < minIntervalMs;
}

/** toBuy is need action, onTheWay is awaiting delivery, out is out of stock. Counts are not added together. */
export function inventoryActionAlert(summary: Pick<MappedInventorySummary, "toBuy" | "onTheWay" | "out">): {
  headline: string;
  detail: string;
} {
  return {
    headline: `${summary.toBuy} need action · ${summary.onTheWay} awaiting delivery`,
    detail: `${summary.out} out of stock`,
  };
}

/** Phoenix clock, shaped like "Oct 8 at 3:41 AM". */
export function formatPhoenixAt(iso: string): string {
  const dt = new Date(iso);
  const date = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TZ,
    month: "short",
    day: "numeric",
  }).format(dt);
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TZ,
    hour: "numeric",
    minute: "2-digit",
  }).format(dt);
  return `${date} at ${time}`;
}

/** Phoenix clock, shaped like "Last synced: Oct 8 at 3:41 AM". */
export function formatInventorySyncedAt(iso: string): string {
  return `Last synced: ${formatPhoenixAt(iso)}`;
}

/**
 * Team category ids shown with catalog names. An unknown id stays as sent.
 * Lookup is case-insensitive; the fallback keeps the original text.
 */
const INVENTORY_CATEGORY_LABELS: Record<string, string> = {
  soda: "Sodas & drinks",
  sodas: "Sodas & drinks",
  drink: "Sodas & drinks",
  drinks: "Sodas & drinks",
  beverage: "Sodas & drinks",
  beverages: "Sodas & drinks",
  "sodas-drinks": "Sodas & drinks",
  "sodas-and-drinks": "Sodas & drinks",
  dairy: "Dairy",
  protein: "Proteins",
  proteins: "Proteins",
  produce: "Produce",
  tortilla: "Tortillas & other ingredients",
  tortillas: "Tortillas & other ingredients",
  ingredient: "Tortillas & other ingredients",
  ingredients: "Tortillas & other ingredients",
  "tortillas-ingredients": "Tortillas & other ingredients",
  "tortillas-and-other-ingredients": "Tortillas & other ingredients",
  coffee: "Coffee & add-ins",
  "add-in": "Coffee & add-ins",
  "add-ins": "Coffee & add-ins",
  addins: "Coffee & add-ins",
  "coffee-add-ins": "Coffee & add-ins",
  "coffee-and-add-ins": "Coffee & add-ins",
  snack: "Snacks",
  snacks: "Snacks",
  supply: "Containers & supplies",
  supplies: "Containers & supplies",
  container: "Containers & supplies",
  containers: "Containers & supplies",
  "containers-supplies": "Containers & supplies",
  "containers-and-supplies": "Containers & supplies",
};

export const INVENTORY_CATEGORY_ORDER = [
  "Sodas & drinks",
  "Dairy",
  "Proteins",
  "Produce",
  "Tortillas & other ingredients",
  "Coffee & add-ins",
  "Snacks",
  "Containers & supplies",
] as const;

export function categoryLabel(categoryId: string): string {
  return INVENTORY_CATEGORY_LABELS[categoryId.trim().toLowerCase()] ?? categoryId;
}

/**
 * Pending means the product needs action. It counts once when status is low, out,
 * or unreviewed, or purchase is needed. A low item that is also needed is still one.
 */
export function itemIsPending(item: { status: InventoryStatus; purchase: InventoryPurchase }): boolean {
  return item.status === "low" || item.status === "out" || item.status === "unreviewed" || item.purchase === "needed";
}

export type InventoryCategoryGroup = {
  label: string;
  items: InventoryItemView[];
  pending: number;
};

export function groupInventoryByCategory(items: InventoryItemView[]): InventoryCategoryGroup[] {
  const groups = new Map<string, InventoryItemView[]>();
  for (const item of items) {
    const label = categoryLabel(item.category);
    const list = groups.get(label);
    if (list) list.push(item);
    else groups.set(label, [item]);
  }
  const order = new Map<string, number>(INVENTORY_CATEGORY_ORDER.map((label, index) => [label, index]));
  return [...groups.entries()]
    .sort(([a], [b]) => {
      const aOrder = order.get(a);
      const bOrder = order.get(b);
      if (aOrder != null && bOrder != null) return aOrder - bOrder;
      if (aOrder != null) return -1;
      if (bOrder != null) return 1;
      return a.localeCompare(b);
    })
    .map(([label, groupItems]) => ({
      label,
      items: groupItems,
      pending: groupItems.filter(itemIsPending).length,
    }));
}

export type InventoryRecentAlert = {
  key: string;
  line: string;
};

/** Low and out only. Each line names its location. Times come from lastUpdatedAt. */
export function recentInventoryAlerts(
  blocks: { locationId: LocationId; items: InventoryItemView[] }[],
): InventoryRecentAlert[] {
  const rows: { key: string; at: string | null; line: string }[] = [];
  for (const block of blocks) {
    for (const item of block.items) {
      if (item.status !== "low" && item.status !== "out") continue;
      const phrase = item.status === "out" ? "Out of stock" : "Running low";
      const when = item.lastUpdatedAt ? formatPhoenixAt(item.lastUpdatedAt) : "time unknown";
      rows.push({
        key: `${block.locationId}|${item.itemId}`,
        at: item.lastUpdatedAt,
        line: `${item.nameEn} · ${phrase} — ${LOCATIONS[block.locationId].shortName} · ${when}`,
      });
    }
  }
  rows.sort((a, b) => {
    if (a.at && b.at && a.at !== b.at) return a.at < b.at ? 1 : -1;
    if (a.at && !b.at) return -1;
    if (!a.at && b.at) return 1;
    return a.line.localeCompare(b.line);
  });
  return rows.map(({ key, line }) => ({ key, line }));
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
    if (options.category && item.category !== options.category && categoryLabel(item.category) !== options.category) {
      return false;
    }
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
