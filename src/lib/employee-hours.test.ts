import test from "node:test";
import assert from "node:assert/strict";
import { csvToRecords } from "./csv";
import { buildEmployeeHoursView, type EmployeeHoursRow, type SquareSalesDay } from "./employee-hours";
import { EMPLOYEE_HOURS_NUMERIC_COLUMNS, parseEmployeeHoursBody } from "./ingest";

const row = {
  location: "glendale",
  periodStart: "2026-09-22",
  periodEnd: "2026-10-05",
  employeeName: "Maria Lopez",
  hours: 72.5,
  hourlyRate: 18,
  basePay: 1305,
  status: "pending",
  source: "team-chilakiltogo-pay-periods",
};

test("employee hours accepts one record and uppercase location names", () => {
  const parsed = parseEmployeeHoursBody({ ...row, location: "GLENDALE", status: "Pending Review" });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.records[0].locationId, "glendale");
  assert.equal(parsed.records[0].status, "pending");
  assert.equal(parsed.records[0].hours, 72.5);
  assert.equal(parsed.records[0].basePay, 1305);
});

test("the same employee may have a row in each location", () => {
  const parsed = parseEmployeeHoursBody({
    records: [row, { ...row, location: "AVONDALE", hours: 28, basePay: 504, status: "approved" }],
  });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.deepEqual(
    parsed.records.map((record) => [record.locationId, record.employeeName, record.status]),
    [
      ["glendale", "Maria Lopez", "pending"],
      ["avondale", "Maria Lopez", "approved"],
    ],
  );
});

test("employee hours rejects sample source, negatives, duplicates, and a reversed period", () => {
  const sample = parseEmployeeHoursBody({ ...row, source: "Sample" });
  assert.equal(sample.ok, false);

  const negative = parseEmployeeHoursBody({ ...row, hours: -1, hourlyRate: -2, basePay: -3 });
  assert.equal(negative.ok, false);
  if (!negative.ok) {
    assert.match(negative.issues.join(" "), /hours/);
    assert.match(negative.issues.join(" "), /hourlyRate/);
    assert.match(negative.issues.join(" "), /basePay/);
  }

  const duplicate = parseEmployeeHoursBody([row, { ...row, hours: 10, basePay: 180 }]);
  assert.equal(duplicate.ok, false);
  if (!duplicate.ok) assert.match(duplicate.error, /Duplicate/);

  const reversed = parseEmployeeHoursBody({ ...row, periodStart: "2026-10-05", periodEnd: "2026-09-22" });
  assert.equal(reversed.ok, false);
  if (!reversed.ok) assert.match(reversed.issues.join(" "), /periodEnd/);

  const unknown = parseEmployeeHoursBody({ ...row, location: "phoenix" });
  assert.equal(unknown.ok, false);
});

test("employee hours rounds decimals and trims the employee name", () => {
  const parsed = parseEmployeeHoursBody({
    ...row,
    employeeName: "  Maria Lopez  ",
    hours: 72.555,
    hourlyRate: 18.004,
    basePay: 1305.001,
  });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.records[0].employeeName, "Maria Lopez");
  assert.equal(parsed.records[0].hours, 72.56);
  assert.equal(parsed.records[0].hourlyRate, 18);
  assert.equal(parsed.records[0].basePay, 1305);
});

test("CSV employee hours becomes the same records as JSON", () => {
  const csv = [
    "location,periodStart,periodEnd,employeeName,hours,hourlyRate,basePay,status,source",
    "glendale,2026-09-22,2026-10-05,Maria Lopez,72.5,18,1305,pending,team-chilakiltogo-pay-periods",
    "avondale,2026-09-22,2026-10-05,Maria Lopez,28,18,504,approved,team-chilakiltogo-pay-periods",
  ].join("\n");
  const parsed = parseEmployeeHoursBody(csvToRecords(csv, EMPLOYEE_HOURS_NUMERIC_COLUMNS));
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.deepEqual(
    parsed.records.map((record) => [record.locationId, record.hours, record.status]),
    [
      ["glendale", 72.5, "pending"],
      ["avondale", 28, "approved"],
    ],
  );
});

