import { AlertCard } from "@/components/design/alert-card";
import type { LocationId } from "@/lib/location";

export function InventoryWatch({
  rows,
}: {
  rows: { locationId: LocationId; out: number; low: number }[];
}) {
  if (rows.length === 0) return null;
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold">Inventory</h2>
      {rows.map((row) => (
        <AlertCard key={row.locationId} tone="problem" href="/inventory" title={placeTitle(row.locationId)}>
          <p>Se terminó {row.out}</p>
          <p>Queda poco {row.low}</p>
        </AlertCard>
      ))}
    </section>
  );
}

function placeTitle(id: LocationId): string {
  return id === "avondale" ? "Trailer · Avondale" : "Restaurant · Glendale";
}
