"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { LOCATION_COOKIE } from "@/lib/auth";
import { parseLocationScope, type LocationScope } from "@/lib/location";

export async function setLocationScope(scope: LocationScope) {
  const next = parseLocationScope(scope);
  (await cookies()).set(LOCATION_COOKIE, next, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/", "layout");
}
