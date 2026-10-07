import test from "node:test";
import assert from "node:assert/strict";
import {
  buildEmployeeHoursView,
  dateHours,
  unpaidBreakNote,
  type EmployeeHoursRow,
  type EmployeeHoursSegment,
  type SquareSalesDay,
} from "./employee-hours";

const period = { periodStart: "2026-10-04", periodEnd: "2026-10-10" };

function segment(partial: Partial<EmployeeHoursSegment> & Pick<EmployeeHoursSegment, "shiftId" | "date" | "hours">): EmployeeHoursSegment {
  return {
    clockIn: "08:00",
    clockOut: "14:00",
    hourlyRate: 10,
    unpaidBreakMinutes: 0,
    breakTimesRecorded: true,
    open: false,
    breaks: [],
    ...partial,
  };
}

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
    appliedHourlyRates: [10],
    segments: [],
    openShifts: [],
  };
}

test("a single location hides the other store", () => {
  const view = buildEmployeeHoursView(
    [
      hoursRow("glendale", "Ana", 8, "pending", 80, "emp_ana"),
      hoursRow("avondale", "Ana", 40, "pending", 400, "emp_ana"),
    ],
    [],
    "glendale",
  );
  assert.equal(view.periods.length, 1);
  assert.equal(view.periods[0].status, "pending");
  assert.equal(view.periods[0].statusCoversBothLocations, true);
  assert.equal(view.periods[0].locations.length, 1);
  assert.equal(view.periods[0].locations[0].locationId, "glendale");
  assert.equal(view.periods[0].locations[0].hours, 8);
  assert.equal(view.periods[0].locations[0].grossPayEstimate, 80);
  assert.equal(view.periods[0].locations[0].employees[0].employeeId, "emp_ana");
});

test("period status stays pending when the other location is pending", () => {
  const view = buildEmployeeHoursView(
    [
      hoursRow("glendale", "Ana", 8, "approved", 80, "emp_ana"),
      hoursRow("avondale", "Luis", 2, "pending", 20, "emp_luis"),
    ],
    [],
    "glendale",
  );
  assert.equal(view.periods[0].status, "pending");
  assert.equal(view.periods[0].statusCoversBothLocations, true);
  assert.equal(view.periods[0].locations.length, 1);
  assert.equal(view.periods[0].locations[0].locationId, "glendale");
  assert.equal(view.periods[0].locations[0].hours, 8);
});

test("ALL keeps labeled per-location blocks and does not combine them", () => {
  const view = buildEmployeeHoursView(
    [
      hoursRow("glendale", "Ana", 8, "approved", 80, "emp_ana"),
      hoursRow("avondale", "Ana", 4, "approved", 40, "emp_ana"),
      hoursRow("glendale", "Luis", 2, "approved", 20, "emp_luis"),
    ],
    [],
    "all",
  );
  assert.equal(view.periods.length, 1);
  assert.equal(view.periods[0].status, "approved");
  assert.deepEqual(
    view.periods[0].locations.map((block) => [block.locationId, block.hours, block.grossPayEstimate]),
    [
      ["glendale", 10, 100],
      ["avondale", 4, 40],
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
    [hoursRow("glendale", "Ana", 3, "pending", 30), hoursRow("avondale", "Ana", 2, "pending", 40)],
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
  assert.equal(view.periods[0].status, "pending");
});

test("labor percent is empty when that location has no Square sales", () => {
  const view = buildEmployeeHoursView([hoursRow("glendale", "Ana", 8, "approved", 80)], [], "glendale");
  assert.equal(view.periods[0].locations[0].laborPct, null);
  assert.equal(view.periods[0].locations[0].squareSales, 0);
  assert.equal(view.periods[0].status, "approved");
});

test("same-day segments sum and an open shift is listed without adding hours", () => {
  const row = hoursRow("glendale", "Ana", 5.616667, "pending", 95.48, "emp_ana");
  row.hourlyRate = 20;
  row.appliedHourlyRates = [17, 18];
  row.segments = [
    segment({ shiftId: "turno-manana", date: "2026-10-07", hours: 3, unpaidBreakMinutes: 15, breakTimesRecorded: false }),
    segment({ shiftId: "turno-tarde", date: "2026-10-07", hours: 2.616667, unpaidBreakMinutes: 15, breakTimesRecorded: false }),
    segment({
      shiftId: "turno-abierto",
      date: "2026-10-08",
      hours: 0,
      clockOut: null,
      open: true,
      breakTimesRecorded: false,
    }),
  ];
  row.openShifts = [{ shiftId: "turno-abierto", clockIn: "2026-10-03T22:10:00-07:00" }];
  const view = buildEmployeeHoursView([row], [], "glendale");
  const employee = view.periods[0].locations[0].employees[0];
  assert.equal(view.periods[0].locations[0].hours, 5.616667);
  assert.equal(employee.hours, 5.616667);
  assert.equal(employee.grossPayEstimate, 95.48);
  assert.notEqual(employee.grossPayEstimate, 20 * 5.616667);
  assert.deepEqual(employee.appliedHourlyRates, [17, 18]);
  assert.deepEqual(dateHours(employee.segments), [{ date: "2026-10-07", hours: 5.616667 }]);
  assert.equal(employee.openShifts[0].shiftId, "turno-abierto");
  const note = unpaidBreakNote(employee.segments[0]);
  assert.match(note ?? "", /already deducted/);
  assert.match(note ?? "", /not recorded/);
  assert.doesNotMatch(note ?? "", /no break/i);
});
