import { AlertCard } from "@/components/design/alert-card";
import { formatSyncStamp } from "@/components/design/sync-status";
import { InventoryCatalog, type InventoryChipSelection } from "@/components/inventory-catalog";
import { SyncInventoryButton } from "@/components/sync-inventory-button";
import { TopBar } from "@/components/top-bar";
import { LocationDot } from "@/components/ui";
import { formatPhoenixDateTime } from "@/lib/dates";
import { LOCATIONS, type LocationScope } from "@/lib/location";
import {
  inventoryActionAlert,
  recentInventoryAlerts,
  type InventoryLocationBlock,
  type InventoryPageData,
} from "@/lib/team-inventory";
import type { MappedInventorySummary } from "@/lib/team-inventory-mapper";

export function InventoryScreen({
  data,
  scope,
  connected,
  chips,
}: {
  data: InventoryPageData;
  scope: LocationScope;
  connected: boolean;
  chips: InventoryChipSelection;
}) {
  const singleBlock = scope === "all" ? null : data.blocks[0];
  const syncLabel = !connected
    ? "Not connected"
    : data.lastSuccessAt
      ? `Last synced: ${formatSyncStamp(new Date(data.lastSuccessAt))}${data.stale ? " · stale" : ""}`
      : "Not synced yet";

  return (
    <>
      <TopBar
        title="Inventory"
        subtitle="Read-only. Consulting this report does not confirm receipts or purchases."
        scope={scope}
        syncLabel={syncLabel}
        syncAction={connected ? <SyncInventoryButton /> : undefined}
      />
      <main className="space-y-4 px-4 py-4 md:px-6">
        {connected ? null : (
          <AlertCard tone="notice" title="Not connected">
            Set CHILAKIL_TEAM_API_KEY and turn on inventory access in Team → Owner API. The base URL defaults to
            https://team.chilakiltogo.com.
          </AlertCard>
        )}
        {data.stale && data.lastError ? (
          <AlertCard tone="problem" title="Inventario desactualizado · Inventory may be stale">
            {data.lastError}
          </AlertCard>
        ) : null}
        {singleBlock?.hasSummary ? <InventoryActionAlert summary={singleBlock.summary} /> : null}
        <RecentAlerts blocks={data.blocks} />
        {data.blocks.map((block) => (
          <LocationInventory
            key={block.locationId}
            block={block}
            chips={chips}
            showAlert={scope === "all"}
            labeled={scope === "all"}
          />
        ))}
      </main>
    </>
  );
}

function RecentAlerts({ blocks }: { blocks: InventoryLocationBlock[] }) {
  const alerts = recentInventoryAlerts(blocks);
  if (alerts.length === 0) return null;
  return (
    <AlertCard tone="notice" title="Recent alerts">
      <ul className="space-y-2">
        {alerts.map((alert) => (
          <li key={alert.key}>{alert.line}</li>
        ))}
      </ul>
    </AlertCard>
  );
}

function InventoryActionAlert({ summary }: { summary: MappedInventorySummary }) {
  const alert = inventoryActionAlert(summary);
  return (
    <AlertCard tone="problem" title={alert.headline}>
      {alert.detail}
    </AlertCard>
  );
}

function LocationInventory({
  block,
  chips,
  showAlert,
  labeled,
}: {
  block: InventoryLocationBlock;
  chips: InventoryChipSelection;
  showAlert: boolean;
  labeled: boolean;
}) {
  const place = LOCATIONS[block.locationId].name;
  const placeTitle = block.locationId === "avondale" ? "Trailer · Avondale" : "Restaurant · Glendale";

  return (
    <section className="space-y-3" aria-label={place}>
      {labeled ? (
        <div className="flex items-center justify-between gap-2 px-1">
          <h2 className="font-display text-2xl font-extrabold leading-none">{placeTitle}</h2>
          <LocationDot id={block.locationId} />
        </div>
      ) : null}
      {showAlert && block.hasSummary ? <InventoryActionAlert summary={block.summary} /> : null}
      {block.generatedAt ? (
        <p className="text-xs text-muted">
          Reporte {formatPhoenixDateTime(new Date(block.generatedAt))}. Report time, not the last count.
        </p>
      ) : null}
      {block.hasSummary ? (
        <InventoryCatalog block={block} chips={chips} />
      ) : (
        <AlertCard tone="notice" title="Sin inventario sincronizado">
          This location has no inventory report yet.
        </AlertCard>
      )}
    </section>
  );
}
