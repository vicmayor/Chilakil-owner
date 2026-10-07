import test from "node:test";
import assert from "node:assert/strict";
import fixture from "./fixtures/team-hours-period.json";
import isoFixture from "./fixtures/team-hours-iso.json";
import contractFixture from "./fixtures/team-hours-contract.json";
import { phoenixSunday } from "./dates";
import { createTeamHoursClient } from "./team-hours-client";
import { mapTeamHoursResponse } from "./team-hours-mapper";
import { recentPayPeriodStarts } from "./team-hours-sync";

test("fixture maps Sunday–Saturday hours keyed by employee id and location", () => {
  const mapped = mapTeamHoursResponse(fixture);
  assert.equal(mapped.ok, true);
  if (!mapped.ok) return;
  assert.equal(mapped.period.periodStart, "2026-09-27");
  assert.equal(mapped.period.periodEnd, "2026-10-03");
  assert.equal(mapped.period.timezone, "America/Phoenix");
  assert.equal(mapped.period.employees.length, 3);

  const glendaleMaria = mapped.period.employees.find(
    (employee) => employee.employeeId === "emp_maria" && employee.locationId === "glendale",
  );
  const avondaleMaria = mapped.period.employees.find(
    (employee) => employee.employeeId === "emp_maria" && employee.locationId === "avondale",
  );
  assert.ok(glendaleMaria);
  assert.ok(avondaleMaria);
  assert.equal(glendaleMaria?.status, "pending");
  assert.equal(glendaleMaria?.totalHours, 12.5);
  assert.equal(glendaleMaria?.grossPayEstimate, 225);
  assert.equal(glendaleMaria?.segments[0].breaks[0].start, "12:00");
  assert.equal(glendaleMaria?.segments[0].breaks[0].end, "12:30");
  assert.equal(glendaleMaria?.segments[1].clockOut, null);
  assert.equal(glendaleMaria?.segments[1].open, false);
  assert.equal(avondaleMaria?.status, "approved");
  assert.equal(avondaleMaria?.segments[0].breaks.length, 2);
  assert.equal(avondaleMaria?.totalHours, 6);
});

test("fixture maps ISO timestamps with an offset and still stores them as sent", () => {
  const mapped = mapTeamHoursResponse(isoFixture);
  assert.equal(mapped.ok, true);
  if (!mapped.ok) return;

  const maria = mapped.period.employees.find((employee) => employee.employeeId === "emp_maria");
  assert.equal(maria?.segments[0].clockIn, "2026-10-04T07:58:00-07:00");
  assert.equal(maria?.segments[0].clockOut, "2026-10-04T16:05:00-07:00");
  assert.equal(maria?.segments[0].breaks[0].start, "2026-10-04T12:00:00-07:00");
  assert.equal(maria?.segments[0].breaks[0].end, "2026-10-04T12:30:00-07:00");

  const luis = mapped.period.employees.find((employee) => employee.employeeId === "emp_luis");
  assert.equal(luis?.segments[0].clockIn, "2026-10-05T11:00:00.000-07:00");
  assert.equal(luis?.segments[0].clockOut, "2026-10-05T15:00:00Z");

  const missingOffset = mapTeamHoursResponse({
    ...isoFixture,
    employees: [
      {
        ...isoFixture.employees[0],
        days: [{ ...isoFixture.employees[0].days[0], clockIn: "2026-10-04T07:58:00" }],
      },
    ],
  });
  assert.equal(missingOffset.ok, false);
  if (!missingOffset.ok) assert.match(missingOffset.error, /HH:MM or an ISO timestamp/);
});

