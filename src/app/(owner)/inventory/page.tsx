import { InventoryScreen } from "@/components/inventory-view";
import { getLocationScope } from "@/lib/scope";
import { teamInventoryConfigured } from "@/lib/team-inventory-client";
import { loadInventoryPage } from "@/lib/team-inventory-load";
import { refreshInventoryOnView } from "@/lib/team-inventory-sync";

export const metadata = { title: "Inventory" };
export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const scope = await getLocationScope();
  await refreshInventoryOnView();
  const data = await loadInventoryPage(scope);
  return <InventoryScreen data={data} scope={scope} connected={teamInventoryConfigured()} />;
}
