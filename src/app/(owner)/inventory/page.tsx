import { InventoryScreen } from "@/components/inventory-view";
import { getLocationScope } from "@/lib/scope";
import { loadInventoryPage } from "@/lib/team-inventory-load";
import { teamInventoryConfigured } from "@/lib/team-inventory-client";

export const metadata = { title: "Inventory" };
export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const scope = await getLocationScope();
  const data = await loadInventoryPage(scope);
  return <InventoryScreen data={data} scope={scope} connected={teamInventoryConfigured()} />;
}
