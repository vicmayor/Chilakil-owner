import test from "node:test";
import assert from "node:assert/strict";
import contractFixture from "./fixtures/team-inventory-contract.json" with { type: "json" };
import richFixture from "./fixtures/team-inventory-rich.json" with { type: "json" };
import { createTeamInventoryClient, TeamInventoryApiError } from "./team-inventory-client";
import { mapTeamInventoryResponse } from "./team-inventory-mapper";
import {
  INVENTORY_FORBIDDEN_HINT,
  blocksForScope,
  categoryLabel,
  filterInventoryItems,
  formatInventorySyncedAt,
  groupInventoryByCategory,
  inventoryActionAlert,
  itemIsPending,
  neededDatePresentation,
  quantityLabel,
  recentInventoryAlerts,
  type InventoryLocationBlock,
} from "./team-inventory";

const TODAY = "2026-10-08";

test("the published example keeps nulls and does not treat unreviewed as empty", () => {
  const mapped = mapTeamInventoryResponse(contractFixture);
  assert.equal(mapped.ok, true);
  if (!mapped.ok) return;
  assert.equal(mapped.report.locations.length, 2);
  const glendale = mapped.report.locations[0];
  const avondale = mapped.report.locations[1];
  assert.equal(glendale.location, "glendale");
  assert.equal(avondale.location, "avondale");
  assert.equal(glendale.items[0].itemId, avondale.items[0].itemId);
  assert.equal(glendale.items[0].quantityOnHand, 24);
  assert.equal(glendale.items[0].status, "low");
  assert.equal(avondale.items[0].quantityOnHand, null);
  assert.equal(avondale.items[0].unit, null);
  assert.equal(avondale.items[0].status, "unreviewed");
  assert.equal(avondale.items[0].lowStock, false);
  assert.equal(avondale.items[0].parLevel, null);
  assert.equal(avondale.items[0].minimumLevel, null);
  assert.equal(avondale.items[0].unitCost, null);
  assert.equal(avondale.summary.unreviewed, 1);
  assert.equal(quantityLabel(avondale.items[0].quantityOnHand, avondale.items[0].unit), "Sin contar");
});

test("pounds stay in base units, including values that must not be divided by 1000", () => {
  const mapped = mapTeamInventoryResponse(richFixture);
  assert.equal(mapped.ok, true);
  if (!mapped.ok) return;
  const glendale = mapped.report.locations.find((block) => block.location === "glendale");
  assert.ok(glendale);
  const asada = glendale.items.find((item) => item.itemId === "carne-asada");
  const rice = glendale.items.find((item) => item.itemId === "arroz");
  const limes = glendale.items.find((item) => item.itemId === "limones");
  assert.equal(asada?.quantityOnHand, 2.375);
  assert.equal(asada?.unit, "lb");
  assert.equal(rice?.quantityOnHand, 1500);
  assert.equal(limes?.quantityOnHand, 0);
  assert.equal(quantityLabel(2.375, "lb"), "2.375 lb");
  assert.equal(quantityLabel(1500, "lb"), "1500 lb");
  assert.equal(quantityLabel(0, "piece"), "0 pzas");
  assert.equal(quantityLabel(null, "lb"), "Sin contar");
  assert.equal(quantityLabel(3, null), "3 desconocido");
  assert.equal(asada?.neededDate, "2026-09-30");
  assert.deepEqual(neededDatePresentation("2026-09-30", TODAY), {
    label: "2026-09-30 vencido",
    overdue: true,
  });
  assert.deepEqual(neededDatePresentation("2026-10-09", TODAY), {
    label: "2026-10-09",
    overdue: false,
  });
  assert.deepEqual(neededDatePresentation(null, TODAY), { label: null, overdue: false });
  const overlap =
    glendale.summary.out +
    glendale.summary.low +
    glendale.summary.toBuy +
    glendale.summary.onTheWay +
    glendale.summary.unreviewed;
  assert.ok(overlap > glendale.items.length);
});

