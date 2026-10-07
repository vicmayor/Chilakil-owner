import { readFileSync } from "node:fs";
import { readXlsx, type SheetCell } from "@/lib/xlsx-lite";
import {
  usableUnitCost,
  type FoodCostInput,
  type FoodIngredient,
  type FoodLine,
  type FoodMenuItem,
  type LineKind,
} from "@/lib/food-cost";

export const FOOD_COST_WORKBOOK_PATH = "data/chilakil-to-go-food-cost.xlsx";

type Grid = Map<number, Map<string, SheetCell>>;

export function loadFoodCostWorkbook(filePath = FOOD_COST_WORKBOOK_PATH): FoodCostInput {
  return parseFoodCostWorkbook(readFileSync(filePath));
}

export function parseFoodCostWorkbook(buffer: Buffer): FoodCostInput {
  const sheets = readXlsx(buffer);
  const prices = requiredSheet(sheets, "Ingredient Prices");
  const recipes = requiredSheet(sheets, "Recipe Costing");
  const summary = requiredSheet(sheets, "Menu Summary");

  const ingredients = parseIngredients(prices);
  applyProteinPortions(summary, ingredients);
  applyStandardToppings(recipes, ingredients);

  const menuItems = parseMenuItems(recipes, summary, ingredients);
  return {
    targetFoodCostPct: parseTarget(summary),
    caveat: findCaveat(sheets),
    ingredients,
    menuItems,
  };
}

function parseIngredients(grid: Grid): FoodIngredient[] {
  const headerRow = findRow(grid, (row) => text(row.get("A")) === "Ingredient");
  if (headerRow == null) throw new Error("Ingredient Prices is missing its header row");
  const rows: FoodIngredient[] = [];
  const seen = new Map<string, number>();
  for (const rowNumber of rowNumbers(grid)) {
    if (rowNumber <= headerRow) continue;
    const row = grid.get(rowNumber);
    if (!row) continue;
    const name = text(row.get("A"));
    if (!name || name === "Ingredient") continue;
    const purchaseQty = number(row.get("C"));
    const unit = text(row.get("D")) ?? "unit";
    const purchaseCost = enteredNumber(row.get("E"));
    const yieldPct = number(row.get("F"));
    const slug = sourceSlug(name);
    const occurrence = (seen.get(slug) ?? 0) + 1;
    seen.set(slug, occurrence);
    rows.push({
      sourceKey: occurrence === 1 ? `workbook:ingredient:${slug}` : `workbook:ingredient:${slug}:${occurrence}`,
      sortOrder: rows.length,
      name,
      vendor: text(row.get("B")),
      purchaseQty,
      unit,
      purchaseCost,
      yieldPct,
      costPerUnit: usableUnitCost(purchaseCost, purchaseQty, yieldPct),
      notes: text(row.get("H")),
      addonPrice: enteredNumber(row.get("I")),
      portionQty: null,
      isStandardTopping: false,
    });
  }
  return rows;
}

function applyProteinPortions(grid: Grid, ingredients: FoodIngredient[]) {
  const headerRow = findRow(grid, (row) => text(row.get("P")) === "PROTEIN ADD-ON");
  if (headerRow == null) return;
  for (const rowNumber of rowNumbers(grid)) {
    if (rowNumber <= headerRow) continue;
    const row = grid.get(rowNumber);
    const name = row ? text(row.get("P")) : null;
    if (!name) break;
    const portionQty = number(row?.get("Q"));
    const addonPrice = enteredNumber(row?.get("T"));
    const match = pricedIngredient(ingredients, name);
    if (!match || portionQty == null) continue;
    match.portionQty = portionQty;
    if (addonPrice != null) match.addonPrice = addonPrice;
  }
}

