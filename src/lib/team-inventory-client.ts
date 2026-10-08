import { readTeamApiKey, readTeamBaseUrl, type TeamHoursLocationQuery } from "@/lib/team-hours-client";

export type TeamInventoryLocationQuery = TeamHoursLocationQuery;

export type TeamInventoryClient = {
  fetchInventory(location: TeamInventoryLocationQuery): Promise<unknown>;
};

type TeamInventoryEnv = {
  CHILAKIL_TEAM_API_URL?: string;
  CHILAKIL_TEAM_API_KEY?: string;
  CHILAKIL_TEAM_API_TOKEN?: string;
  [key: string]: string | undefined;
};

export class TeamInventoryApiError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`Team inventory API returned ${status}`);
    this.name = "TeamInventoryApiError";
    this.status = status;
  }
}

/** Same key and base URL as the hours client. Inventory also needs inventory:read. */
export function teamInventoryConfigured(env: TeamInventoryEnv = process.env): boolean {
  return createTeamInventoryClient(env) != null;
}

/**
 * Read-only client for GET {base}/api/v1/inventory.
 * The key is sent only as Authorization: Bearer. It is never placed in the URL.
 */
export function createTeamInventoryClient(
  env: TeamInventoryEnv = process.env,
  fetchImpl: typeof fetch = fetch,
): TeamInventoryClient | null {
  const baseUrl = readTeamBaseUrl(env);
  const token = readTeamApiKey(env);
  if (!baseUrl || !token) return null;

  return {
    async fetchInventory(location) {
      const url = new URL(`${baseUrl}/api/v1/inventory`);
      url.searchParams.set("location", location);
      const response = await fetchImpl(url, {
        method: "GET",
        headers: {
          accept: "application/json",
          authorization: `Bearer ${token}`,
        },
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) throw new TeamInventoryApiError(response.status);
      return response.json() as Promise<unknown>;
    },
  };
}
