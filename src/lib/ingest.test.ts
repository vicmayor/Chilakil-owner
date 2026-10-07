import test from "node:test";
import assert from "node:assert/strict";
import { csvToRecords } from "./csv";
import { DOORDASH_STORE_IDS } from "./doordash-stores";
import { UBEREATS_STORE_IDS } from "./ubereats-stores";
import {
  DAILY_SALES_NUMERIC_COLUMNS,
  DOORDASH_WEEKLY_NUMERIC_COLUMNS,
  UBEREATS_WEEKLY_NUMERIC_COLUMNS,
  bearerMatches,
  parseDailySalesBody,
  parseDoorDashWeeklyBody,
  parseUberEatsWeeklyBody,
} from "./ingest";

const daily = {
  location: "glendale",
  date: "2026-10-06",
  grossSales: 100,
  netSales: 80,
  orderCount: 4,
  source: "square-export",
};

test("daily sales accepts one record and computes the average ticket", () => {
  const parsed = parseDailySalesBody(daily);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.records.length, 1);
  assert.equal(parsed.records[0].locationId, "glendale");
  assert.equal(parsed.records[0].averageTicket, 25);
  assert.equal(parsed.records[0].discounts, 0);
});

test("daily sales accepts a batch and keeps each location on its own row", () => {
  const parsed = parseDailySalesBody({
    records: [
      daily,
      { ...daily, location: "avondale", grossSales: 40, netSales: 30, orderCount: 2 },
    ],
  });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.deepEqual(
    parsed.records.map((record) => record.locationId),
    ["glendale", "avondale"],
  );
  assert.equal(parsed.records[0].grossSales, 100);
  assert.equal(parsed.records[1].grossSales, 40);
});

test("daily sales rejects an unknown location and a duplicate key", () => {
  const unknown = parseDailySalesBody({ ...daily, location: "phoenix" });
  assert.equal(unknown.ok, false);
  if (!unknown.ok) assert.match(unknown.issues.join(" "), /location/i);

  const duplicate = parseDailySalesBody([daily, daily]);
  assert.equal(duplicate.ok, false);
  if (!duplicate.ok) assert.match(duplicate.error, /Duplicate/);
});

test("daily sales rejects the reserved sample source", () => {
  const parsed = parseDailySalesBody({ ...daily, source: "sample" });
  assert.equal(parsed.ok, false);
});

test("weekly DoorDash rejects a store id that belongs to the other location", () => {
  const parsed = parseDoorDashWeeklyBody({
    location: "glendale",
    doorDashStoreId: DOORDASH_STORE_IDS.avondale,
    weekStart: "2026-09-28",
    weekEnd: "2026-10-04",
    subtotal: 1000,
    orderCount: 20,
    commission: 300,
    netPayout: 700,
    source: "doordash-merchant-report",
  });
  assert.equal(parsed.ok, false);
  if (!parsed.ok) {
    assert.match(parsed.issues.join(" "), /not glendale/i);
    assert.match(parsed.issues.join(" "), /across locations/i);
  }
});

test("weekly DoorDash accepts the matching store and stores commission as a ratio", () => {
  const parsed = parseDoorDashWeeklyBody({
    location: "avondale",
    doorDashStoreId: Number(DOORDASH_STORE_IDS.avondale),
    weekStart: "2026-09-28",
    weekEnd: "2026-10-04",
    gross: 2000,
    orderCount: 40,
    commission: 660,
    marketingFees: 40,
    netPayout: 1300,
    effectiveCommissionPct: 33,
    source: "doordash-merchant-report",
  });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.records[0].locationId, "avondale");
  assert.equal(parsed.records[0].doorDashStoreId, DOORDASH_STORE_IDS.avondale);
  assert.equal(parsed.records[0].subtotal, 2000);
  assert.equal(parsed.records[0].effectiveCommissionPct, 0.33);
});

test("weekly DoorDash rejects an unknown store and a short week", () => {
  const unknown = parseDoorDashWeeklyBody({
    location: "glendale",
    doorDashStoreId: "111",
    weekStart: "2026-09-28",
    weekEnd: "2026-10-04",
    subtotal: 10,
    orderCount: 1,
    commission: 1,
    netPayout: 9,
    source: "doordash-merchant-report",
  });
  assert.equal(unknown.ok, false);

  const short = parseDoorDashWeeklyBody({
    location: "glendale",
    doorDashStoreId: DOORDASH_STORE_IDS.glendale,
    weekStart: "2026-09-28",
    weekEnd: "2026-09-30",
    subtotal: 10,
    orderCount: 1,
    commission: 1,
    netPayout: 9,
    source: "doordash-merchant-report",
  });
  assert.equal(short.ok, false);
  if (!short.ok) assert.match(short.issues.join(" "), /weekEnd/);
});

test("CSV daily sales becomes the same records as JSON", () => {
  const csv = [
    "location,date,grossSales,netSales,orderCount,source",
    "glendale,2026-10-06,100,80,4,square-export",
    "avondale,2026-10-06,40,30,2,square-export",
  ].join("\n");
  const parsed = parseDailySalesBody(csvToRecords(csv, DAILY_SALES_NUMERIC_COLUMNS));
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.deepEqual(
    parsed.records.map((record) => [record.locationId, record.grossSales]),
    [
      ["glendale", 100],
      ["avondale", 40],
    ],
  );
});

