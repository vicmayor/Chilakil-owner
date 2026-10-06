import test from "node:test";
import assert from "node:assert/strict";
import { combineWeek, previousWeeks, reportsForLocations, type WeeklyReport } from "./doordash-weekly";
import { DOORDASH_STORE_IDS } from "./doordash-stores";

function report(partial: Pick<WeeklyReport, "locationId" | "weekStart"> & Partial<WeeklyReport>): WeeklyReport {
  return {
    doorDashStoreId: DOORDASH_STORE_IDS[partial.locationId],
    weekEnd: "2026-10-04",
    subtotal: 1000,
    gross: 1000,
    orderCount: 10,
    commission: 300,
    marketingFees: 0,
    errorCharges: 0,
    adjustments: 0,
    netPayout: 700,
    effectiveCommissionPct: 0.3,
    deliveryOrders: null,
    pickupOrders: null,
    deliverySubtotal: null,
    pickupSubtotal: null,
    source: "doordash-merchant-report",
    importedAt: "2026-10-06T18:00:00.000Z",
    ...partial,
  };
}

test("location filter drops the other store", () => {
  const rows = reportsForLocations(
    [
      report({ locationId: "glendale", weekStart: "2026-09-28" }),
      report({ locationId: "avondale", weekStart: "2026-09-28", subtotal: 400, commission: 160 }),
    ],
    ["avondale"],
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].locationId, "avondale");
  assert.equal(rows[0].doorDashStoreId, DOORDASH_STORE_IDS.avondale);
});

test("combined commission is weighted, not an average of the two rates", () => {
  const combined = combineWeek([
    report({ locationId: "glendale", weekStart: "2026-09-28", subtotal: 1000, commission: 300, effectiveCommissionPct: 0.3 }),
    report({
      locationId: "avondale",
      weekStart: "2026-09-28",
      subtotal: 1000,
      commission: 100,
      effectiveCommissionPct: 0.1,
      netPayout: 900,
    }),
  ]);
  assert.ok(combined);
  assert.equal(combined.subtotal, 2000);
  assert.equal(combined.commission, 400);
  assert.equal(combined.effectiveCommissionPct, 0.2);
  assert.match(combined.label, /Glendale \+ Avondale/);
  assert.deepEqual(combined.locationsIncluded, ["glendale", "avondale"]);
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
