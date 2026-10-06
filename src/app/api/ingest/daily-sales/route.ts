import { csvToRecords } from "@/lib/csv";
import {
  DAILY_SALES_NUMERIC_COLUMNS,
  isIngestAuthorized,
  parseDailySalesBody,
  upsertDailySales,
} from "@/lib/ingest";

export async function POST(request: Request) {
  if (!isIngestAuthorized(request)) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await readIngestBody(request, DAILY_SALES_NUMERIC_COLUMNS);
  if (!body.ok) {
    return Response.json({ ok: false, error: body.error }, { status: 400 });
  }

  const parsed = parseDailySalesBody(body.value);
  if (!parsed.ok) {
    return Response.json({ ok: false, error: parsed.error, issues: parsed.issues }, { status: 400 });
  }

  const rows = await upsertDailySales(parsed.records);
  return Response.json({
    ok: true,
    upserted: rows.length,
    records: rows.map((row) => ({ location: row.locationId, date: row.date })),
  });
}

async function readIngestBody(
  request: Request,
  numericColumns: ReadonlySet<string>,
): Promise<{ ok: true; value: unknown } | { ok: false; error: string }> {
  const contentType = request.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("text/csv") || contentType.includes("application/csv")) {
      return { ok: true, value: csvToRecords(await request.text(), numericColumns) };
    }
    return { ok: true, value: await request.json() };
  } catch {
    return { ok: false, error: "Body must be JSON or CSV." };
  }
}
