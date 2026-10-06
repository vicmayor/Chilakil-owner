import test from "node:test";
import assert from "node:assert/strict";
import { DOORDASH_PRICING_REPORTS } from "../data/doordash-pricing-reports";

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** Break-even rounded up to the next $X.49 or $X.99, matching the report method. */
function recommendedFromBreakEven(breakEven: number) {
  const cents = Math.round(breakEven * 100);
  const dollars = Math.floor(cents / 100);
  const rem = cents % 100;
  if (rem <= 49) return round2(dollars + 0.49);
  return round2(dollars + 0.99);
}

function report(locationId: "glendale" | "avondale") {
  const matches = DOORDASH_PRICING_REPORTS.filter((row) => row.locationId === locationId);
  assert.equal(matches.length, 1);
  return matches[0];
}

test("October 6 reports stay keyed to separate DoorDash stores", () => {
  const glendale = report("glendale");
  const avondale = report("avondale");
  assert.equal(glendale.reportDate, "2026-10-06");
  assert.equal(avondale.reportDate, "2026-10-06");
  assert.equal(glendale.doorDashStoreId, "32669627");
  assert.equal(avondale.doorDashStoreId, "27859030");
  assert.notEqual(glendale.doorDashStoreId, avondale.doorDashStoreId);
  assert.equal(
    new Set(DOORDASH_PRICING_REPORTS.map((row) => `${row.locationId}|${row.reportDate}|${row.doorDashStoreId}`))
      .size,
    DOORDASH_PRICING_REPORTS.length,
  );
});

test("menu math matches the 30% keep, break-even, and $X.49/$X.99 rules", () => {
  for (const row of DOORDASH_PRICING_REPORTS) {
    assert.equal(row.commissionRate, 0.3);
    for (const line of row.lines) {
      if (!line.onDoorDash || line.doorDashPrice === null) {
        assert.equal(line.status, "not_on_menu");
        assert.equal(line.doorDashPrice, null);
        assert.equal(line.keepNow, null);
        assert.equal(line.recommendedPrice, null);
        continue;
      }
      const keepNow = round2(line.doorDashPrice * 0.7);
      const vsInStore = round2(keepNow - line.inStorePrice);
      const breakEven = round2(line.inStorePrice / 0.7);
      const recommended = recommendedFromBreakEven(breakEven);
      const change = round2(recommended - line.doorDashPrice);
      const keepRecommended = round2(recommended * 0.7);
      const markup = Math.round((line.doorDashPrice / line.inStorePrice - 1) * 100);
      assert.equal(line.keepNow, keepNow, line.name);
      assert.equal(line.vsInStore, vsInStore, line.name);
      assert.equal(line.breakEvenPrice, breakEven, line.name);
      assert.equal(line.recommendedPrice, recommended, line.name);
      assert.equal(line.changeNeeded, change, line.name);
      assert.equal(line.keepRecommended, keepRecommended, line.name);
      assert.equal(line.markupPct, markup, line.name);
      assert.ok(line.keepRecommended !== null && line.keepRecommended + 0.001 >= line.inStorePrice, line.name);
    }
  }
});

