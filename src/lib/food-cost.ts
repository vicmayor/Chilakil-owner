export const FOOD_COST_WORKBOOK_FILE = "chilakil-to-go-food-cost.xlsx";

export type LineKind = "component" | "average_protein" | "packaging";

export type FoodIngredient = {
  sourceKey: string;
  sortOrder: number;
  name: string;
  vendor: string | null;
  purchaseQty: number | null;
  unit: string;
  purchaseCost: number | null;
  yieldPct: number | null;
  costPerUnit: number | null;
  notes: string | null;
  addonPrice: number | null;
  portionQty: number | null;
  isStandardTopping: boolean;
};

export type FoodLine = {
  ingredientKey: string;
  quantity: number;
  unit: string;
  sheetUnitCost: number | null;
  notes: string | null;
  kind: LineKind;
  sortOrder: number;
};

export type FoodMenuItem = {
  sourceKey: string;
  recipeKey: string;
  sortOrder: number;
  name: string;
  category: string;
  price: number | null;
  packagingCost: number;
  standardToppings: boolean;
  notes: string | null;
  lines: FoodLine[];
};

export type FoodCostInput = {
  targetFoodCostPct: number;
  caveat: string | null;
  ingredients: FoodIngredient[];
  menuItems: FoodMenuItem[];
};

export type ReportLine = {
  name: string;
  quantity: number;
  unit: string;
  notes: string | null;
  kind: LineKind;
  menuCost: number | null;
  catalogCost: number | null;
};

export type MenuCostReport = {
  sourceKey: string;
  sortOrder: number;
  name: string;
  category: string;
  price: number | null;
  menuCost: number | null;
  foodCostPct: number | null;
  grossProfit: number | null;
  suggestedPrice: number | null;
  baseCost: number | null;
  baseWithToppings: number | null;
  baseWithToppingsPct: number | null;
  standardToppings: boolean;
  lines: ReportLine[];
  costed: boolean;
};

export type ProteinAddonReport = {
  name: string;
  portionQty: number;
  unit: string;
  costPerLb: number | null;
  portionCost: number | null;
  addonPrice: number;
  contribution: number | null;
  addonCostPct: number | null;
};

export type PlateReport = {
  menuName: string;
  label: string;
  proteinName: string;
  sellPrice: number;
  baseCost: number;
  proteinCost: number;
  totalCost: number;
  foodCostPct: number;
  profit: number;
};

export type ToppingReport = {
  name: string;
  portionQty: number;
  unit: string;
  cost: number | null;
};

export type PriceListRow = {
  name: string;
  vendor: string | null;
  unit: string;
  purchaseQty: number | null;
  purchaseCost: number | null;
  costPerUnit: number | null;
  notes: string | null;
  addonPrice: number | null;
};

export type FoodCostReport = {
  targetFoodCostPct: number;
  caveat: string | null;
  toppingCost: number | null;
  toppings: ToppingReport[];
  menu: MenuCostReport[];
  proteins: ProteinAddonReport[];
  plates: PlateReport[];
  priceList: PriceListRow[];
  missingPrices: { name: string; unit: string; purchaseQty: number | null }[];
};

export function usableUnitCost(
  purchaseCost: number | null,
  purchaseQty: number | null,
  yieldPct: number | null,
): number | null {
  if (purchaseCost == null || purchaseQty == null || purchaseQty === 0 || yieldPct == null) return null;
  const yieldRatio = yieldPct > 1 ? yieldPct / 100 : yieldPct;
  if (yieldRatio === 0) return null;
  return purchaseCost / purchaseQty / yieldRatio;
}

export function menuUnitCost(sheetUnitCost: number | null, catalogUnitCost: number | null): number | null {
  if (sheetUnitCost != null) return sheetUnitCost;
  return catalogUnitCost;
}

export function pricedRecipeCost(
  lines: { quantity: number; sheetUnitCost: number | null; catalogUnitCost: number | null }[],
  packagingCost = 0,
): number | null {
  if (lines.length === 0) return null;
  let sum = packagingCost;
  for (const line of lines) {
    const unit = menuUnitCost(line.sheetUnitCost, line.catalogUnitCost);
    if (unit == null) return null;
    sum += line.quantity * unit;
  }
  return sum;
}

