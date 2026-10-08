"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { syncTeamInventory, type SyncTeamInventoryResult } from "@/lib/team-inventory-sync";

export async function syncInventoryAction(): Promise<SyncTeamInventoryResult> {
  await requireSession();
  try {
    const result = await syncTeamInventory();
    if (result.connected) {
      revalidatePath("/inventory");
      revalidatePath("/dashboard");
    }
    return result;
  } catch (error) {
    console.error("Inventory sync failed", error instanceof Error ? error.message : "unknown");
    return { ok: false, connected: true, counts: [], error: "Couldn't sync inventory." };
  }
}