function applyStandardToppings(grid: Grid, ingredients: FoodIngredient[]) {
  const headerRow = findRow(grid, (row) => text(row.get("L")) === "STANDARD TOPPINGS");
  if (headerRow == null) return;
  for (const rowNumber of rowNumbers(grid)) {
    if (rowNumber <= headerRow) continue;
    const row = grid.get(rowNumber);
    const name = row ? text(row.get("L")) : null;
    if (!name) break;
    const portion = text(row?.get("M"));
    const match = ingredients.find((ingredient) => ingredient.name === name);
    if (!match) continue;
    match.isStandardTopping = true;
    const qty = portion ? Number(/^(\d+(?:\.\d+)?)/.exec(portion)?.[1]) : null;
    if (qty != null && Number.isFinite(qty)) match.portionQty = qty;
  }
}

function parseMenuItems(recipes: Grid, summary: Grid, ingredients: FoodIngredient[]): FoodMenuItem[] {
  const groups = new Map<string, { sortOrder: number; lines: FoodLine[] }>();
  const headerRow = findRow(recipes, (row) => text(row.get("A")) === "Menu Item");
  if (headerRow == null) throw new Error("Recipe Costing is missing its header row");
  let current = "";
  for (const rowNumber of rowNumbers(recipes)) {
    if (rowNumber <= headerRow) continue;
    const row = recipes.get(rowNumber);
    if (!row) continue;
    const menuName = text(row.get("A"));
    if (menuName && menuName !== "Menu Item") current = menuName;
    if (!current || current === "Menu Item") continue;
    const ingredientName = text(row.get("B"));
    if (!ingredientName) {
      if (!groups.has(current)) groups.set(current, { sortOrder: groups.size, lines: [] });
      continue;
    }
    const quantity = number(row.get("C"));
    const sheetUnitCost = number(row.get("E"));
    const ingredient = matchIngredient(ingredients, ingredientName, sheetUnitCost);
    if (!ingredient) {
      throw new Error(`Recipe "${current}" uses "${ingredientName}", which is not on Ingredient Prices`);
    }
    const notes = text(row.get("J"));
    const line: FoodLine = {
      ingredientKey: ingredient.sourceKey,
      quantity: quantity ?? 0,
      unit: text(row.get("D")) ?? ingredient.unit,
      sheetUnitCost,
      notes,
      kind: lineKind(ingredientName, notes),
      sortOrder: 0,
    };
    const group = groups.get(current) ?? { sortOrder: groups.size, lines: [] };
    line.sortOrder = group.lines.length;
    group.lines.push(line);
    groups.set(current, group);
  }

  const summaryOrder: string[] = [];
  const prices = new Map<string, number | null>();
  const packaging = new Map<string, number>();
  const summaryHeader = findRow(summary, (row) => text(row.get("A")) === "Menu Item");
  if (summaryHeader == null) throw new Error("Menu Summary is missing its header row");
  for (const rowNumber of rowNumbers(summary)) {
    if (rowNumber <= summaryHeader) continue;
    const row = summary.get(rowNumber);
    if (!row) continue;
    const name = text(row.get("A"));
    if (!name || name === "Menu Item" || name === "TARGET FOOD COST") continue;
    if (!groups.has(name) && !summaryOrder.includes(name)) {
      groups.set(name, { sortOrder: groups.size, lines: [] });
    }
    if (!summaryOrder.includes(name)) summaryOrder.push(name);
    const sellCell = row.get("E");
    prices.set(name, sellCell && !sellCell.formula ? number(sellCell) : null);
    packaging.set(name, number(row.get("C")) ?? 0);
  }

  const names = [...summaryOrder, ...[...groups.keys()].filter((name) => !summaryOrder.includes(name))];
  return names.map((name, index) => {
    const group = groups.get(name) ?? { sortOrder: index, lines: [] };
    const hasPlateLines = group.lines.some((line) => line.kind !== "average_protein");
    return {
      sourceKey: `workbook:menu:${sourceSlug(name)}`,
      recipeKey: `workbook:recipe:${sourceSlug(name)}`,
      sortOrder: index,
      name,
      category: categoryFor(name),
      price: prices.get(name) ?? null,
      packagingCost: packaging.get(name) ?? 0,
      standardToppings: /chilaquiles/i.test(name) && hasPlateLines,
      notes: group.lines.map((line) => line.notes).filter((note): note is string => Boolean(note)).join(" · ") || null,
      lines: group.lines,
    };
  });
}