test("contract sample keeps Team pay, unpaid minutes, and an unrecorded break", () => {
  const mapped = mapTeamHoursResponse(contractFixture);
  assert.equal(mapped.ok, true);
  if (!mapped.ok) return;
  const employee = mapped.period.employees[0];
  assert.equal(employee.employeeId, "empleado-ejemplo");
  assert.equal(employee.locationId, "glendale");
  assert.equal(employee.hourlyRate, 17);
  assert.equal(employee.totalHours, 5.5);
  assert.equal(employee.grossPayEstimate, 93.5);
  assert.notEqual(employee.grossPayEstimate, employee.hourlyRate * 6);
  assert.deepEqual(employee.appliedHourlyRates, [17]);
  assert.equal(employee.openShifts.length, 0);
  const segment = employee.segments[0];
  assert.equal(segment.shiftId, "turno-ejemplo");
  assert.equal(segment.hours, 5.5);
  assert.equal(segment.unpaidBreakMinutes, 30);
  assert.equal(segment.breakTimesRecorded, false);
  assert.equal(segment.breaks.length, 0);
  assert.equal(segment.open, false);
  assert.equal(segment.clockIn, "2026-10-07T08:00:00-07:00");
});

test("several segments on one date sum by shift id and an open shift is not counted", () => {
  const base = contractFixture.employees[0];
  const mapped = mapTeamHoursResponse({
    ...contractFixture,
    employees: [
      {
        ...base,
        hourlyRate: 20,
        totalHours: 5.616667,
        grossPayEstimate: 95.48,
        appliedHourlyRates: [17, 18],
        openShifts: [{ id: "turno-abierto", clockIn: "2026-10-03T22:10:00-07:00" }],
        days: [
          {
            ...base.days[0],
            shiftId: "turno-manana",
            hours: 3,
            unpaidBreakMinutes: 15,
            breakTimesRecorded: false,
            breaks: [],
            hourlyRate: 17,
          },
          {
            ...base.days[0],
            shiftId: "turno-tarde",
            clockIn: "2026-10-07T15:00:00-07:00",
            clockOut: "2026-10-07T18:00:00-07:00",
            hours: 2.616667,
            unpaidBreakMinutes: 15,
            breakTimesRecorded: false,
            breaks: [],
            hourlyRate: 18,
          },
          {
            date: "2026-10-08",
            shiftId: "turno-abierto",
            clockIn: "2026-10-08T09:00:00-07:00",
            clockOut: null,
            breaks: [],
            unpaidBreakMinutes: 0,
            breakTimesRecorded: false,
            hourlyRate: 20,
            hours: 0,
          },
          {
            date: "2026-10-04",
            shiftId: "turno-noche",
            clockIn: "2026-10-04T22:00:00-07:00",
            clockOut: "2026-10-04T23:59:00-07:00",
            breaks: [],
            unpaidBreakMinutes: 0,
            breakTimesRecorded: true,
            hourlyRate: 17,
            hours: 1.983333,
          },
          {
            date: "2026-10-05",
            shiftId: "turno-noche",
            clockIn: "2026-10-05T00:00:00-07:00",
            clockOut: "2026-10-05T02:00:00-07:00",
            breaks: [],
            unpaidBreakMinutes: 0,
            breakTimesRecorded: true,
            hourlyRate: 17,
            hours: 2,
          },
        ],
      },
    ],
  });
  assert.equal(mapped.ok, true);
  if (!mapped.ok) return;
  const employee = mapped.period.employees[0];
  assert.equal(employee.grossPayEstimate, 95.48);
  assert.notEqual(employee.grossPayEstimate, 20 * 5.616667);
  assert.deepEqual(employee.appliedHourlyRates, [17, 18]);
  assert.equal(employee.totalHours, 5.616667);
  const sameDay = employee.segments.filter((segment) => segment.date === "2026-10-07" && !segment.open);
  assert.equal(sameDay.length, 2);
  assert.equal(
    Number((sameDay[0].hours + sameDay[1].hours).toFixed(6)),
    5.616667,
  );
  const open = employee.segments.find((segment) => segment.shiftId === "turno-abierto");
  assert.equal(open?.open, true);
  assert.equal(open?.hours, 0);
  assert.equal(open?.clockOut, null);
  assert.deepEqual(employee.openShifts, [
    { shiftId: "turno-abierto", clockIn: "2026-10-03T22:10:00-07:00" },
  ]);
  const overnight = employee.segments.filter((segment) => segment.shiftId === "turno-noche");
  assert.deepEqual(
    overnight.map((segment) => segment.date),
    ["2026-10-04", "2026-10-05"],
  );

  const duplicate = mapTeamHoursResponse({
    ...contractFixture,
    employees: [
      {
        ...base,
        days: [base.days[0], { ...base.days[0], clockIn: "2026-10-07T15:00:00-07:00" }],
      },
    ],
  });
  assert.equal(duplicate.ok, false);
  if (!duplicate.ok) assert.match(duplicate.error, /turno-ejemplo/);
});

