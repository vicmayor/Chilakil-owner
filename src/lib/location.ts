export const LOCATION_IDS = ["glendale", "avondale"] as const;

export type LocationId = (typeof LOCATION_IDS)[number];
export type LocationScope = "all" | LocationId;

export const LOCATIONS: Record<
  LocationId,
  {
    id: LocationId;
    name: string;
    shortName: string;
    typeLabel: string;
    city: string;
  }
> = {
  glendale: {
    id: "glendale",
    name: "Glendale Restaurant",
    shortName: "Glendale",
    typeLabel: "Restaurant",
    city: "Glendale, AZ",
  },
  avondale: {
    id: "avondale",
    name: "Avondale Food Trailer",
    shortName: "Avondale",
    typeLabel: "Food trailer",
    city: "Avondale, AZ",
  },
};

export const COMBINED_LABEL = "Combined total (Glendale + Avondale)";
export const COMBINED_BANNER =
  "Both locations — each figure is labeled. Combined totals are marked so they are never mistaken for a single store.";

export function isLocationId(value: string): value is LocationId {
  return value === "glendale" || value === "avondale";
}

export function parseLocationScope(value: string | undefined | null): LocationScope {
  if (value === "glendale" || value === "avondale" || value === "all") return value;
  return "all";
}

/**
 * IDs to query. ALL returns both IDs — callers must still present per-location
 * figures and only add a total when it is explicitly labeled combined.
 */
export function locationIdsForScope(scope: LocationScope): LocationId[] {
  if (scope === "all") return [...LOCATION_IDS];
  return [scope];
}

export function isCombinedScope(scope: LocationScope): scope is "all" {
  return scope === "all";
}

export function locationLabel(id: LocationId): string {
  return LOCATIONS[id].shortName;
}
