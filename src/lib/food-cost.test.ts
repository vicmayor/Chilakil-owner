import test from "node:test";
import assert from "node:assert/strict";
import { buildFoodCostReport, withFoodCostEdits } from "./food-cost";
import { loadFoodCostWorkbook } from "./food-cost-workbook";

const workbook = loadFoodCostWorkbook();
const report = buildFoodCostReport(workbook);

function close(actual: number | null, expected: number) {
  assert.notEqual(actual, null);
  assert.ok(Math.abs((actual ?? 0) - expected) < 1e-9, `${actual} !== ${expected}`);
}

function item(name: string) {
  const found = report.menu.find((row) => row.name === name);
  assert.ok(found, name);
  return found;
}

test("workbook keys stay unique and stable", () => {
  const again = loadFoodCostWorkbook();
  const ingredientKeys = workbook.ingredients.map((row) => row.sourceKey);
  const menuKeys = workbook.menuItems.map((row) => row.sourceKey);
  assert.equal(new Set(ingredientKeys).size, ingredientKeys.length);
  assert.equal(new Set(menuKeys).size, menuKeys.length);
  assert.deepEqual(
    again.ingredients.map((row) => row.sourceKey),
    ingredientKeys,
  );
  assert.deepEqual(
    again.menuItems.map((row) => row.sourceKey),
    menuKeys,
  );
});

test("blank purchase costs stay blank", () => {
  const chicken = workbook.ingredients.find((row) => row.name === "Chicken");
  const cotija = workbook.ingredients.find((row) => row.name === "Cotija Cheese");
  const blankPastor = workbook.ingredients.find((row) => row.name === "Al Pastor" && row.purchaseCost == null);
  const pricedPastor = workbook.ingredients.find((row) => row.name === "Al Pastor" && row.purchaseCost != null);
  assert.equal(chicken?.costPerUnit, null);
  assert.equal(chicken?.purchaseCost, null);
  assert.equal(cotija?.costPerUnit, null);
  assert.equal(blankPastor?.costPerUnit, null);
  assert.equal(blankPastor?.addonPrice, null);
  close(pricedPastor?.costPerUnit ?? null, 0.5);
  assert.equal(pricedPastor?.addonPrice, 3);
  assert.ok(report.missingPrices.some((row) => row.name === "Chicken"));
  assert.ok(report.missingPrices.some((row) => row.name === "Al Pastor" && row.unit === "lb"));
  assert.equal(report.missingPrices.some((row) => row.name === "Al Pastor" && row.unit === "oz"), false);
});

test("menu summary matches the completed Chilakil items at a 30% target", () => {
  assert.equal(report.targetFoodCostPct, 0.3);
  const byo = item("Build Your Own Chilaquiles");
  const burrito = item("Burrito de Chilaquiles");
  const og = item("OG Breakfast Burrito");
  assert.equal(byo.price, 12);
  assert.equal(burrito.price, 12);
  assert.equal(og.price, 11);
  close(byo.menuCost, 5.03610119047619);
  close(burrito.menuCost, 5.410267857142856);
  close(og.menuCost, 3.63478125);
  close(byo.foodCostPct, 5.03610119047619 / 12);
  close(burrito.foodCostPct, 5.410267857142856 / 12);
  close(og.foodCostPct, 3.63478125 / 11);
  close(byo.suggestedPrice, 5.03610119047619 / 0.3);
  close(burrito.suggestedPrice, 5.410267857142856 / 0.3);
  close(og.suggestedPrice, 3.63478125 / 0.3);

  const box = byo.lines.find((line) => line.name === "#8 To-Go Box");
  assert.equal(box?.menuCost, 0);
  close(box?.catalogCost ?? null, 44 / 300);
});

test("base costs add onion and cilantro, and protein add-ons keep the sheet economics", () => {
  const byo = item("Build Your Own Chilaquiles");
  const burrito = item("Burrito de Chilaquiles");
  close(byo.baseCost, 3.182767857142857);
  close(byo.baseWithToppings, 3.857767857142857);
  close(burrito.baseCost, 3.4102678571428564);
  close(burrito.baseWithToppings, 4.085267857142856);
  close(report.toppingCost, 0.675);

  const asada = report.proteins.find((row) => row.name === "Carne Asada");
  const pastor = report.proteins.find((row) => row.name === "Al Pastor");
  const chorizo = report.proteins.find((row) => row.name === "Chorizo");
  assert.equal(report.proteins.length, 3);
  close(asada?.portionCost ?? null, 2);
  close(asada?.costPerLb ?? null, 8);
  assert.equal(asada?.addonPrice, 3);
  close(asada?.contribution ?? null, 1);
  close(asada?.addonCostPct ?? null, 2 / 3);
  close(pastor?.portionCost ?? null, 2);
  assert.equal(pastor?.addonPrice, 3);
  close(chorizo?.portionCost ?? null, 1.5);
  assert.equal(chorizo?.addonPrice, 2);
  close(chorizo?.addonCostPct ?? null, 0.75);

  const chilaquilesAsada = report.plates.find((row) => row.label === "Chilaquiles + Carne Asada");
  const burritoAsada = report.plates.find((row) => row.label === "Burrito + Carne Asada");
  const chilaquilesChorizo = report.plates.find((row) => row.label === "Chilaquiles + Chorizo");
  close(chilaquilesAsada?.sellPrice ?? null, 15);
  close(chilaquilesAsada?.totalCost ?? null, 5.857767857142857);
  close(chilaquilesChorizo?.sellPrice ?? null, 14);
  close(chilaquilesChorizo?.totalCost ?? null, 5.357767857142857);
  close(burritoAsada?.sellPrice ?? null, 15);
  close(burritoAsada?.totalCost ?? null, 6.085267857142856);
});