export function buildFoodCostReport(input: FoodCostInput): FoodCostReport {
  const ingredients = new Map(input.ingredients.map((row) => [row.sourceKey, row]));
  const toppings = input.ingredients
    .filter((row) => row.isStandardTopping)
    .map((row) => ({
      name: row.name,
      portionQty: row.portionQty ?? 0,
      unit: row.unit,
      cost:
        row.costPerUnit == null || row.portionQty == null ? null : row.costPerUnit * row.portionQty,
    }));
  const toppingCost = sumKnown(toppings.map((row) => row.cost));

  const menu = input.menuItems.map((item) => toMenuReport(item, ingredients, toppingCost, input.targetFoodCostPct));
  const proteins = input.ingredients
    .filter((row) => row.addonPrice != null && row.portionQty != null)
    .map((row) => toProtein(row));

  const plates: PlateReport[] = [];
  for (const item of menu) {
    if (!item.standardToppings || item.price == null || item.baseWithToppings == null) continue;
    for (const protein of proteins) {
      if (protein.portionCost == null) continue;
      const totalCost = item.baseWithToppings + protein.portionCost;
      const sellPrice = item.price + protein.addonPrice;
      plates.push({
        menuName: item.name,
        label: `${plateLabel(item.name)} + ${protein.name}`,
        proteinName: protein.name,
        sellPrice,
        baseCost: item.baseWithToppings,
        proteinCost: protein.portionCost,
        totalCost,
        foodCostPct: sellPrice > 0 ? totalCost / sellPrice : 0,
        profit: sellPrice - totalCost,
      });
    }
  }

  return {
    targetFoodCostPct: input.targetFoodCostPct,
    caveat: input.caveat,
    toppingCost,
    toppings,
    menu,
    proteins,
    plates,
    priceList: input.ingredients.map((row) => ({
      name: row.name,
      vendor: row.vendor,
      unit: row.unit,
      purchaseQty: row.purchaseQty,
      purchaseCost: row.purchaseCost,
      costPerUnit: row.costPerUnit,
      notes: row.notes,
      addonPrice: row.addonPrice,
    })),
    missingPrices: input.ingredients
      .filter((row) => row.purchaseCost == null)
      .map((row) => ({ name: row.name, unit: row.unit, purchaseQty: row.purchaseQty })),
  };
}

export function foodCostSignature(input: FoodCostInput): string {
  return JSON.stringify(input);
}

function toMenuReport(
  item: FoodMenuItem,
  ingredients: Map<string, FoodIngredient>,
  toppingCost: number | null,
  target: number,
): MenuCostReport {
  const lines: ReportLine[] = item.lines.map((line) => {
    const ingredient = ingredients.get(line.ingredientKey);
    const catalogUnit = ingredient?.costPerUnit ?? null;
    const unit = menuUnitCost(line.sheetUnitCost, catalogUnit);
    return {
      name: ingredient?.name ?? "Ingredient",
      quantity: line.quantity,
      unit: line.unit || ingredient?.unit || "",
      notes: line.notes,
      kind: line.kind,
      menuCost: unit == null ? null : line.quantity * unit,
      catalogCost: catalogUnit == null ? null : line.quantity * catalogUnit,
    };
  });

  const costed = lines.length > 0;
  const menuCost = costed ? addPackaging(sumKnown(lines.map((line) => line.menuCost)), item.packagingCost) : null;
  const baseLines = lines.filter((line) => line.kind !== "average_protein");
  const baseCost =
    baseLines.length > 0 ? addPackaging(sumKnown(baseLines.map((line) => line.catalogCost)), item.packagingCost) : null;
  const baseWithToppings =
    item.standardToppings && baseCost != null && toppingCost != null ? baseCost + toppingCost : item.standardToppings ? null : baseCost;
  const price = item.price;
  return {
    sourceKey: item.sourceKey,
    sortOrder: item.sortOrder,
    name: item.name,
    category: item.category,
    price,
    menuCost,
    foodCostPct: price != null && price > 0 && menuCost != null ? menuCost / price : null,
    grossProfit: price != null && menuCost != null ? price - menuCost : null,
    suggestedPrice: menuCost != null && target > 0 ? menuCost / target : null,
    baseCost,
    baseWithToppings,
    baseWithToppingsPct:
      price != null && price > 0 && baseWithToppings != null ? baseWithToppings / price : null,
    standardToppings: item.standardToppings,
    lines,
    costed,
  };
}