test("quoted CSV commas stay inside one field", () => {
  const csv = `location,doorDashStoreId,weekStart,weekEnd,subtotal,orderCount,commission,netPayout,source
glendale,${DOORDASH_STORE_IDS.glendale},2026-09-28,2026-10-04,1000,10,300,700,"doordash, export"`;
  const parsed = parseDoorDashWeeklyBody(csvToRecords(csv, DOORDASH_WEEKLY_NUMERIC_COLUMNS));
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.records[0].source, "doordash, export");
});

const glendaleUber = {
  location: "glendale",
  uberStoreId: UBEREATS_STORE_IDS.glendale,
  weekStart: "2026-09-28",
  weekEnd: "2026-10-04",
  subtotal: 1403.97,
  tax: 143.3,
  gross: 1547.27,
  orderCount: 49,
  deliveryOrders: 48,
  pickupOrders: 1,
  commission: -371.47,
  marketingFees: -154.5,
  promoFees: -32.67,
  adjustments: -210.74,
  errorCharges: null,
  netPayout: 777.89,
  source: "ubereats-merchant-statement-2026-10-04",
  notes: "Ignored extra field from the merchant statement.",
};

const avondaleUber = {
  location: "avondale",
  uberStoreId: UBEREATS_STORE_IDS.avondale.toUpperCase(),
  weekStart: "2026-09-28",
  weekEnd: "2026-10-04",
  subtotal: 703,
  tax: 61.89,
  gross: 764.89,
  orderCount: 25,
  deliveryOrders: 22,
  pickupOrders: 3,
  commission: -183.23,
  marketingFees: -27.2,
  promoFees: -4.95,
  adjustments: 0,
  errorCharges: null,
  netPayout: 549.51,
  source: "ubereats-merchant-statement-2026-10-04",
};

test("weekly Uber Eats keeps signed fees, a null error charge, and separate promo fees", () => {
  const parsed = parseUberEatsWeeklyBody({ records: [glendaleUber, avondaleUber] });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.deepEqual(
    parsed.records.map((record) => record.locationId),
    ["glendale", "avondale"],
  );
  const glendale = parsed.records[0];
  assert.equal(glendale.uberStoreId, UBEREATS_STORE_IDS.glendale);
  assert.equal(glendale.commission, -371.47);
  assert.equal(glendale.marketingFees, -154.5);
  assert.equal(glendale.promoFees, -32.67);
  assert.equal(glendale.adjustments, -210.74);
  assert.equal(glendale.errorCharges, null);
  assert.equal(glendale.tax, 143.3);
  assert.equal(glendale.deliveryOrders, 48);
  assert.equal(glendale.pickupOrders, 1);
  assert.equal(parsed.records[1].uberStoreId, UBEREATS_STORE_IDS.avondale);
  assert.equal(parsed.records[1].locationId, "avondale");
});

test("weekly Uber Eats rejects a store id that belongs to the other location", () => {
  const parsed = parseUberEatsWeeklyBody({
    ...glendaleUber,
    uberStoreId: UBEREATS_STORE_IDS.avondale,
  });
  assert.equal(parsed.ok, false);
  if (!parsed.ok) {
    assert.match(parsed.issues.join(" "), /not glendale/i);
    assert.match(parsed.issues.join(" "), /across locations/i);
  }
});

test("weekly Uber Eats rejects an unknown store, a short week, and the sample source", () => {
  const unknown = parseUberEatsWeeklyBody({
    ...glendaleUber,
    uberStoreId: "00000000-0000-0000-0000-000000000000",
  });
  assert.equal(unknown.ok, false);
  if (!unknown.ok) assert.match(unknown.issues.join(" "), /not a Chilakil store/);

  const short = parseUberEatsWeeklyBody({
    ...glendaleUber,
    weekEnd: "2026-10-03",
  });
  assert.equal(short.ok, false);
  if (!short.ok) assert.match(short.issues.join(" "), /weekEnd/);

  const sample = parseUberEatsWeeklyBody({ ...glendaleUber, source: "sample" });
  assert.equal(sample.ok, false);

  const duplicate = parseUberEatsWeeklyBody([glendaleUber, glendaleUber]);
  assert.equal(duplicate.ok, false);
  if (!duplicate.ok) assert.match(duplicate.error, /Duplicate/);
});

test("Uber Eats CSV keeps a null error charge empty and a signed commission", () => {
  const csv = [
    "location,uberStoreId,weekStart,weekEnd,subtotal,tax,gross,orderCount,deliveryOrders,pickupOrders,commission,marketingFees,promoFees,adjustments,errorCharges,netPayout,source",
    `avondale,${UBEREATS_STORE_IDS.avondale},2026-09-28,2026-10-04,703,61.89,764.89,25,22,3,-183.23,-27.20,-4.95,0,,549.51,ubereats-export`,
  ].join("\n");
  const parsed = parseUberEatsWeeklyBody(csvToRecords(csv, UBEREATS_WEEKLY_NUMERIC_COLUMNS));
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.records[0].commission, -183.23);
  assert.equal(parsed.records[0].errorCharges, null);
  assert.equal(parsed.records[0].promoFees, -4.95);
});

test("ingest auth requires the bearer token and ignores a different length", () => {
  assert.equal(bearerMatches("Bearer correct-token", "correct-token"), true);
  assert.equal(bearerMatches("Bearer wrong-token!", "correct-token"), false);
  assert.equal(bearerMatches(null, "correct-token"), false);
  assert.equal(bearerMatches("Bearer correct-token", undefined), false);
  assert.equal(bearerMatches("Bearer correct-token", ""), false);
});
