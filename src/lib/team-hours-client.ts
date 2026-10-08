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
  CHILAKIL_TEAM_API_KEY?: string;
  CHILAKIL_TEAM_API_TOKEN?: string;
  [key: string]: string | undefined;
};

export const TEAM_HOURS_DEFAULT_BASE_URL = "https://team.chilakiltogo.com";

export class TeamHoursApiError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`Team hours API returned ${status}`);
    this.name = "TeamHoursApiError";
    this.status = status;
  }
}

/** A key or legacy token must be set. The base URL defaults to the Team site. */
export function teamHoursConfigured(env: TeamHoursEnv = process.env): boolean {
  return createTeamHoursClient(env) != null;
}

/**
 * Read-only client for GET {base}/api/v1/hours.
 * The path, query names, and key header live here so the endpoint can change later.
 * The key is sent only as Authorization: Bearer. It is never placed in the URL.
 */
export function createTeamHoursClient(
  env: TeamHoursEnv = process.env,
  fetchImpl: typeof fetch = fetch,
): TeamHoursClient | null {
  const baseUrl = resolveBaseUrl(env.CHILAKIL_TEAM_API_URL);
  const token = teamApiKey(env);
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

export function readTeamApiKey(env: TeamHoursEnv = process.env): string | null {
  return teamApiKey(env);
}

export function readTeamBaseUrl(env: TeamHoursEnv = process.env): string | null {
  return resolveBaseUrl(env.CHILAKIL_TEAM_API_URL);
}

function teamApiKey(env: TeamHoursEnv): string | null {
  const key = env.CHILAKIL_TEAM_API_KEY?.trim();
  if (key) return key;
  const token = env.CHILAKIL_TEAM_API_TOKEN?.trim();
  return token || null;
}

function resolveBaseUrl(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return TEAM_HOURS_DEFAULT_BASE_URL;
  return normalizeBaseUrl(trimmed);
}

function normalizeBaseUrl(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const path = url.pathname.replace(/\/$/, "");
  return `${url.origin}${path === "/" ? "" : path}`;
}
