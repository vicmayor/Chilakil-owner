import { InventoryScreen } from "@/components/inventory-view";
import type { InventoryChipSelection } from "@/components/inventory-catalog";
import { getLocationScope } from "@/lib/scope";
import { teamInventoryConfigured } from "@/lib/team-inventory-client";
import { loadInventoryPage } from "@/lib/team-inventory-load";
import { refreshInventoryOnView } from "@/lib/team-inventory-sync";
import { parseInventoryChip } from "@/lib/team-inventory";

export const metadata = { title: "Inventory" };
export const dynamic = "force-dynamic";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [params, scope] = await Promise.all([searchParams, getLocationScope()]);
  await refreshInventoryOnView();
  const data = await loadInventoryPage(scope);
  const chips: InventoryChipSelection = {
    glendale: parseInventoryChip(params.glendale),
    avondale: parseInventoryChip(params.avondale),
  };
  return (
    <InventoryScreen data={data} scope={scope} connected={teamInventoryConfigured()} chips={chips} />
  );
}
