import { cookies } from "next/headers";
import { LOCATION_COOKIE } from "@/lib/auth";
import {
  parseLocationScope,
  type LocationScope,
} from "@/lib/location";

export async function getLocationScope(): Promise<LocationScope> {
  const value = (await cookies()).get(LOCATION_COOKIE)?.value;
  return parseLocationScope(value);
}
