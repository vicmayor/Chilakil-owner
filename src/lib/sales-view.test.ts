import test from "node:test";
import assert from "node:assert/strict";
import { buildSalesView, grossChange, type SalesRecord } from "./sales-view";

function row(partial: Pick<SalesRecord, "locationId" | "date" | "grossSales"> & Partial<SalesRecord>): SalesRecord {
  return {
    netSales: partial.grossSales * 0.8,
    discounts: 0,
    refunds: 0,
    tips: 0,
    tax: null,
    orderCount: 10,
    averageTicket: partial.grossSales / 10,
    inStoreGross: null,
    inStoreOrders: null,
    doorDashGross: null,
    doorDashOrders: null,
    uberEatsGross: null,
    uberEatsOrders: null,
    grubhubGross: null,
    grubhubOrders: null,
    newCustomers: null,
    returningCustomers: null,
    identifiedCustomers: null,
    source: "square-export",
    importedAt: "2026-10-06T18:00:00.000Z",
    ...partial,
  };
}

test("a single location view never includes the other store", () => {
  const view = buildSalesView(
    [
      row({ locationId: "glendale", date: "2026-10-06", grossSales: 500 }),
      row({ locationId: "avondale", date: "2026-10-06", grossSales: 200 }),
    ],
    ["glendale"],
    "2026-10-06",
  );
  assert.deepEqual(view.scopeIds, ["glendale"]);
  assert.equal(view.featured[0]?.grossSales, 500);
  assert.equal(view.featured.length, 1);
  assert.equal(view.weekToDate.combined, null);
  assert.equal(view.weekToDate.byLocation[0].gross, 500);
});

test("ALL keeps labeled location totals and a combined week total", () => {
  const view = buildSalesView(
    [
      row({ locationId: "glendale", date: "2026-10-06", grossSales: 500 }),
      row({ locationId: "avondale", date: "2026-10-06", grossSales: 200 }),
      row({ locationId: "glendale", date: "2026-10-05", grossSales: 100 }),
      row({ locationId: "avondale", date: "2026-09-30", grossSales: 50 }),
    ],
    ["glendale", "avondale"],
    "2026-10-06",
  );
  assert.equal(view.featuredIsToday, true);
  assert.equal(view.featured[0]?.grossSales, 500);
  assert.equal(view.featured[1]?.grossSales, 200);
  assert.equal(view.yesterday[0]?.grossSales, 100);
  assert.equal(view.yesterday[1], null);
  assert.equal(view.weekToDate.combined?.gross, 800);
  assert.match(view.weekToDate.combined?.label ?? "", /Glendale \+ Avondale/);
  assert.equal(view.lastWeek.byLocation[1].gross, 50);
  assert.equal(view.last7.length, 7);
});

test("featured day falls back to the latest imported day", () => {
  const view = buildSalesView(
    [row({ locationId: "avondale", date: "2026-10-04", grossSales: 80, source: "sample" })],
    ["avondale"],
    "2026-10-06",
  );
  assert.equal(view.featuredIsToday, false);
  assert.equal(view.featuredDate, "2026-10-04");
  assert.equal(view.sampleOnFeatured, true);
  assert.equal(view.anySample, true);
});

test("new customers stay on their location and ALL sums only complete counts", () => {
  const view = buildSalesView(
    [
      row({
        locationId: "glendale",
        date: "2026-10-06",
        grossSales: 500,
        newCustomers: 8,
        returningCustomers: 40,
      }),
      row({
        locationId: "avondale",
        date: "2026-10-06",
        grossSales: 200,
        newCustomers: 3,
      }),
      row({
        locationId: "glendale",
        date: "2026-10-05",
        grossSales: 100,
        newCustomers: 2,
      }),
      row({ locationId: "avondale", date: "2026-10-04", grossSales: 40 }),
    ],
    ["glendale", "avondale"],
    "2026-10-06",
  );
  assert.equal(view.featured[0]?.newCustomers, 8);
  assert.equal(view.featured[1]?.newCustomers, 3);
  assert.equal(view.featured[0]?.returningCustomers, 40);
  assert.equal(view.featured[1]?.returningCustomers, null);
  assert.equal(view.yesterday[0]?.newCustomers, 2);
  assert.equal(view.yesterday[1], null);
  assert.equal(view.weekToDate.byLocation[0].newCustomers, 10);
  assert.equal(view.weekToDate.byLocation[1].newCustomers, 3);
  assert.equal(view.weekToDate.combined?.newCustomers, 13);
  assert.equal(view.weekToDate.byLocation[0].returningCustomers, 40);
  assert.equal(view.weekToDate.byLocation[1].returningCustomers, null);
  assert.equal(view.weekToDate.combined?.returningCustomers, null);
  assert.equal(view.last7.find((day) => day.date === "2026-10-04")?.newCustomersByLocation[0], null);
  assert.equal(view.last7.find((day) => day.date === "2026-10-04")?.newCustomersByLocation[1], null);

  const glendale = buildSalesView(
    [
      row({ locationId: "glendale", date: "2026-10-06", grossSales: 500, newCustomers: 8 }),
      row({ locationId: "avondale", date: "2026-10-06", grossSales: 200, newCustomers: 99 }),
    ],
    ["glendale"],
    "2026-10-06",
  );
  assert.equal(glendale.featured.length, 1);
  assert.equal(glendale.featured[0]?.newCustomers, 8);
  assert.equal(glendale.weekToDate.combined, null);
  assert.equal(glendale.weekToDate.byLocation[0].newCustomers, 8);
});

test("a reported zero stays zero and a missing count stays empty", () => {
  const view = buildSalesView(
    [
      row({ locationId: "glendale", date: "2026-10-06", grossSales: 10, newCustomers: 0 }),
      row({ locationId: "avondale", date: "2026-10-06", grossSales: 10 }),
    ],
    ["glendale", "avondale"],
    "2026-10-06",
  );
  assert.equal(view.featured[0]?.newCustomers, 0);
  assert.equal(view.featured[1]?.newCustomers, null);
  assert.equal(view.weekToDate.combined?.newCustomers, null);
});

test("week-over-week change is null when last week is empty", () => {
  assert.equal(grossChange(100, 0), null);
  assert.equal(grossChange(150, 100), 0.5);
});
