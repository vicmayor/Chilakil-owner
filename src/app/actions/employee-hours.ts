"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { syncTeamHours } from "@/lib/team-hours-sync";

export type SyncEmployeeHoursActionResult = {
  ok: boolean;
  connected: boolean;
  upserted: number;
  error?: string;
};

export async function syncEmployeeHoursAction(): Promise<SyncEmployeeHoursActionResult> {
  await requireSession();
  try {
    const result = await syncTeamHours();
    if (result.connected) revalidatePath("/employees");
    return {
      ok: result.ok,
      connected: result.connected,
      upserted: result.upserted,
      error: result.error,
    };
  } catch (error) {
    console.error("Employee hours sync failed", error instanceof Error ? error.message : "unknown");
    return { ok: false, connected: true, upserted: 0, error: "Couldn't sync hours." };
  }
}