function parseTarget(grid: Grid): number {
  for (const row of grid.values()) {
    if (text(row.get("A")) !== "TARGET FOOD COST") continue;
    for (const column of ["B", "C", "D", "E"]) {
      const value = enteredNumber(row.get(column));
      if (value != null) return value;
    }
  }
  throw new Error("Menu Summary is missing TARGET FOOD COST");
}

function findCaveat(sheets: Map<string, Grid>): string | null {
  for (const grid of sheets.values()) {
    for (const row of grid.values()) {
      for (const cell of row.values()) {
        if (typeof cell.value === "string" && cell.value.toLowerCase().includes("do not yet include")) {
          return cell.value.trim();
        }
      }
    }
  }
  return null;
}

function matchIngredient(
  ingredients: FoodIngredient[],
  name: string,
  sheetUnitCost: number | null,
): FoodIngredient | null {
  const matches = ingredients.filter((row) => row.name === name);
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0];
  const priced = matches.filter((row) => row.costPerUnit != null);
  if (sheetUnitCost != null && sheetUnitCost > 0 && priced.length > 0) {
    return priced.reduce((best, row) =>
      Math.abs((row.costPerUnit ?? 0) - sheetUnitCost) < Math.abs((best.costPerUnit ?? 0) - sheetUnitCost)
        ? row
        : best,
    );
  }
  return priced[0] ?? matches[0];
}

function pricedIngredient(ingredients: FoodIngredient[], name: string): FoodIngredient | null {
  const matches = ingredients.filter((row) => row.name === name);
  return matches.find((row) => row.purchaseCost != null) ?? matches[0] ?? null;
}

function lineKind(name: string, notes: string | null): LineKind {
  if (name === "Average Protein" || (notes ?? "").toLowerCase().includes("protein is added")) {
    return "average_protein";
  }
  if (/box/i.test(name)) return "packaging";
  return "component";
}

function categoryFor(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("bowl")) return "Bowls";
  if (lower.includes("torta")) return "Tortas";
  if (lower.includes("burrito")) return "Burritos";
  if (lower.includes("chilaquiles")) return "Chilaquiles";
  return "Menu";
}

function sourceSlug(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[–—]/g, "-")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function requiredSheet(sheets: Map<string, Grid>, name: string): Grid {
  const sheet = sheets.get(name);
  if (!sheet) throw new Error(`Workbook is missing the ${name} sheet`);
  return sheet;
}

function findRow(grid: Grid, predicate: (row: Map<string, SheetCell>) => boolean): number | null {
  for (const rowNumber of rowNumbers(grid)) {
    const row = grid.get(rowNumber);
    if (row && predicate(row)) return rowNumber;
  }
  return null;
}

function rowNumbers(grid: Grid): number[] {
  return [...grid.keys()].sort((a, b) => a - b);
}

function text(cell: SheetCell | undefined): string | null {
  if (!cell || cell.value == null) return null;
  const value = String(cell.value).trim();
  return value.length ? value : null;
}

function number(cell: SheetCell | undefined): number | null {
  if (!cell || cell.value == null || cell.value === "") return null;
  const value = typeof cell.value === "number" ? cell.value : Number(cell.value);
  return Number.isFinite(value) ? value : null;
}

/** Entered values only. Formula results such as IFERROR blanks stay empty. */
function enteredNumber(cell: SheetCell | undefined): number | null {
  if (!cell || cell.formula) return null;
  return number(cell);
}
