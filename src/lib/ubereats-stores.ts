import type { LocationId } from "@/lib/location";

/** Uber Eats merchant store ids. These are not secrets. Avondale may be labeled Phoenix in Uber. */
export const UBEREATS_STORE_IDS: Record<LocationId, string> = {
  glendale: "91bb8a8e-e9c5-5c0d-88a0-671cb75faf20",
  avondale: "a4232345-3850-5bb6-92bf-27434a445d64",
};

export function locationForUberStore(storeId: string): LocationId | null {
  const id = storeId.trim().toLowerCase();
  if (id === UBEREATS_STORE_IDS.glendale) return "glendale";
  if (id === UBEREATS_STORE_IDS.avondale) return "avondale";
  return null;
}
