import test from "node:test";
import assert from "node:assert/strict";
import { combineWeek, previousWeeks, reportsForLocations, type UberEatsWeek } from "./ubereats-weekly";
import { UBEREATS_STORE_IDS } from "./ubereats-stores";

function report(partial: Pick<UberEatsWeek, "locationId" | "weekStart"> & Partial<UberEatsWeek>): UberEatsWeek {
  return {
    uberStoreId: UBEREATS_STORE_IDS[partial.locationId],
    weekEnd: "2026-10-04",
    subtotal: 1000,
    tax: 80,
    gross: 1080,
    orderCount: 10,
    deliveryOrders: 8,
    pickupOrders: 2,
    commission: -300,
    marketingFees: 0,
    promoFees: 0,
    adjustments: 0,
    errorCharges: null,
    netPayout: 780,
    effectiveCommissionPct: 0.3,
    source: "ubereats-merchant-statement",
    importedAt: "2026-10-06T18:00:00.000Z",
    ...partial,
  };
}

test("location filter drops the other Uber Eats store", () => {
  const rows = reportsForLocations(
    [
      report({ locationId: "glendale", weekStart: "2026-09-28" }),
      report({ locationId: "avondale", weekStart: "2026-09-28", subtotal: 400, commission: -160 }),
    ],
    ["avondale"],
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].locationId, "avondale");
  assert.equal(rows[0].uberStoreId, UBEREATS_STORE_IDS.avondale);
});

test("combined commission is weighted, and a missing error charge stays missing", () => {
  const combined = combineWeek([
    report({
      locationId: "glendale",
      weekStart: "2026-09-28",
      subtotal: 1403.97,
      commission: -371.47,
      marketingFees: -154.5,
      promoFees: -32.67,
      tax: 143.3,
      netPayout: 777.89,
      errorCharges: null,
    }),
    report({
      locationId: "avondale",
      weekStart: "2026-09-28",
      subtotal: 703,
      commission: -183.23,
      marketingFees: -27.2,
      promoFees: -4.95,
      tax: 61.89,
      netPayout: 549.51,
      adjustments: 0,
      errorCharges: null,
    }),
  ]);
  assert.ok(combined);
  assert.equal(combined.subtotal, 2106.97);
  assert.equal(combined.commission, -554.7);
  assert.equal(combined.marketingFees, -181.7);
  assert.equal(combined.promoFees, -37.62);
  assert.equal(combined.tax, 205.19);
  assert.equal(combined.netPayout, 1327.4);
  assert.equal(combined.errorCharges, null);
  assert.ok(Math.abs(combined.effectiveCommissionPct - 554.7 / 2106.97) < 1e-9);
  assert.notEqual(combined.effectiveCommissionPct, (371.47 / 1403.97 + 183.23 / 703) / 2);
  assert.match(combined.label, /Glendale \+ Avondale/);
  assert.deepEqual(combined.locationsIncluded, ["glendale", "avondale"]);
});

test("combined error charges sum only when every location reported one", () => {
  const partial = combineWeek([
    report({ locationId: "glendale", weekStart: "2026-09-28", errorCharges: -12 }),
    report({ locationId: "avondale", weekStart: "2026-09-28", errorCharges: null }),
  ]);
  assert.equal(partial?.errorCharges, null);

  const full = combineWeek([
    report({ locationId: "glendale", weekStart: "2026-09-28", errorCharges: -12 }),
    report({ locationId: "avondale", weekStart: "2026-09-28", errorCharges: -3.5 }),
  ]);
  assert.equal(full?.errorCharges, -15.5);
});

test("previous weeks omit the latest week for that location only", () => {
  const rows = [
    report({ locationId: "glendale", weekStart: "2026-10-05" }),
    report({ locationId: "glendale", weekStart: "2026-09-28" }),
    report({ locationId: "avondale", weekStart: "2026-09-28" }),
  ];
  const previous = previousWeeks(rows, "glendale", "2026-10-05");
  assert.deepEqual(
    previous.map((row) => row.weekStart),
    ["2026-09-28"],
  );
});
