import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "./db";
import { DOORDASH_STORE_IDS } from "./doordash-stores";
import { UBEREATS_STORE_IDS } from "./ubereats-stores";
import { loadEmployeeHoursView } from "./employee-hours";
import {
  parseDailySalesBody,
  parseDoorDashWeeklyBody,
  parseEmployeeHoursBody,
  parseUberEatsWeeklyBody,
  upsertDailySales,
  upsertDoorDashWeekly,
  upsertEmployeeHours,
  upsertUberEatsWeekly,
} from "./ingest";
import { POST as postDaily } from "../app/api/ingest/daily-sales/route";
import { POST as postWeekly } from "../app/api/ingest/doordash-weekly/route";
import { POST as postUberWeekly } from "../app/api/ingest/ubereats-weekly/route";
import { POST as postEmployeeHours } from "../app/api/ingest/employee-hours/route";

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

const HOURS_START = "2099-03-02";
const HOURS_END = "2099-03-15";

function hoursBody(
  location: "glendale" | "avondale",
  employeeName: string,
  hours: number,
  extra: Record<string, unknown> = {},
) {
  return {
    location,
    periodStart: HOURS_START,
    periodEnd: HOURS_END,
    employeeName,
    hours,
    hourlyRate: 16,
    basePay: Math.round(hours * 16 * 100) / 100,
    status: "pending",
    source: "upsert-test",
    ...extra,
  };
}

async function cleanup() {
  await prisma.dailySalesRecord.deleteMany({ where: { date: { in: DATES }, source: { in: ["upsert-test", "square-export"] } } });
  await prisma.doorDashWeeklyReport.deleteMany({ where: { weekStart: WEEK_START } });
  await prisma.uberEatsWeeklyReport.deleteMany({ where: { weekStart: UBER_WEEK_START } });
  await prisma.employeeHoursPeriod.deleteMany({ where: { source: "upsert-test" } });
  await prisma.dailySalesRecord.deleteMany({
    where: {
      source: "upsert-test",
      OR: [{ date: { gte: HOURS_START, lte: HOURS_END } }, { date: "2099-04-01" }],
    },
  });
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

test("employee hours upsert updates one location and keeps the other", async () => {
  process.env.INGEST_TOKEN = process.env.INGEST_TOKEN || "upsert-test-token";
  await cleanup();

  const first = parseEmployeeHoursBody([
    hoursBody("glendale", "Ana Ruiz", 10),
    hoursBody("avondale", "Ana Ruiz", 4, { status: "approved", basePay: 64 }),
  ]);
  assert.equal(first.ok, true);
  if (!first.ok) return;
  await upsertEmployeeHours(first.records);

  const second = parseEmployeeHoursBody(hoursBody("glendale", "Ana Ruiz", 12, { status: "approved" }));
  assert.equal(second.ok, true);
  if (!second.ok) return;
  await upsertEmployeeHours(second.records);

  const rows = await prisma.employeeHoursPeriod.findMany({
    where: { employeeName: "Ana Ruiz", periodStart: HOURS_START },
    orderBy: { locationId: "asc" },
  });
  assert.equal(rows.length, 2);
  assert.equal(rows[0].locationId, "avondale");
  assert.equal(rows[0].hours.toNumber(), 4);
  assert.equal(rows[0].status, "approved");
  assert.equal(rows[1].locationId, "glendale");
  assert.equal(rows[1].hours.toNumber(), 12);
  assert.equal(rows[1].basePay.toNumber(), 192);
  assert.equal(rows[1].status, "approved");
});

test("employee hours rejects a negative batch and a sample source without writing", async () => {
  process.env.INGEST_TOKEN = process.env.INGEST_TOKEN || "upsert-test-token";
  await cleanup();

  const negative = await postEmployeeHours(
    new Request("http://localhost/api/ingest/employee-hours", {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.INGEST_TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        records: [hoursBody("glendale", "Ana Ruiz", 8), hoursBody("avondale", "Luis Vega", -1)],
      }),
    }),
  );
  assert.equal(negative.status, 400);
  assert.equal(await prisma.employeeHoursPeriod.count({ where: { source: "upsert-test" } }), 0);

  const sample = await postEmployeeHours(
    new Request("http://localhost/api/ingest/employee-hours", {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.INGEST_TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(hoursBody("glendale", "Ana Ruiz", 8, { source: "sample" })),
    }),
  );
  assert.equal(sample.status, 400);
  assert.equal(await prisma.employeeHoursPeriod.count({ where: { periodStart: HOURS_START } }), 0);
});

test("employee hours requires the bearer token", async () => {
  process.env.INGEST_TOKEN = process.env.INGEST_TOKEN || "upsert-test-token";
  await cleanup();
  const response = await postEmployeeHours(
    new Request("http://localhost/api/ingest/employee-hours", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(hoursBody("avondale", "Ana Ruiz", 5)),
    }),
  );
  assert.equal(response.status, 401);
  assert.equal(await prisma.employeeHoursPeriod.count({ where: { source: "upsert-test" } }), 0);
});

test("loaded labor percent uses Square sales for that location and those dates", async () => {
  process.env.INGEST_TOKEN = process.env.INGEST_TOKEN || "upsert-test-token";
  await cleanup();

  const hours = parseEmployeeHoursBody([
    hoursBody("glendale", "Ana Ruiz", 10, { basePay: 100, status: "pending" }),
    hoursBody("avondale", "Ana Ruiz", 4, { basePay: 40, status: "approved" }),
  ]);
  assert.equal(hours.ok, true);
  if (!hours.ok) return;
  await upsertEmployeeHours(hours.records);

  const sales = parseDailySalesBody([
    dailyBody("glendale", 200, "2099-03-02"),
    dailyBody("glendale", 300, "2099-03-10"),
    dailyBody("avondale", 800, "2099-03-02"),
    dailyBody("glendale", 9000, "2099-04-01"),
  ]);
  assert.equal(sales.ok, true);
  if (!sales.ok) return;
  await upsertDailySales(sales.records.map((record) => ({ ...record, source: "upsert-test" })));

  const all = await loadEmployeeHoursView("all");
  assert.equal(all.periods.length, 1);
  assert.deepEqual(
    all.periods[0].locations.map((block) => [block.locationId, block.basePay, block.squareSales, block.laborPct]),
    [
      ["glendale", 100, 500, 0.2],
      ["avondale", 40, 800, 0.05],
    ],
  );
  assert.equal(all.periods[0].locations[0].review, "pending");
  assert.equal(all.periods[0].locations[1].review, "approved");

  const glendaleOnly = await loadEmployeeHoursView("glendale");
  assert.equal(glendaleOnly.periods[0].locations.length, 1);
  assert.equal(glendaleOnly.periods[0].locations[0].locationId, "glendale");
  assert.equal(glendaleOnly.periods[0].locations[0].squareSales, 500);
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