const period = { periodStart: "2026-10-01", periodEnd: "2026-10-03" };

function hoursRow(
  locationId: "glendale" | "avondale",
  employeeName: string,
  hours: number,
  status: "pending" | "approved",
  basePay = hours * 10,
): EmployeeHoursRow {
  return {
    locationId,
    ...period,
    employeeName,
    hours,
    hourlyRate: 10,
    basePay,
    status,
  };
}

test("a single location hides the other store", () => {
  const view = buildEmployeeHoursView(
    [hoursRow("glendale", "Ana", 8, "pending", 80), hoursRow("avondale", "Ana", 40, "approved", 400)],
    [],
    "glendale",
  );
  assert.equal(view.periods.length, 1);
  assert.equal(view.periods[0].locations.length, 1);
  assert.equal(view.periods[0].locations[0].locationId, "glendale");
  assert.equal(view.periods[0].locations[0].hours, 8);
  assert.equal(view.periods[0].locations[0].basePay, 80);
  assert.equal(view.periods[0].locations[0].review, "pending");
});

test("ALL keeps labeled per-location blocks and does not combine them", () => {
  const view = buildEmployeeHoursView(
    [
      hoursRow("glendale", "Ana", 8, "approved", 80),
      hoursRow("avondale", "Ana", 4, "pending", 40),
      hoursRow("glendale", "Luis", 2, "approved", 20),
    ],
    [],
    "all",
  );
  assert.equal(view.periods.length, 1);
  assert.deepEqual(
    view.periods[0].locations.map((block) => [block.locationId, block.hours, block.basePay, block.review]),
    [
      ["glendale", 10, 100, "approved"],
      ["avondale", 4, 40, "pending"],
    ],
  );
  assert.deepEqual(
    view.periods[0].locations[0].employees.map((employee) => employee.employeeName),
    ["Ana", "Luis"],
  );
  assert.equal("combined" in view.periods[0], false);
});

test("labor percent uses only that location's Square sales inside the pay period", () => {
  const sales: SquareSalesDay[] = [
    { locationId: "glendale", date: "2026-10-01", grossSales: 100 },
    { locationId: "glendale", date: "2026-10-03", grossSales: 50 },
    { locationId: "glendale", date: "2026-09-30", grossSales: 999 },
    { locationId: "avondale", date: "2026-10-01", grossSales: 10_000 },
    { locationId: "avondale", date: "2026-10-02", grossSales: 200 },
  ];
  const view = buildEmployeeHoursView(
    [hoursRow("glendale", "Ana", 3, "pending", 30), hoursRow("avondale", "Ana", 2, "approved", 40)],
    sales,
    "all",
  );
  const glendale = view.periods[0].locations[0];
  const avondale = view.periods[0].locations[1];
  assert.equal(glendale.squareSales, 150);
  assert.equal(glendale.salesDaysOnFile, 2);
  assert.equal(glendale.periodDays, 3);
  assert.equal(glendale.laborPct, 0.2);
  assert.equal(avondale.squareSales, 10200);
  assert.equal(avondale.laborPct, 40 / 10200);
  assert.equal(avondale.review, "approved");
});

test("labor percent is empty when that location has no Square sales", () => {
  const view = buildEmployeeHoursView([hoursRow("glendale", "Ana", 8, "approved", 80)], [], "glendale");
  assert.equal(view.periods[0].locations[0].laborPct, null);
  assert.equal(view.periods[0].locations[0].squareSales, 0);
  assert.equal(view.periods[0].locations[0].review, "approved");
});

test("mixed approval stays pending review without blending locations", () => {
  const view = buildEmployeeHoursView(
    [hoursRow("glendale", "Ana", 8, "pending", 80), hoursRow("glendale", "Luis", 2, "approved", 20)],
    [{ locationId: "glendale", date: "2026-10-02", grossSales: 200 }],
    "all",
  );
  const block = view.periods[0].locations[0];
  assert.equal(block.review, "mixed");
  assert.equal(block.pendingCount, 1);
  assert.equal(block.approvedCount, 1);
  assert.equal(view.periods[0].locations.length, 1);
  assert.equal(block.laborPct, 0.5);
});