function toProtein(row: FoodIngredient): ProteinAddonReport {
  const portionQty = row.portionQty ?? 0;
  const portionCost = row.costPerUnit == null ? null : row.costPerUnit * portionQty;
  const addonPrice = row.addonPrice ?? 0;
  const costPerLb =
    row.costPerUnit == null ? null : row.unit === "oz" ? row.costPerUnit * 16 : row.unit === "lb" ? row.costPerUnit : null;
  return {
    name: row.name,
    portionQty,
    unit: "oz",
    costPerLb,
    portionCost,
    addonPrice,
    contribution: portionCost == null ? null : addonPrice - portionCost,
    addonCostPct: portionCost == null || addonPrice === 0 ? null : portionCost / addonPrice,
  };
}

function plateLabel(name: string): string {
  if (name === "Build Your Own Chilaquiles") return "Chilaquiles";
  if (name === "Burrito de Chilaquiles") return "Burrito";
  return name;
}

function sumKnown(values: Array<number | null>): number | null {
  if (values.some((value) => value == null)) return null;
  return values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
}

function addPackaging(cost: number | null, packaging: number): number | null {
  if (cost == null) return null;
  return cost + packaging;
}

export const MAX_MONEY_INPUT = 10_000;

export type FoodCostEdits = {
  /** Ingredient sourceKey -> unit cost. Null leaves that workbook cell blank. */
  costPerUnit: Record<string, number | null>;
  /** Menu sourceKey -> sell price. */
  prices: Record<string, number | null>;
  /** Ingredient sourceKey -> protein add-on sell price. */
  addonPrices: Record<string, number | null>;
};

/**
 * Apply a what-if on top of one kitchen's workbook. Protein add-ons are the
 * ingredient rows that already carry a portion and an add-on price; this does
 * not look up menu names. A changed unit cost also replaces that ingredient's
 * recipe-sheet unit cost so plate costs follow the edit.
 */
export function withFoodCostEdits(input: FoodCostInput, edits: FoodCostEdits): FoodCostInput {
  const changedCosts = new Map<string, number | null>();
  const ingredients = input.ingredients.map((row) => {
    const hasCost = Object.prototype.hasOwnProperty.call(edits.costPerUnit, row.sourceKey);
    const hasAddon = Object.prototype.hasOwnProperty.call(edits.addonPrices, row.sourceKey);
    const costPerUnit = hasCost ? edits.costPerUnit[row.sourceKey] : row.costPerUnit;
    const addonPrice = hasAddon ? edits.addonPrices[row.sourceKey] : row.addonPrice;
    if (hasCost && costPerUnit !== row.costPerUnit) changedCosts.set(row.sourceKey, costPerUnit);
    return { ...row, costPerUnit, addonPrice };
  });

  const menuItems = input.menuItems.map((item) => {
    const hasPrice = Object.prototype.hasOwnProperty.call(edits.prices, item.sourceKey);
    return {
      ...item,
      price: hasPrice ? edits.prices[item.sourceKey] : item.price,
      lines: item.lines.map((line) => {
        if (!changedCosts.has(line.ingredientKey)) return { ...line };
        return { ...line, sheetUnitCost: changedCosts.get(line.ingredientKey) ?? null };
      }),
    };
  });

  return {
    targetFoodCostPct: input.targetFoodCostPct,
    caveat: input.caveat,
    ingredients,
    menuItems,
  };
}
