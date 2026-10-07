import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "./db";
import { DOORDASH_STORE_IDS } from "./doordash-stores";
import { UBEREATS_STORE_IDS } from "./ubereats-stores";
import {
  parseDailySalesBody,
  parseDoorDashWeeklyBody,
  parseUberEatsWeeklyBody,
  upsertDailySales,
  upsertDoorDashWeekly,
  upsertUberEatsWeekly,
} from "./ingest";
import { POST as postDaily } from "../app/api/ingest/daily-sales/route";
import { POST as postWeekly } from "../app/api/ingest/doordash-weekly/route";
import { POST as postUberWeekly } from "../app/api/ingest/ubereats-weekly/route";

const DATES = ["2099-01-05", "2099-01-06"];
const WEEK_START = "2099-01-05";
const WEEK_END = "2099-01-11";
const UBER_WEEK_START = "2099-02-02";
const UBER_WEEK_END = "2099-02-08";

function dailyBody(location: "glendale" | "avondale", gross: number, date = DATES[0]) {
  return {
    location,
    date,
    grossSales: gross,
    netSales: gross - 10,
    orderCount: 2,
    source: "upsert-test",
  };
}

before(async () => {
  process.env.INGEST_TOKEN = process.env.INGEST_TOKEN || "upsert-test-token";
  await prisma.location.upsert({
    where: { id: "glendale" },
    create: {
      id: "glendale",
      name: "Glendale Restaurant",
      shortName: "Glendale",
      type: "restaurant",
      timezone: "America/Phoenix",
    },
    update: {},
  });
  await prisma.location.upsert({
    where: { id: "avondale" },
    create: {
      id: "avondale",
      name: "Avondale Food Trailer",
      shortName: "Avondale",
      type: "trailer",
      timezone: "America/Phoenix",
    },
    update: {},
  });
});

async function cleanup() {
  await prisma.dailySalesRecord.deleteMany({ where: { date: { in: DATES }, source: { in: ["upsert-test", "square-export"] } } });
  await prisma.doorDashWeeklyReport.deleteMany({ where: { weekStart: WEEK_START } });
  await prisma.uberEatsWeeklyReport.deleteMany({ where: { weekStart: UBER_WEEK_START } });
}

test("daily sales upsert is idempotent and does not write the other location", async () => {
  process.env.INGEST_TOKEN = process.env.INGEST_TOKEN || "upsert-test-token";
  await cleanup();

  const first = parseDailySalesBody(dailyBody("glendale", 100));
  assert.equal(first.ok, true);
  if (!first.ok) return;
  await upsertDailySales(first.records);

  const second = parseDailySalesBody(dailyBody("glendale", 250));
  assert.equal(second.ok, true);
  if (!second.ok) return;
  await upsertDailySales(second.records);

  const rows = await prisma.dailySalesRecord.findMany({ where: { date: DATES[0] } });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].locationId, "glendale");
  assert.equal(rows[0].grossSales, 250);

  const avondale = await prisma.dailySalesRecord.count({
    where: { locationId: "avondale", date: DATES[0] },
  });
  assert.equal(avondale, 0);
});

test("a batch with an unknown location writes nothing", async () => {
  process.env.INGEST_TOKEN = process.env.INGEST_TOKEN || "upsert-test-token";
  await cleanup();
  const before = await prisma.dailySalesRecord.count({ where: { date: { in: DATES } } });
  const response = await postDaily(
    new Request("http://localhost/api/ingest/daily-sales", {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.INGEST_TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        records: [dailyBody("glendale", 10, DATES[1]), { ...dailyBody("glendale", 10, DATES[1]), location: "phoenix" }],
      }),
    }),
  );
  assert.equal(response.status, 400);
  const after = await prisma.dailySalesRecord.count({ where: { date: { in: DATES } } });
  assert.equal(after, before);
});

test("weekly upsert updates the same location week and rejects a crossed store id", async () => {
  process.env.INGEST_TOKEN = process.env.INGEST_TOKEN || "upsert-test-token";
  await cleanup();

  const parsed = parseDoorDashWeeklyBody({
    location: "glendale",
    doorDashStoreId: DOORDASH_STORE_IDS.glendale,
    weekStart: WEEK_START,
    weekEnd: WEEK_END,
    subtotal: 1000,
    orderCount: 10,
    commission: 300,
    netPayout: 700,
    source: "upsert-test",
  });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  await upsertDoorDashWeekly(parsed.records);

  const updated = parseDoorDashWeeklyBody({
    location: "glendale",
    doorDashStoreId: DOORDASH_STORE_IDS.glendale,
    weekStart: WEEK_START,
    weekEnd: WEEK_END,
    subtotal: 1800,
    orderCount: 18,
    commission: 540,
    netPayout: 1200,
    source: "upsert-test",
  });
  assert.equal(updated.ok, true);
  if (!updated.ok) return;
  await upsertDoorDashWeekly(updated.records);

  const rows = await prisma.doorDashWeeklyReport.findMany({ where: { weekStart: WEEK_START } });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].locationId, "glendale");
  assert.equal(rows[0].subtotal, 1800);
  assert.equal(rows[0].doorDashStoreId, DOORDASH_STORE_IDS.glendale);

  const crossed = await postWeekly(
    new Request("http://localhost/api/ingest/doordash-weekly", {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.INGEST_TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        location: "glendale",
        doorDashStoreId: DOORDASH_STORE_IDS.avondale,
        weekStart: WEEK_START,
        weekEnd: WEEK_END,
        subtotal: 50,
        orderCount: 1,
        commission: 10,
        netPayout: 40,
        source: "upsert-test",
      }),
    }),
  );
  assert.equal(crossed.status, 400);
  const after = await prisma.doorDashWeeklyReport.findMany({ where: { weekStart: WEEK_START } });
  assert.equal(after.length, 1);
  assert.equal(after[0].subtotal, 1800);
  assert.equal(after[0].locationId, "glendale");
  const avondale = await prisma.doorDashWeeklyReport.count({
    where: { locationId: "avondale", weekStart: WEEK_START },
  });
  assert.equal(avondale, 0);
});

