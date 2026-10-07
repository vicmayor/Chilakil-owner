import type { LocationId } from "@/lib/location";

/** Suggested menu price is recipe cost divided by this target. */
export const TARGET_FOOD_COST_PCT = 0.3;

export const MAX_MONEY_INPUT = 10_000;

/**
 * In-store protein add-on price from the Oct 6, 2026 DoorDash pricing reports
 * (Carne Asada, Al Pastor, Chicken at $3 in both kitchens). It is a what-if
 * starting point only — the food-cost workbook has no add-on menu row, so Save
 * does not write this price.
 */
export const PROTEIN_ADDON_PRICE = 3;

/**
 * Add-on portion is the protein quantity already on that plate in the workbook,
 * not a second recipe. Both kitchens share these names; costs stay per location.
 */
export const PROTEIN_ADDONS = [
  {
    ingredientName: "Carne asada",
    label: "Extra carne asada",
    portionFromRecipe: "Carne asada tacos (3)",
  },
  {
    ingredientName: "Pastor pork",
    label: "Extra al pastor",
    portionFromRecipe: "Tacos al pastor (3)",
  },
  {
    ingredientName: "Chicken thigh",
    label: "Extra chicken",
    portionFromRecipe: "Chicken tinga quesadilla",
  },
] as const;

export type ProteinIngredientName = (typeof PROTEIN_ADDONS)[number]["ingredientName"];

const PROTEIN_NAMES = new Set<string>(PROTEIN_ADDONS.map((addon) => addon.ingredientName));

export function isProteinIngredient(name: string): boolean {
  return PROTEIN_NAMES.has(name);
}

export type RecipeLine = {
  ingredientId: string;
  quantity: number;
};

export type FoodCostIngredient = {
  id: string;
  name: string;
  unit: string;
  costPerUnit: number;
};

export type FoodCostMenuItem = {
  id: string;
  name: string;
  category: string;
  price: number;
  lines: (RecipeLine & { name: string; unit: string })[];
};

export type FoodCostLocation = {
  locationId: LocationId;
  ingredients: FoodCostIngredient[];
  items: FoodCostMenuItem[];
};

export type CostQuote = {
  recipeCost: number;
  foodCostPct: number | null;
  grossProfit: number;
  suggestedPrice: number;
};

export type ProteinAddon = {
  ingredientId: string;
  ingredientName: string;
  label: string;
  unit: string;
  portionQty: number;
  portionFromRecipe: string;
  costPerUnit: number;
  recipeCost: number;
};

export function parseCostInput(raw: string): number | null {
  const trimmed = raw.trim().replace(/^\$/, "");
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0 || value > MAX_MONEY_INPUT) return null;
  return value;
}

export function costInputValue(amount: number): string {
  if (!Number.isFinite(amount)) return "";
  return String(Math.round(amount * 10000) / 10000);
}

export function costsDiffer(a: number, b: number): boolean {
  return Math.abs(a - b) > 0.000001;
}

export function recipeCost(lines: RecipeLine[], costPerUnitById: ReadonlyMap<string, number>): number {
  let total = 0;
  for (const line of lines) {
    total += line.quantity * (costPerUnitById.get(line.ingredientId) ?? 0);
  }
  return total;
}

export function quoteSale(recipeCost: number, price: number, target = TARGET_FOOD_COST_PCT): CostQuote {
  return {
    recipeCost,
    foodCostPct: price > 0 ? recipeCost / price : null,
    grossProfit: price - recipeCost,
    suggestedPrice: target > 0 ? recipeCost / target : recipeCost,
  };
}

export function proteinAddonsForLocation(
  ingredients: FoodCostIngredient[],
  items: Pick<FoodCostMenuItem, "name" | "lines">[],
): ProteinAddon[] {
  const byName = new Map(ingredients.map((ingredient) => [ingredient.name, ingredient]));
  const addons: ProteinAddon[] = [];

  for (const spec of PROTEIN_ADDONS) {
    const ingredient = byName.get(spec.ingredientName);
    if (!ingredient) continue;
    const recipe = items.find((item) => item.name === spec.portionFromRecipe);
    const line = recipe?.lines.find((entry) => entry.ingredientId === ingredient.id);
    if (!recipe || !line) continue;
    addons.push({
      ingredientId: ingredient.id,
      ingredientName: ingredient.name,
      label: spec.label,
      unit: ingredient.unit,
      portionQty: line.quantity,
      portionFromRecipe: recipe.name,
      costPerUnit: ingredient.costPerUnit,
      recipeCost: line.quantity * ingredient.costPerUnit,
    });
  }

  return addons;
}

type GroupIngredient = FoodCostIngredient & { locationId: string };
type GroupItem = FoodCostMenuItem & { locationId: string };

/**
 * Split workbook rows by kitchen. ALL passes both ids and gets two groups.
 * A single scope passes one id, so the other kitchen is dropped.
 */
export function groupFoodCostLocations(
  locationIds: readonly LocationId[],
  ingredients: GroupIngredient[],
  items: GroupItem[],
): FoodCostLocation[] {
  return locationIds.map((locationId) => ({
    locationId,
    ingredients: ingredients
      .filter((ingredient) => ingredient.locationId === locationId)
      .map((ingredient) => ({
        id: ingredient.id,
        name: ingredient.name,
        unit: ingredient.unit,
        costPerUnit: ingredient.costPerUnit,
      }))
      .sort(compareIngredients),
    items: items
      .filter((item) => item.locationId === locationId)
      .map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        price: item.price,
        lines: item.lines,
      }))
      .sort(compareItems),
  }));
}

function compareIngredients(a: FoodCostIngredient, b: FoodCostIngredient): number {
  const proteinDelta = Number(isProteinIngredient(b.name)) - Number(isProteinIngredient(a.name));
  if (proteinDelta !== 0) return proteinDelta;
  return a.name.localeCompare(b.name);
}

function compareItems(a: FoodCostMenuItem, b: FoodCostMenuItem): number {
  const category = a.category.localeCompare(b.category);
  if (category !== 0) return category;
  return a.name.localeCompare(b.name);
}
