import test from "node:test";
import assert from "node:assert/strict";
import {
  BUSINESS_WIDE_LABEL,
  COMBINED_LABEL,
  isCombinedScope,
  locationIdsForScope,
  parseLocationScope,
} from "./location";

test("ALL returns both location ids and does not collapse them", () => {
  assert.deepEqual(locationIdsForScope("all"), ["glendale", "avondale"]);
  assert.equal(isCombinedScope("all"), true);
});

test("single location scope never includes the other store", () => {
  assert.deepEqual(locationIdsForScope("glendale"), ["glendale"]);
  assert.deepEqual(locationIdsForScope("avondale"), ["avondale"]);
  assert.equal(isCombinedScope("glendale"), false);
});

test("unknown cookie values default to ALL rather than a silent merge of one id", () => {
  assert.equal(parseLocationScope("both"), "all");
  assert.equal(parseLocationScope(undefined), "all");
  assert.equal(parseLocationScope("glendale"), "glendale");
});

test("combined totals keep an explicit label", () => {
  assert.match(COMBINED_LABEL, /Glendale/i);
  assert.match(COMBINED_LABEL, /Avondale/i);
});

test("business-wide is a distinct label, not a store name", () => {
  assert.equal(BUSINESS_WIDE_LABEL, "Business-wide");
  assert.notEqual(BUSINESS_WIDE_LABEL, COMBINED_LABEL);
});
