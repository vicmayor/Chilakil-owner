import { bearerMatches } from "@/lib/ingest";
import { syncTeamHours } from "@/lib/team-hours-sync";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}

async function handle(request: Request) {
  if (!isSyncAuthorized(request)) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncTeamHours();
    if (!result.connected) {
      return Response.json({ ok: false, connected: false, upserted: 0, periods: 0 });
    }
    return Response.json(result);
  } catch (error) {
    console.error("Employee hours sync failed", error instanceof Error ? error.message : "unknown");
    return Response.json({ ok: false, connected: true, error: "Couldn't sync hours." }, { status: 502 });
  }
}

function isSyncAuthorized(request: Request): boolean {
  const header = request.headers.get("authorization");
  return bearerMatches(header, process.env.CRON_SECRET) || bearerMatches(header, process.env.INGEST_TOKEN);
}
