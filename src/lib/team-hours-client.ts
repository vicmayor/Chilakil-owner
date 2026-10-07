export type TeamHoursLocationQuery = "glendale" | "avondale" | "all";

export type TeamHoursQuery = {
  periodStart: string;
  location: TeamHoursLocationQuery;
};

export type TeamHoursClient = {
  fetchHours(query: TeamHoursQuery): Promise<unknown>;
};

type TeamHoursEnv = {
  CHILAKIL_TEAM_API_URL?: string;
  CHILAKIL_TEAM_API_TOKEN?: string;
  [key: string]: string | undefined;
};

export class TeamHoursApiError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`Team hours API returned ${status}`);
    this.name = "TeamHoursApiError";
    this.status = status;
  }
}

/** Both env vars must be set or the Employees page stays "Not connected". */
export function teamHoursConfigured(env: TeamHoursEnv = process.env): boolean {
  return createTeamHoursClient(env) != null;
}

/**
 * Read-only client for GET {base}/api/v1/hours.
 * The path and query names are isolated here so the endpoint can change later.
 */
export function createTeamHoursClient(
  env: TeamHoursEnv = process.env,
  fetchImpl: typeof fetch = fetch,
): TeamHoursClient | null {
  const baseUrl = normalizeBaseUrl(env.CHILAKIL_TEAM_API_URL);
  const token = env.CHILAKIL_TEAM_API_TOKEN?.trim();
  if (!baseUrl || !token) return null;

  return {
    async fetchHours(query) {
      const url = new URL(`${baseUrl}/api/v1/hours`);
      url.searchParams.set("periodStart", query.periodStart);
      url.searchParams.set("location", query.location);
      const response = await fetchImpl(url, {
        method: "GET",
        headers: {
          accept: "application/json",
          authorization: `Bearer ${token}`,
        },
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) throw new TeamHoursApiError(response.status);
      return response.json() as Promise<unknown>;
    },
  };
}

function normalizeBaseUrl(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const path = url.pathname.replace(/\/$/, "");
  return `${url.origin}${path === "/" ? "" : path}`;
}
