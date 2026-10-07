import test from "node:test";
import assert from "node:assert/strict";
import {
  PROTEIN_ADDON_PRICE,
  TARGET_FOOD_COST_PCT,
  costsDiffer,
  groupFoodCostLocations,
  parseCostInput,
  proteinAddonsForLocation,
  quoteSale,
  recipeCost,
  type FoodCostIngredient,
  type FoodCostMenuItem,
} from "./food-cost";

/**
 * Unit costs and plate quantities copied from prisma/seed.ts.
 * Glendale and Avondale are separate rows there; these fixtures stay separate too.
 */
const GLENDALE_COSTS: Record<string, number> = {
  "Carne asada": 8.4,
  "Pastor pork": 5.1,
  "Chicken thigh": 3.8,
  "Corn tortillas": 0.08,
  "Flour tortillas": 0.18,
  "Oaxaca cheese": 6.2,
  "Cabbage / onion mix": 1.4,
  "Salsa roja": 0.12,
  Rice: 0.06,
  Beans: 0.07,
  "Horchata mix": 0.09,
  Clamshell: 0.22,
};

const AVONDALE_COSTS: Record<string, number> = {
  "Carne asada": 8.7,
  "Pastor pork": 5.3,
  "Chicken thigh": 4,
  "Corn tortillas": 0.09,
  "Flour tortillas": 0.2,
  "Oaxaca cheese": 6.4,
  "Cabbage / onion mix": 1.5,
  "Salsa roja": 0.13,
  Rice: 0.07,
  Beans: 0.08,
  "Horchata mix": 0.1,
  Clamshell: 0.22,
};

const PLATES: {
  name: string;
  category: string;
  price: number;
  lines: [string, number][];
}[] = [
  {
    name: "Tacos al pastor (3)",
    category: "Tacos",
    price: 13.5,
    lines: [
      ["Pastor pork", 0.35],
      ["Corn tortillas", 3],
      ["Cabbage / onion mix", 0.12],
      ["Salsa roja", 2],
      ["Clamshell", 1],
    ],
  },
  {
    name: "Carne asada tacos (3)",
    category: "Tacos",
    price: 14.5,
    lines: [
      ["Carne asada", 0.38],
      ["Corn tortillas", 3],
      ["Cabbage / onion mix", 0.12],
      ["Salsa roja", 2],
      ["Clamshell", 1],
    ],
  },
  {
    name: "Burrito Chilakil",
    category: "Burritos",
    price: 14,
    lines: [
      ["Carne asada", 0.3],
      ["Flour tortillas", 1],
      ["Rice", 5],
      ["Beans", 4],
      ["Oaxaca cheese", 0.12],
      ["Salsa roja", 2],
      ["Clamshell", 1],
    ],
  },
  {
    name: "Chicken tinga quesadilla",
    category: "Quesadillas",
    price: 12,
    lines: [
      ["Chicken thigh", 0.28],
      ["Flour tortillas", 1],
      ["Oaxaca cheese", 0.18],
      ["Salsa roja", 1.5],
      ["Clamshell", 1],
    ],
  },
  {
    name: "Horchata 16oz",
    category: "Drinks",
    price: 3.75,
    lines: [["Horchata mix", 16]],
  },
];

function kitchen(locationId: "glendale" | "avondale", costs: Record<string, number>) {
  const ingredients: (FoodCostIngredient & { locationId: "glendale" | "avondale" })[] = Object.entries(
    costs,
  ).map(([name, costPerUnit]) => ({
    id: `${locationId}:${name}`,
    locationId,
    name,
    unit: name.includes("tortilla") || name === "Clamshell" ? "each" : name === "Salsa roja" || name.includes("mix") || name === "Rice" || name === "Beans" ? "oz" : "lb",
    costPerUnit,
  }));
  const items: (FoodCostMenuItem & { locationId: "glendale" | "avondale" })[] = PLATES.map((plate) => ({
    id: `${locationId}:${plate.name}`,
    locationId,
    name: plate.name,
    category: plate.category,
    price: locationId === "avondale" && plate.category !== "Drinks" ? plate.price - 0.5 : plate.price,
    lines: plate.lines.map(([name, quantity]) => {
      const ingredient = ingredients.find((entry) => entry.name === name);
      if (!ingredient) throw new Error(`missing ${name}`);
      return {
        ingredientId: ingredient.id,
        name,
        unit: ingredient.unit,
        quantity,
      };
    }),
  }));
  return { ingredients, items };
}