test("Glendale PDF anchors: 9 losing, OG burrito needs review, store counts", () => {
  const glendale = report("glendale");
  const items = glendale.lines.filter((line) => line.kind === "item");
  assert.equal(items.length, 10);
  assert.equal(items.filter((line) => line.status === "losing").length, 9);
  assert.equal(items.filter((line) => line.status === "review").length, 1);
  assert.equal(items.filter((line) => line.status === "ok").length, 0);
  assert.match(glendale.headline, /9 of 10/);
  assert.match(glendale.headline, /1 needs review/);

  const byName = Object.fromEntries(items.map((line) => [line.name, line]));
  assert.equal(byName.Chilaquiles.inStorePrice, 12);
  assert.equal(byName.Chilaquiles.doorDashPrice, 15);
  assert.equal(byName.Chilaquiles.squareSold30d, 547);
  assert.equal(byName["Chilakil Burrito"].inStorePrice, 12);
  assert.equal(byName["Chilakil Burrito"].doorDashPrice, 12);
  assert.equal(byName["Chilakil Burrito"].vsInStore, -3.6);
  assert.equal(byName.Churro.inStorePrice, 2.5);
  assert.equal(byName.Churro.doorDashPrice, 2.5);
  assert.equal(byName["Chialkil Concha"].inStorePrice, 10);
  assert.equal(byName["Chialkil Concha"].doorDashPrice, 12);

  const og = byName["OG Breakfast Burrito"];
  assert.equal(og.status, "review");
  assert.equal(og.inStorePrice, 11);
  assert.equal(og.doorDashPrice, 14.99);
  assert.equal(og.breakEvenPrice, 15.71);
  assert.equal(og.recommendedPrice, 15.99);
  assert.equal(og.squareSold30d, 47);
  assert.match(og.footnote ?? "", /\$21\.41/);
  assert.match(og.footnote ?? "", /\$21\.49/);

  const trio = glendale.lines.find((line) => line.name.startsWith("Trio Meat"));
  assert.ok(trio);
  assert.equal(trio.onDoorDash, false);
  assert.equal(trio.inStorePrice, 4);
  assert.match(glendale.addonNote ?? "", /NEEDS REVIEW/);
  assert.match(glendale.commissionNote, /29\.4%/);
  assert.match(glendale.commissionNote, /6%/);
  assert.match(glendale.exclusionNote, /food cost/i);
  assert.match(glendale.exclusionNote, /Card fees and tax/);
  assert.match(glendale.popularityLead, /547/);
  assert.equal(glendale.pdfPath, "/reports/glendale-doordash-pricing-2026-10-06.pdf");
  assert.equal(items.some((line) => line.name === "Soda"), false);
});

test("Avondale PDF anchors: all 5 items losing, Torta $0.00 check, separate counts", () => {
  const avondale = report("avondale");
  const items = avondale.lines.filter((line) => line.kind === "item");
  assert.equal(items.length, 5);
  assert.equal(items.filter((line) => line.status === "losing").length, 5);
  assert.equal(items.filter((line) => line.status === "review").length, 0);
  assert.match(avondale.headline, /5 of 5/);

  const byName = Object.fromEntries(items.map((line) => [line.name, line]));
  assert.equal(byName.Chilaquiles.squareSold30d, 1270);
  assert.equal(byName.Soda.inStorePrice, 2);
  assert.equal(byName.Soda.doorDashPrice, 2);
  assert.equal(byName.Soda.squareSold30d, 211);
  assert.equal(byName["Chilakil Burrito"].squareSold30d, 59);
  assert.equal(byName["Keto Chilaquiles"].squareSold30d, 7);

  const torta = byName["Chilakil Torta"];
  assert.equal(torta.status, "losing");
  assert.equal(torta.inStorePrice, 9);
  assert.equal(torta.doorDashPrice, 10);
  assert.match(torta.footnote ?? "", /\$0\.00/);
  assert.match(torta.footnote ?? "", /\$9/);
  assert.match(avondale.notes.map((note) => note.body).join(" "), /\$0\.00/);

  assert.match(avondale.commissionNote, /not been verified/);
  assert.match(avondale.commissionNote, /30%/);
  assert.match(avondale.commissionNote, /29\.4%/);
  assert.match(avondale.exclusionNote, /Card fees and tax/);
  assert.match(avondale.popularityLead, /1,270/);
  assert.equal(avondale.pdfPath, "/reports/avondale-doordash-pricing-2026-10-06.pdf");

  const names = new Set(avondale.lines.map((line) => line.name));
  assert.equal(names.has("Churro"), false);
  assert.equal(names.has("Chialkil Concha"), false);
  assert.equal(names.has("OG Breakfast Burrito"), false);
  const shrimpTrio = avondale.lines.find((line) => line.name.startsWith("Shrimp; Trio"));
  assert.ok(shrimpTrio);
  assert.equal(shrimpTrio.doorDashPrice, 4);
  assert.equal(shrimpTrio.recommendedPrice, 5.99);
});