function uberBody(location: "glendale" | "avondale", netPayout: number) {
  return {
    location,
    uberStoreId: UBEREATS_STORE_IDS[location],
    weekStart: UBER_WEEK_START,
    weekEnd: UBER_WEEK_END,
    subtotal: 100,
    tax: 8,
    gross: 108,
    orderCount: 4,
    deliveryOrders: 3,
    pickupOrders: 1,
    commission: -20,
    marketingFees: -5,
    promoFees: -1.5,
    adjustments: 0,
    errorCharges: null,
    netPayout,
    source: "upsert-test",
  };
}

test("weekly Uber Eats upsert updates the same location week and rejects a crossed store id", async () => {
  process.env.INGEST_TOKEN = process.env.INGEST_TOKEN || "upsert-test-token";
  await cleanup();

  const parsed = parseUberEatsWeeklyBody(uberBody("glendale", 81.5));
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  await upsertUberEatsWeekly(parsed.records);

  const updated = parseUberEatsWeeklyBody({ ...uberBody("glendale", 90), commission: -11.5, errorCharges: -2 });
  assert.equal(updated.ok, true);
  if (!updated.ok) return;
  await upsertUberEatsWeekly(updated.records);

  const rows = await prisma.uberEatsWeeklyReport.findMany({ where: { weekStart: UBER_WEEK_START } });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].locationId, "glendale");
  assert.equal(rows[0].netPayout, 90);
  assert.equal(rows[0].commission, -11.5);
  assert.equal(rows[0].promoFees, -1.5);
  assert.equal(rows[0].errorCharges, -2);
  assert.equal(rows[0].uberStoreId, UBEREATS_STORE_IDS.glendale);

  const crossed = await postUberWeekly(
    new Request("http://localhost/api/ingest/ubereats-weekly", {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.INGEST_TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        ...uberBody("glendale", 1),
        uberStoreId: UBEREATS_STORE_IDS.avondale,
      }),
    }),
  );
  assert.equal(crossed.status, 400);
  const after = await prisma.uberEatsWeeklyReport.findMany({ where: { weekStart: UBER_WEEK_START } });
  assert.equal(after.length, 1);
  assert.equal(after[0].netPayout, 90);
  assert.equal(after[0].locationId, "glendale");
  const avondale = await prisma.uberEatsWeeklyReport.count({
    where: { locationId: "avondale", weekStart: UBER_WEEK_START },
  });
  assert.equal(avondale, 0);
});

test("Uber Eats weekly rejects a missing bearer token and a sample source without writing", async () => {
  process.env.INGEST_TOKEN = process.env.INGEST_TOKEN || "upsert-test-token";
  await cleanup();

  const unauthorized = await postUberWeekly(
    new Request("http://localhost/api/ingest/ubereats-weekly", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(uberBody("avondale", 50)),
    }),
  );
  assert.equal(unauthorized.status, 401);

  const sample = await postUberWeekly(
    new Request("http://localhost/api/ingest/ubereats-weekly", {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.INGEST_TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ ...uberBody("avondale", 50), source: "Sample" }),
    }),
  );
  assert.equal(sample.status, 400);
  const count = await prisma.uberEatsWeeklyReport.count({ where: { weekStart: UBER_WEEK_START } });
  assert.equal(count, 0);
});

test("missing bearer token is unauthorized and does not write", async () => {
  process.env.INGEST_TOKEN = process.env.INGEST_TOKEN || "upsert-test-token";
  await cleanup();
  const response = await postDaily(
    new Request("http://localhost/api/ingest/daily-sales", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(dailyBody("avondale", 75, DATES[1])),
    }),
  );
  assert.equal(response.status, 401);
  const count = await prisma.dailySalesRecord.count({
    where: { locationId: "avondale", date: DATES[1] },
  });
  assert.equal(count, 0);
});

after(async () => {
  await cleanup();
  await prisma.$disconnect();
});
