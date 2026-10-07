import test from "node:test";
import assert from "node:assert/strict";
import fixture from "./fixtures/team-hours-period.json";
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
  assert.equal(glendaleMaria?.days[0].breaks[0].start, "12:00");
  assert.equal(glendaleMaria?.days[0].breaks[0].end, "12:30");
  assert.equal(glendaleMaria?.days[1].clockOut, null);
  assert.equal(avondaleMaria?.status, "approved");
  assert.equal(avondaleMaria?.days[0].breaks.length, 2);
  assert.equal(avondaleMaria?.totalHours, 6);
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

test("the team client is absent until both env vars are set and calls the hours path", async () => {
  assert.equal(createTeamHoursClient({}), null);
  assert.equal(createTeamHoursClient({ CHILAKIL_TEAM_API_URL: "https://team.example.com" }), null);

  let seenUrl = "";
  let seenAuthorization = "";
  const client = createTeamHoursClient(
    {
      CHILAKIL_TEAM_API_URL: "https://team.example.com/",
      CHILAKIL_TEAM_API_TOKEN: "secret-token",
    },
    async (url, init) => {
      seenUrl = String(url);
      const headers = new Headers(init?.headers);
      seenAuthorization = headers.get("authorization") ?? "";
      return new Response("{}", { status: 200 });
    },
  );
  assert.ok(client);
  await client?.fetchHours({ periodStart: "2026-10-04", location: "all" });
  assert.equal(seenUrl, "https://team.example.com/api/v1/hours?periodStart=2026-10-04&location=all");
  assert.equal(seenAuthorization, "Bearer secret-token");
  assert.equal(seenUrl.includes("secret-token"), false);
});