function costMap(ingredients: FoodCostIngredient[]) {
  return new Map(ingredients.map((ingredient) => [ingredient.id, ingredient.costPerUnit]));
}

test("Glendale pastor plate matches the workbook and a 30% suggested price", () => {
  const { ingredients, items } = kitchen("glendale", GLENDALE_COSTS);
  const pastor = items.find((item) => item.name === "Tacos al pastor (3)");
  assert.ok(pastor);
  const cost = recipeCost(pastor.lines, costMap(ingredients));
  assert.ok(Math.abs(cost - 2.653) < 1e-9);
  const quote = quoteSale(cost, pastor.price);
  assert.equal(quote.foodCostPct, cost / 13.5);
  assert.ok(Math.abs(quote.grossProfit - (13.5 - cost)) < 1e-9);
  assert.equal(quote.suggestedPrice, cost / TARGET_FOOD_COST_PCT);
  assert.ok(quote.suggestedPrice < pastor.price);
});

test("Avondale keeps its own costs and trailer prices", () => {
  const glendale = kitchen("glendale", GLENDALE_COSTS);
  const avondale = kitchen("avondale", AVONDALE_COSTS);
  const gPastor = glendale.items.find((item) => item.name === "Tacos al pastor (3)");
  const aPastor = avondale.items.find((item) => item.name === "Tacos al pastor (3)");
  assert.ok(gPastor && aPastor);
  const gCost = recipeCost(gPastor.lines, costMap(glendale.ingredients));
  const aCost = recipeCost(aPastor.lines, costMap(avondale.ingredients));
  assert.ok(Math.abs(aCost - 2.785) < 1e-9);
  assert.notEqual(gCost, aCost);
  assert.equal(aPastor.price, 13);
  assert.equal(gPastor.price, 13.5);
  const drink = avondale.items.find((item) => item.name === "Horchata 16oz");
  assert.equal(drink?.price, 3.75);
});

test("raising a protein cost updates that plate, the burrito, and the add-on only", () => {
  const { ingredients, items } = kitchen("glendale", GLENDALE_COSTS);
  const baseAddons = proteinAddonsForLocation(ingredients, items);
  const asada = baseAddons.find((addon) => addon.ingredientName === "Carne asada");
  const pastor = baseAddons.find((addon) => addon.ingredientName === "Pastor pork");
  const chicken = baseAddons.find((addon) => addon.ingredientName === "Chicken thigh");
  assert.ok(asada && pastor && chicken);
  assert.equal(asada.portionQty, 0.38);
  assert.equal(asada.portionFromRecipe, "Carne asada tacos (3)");
  assert.ok(Math.abs(asada.recipeCost - 0.38 * 8.4) < 1e-9);
  assert.ok(Math.abs(pastor.recipeCost - 0.35 * 5.1) < 1e-9);
  assert.ok(Math.abs(chicken.recipeCost - 0.28 * 3.8) < 1e-9);

  const bumped = ingredients.map((ingredient) =>
    ingredient.name === "Carne asada" ? { ...ingredient, costPerUnit: 10 } : ingredient,
  );
  const nextAddons = proteinAddonsForLocation(bumped, items);
  const nextAsada = nextAddons.find((addon) => addon.ingredientName === "Carne asada");
  const nextPastor = nextAddons.find((addon) => addon.ingredientName === "Pastor pork");
  assert.ok(nextAsada && nextPastor);
  assert.ok(Math.abs(nextAsada.recipeCost - 3.8) < 1e-9);
  assert.equal(nextPastor.recipeCost, pastor.recipeCost);

  const costs = costMap(bumped);
  const tacos = items.find((item) => item.name === "Carne asada tacos (3)");
  const burrito = items.find((item) => item.name === "Burrito Chilakil");
  const horchata = items.find((item) => item.name === "Horchata 16oz");
  assert.ok(tacos && burrito && horchata);
  assert.ok(recipeCost(tacos.lines, costs) > recipeCost(tacos.lines, costMap(ingredients)));
  assert.ok(recipeCost(burrito.lines, costs) > recipeCost(burrito.lines, costMap(ingredients)));
  assert.equal(recipeCost(horchata.lines, costs), recipeCost(horchata.lines, costMap(ingredients)));

  const addonQuote = quoteSale(nextAsada.recipeCost, PROTEIN_ADDON_PRICE);
  assert.equal(addonQuote.suggestedPrice, nextAsada.recipeCost / 0.3);
  assert.ok(addonQuote.foodCostPct !== null && addonQuote.foodCostPct > TARGET_FOOD_COST_PCT);
});

