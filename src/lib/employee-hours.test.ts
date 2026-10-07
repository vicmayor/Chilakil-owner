import test from "node:test";
import assert from "node:assert/strict";
import { buildEmployeeHoursView, type EmployeeHoursRow, type SquareSalesDay } from "./employee-hours";

const period = { periodStart: "2026-10-04", periodEnd: "2026-10-10" };

function hoursRow(
  locationId: "glendale" | "avondale",
  employeeName: string,
  hours: number,
  status: "pending" | "approved",
  grossPayEstimate = hours * 10,
  employeeId = `${locationId}-${employeeName}`,
): EmployeeHoursRow {
  return {
    locationId,
    ...period,
    employeeId,
    employeeName,
    totalHours: hours,
    hourlyRate: 10,
    grossPayEstimate,
    status,
    days: [],
  };
}

test("a single location hides the other store", () => {
  const view = buildEmployeeHoursView(
    [
      hoursRow("glendale", "Ana", 8, "pending", 80, "emp_ana"),
      hoursRow("avondale", "Ana", 40, "approved", 400, "emp_ana"),
    ],
    [],
    "glendale",
  );
  assert.equal(view.periods.length, 1);
  assert.equal(view.periods[0].locations.length, 1);
  assert.equal(view.periods[0].locations[0].locationId, "glendale");
  assert.equal(view.periods[0].locations[0].hours, 8);
  assert.equal(view.periods[0].locations[0].grossPayEstimate, 80);
  assert.equal(view.periods[0].locations[0].employees[0].employeeId, "emp_ana");
  assert.equal(view.periods[0].locations[0].review, "pending");
});

test("ALL keeps labeled per-location blocks and does not combine them", () => {
  const view = buildEmployeeHoursView(
    [
      hoursRow("glendale", "Ana", 8, "approved", 80, "emp_ana"),
      hoursRow("avondale", "Ana", 4, "pending", 40, "emp_ana"),
      hoursRow("glendale", "Luis", 2, "approved", 20, "emp_luis"),
    ],
    [],
    "all",
  );
  assert.equal(view.periods.length, 1);
  assert.deepEqual(
    view.periods[0].locations.map((block) => [block.locationId, block.hours, block.grossPayEstimate, block.review]),
    [
      ["glendale", 10, 100, "approved"],
      ["avondale", 4, 40, "pending"],
    ],
  );
  assert.deepEqual(
    view.periods[0].locations[0].employees.map((employee) => employee.employeeName),
    ["Ana", "Luis"],
  );
  assert.deepEqual(
    view.periods[0].locations.map((block) => block.employees.map((employee) => employee.employeeId)),
    [["emp_ana", "emp_luis"], ["emp_ana"]],
  );
  assert.equal("combined" in view.periods[0], false);
});

test("labor percent uses only that location's Square sales inside the pay period", () => {
  const sales: SquareSalesDay[] = [
    { locationId: "glendale", date: "2026-10-04", grossSales: 100 },
    { locationId: "glendale", date: "2026-10-06", grossSales: 50 },
    { locationId: "glendale", date: "2026-10-03", grossSales: 999 },
    { locationId: "avondale", date: "2026-10-04", grossSales: 10_000 },
    { locationId: "avondale", date: "2026-10-05", grossSales: 200 },
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
  assert.equal(glendale.periodDays, 7);
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
    [{ locationId: "glendale", date: "2026-10-05", grossSales: 200 }],
    "all",
  );
  const block = view.periods[0].locations[0];
  assert.equal(block.review, "mixed");
  assert.equal(block.pendingCount, 1);
  assert.equal(block.approvedCount, 1);
  assert.equal(view.periods[0].locations.length, 1);
  assert.equal(block.laborPct, 0.5);
});
