import test from "node:test";
import assert from "node:assert/strict";
import { sumMetrics, type LocationMetrics } from "./metrics";

function stub(partial: Partial<LocationMetrics> & Pick<LocationMetrics, "locationId">): LocationMetrics {
  return {
    name: partial.locationId,
    shortName: partial.locationId,
    gross: 0,
    deliveryGross: 0,
    inStoreGross: 0,
    fees: 0,
    net: 0,
    labor: 0,
    laborHours: 0,
    foodCost: 0,
    actualFoodPurchases: 0,
    orderCount: 0,
    averageTicket: 0,
    targetLaborPct: 0.25,
    targetFoodCostPct: 0.3,
    laborPct: 0,
    foodCostPct: 0,
    netPct: 0,
    ...partial,
  };
}

test("combined metrics add Glendale and Avondale and mark the result combined", () => {
  const g = stub({
    locationId: "glendale",
    name: "Glendale Restaurant",
    shortName: "Glendale",
    gross: 5842.5,
    deliveryGross: 1986,
    net: 5278.94,
    labor: 1312,
    foodCost: 1694.33,
    orderCount: 127,
  });
  const a = stub({
    locationId: "avondale",
    name: "Avondale Food Trailer",
    shortName: "Avondale",
    gross: 2418.75,
    deliveryGross: 1654,
    net: 1950.99,
    labor: 486,
    foodCost: 773.99,
    orderCount: 61,
  });
  const combined = sumMetrics([g, a]);
  assert.equal(combined.gross, 8261.25);
  assert.equal(combined.orderCount, 188);
  assert.equal(combined.deliveryGross, 3640);
  assert.equal(combined.shortName, "Combined");
  assert.match(combined.name, /Combined total/i);
  assert.notEqual(combined.name, g.name);
  assert.notEqual(combined.name, a.name);
});

test("a single location is not relabeled as combined", () => {
  const g = stub({
    locationId: "glendale",
    name: "Glendale Restaurant",
    shortName: "Glendale",
    gross: 100,
    orderCount: 2,
  });
  assert.equal(g.shortName, "Glendale");
  assert.equal(g.name, "Glendale Restaurant");
});