test("a fractional piece quantity is rejected and locations stay separate in filters", () => {
  const broken = structuredClone(contractFixture);
  broken.locations[0].items[0].quantityOnHand = 1.5;
  const mapped = mapTeamInventoryResponse(broken);
  assert.equal(mapped.ok, false);

  const rich = mapTeamInventoryResponse(richFixture);
  assert.equal(rich.ok, true);
  if (!rich.ok) return;
  const blocks = rich.report.locations.map((block): InventoryLocationBlock => ({
    locationId: block.location,
    hasSummary: true,
    summary: block.summary,
    generatedAt: rich.report.generatedAt,
    items: block.items.map((item) => ({
      itemId: item.itemId,
      name: item.name,
      nameEn: item.nameEn,
      category: item.category,
      unit: item.unit,
      unitLabel: item.unitLabel,
      supplier: item.supplier,
      quantityOnHand: item.quantityOnHand,
      quantityText: quantityLabel(item.quantityOnHand, item.unit),
      status: item.status,
      statusLabel: item.status,
      lowStock: item.lowStock,
      purchase: item.purchase,
      purchaseLabel: item.purchase ?? "—",
      deliveryStatus: item.deliveryStatus,
      deliveryLabel: item.deliveryStatus ?? "—",
      neededBy: item.neededBy,
      neededByLabel: null,
      neededDate: item.neededDate,
      neededLabel: neededDatePresentation(item.neededDate, TODAY).label,
      neededOverdue: neededDatePresentation(item.neededDate, TODAY).overdue,
      lastCountedAt: item.lastCountedAt,
      lastCountedBy: item.lastCountedBy,
      lastUpdatedAt: item.lastUpdatedAt,
      lastUpdatedBy: item.lastUpdatedBy,
    })),
  }));
  const visible = blocksForScope(blocks, "all");
  assert.equal(visible.length, 2);
  assert.deepEqual(
    visible.map((block) => [block.locationId, block.summary.out, block.summary.low]),
    [
      ["glendale", 1, 1],
      ["avondale", 0, 0],
    ],
  );
  const glendaleOnly = blocksForScope(blocks, "glendale");
  assert.equal(glendaleOnly.length, 1);
  assert.equal(glendaleOnly[0].items.some((item) => item.quantityOnHand == null), false);
  const low = filterInventoryItems(glendaleOnly[0].items, { chip: "low", category: null, search: "" });
  assert.deepEqual(low.map((item) => item.itemId), ["bistro-bags-13"]);
  assert.equal(low.some((item) => item.status === "out"), false);
  const search = filterInventoryItems(visible[1].items, { chip: null, category: null, search: "bistro" });
  assert.equal(search.length, 1);
  assert.equal(search[0].quantityText, "Sin contar");
  const overdue = glendaleOnly[0].items.find((item) => item.itemId === "carne-asada");
  assert.equal(overdue?.neededOverdue, true);
  assert.equal(overdue?.neededLabel, "2026-09-30 vencido");
  assert.deepEqual(inventoryActionAlert(visible[0].summary), {
    headline: "2 need action · 2 awaiting delivery",
    detail: "1 out of stock",
  });
  assert.deepEqual(inventoryActionAlert(visible[1].summary), {
    headline: "1 need action · 1 awaiting delivery",
    detail: "0 out of stock",
  });
  assert.equal(formatInventorySyncedAt("2026-10-08T03:41:00-07:00"), "Last synced: Oct 8 at 3:41 AM");
  assert.equal(categoryLabel("supplies"), "Containers & supplies");
  assert.equal(categoryLabel("protein"), "Proteins");
  assert.equal(categoryLabel("DRY"), "DRY");
  const supplies = filterInventoryItems(glendaleOnly[0].items, {
    chip: null,
    category: "Containers & supplies",
    search: "",
  });
  assert.deepEqual(supplies.map((item) => item.itemId), ["bistro-bags-13"]);
  const groups = groupInventoryByCategory(glendaleOnly[0].items);
  assert.deepEqual(
    groups.map((group) => [group.label, group.items.length, group.pending]),
    [
      ["Proteins", 1, 0],
      ["Produce", 1, 0],
      ["Containers & supplies", 1, 1],
      ["dry", 1, 1],
    ],
  );
  assert.equal(itemIsPending({ status: "sufficient", purchase: "needed" }), true);
  assert.equal(itemIsPending({ status: "low", purchase: "needed" }), true);
  assert.equal(itemIsPending({ status: "sufficient", purchase: "purchased" }), false);
  const alerts = recentInventoryAlerts(visible);
  assert.deepEqual(
    alerts.map((alert) => alert.line),
    [
      "13″ Bistro Bags · Running low — Glendale · Oct 8 at 9:05 AM",
      "Rice · Out of stock — Glendale · Oct 8 at 8:10 AM",
    ],
  );
  assert.equal(alerts.some((alert) => alert.key.startsWith("avondale|")), false);
});

test("the inventory client uses the shared key and does not put it in the URL", async () => {
  assert.equal(createTeamInventoryClient({}), null);

  let seenUrl = "";
  let seenAuthorization = "";
  const client = createTeamInventoryClient(
    {
      CHILAKIL_TEAM_API_URL: "https://team.example.com/",
      CHILAKIL_TEAM_API_KEY: "live-key",
      CHILAKIL_TEAM_API_TOKEN: "legacy-token",
    },
    async (url, init) => {
      seenUrl = String(url);
      seenAuthorization = new Headers(init?.headers).get("authorization") ?? "";
      return new Response(JSON.stringify({ secret: "nope" }), { status: 403 });
    },
  );
  assert.ok(client);
  await assert.rejects(
    () => client?.fetchInventory("all"),
    (error: unknown) => {
      assert.ok(error instanceof TeamInventoryApiError);
      assert.equal(error.status, 403);
      assert.equal(error.message, "Team inventory API returned 403");
      assert.equal(error.message.includes("nope"), false);
      return true;
    },
  );
  assert.equal(`${seenUrl}`, "https://team.example.com/api/v1/inventory?location=all");
  assert.equal(`${seenAuthorization}`, "Bearer live-key");
  assert.equal(seenUrl.includes("live-key"), false);
  assert.match(INVENTORY_FORBIDDEN_HINT, /Activa el permiso de inventario/);
});
