import type { LocationId } from "@/lib/location";

/** DoorDash merchant store ids. These are not secrets. */
export const DOORDASH_STORE_IDS: Record<LocationId, string> = {
  glendale: "32669627",
  avondale: "27859030",
};

export function locationForDoorDashStore(storeId: string): LocationId | null {
  if (storeId === DOORDASH_STORE_IDS.glendale) return "glendale";
  if (storeId === DOORDASH_STORE_IDS.avondale) return "avondale";
  return null;
}
