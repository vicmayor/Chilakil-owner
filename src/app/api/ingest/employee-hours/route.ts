import { csvToRecords } from "@/lib/csv";
import {
  EMPLOYEE_HOURS_NUMERIC_COLUMNS,
  isIngestAuthorized,
  parseEmployeeHoursBody,
  upsertEmployeeHours,
} from "@/lib/ingest";

export async function POST(request: Request) {
  if (!isIngestAuthorized(request)) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  let body: unknown;
  try {
    if (contentType.includes("text/csv") || contentType.includes("application/csv")) {
      body = csvToRecords(await request.text(), EMPLOYEE_HOURS_NUMERIC_COLUMNS);
    } else {
      body = await request.json();
    }
  } catch {
    return Response.json({ ok: false, error: "Body must be JSON or CSV." }, { status: 400 });
  }

  const parsed = parseEmployeeHoursBody(body);
  if (!parsed.ok) {
    return Response.json({ ok: false, error: parsed.error, issues: parsed.issues }, { status: 400 });
  }

  const rows = await upsertEmployeeHours(parsed.records);
  return Response.json({
    ok: true,
    upserted: rows.length,
    records: rows.map((row) => ({
      location: row.locationId,
      periodStart: row.periodStart,
      employeeName: row.employeeName,
    })),
  });
}
