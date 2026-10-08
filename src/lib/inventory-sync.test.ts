import test, { before } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "./db";
import richFixture from "./fixtures/team-inventory-rich.json" with { type: "json" };
import { POST as postInventorySync } from "../app/api/sync/inventory/route";
import { syncTeamInventory } from "./team-inventory-sync";
import { TeamInventoryApiError, type TeamInventoryClient } from "./team-inventory-client";
import { INVENTORY_FORBIDDEN_HINT } from "./team-inventory";

function clientFor(payload: unknown): TeamInventoryClient {
  return {
    async fetchInventory() {
      return payload;
    },
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
  await prisma.teamInventoryItem.deleteMany({});
  await prisma.teamInventorySummary.deleteMany({});
  await prisma.teamInventorySyncState.deleteMany({});
}

test("a valid inventory pull keeps nulls, pound decimals, and separate locations", async () => {
  await cleanup();
  const result = await syncTeamInventory({ client: clientFor(richFixture), location: "all" });
  assert.equal(result.ok, true);
  assert.equal(result.connected, true);
  assert.deepEqual(
    result.counts.map((row) => [row.locationId, row.items]),
    [
      ["glendale", 4],
      ["avondale", 2],
    ],
  );

  const rice = await prisma.teamInventoryItem.findUnique({
    where: { locationId_itemId: { locationId: "glendale", itemId: "arroz" } },
  });
  const asada = await prisma.teamInventoryItem.findUnique({
    where: { locationId_itemId: { locationId: "glendale", itemId: "carne-asada" } },
  });
  const bags = await prisma.teamInventoryItem.findUnique({
    where: { locationId_itemId: { locationId: "avondale", itemId: "bistro-bags-13" } },
  });
  assert.equal(rice?.quantityOnHand?.toNumber(), 1500);
  assert.equal(rice?.status, "out");
  assert.equal(rice?.purchase, "needed");
  assert.equal(rice?.deliveryStatus, "ordered");
  assert.equal(asada?.quantityOnHand?.toNumber(), 2.375);
  assert.equal(asada?.neededDate, "2026-09-30");
  assert.equal(asada?.parLevel, null);
  assert.equal(bags?.quantityOnHand, null);
  assert.equal(bags?.status, "unreviewed");
  assert.equal(bags?.unit, null);
  assert.equal(bags?.lowStock, false);

  const summaries = await prisma.teamInventorySummary.findMany({ orderBy: { locationId: "asc" } });
  assert.equal(summaries.length, 2);
  const glendale = summaries.find((row) => row.locationId === "glendale");
  assert.deepEqual(
    [glendale?.out, glendale?.low, glendale?.toBuy, glendale?.onTheWay, glendale?.unreviewed],
    [1, 1, 2, 2, 0],
  );
  const state = await prisma.teamInventorySyncState.findUnique({ where: { id: "default" } });
  assert.equal(state?.lastError, null);
  assert.ok(state?.lastSuccessAt);
  assert.equal(state.generatedAt?.toISOString(), new Date("2026-10-08T10:00:00-07:00").toISOString());
});

test("syncing only glendale replaces that catalog and leaves avondale in place", async () => {
  await cleanup();
  await syncTeamInventory({ client: clientFor(richFixture), location: "all" });
  const glendaleOnly = {
    generatedAt: "2026-10-08T12:00:00-07:00",
    timezone: "America/Phoenix",
    locations: [
      {
        location: "glendale",
        items: [
          {
            ...richFixture.locations[0].items[2],
            quantityOnHand: 10,
            status: "low",
            lowStock: true,
          },
        ],
        summary: { out: 0, low: 1, toBuy: 0, onTheWay: 0, unreviewed: 0 },
      },
      richFixture.locations[1],
    ],
  };
  const result = await syncTeamInventory({ client: clientFor(glendaleOnly), location: "glendale" });
  assert.equal(result.ok, true);
  assert.deepEqual(result.counts, [{ locationId: "glendale", items: 1 }]);

  const glendaleItems = await prisma.teamInventoryItem.findMany({
    where: { locationId: "glendale" },
    orderBy: { itemId: "asc" },
  });
  assert.deepEqual(
    glendaleItems.map((row) => [row.itemId, row.quantityOnHand?.toNumber()]),
    [["arroz", 10]],
  );
  const avondale = await prisma.teamInventoryItem.findMany({
    where: { locationId: "avondale" },
    orderBy: { itemId: "asc" },
  });
  assert.deepEqual(
    avondale.map((row) => [row.itemId, row.quantityOnHand]),
    [
      ["arroz", null],
      ["bistro-bags-13", null],
    ],
  );
  const avondaleSummary = await prisma.teamInventorySummary.findUnique({ where: { locationId: "avondale" } });
  assert.equal(avondaleSummary?.unreviewed, 2);
  assert.equal(
    avondaleSummary?.generatedAt.toISOString(),
    new Date("2026-10-08T10:00:00-07:00").toISOString(),
  );
});

test("403 and 503 keep the last inventory and record the permission hint", async () => {
  await cleanup();
  const first = await syncTeamInventory({ client: clientFor(richFixture), location: "all" });
  assert.equal(first.ok, true);
  const beforeItems = await prisma.teamInventoryItem.findMany({ orderBy: [{ locationId: "asc" }, { itemId: "asc" }] });
  const beforeState = await prisma.teamInventorySyncState.findUnique({ where: { id: "default" } });
  assert.ok(beforeState?.lastSuccessAt);

  const forbidden: TeamInventoryClient = {
    async fetchInventory() {
      throw new TeamInventoryApiError(403);
    },
  };
  const denied = await syncTeamInventory({ client: forbidden, location: "all" });
  assert.equal(denied.ok, false);
  assert.equal(denied.connected, true);
  assert.equal(denied.status, 403);
  assert.match(denied.error ?? "", /Activa el permiso de inventario en Team/);
  assert.match(denied.error ?? "", /Turn on inventory access/);
  assert.equal(denied.error?.includes(INVENTORY_FORBIDDEN_HINT), true);

  const afterForbidden = await prisma.teamInventorySyncState.findUnique({ where: { id: "default" } });
  assert.equal(afterForbidden?.lastStatus, 403);
  assert.equal(afterForbidden?.lastSuccessAt?.toISOString(), beforeState.lastSuccessAt.toISOString());
  assert.equal(afterForbidden?.generatedAt?.toISOString(), beforeState.generatedAt?.toISOString());

  const down: TeamInventoryClient = {
    async fetchInventory() {
      throw new TeamInventoryApiError(503);
    },
  };
  const unavailable = await syncTeamInventory({ client: down, location: "all" });
  assert.equal(unavailable.ok, false);
  assert.equal(unavailable.status, 503);
  assert.match(unavailable.error ?? "", /temporarily unavailable/);
  const afterDown = await prisma.teamInventorySyncState.findUnique({ where: { id: "default" } });
  assert.equal(afterDown?.lastStatus, 503);
  assert.equal(afterDown?.lastSuccessAt?.toISOString(), beforeState.lastSuccessAt.toISOString());

  const afterItems = await prisma.teamInventoryItem.findMany({ orderBy: [{ locationId: "asc" }, { itemId: "asc" }] });
  assert.deepEqual(
    afterItems.map((row) => [row.locationId, row.itemId, row.quantityOnHand?.toString() ?? null, row.status]),
    beforeItems.map((row) => [row.locationId, row.itemId, row.quantityOnHand?.toString() ?? null, row.status]),
  );
  assert.equal(afterItems.length, 6);
});

test("a fresh page-open pull skips Team and a timeout keeps the stored rows", async () => {
  await cleanup();
  const first = await syncTeamInventory({ client: clientFor(richFixture), location: "all" });
  assert.equal(first.ok, true);
  let calls = 0;
  const counting: TeamInventoryClient = {
    async fetchInventory() {
      calls += 1;
      return richFixture;
    },
  };
  const skipped = await syncTeamInventory({ client: counting, location: "all", minIntervalMs: 60_000 });
  assert.equal(skipped.ok, true);
  assert.equal(skipped.skipped, true);
  assert.equal(calls, 0);

  await prisma.teamInventorySyncState.update({
    where: { id: "default" },
    data: { lastError: "stale", lastStatus: 503 },
  });
  const retried = await syncTeamInventory({ client: counting, location: "all", minIntervalMs: 60_000 });
  assert.equal(retried.skipped, undefined);
  assert.equal(calls, 1);

  await prisma.teamInventorySyncState.update({
    where: { id: "default" },
    data: { lastSuccessAt: new Date(Date.now() - 120_000), lastError: null, lastStatus: null },
  });
  const again = await syncTeamInventory({ client: counting, location: "all", minIntervalMs: 60_000 });
  assert.equal(again.ok, true);
  assert.equal(again.skipped, undefined);
  assert.equal(calls, 2);

  await prisma.teamInventorySyncState.update({
    where: { id: "default" },
    data: { lastSuccessAt: new Date(Date.now() - 120_000), lastError: null, lastStatus: null },
  });
  const before = await prisma.teamInventoryItem.count();
  const timedOut: TeamInventoryClient = {
    async fetchInventory() {
      const error = new Error("The operation was aborted due to timeout");
      error.name = "TimeoutError";
      throw error;
    },
  };
  const failed = await syncTeamInventory({ client: timedOut, location: "all", minIntervalMs: 60_000 });
  assert.equal(failed.ok, false);
  assert.match(failed.error ?? "", /Couldn't reach the Team API/);
  assert.equal(await prisma.teamInventoryItem.count(), before);
  const state = await prisma.teamInventorySyncState.findUnique({ where: { id: "default" } });
  assert.ok(state?.lastError);
  assert.ok(state.lastSuccessAt);
});

test("inventory sync route requires a bearer token and stays disconnected without a team key", async () => {
  await cleanup();
  process.env.INGEST_TOKEN = process.env.INGEST_TOKEN || "upsert-test-token";
  const previousUrl = process.env.CHILAKIL_TEAM_API_URL;
  const previousKey = process.env.CHILAKIL_TEAM_API_KEY;
  const previousToken = process.env.CHILAKIL_TEAM_API_TOKEN;
  delete process.env.CHILAKIL_TEAM_API_URL;
  delete process.env.CHILAKIL_TEAM_API_KEY;
  delete process.env.CHILAKIL_TEAM_API_TOKEN;
  try {
    const unauthorized = await postInventorySync(new Request("http://localhost/api/sync/inventory", { method: "POST" }));
    assert.equal(unauthorized.status, 401);

    const missing = await postInventorySync(
      new Request("http://localhost/api/sync/inventory", {
        method: "POST",
        headers: { authorization: `Bearer ${process.env.INGEST_TOKEN}` },
      }),
    );
    assert.equal(missing.status, 200);
    const body = (await missing.json()) as { ok: boolean; connected: boolean; counts: unknown[] };
    assert.equal(body.ok, false);
    assert.equal(body.connected, false);
    assert.deepEqual(body.counts, []);
    assert.equal(await prisma.teamInventoryItem.count(), 0);
  } finally {
    if (previousUrl === undefined) delete process.env.CHILAKIL_TEAM_API_URL;
    else process.env.CHILAKIL_TEAM_API_URL = previousUrl;
    if (previousKey === undefined) delete process.env.CHILAKIL_TEAM_API_KEY;
    else process.env.CHILAKIL_TEAM_API_KEY = previousKey;
    if (previousToken === undefined) delete process.env.CHILAKIL_TEAM_API_TOKEN;
    else process.env.CHILAKIL_TEAM_API_TOKEN = previousToken;
  }
});