test("a Glendale protein what-if does not change the Avondale add-on", () => {
  const glendale = kitchen("glendale", GLENDALE_COSTS);
  const avondale = kitchen("avondale", AVONDALE_COSTS);
  const grouped = groupFoodCostLocations(
    ["glendale", "avondale"],
    [...glendale.ingredients, ...avondale.ingredients],
    [...glendale.items, ...avondale.items],
  );
  assert.deepEqual(
    grouped.map((location) => location.locationId),
    ["glendale", "avondale"],
  );
  assert.ok(grouped[0].ingredients.every((ingredient) => ingredient.id.startsWith("glendale:")));
  assert.ok(grouped[1].items.every((item) => item.id.startsWith("avondale:")));
  assert.deepEqual(
    grouped[0].ingredients.slice(0, 3).map((ingredient) => ingredient.name),
    ["Carne asada", "Chicken thigh", "Pastor pork"],
  );

  const editedGlendale = grouped[0].ingredients.map((ingredient) =>
    ingredient.name === "Pastor pork" ? { ...ingredient, costPerUnit: 9 } : ingredient,
  );
  const gAddon = proteinAddonsForLocation(editedGlendale, grouped[0].items).find(
    (addon) => addon.ingredientName === "Pastor pork",
  );
  const aAddon = proteinAddonsForLocation(grouped[1].ingredients, grouped[1].items).find(
    (addon) => addon.ingredientName === "Pastor pork",
  );
  assert.ok(gAddon && aAddon);
  assert.ok(Math.abs(gAddon.recipeCost - 0.35 * 9) < 1e-9);
  assert.ok(Math.abs(aAddon.recipeCost - 0.35 * 5.3) < 1e-9);
  assert.notEqual(gAddon.ingredientId, aAddon.ingredientId);
});

test("a single-location scope drops the other kitchen", () => {
  const glendale = kitchen("glendale", GLENDALE_COSTS);
  const avondale = kitchen("avondale", AVONDALE_COSTS);
  const onlyTrailer = groupFoodCostLocations(
    ["avondale"],
    [...glendale.ingredients, ...avondale.ingredients],
    [...glendale.items, ...avondale.items],
  );
  assert.equal(onlyTrailer.length, 1);
  assert.equal(onlyTrailer[0].locationId, "avondale");
  assert.equal(onlyTrailer[0].items.length, PLATES.length);
  assert.ok(onlyTrailer[0].ingredients.every((ingredient) => ingredient.id.startsWith("avondale:")));
});

test("cost input rejects blanks and keeps workbook dollars", () => {
  assert.equal(parseCostInput(""), null);
  assert.equal(parseCostInput("8.40"), 8.4);
  assert.equal(parseCostInput("$3"), 3);
  assert.equal(parseCostInput("-1"), null);
  assert.equal(costsDiffer(8.4, 8.4), false);
  assert.equal(costsDiffer(8.4, 8.7), true);
});
