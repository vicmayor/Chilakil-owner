import { z } from "zod";
import type { LocationId } from "@/lib/location";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .refine(isRealIsoDate, "Invalid calendar date");

const isoInstant = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .refine(isIsoInstant, "Use an ISO timestamp with an offset");

const unitSchema = z.enum(["piece", "lb"]).nullable();
const statusSchema = z.enum(["unreviewed", "sufficient", "low", "out"]);
const purchaseSchema = z.enum(["needed", "purchased", "shipped", "received"]).nullable();
const deliverySchema = z.enum(["ordered", "shipped"]).nullable();
const neededBySchema = z.enum(["tomorrow", "this_week"]).nullable();

const optionalText = z.string().trim().min(1).max(200).nullable();

const level = z.number().finite().nonnegative().max(99_999_999_999.999).nullable();
const money = z.number().finite().nonnegative().max(9_999_999_999.99).nullable();

const itemSchema = z.object({
  id: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(200),
  nameEn: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(80),
  unit: unitSchema,
  unitLabel: optionalText,
  supplier: optionalText,
  quantityOnHand: z.number().finite().nullable(),
  status: statusSchema,
  lowStock: z.boolean(),
  parLevel: level,
  minimumLevel: level,
  unitCost: money,
  purchase: purchaseSchema,
  deliveryStatus: deliverySchema,
  neededBy: neededBySchema,
  neededDate: isoDate.nullable(),
  lastCountedAt: isoInstant.nullable(),
  lastCountedBy: optionalText,
  lastUpdatedAt: isoInstant.nullable(),
  lastUpdatedBy: optionalText,
});

const summarySchema = z.object({
  out: z.number().int().nonnegative().max(100_000),
  low: z.number().int().nonnegative().max(100_000),
  toBuy: z.number().int().nonnegative().max(100_000),
  onTheWay: z.number().int().nonnegative().max(100_000),
  unreviewed: z.number().int().nonnegative().max(100_000),
});

const locationSchema = z.object({
  location: z.enum(["glendale", "avondale"]),
  items: z.array(itemSchema).max(5_000),
  summary: summarySchema,
});

const responseSchema = z.object({
  generatedAt: isoInstant,
  timezone: z.literal("America/Phoenix"),
  locations: z.array(locationSchema).max(2),
});

export type InventoryUnit = "piece" | "lb" | null;
export type InventoryStatus = "unreviewed" | "sufficient" | "low" | "out";
export type InventoryPurchase = "needed" | "purchased" | "shipped" | "received" | null;
export type InventoryDelivery = "ordered" | "shipped" | null;
export type InventoryNeededBy = "tomorrow" | "this_week" | null;

export type MappedInventoryItem = {
  itemId: string;
  name: string;
  nameEn: string;
  category: string;
  unit: InventoryUnit;
  unitLabel: string | null;
  supplier: string | null;
  quantityOnHand: number | null;
  status: InventoryStatus;
  lowStock: boolean;
  parLevel: number | null;
  minimumLevel: number | null;
  unitCost: number | null;
  purchase: InventoryPurchase;
  deliveryStatus: InventoryDelivery;
  neededBy: InventoryNeededBy;
  neededDate: string | null;
  lastCountedAt: string | null;
  lastCountedBy: string | null;
  lastUpdatedAt: string | null;
  lastUpdatedBy: string | null;
};

export type MappedInventorySummary = {
  out: number;
  low: number;
  toBuy: number;
  onTheWay: number;
  unreviewed: number;
};

export type MappedInventoryLocation = {
  location: LocationId;
  items: MappedInventoryItem[];
  summary: MappedInventorySummary;
};

export type MappedInventoryReport = {
  generatedAt: string;
  timezone: "America/Phoenix";
  locations: MappedInventoryLocation[];
};

export type MapInventorySuccess = { ok: true; report: MappedInventoryReport };
export type MapInventoryFailure = { ok: false; error: string };
export type MapInventoryResult = MapInventorySuccess | MapInventoryFailure;

/**
 * Turns one Team inventory payload into per-location blocks.
 * Quantities stay in the base units Team already sent. Null stays null.
 */
export function mapTeamInventoryResponse(input: unknown): MapInventoryResult {
  const parsed = responseSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: `Invalid team inventory payload: ${formatZod(parsed.error)}` };
  }

  const locations: MappedInventoryLocation[] = [];
  const seenLocations = new Set<string>();
  for (const block of parsed.data.locations) {
    if (seenLocations.has(block.location)) {
      return { ok: false, error: `Duplicate location ${block.location}.` };
    }
    seenLocations.add(block.location);
    const items: MappedInventoryItem[] = [];
    const seenItems = new Set<string>();
    for (const item of block.items) {
      if (seenItems.has(item.id)) {
        return { ok: false, error: `Duplicate item ${item.id} at ${block.location}.` };
      }
      seenItems.add(item.id);
      const quantityError = validateQuantity(item.unit, item.quantityOnHand);
      if (quantityError) {
        return { ok: false, error: `${block.location} ${item.id}: ${quantityError}` };
      }
      items.push({
        itemId: item.id,
        name: item.name,
        nameEn: item.nameEn,
        category: item.category,
        unit: item.unit,
        unitLabel: item.unitLabel,
        supplier: item.supplier,
        quantityOnHand: item.quantityOnHand,
        status: item.status,
        lowStock: item.lowStock,
        parLevel: item.parLevel,
        minimumLevel: item.minimumLevel,
        unitCost: item.unitCost,
        purchase: item.purchase,
        deliveryStatus: item.deliveryStatus,
        neededBy: item.neededBy,
        neededDate: item.neededDate,
        lastCountedAt: item.lastCountedAt,
        lastCountedBy: item.lastCountedBy,
        lastUpdatedAt: item.lastUpdatedAt,
        lastUpdatedBy: item.lastUpdatedBy,
      });
    }
    locations.push({
      location: block.location,
      items,
      summary: { ...block.summary },
    });
  }

  return {
    ok: true,
    report: {
      generatedAt: parsed.data.generatedAt,
      timezone: "America/Phoenix",
      locations,
    },
  };
}

function validateQuantity(unit: InventoryUnit, quantity: number | null): string | null {
  if (quantity == null) return null;
  if (quantity < 0 || quantity > 99_999_999_999.999) return "quantityOnHand is out of range.";
  const places = decimalPlaces(quantity);
  if (unit === "piece" && !Number.isInteger(quantity)) {
    return "piece quantities must be integers.";
  }
  if (places > 3) return "quantityOnHand allows at most 3 decimal places.";
  return null;
}

function decimalPlaces(value: number): number {
  const text = value.toString();
  if (/e/i.test(text)) {
    const fixed = value.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
    const dot = fixed.indexOf(".");
    return dot === -1 ? 0 : fixed.length - dot - 1;
  }
  const dot = text.indexOf(".");
  return dot === -1 ? 0 : text.length - dot - 1;
}

function formatZod(error: z.ZodError): string {
  return error.issues.map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`).join("; ");
}

const ISO_INSTANT =
  /^(\d{4}-\d{2}-\d{2})T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;

function isIsoInstant(value: string): boolean {
  const match = ISO_INSTANT.exec(value);
  return match != null && isRealIsoDate(match[1]) && !Number.isNaN(Date.parse(value));
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