test("protein add-ons follow workbook rows when sample plates are absent", () => {
  const names = report.proteins.map((row) => row.name).sort();
  assert.deepEqual(names, ["Al Pastor", "Carne Asada", "Chorizo"]);
  const withoutSamplePlates = {
    ...workbook,
    menuItems: workbook.menuItems.filter((item) => !/taco|quesadilla|thigh|pastor pork/i.test(item.name)),
  };
  assert.deepEqual(
    buildFoodCostReport(withoutSamplePlates).proteins.map((row) => row.name).sort(),
    names,
  );
  assert.ok(withoutSamplePlates.menuItems.some((item) => item.name === "Build Your Own Chilaquiles"));
});

test("a unit-cost what-if stays on one copy of the workbook", () => {
  const pastor = workbook.ingredients.find((row) => row.name === "Al Pastor" && row.costPerUnit != null);
  const asada = workbook.ingredients.find((row) => row.name === "Carne Asada" && row.portionQty != null);
  assert.ok(pastor && asada);
  const glendale = withFoodCostEdits(workbook, {
    costPerUnit: { [pastor.sourceKey]: 0.75 },
    prices: {},
    addonPrices: {},
  });
  const glendaleReport = buildFoodCostReport(glendale);
  const avondaleReport = buildFoodCostReport(workbook);
  close(glendaleReport.proteins.find((row) => row.name === "Al Pastor")?.portionCost ?? null, 3);
  close(avondaleReport.proteins.find((row) => row.name === "Al Pastor")?.portionCost ?? null, 2);
  close(glendaleReport.proteins.find((row) => row.name === "Carne Asada")?.portionCost ?? null, 2);
  assert.equal(workbook.ingredients.find((row) => row.sourceKey === pastor.sourceKey)?.costPerUnit, 0.5);

  const byoKey = workbook.menuItems.find((item) => item.name === "Build Your Own Chilaquiles")?.sourceKey;
  assert.ok(byoKey);
  const repriced = buildFoodCostReport(
    withFoodCostEdits(workbook, {
      costPerUnit: {},
      prices: { [byoKey]: 15 },
      addonPrices: {},
    }),
  );
  assert.equal(repriced.menu.find((row) => row.name === "Build Your Own Chilaquiles")?.price, 15);
  assert.equal(report.menu.find((row) => row.name === "Build Your Own Chilaquiles")?.price, 12);

  const average = workbook.ingredients.find((row) => row.name === "Average Protein");
  assert.ok(average?.sourceKey);
  const withProtein = buildFoodCostReport(
    withFoodCostEdits(workbook, {
      costPerUnit: { [average.sourceKey]: (average.costPerUnit ?? 0) + 1 },
      prices: {},
      addonPrices: {},
    }),
  );
  const before = report.menu.find((row) => row.name === "Build Your Own Chilaquiles")?.menuCost ?? 0;
  const after = withProtein.menu.find((row) => row.name === "Build Your Own Chilaquiles")?.menuCost ?? 0;
  assert.ok(after > before);
  const plateBefore = report.plates.find((row) => row.label === "Chilaquiles + Al Pastor")?.totalCost ?? 0;
  const plateAfter = glendaleReport.plates.find((row) => row.label === "Chilaquiles + Al Pastor")?.totalCost ?? 0;
  assert.ok(plateAfter > plateBefore);
  assert.equal(asada.name, "Carne Asada");
});

test("empty template items stay unpriced", () => {
  for (const name of ["Torta de Chilaquiles", "Keto Chilaquiles", "Breakfast Burrito", "Chorizo & Egg Burrito", "Breakfast Bowl"]) {
    const row = item(name);
    assert.equal(row.price, null);
    assert.equal(row.menuCost, null);
    assert.equal(row.costed, false);
  }
});