test("mapper rejects a non-Sunday period, a bad timezone, and a negative amount", () => {
  const monday = mapTeamHoursResponse({
    ...fixture,
    periodStart: "2026-09-28",
    periodEnd: "2026-10-04",
    employees: [],
  });
  assert.equal(monday.ok, false);
  if (!monday.ok) assert.match(monday.error, /Sunday/);

  const zone = mapTeamHoursResponse({ ...fixture, timezone: "America/Los_Angeles" });
  assert.equal(zone.ok, false);

  const negative = mapTeamHoursResponse({
    ...fixture,
    employees: [{ ...fixture.employees[0], totalHours: -1 }],
  });
  assert.equal(negative.ok, false);
  if (!negative.ok) assert.match(negative.error, /totalHours/);
});

test("mapper rejects a duplicate employee id at the same location and a day outside the period", () => {
  const duplicate = mapTeamHoursResponse({
    ...fixture,
    employees: [fixture.employees[0], fixture.employees[0]],
  });
  assert.equal(duplicate.ok, false);
  if (!duplicate.ok) assert.match(duplicate.error, /Duplicate employee emp_maria/);

  const outside = mapTeamHoursResponse({
    ...fixture,
    employees: [
      {
        ...fixture.employees[2],
        days: [{ ...fixture.employees[2].days[0], date: "2026-10-04" }],
      },
    ],
  });
  assert.equal(outside.ok, false);
  if (!outside.ok) assert.match(outside.error, /outside/);
});

test("pay periods are Sunday to Saturday in Phoenix", () => {
  assert.equal(phoenixSunday("2026-10-07"), "2026-10-04");
  assert.deepEqual(recentPayPeriodStarts("2026-10-07", 2), ["2026-10-04", "2026-09-27"]);
});

test("the team client defaults the base URL and prefers the API key", async () => {
  assert.equal(createTeamHoursClient({}), null);
  assert.equal(createTeamHoursClient({ CHILAKIL_TEAM_API_URL: "https://team.example.com" }), null);

  let seenUrl = "";
  let seenAuthorization = "";
  const fallback = createTeamHoursClient(
    { CHILAKIL_TEAM_API_TOKEN: "legacy-token" },
    async (url, init) => {
      seenUrl = String(url);
      seenAuthorization = new Headers(init?.headers).get("authorization") ?? "";
      return new Response("{}", { status: 200 });
    },
  );
  assert.ok(fallback);
  await fallback?.fetchHours({ periodStart: "2026-10-04", location: "all" });
  assert.equal(`${seenUrl}`, "https://team.chilakiltogo.com/api/v1/hours?periodStart=2026-10-04&location=all");
  assert.equal(`${seenAuthorization}`, "Bearer legacy-token");

  const client = createTeamHoursClient(
    {
      CHILAKIL_TEAM_API_URL: "https://team.example.com/",
      CHILAKIL_TEAM_API_KEY: "live-key",
      CHILAKIL_TEAM_API_TOKEN: "legacy-token",
    },
    async (url, init) => {
      seenUrl = String(url);
      seenAuthorization = new Headers(init?.headers).get("authorization") ?? "";
      return new Response("{}", { status: 200 });
    },
  );
  assert.ok(client);
  await client?.fetchHours({ periodStart: "2026-10-04", location: "glendale" });
  assert.equal(`${seenUrl}`, "https://team.example.com/api/v1/hours?periodStart=2026-10-04&location=glendale");
  assert.equal(`${seenAuthorization}`, "Bearer live-key");
  assert.equal(seenUrl.includes("live-key"), false);
  assert.equal(seenUrl.includes("legacy-token"), false);
});
