import Link from "next/link";
import { LocationDot } from "@/components/ui";
import type { LocationId } from "@/lib/location";

export function InventoryWatch({
  rows,
}: {
  rows: { locationId: LocationId; out: number; low: number }[];
}) {
  if (rows.length === 0) return null;
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold">Inventory</h2>
      <div className="space-y-2">
        {rows.map((row) => (
          <Link
            key={row.locationId}
            href="/inventory"
            className="block rounded-2xl border border-line bg-card p-4"
          >
            <LocationDot id={row.locationId} />
            <p className="mt-2 text-sm font-bold">Se terminó {row.out}</p>
            <p className="text-sm font-bold">Queda poco {row.low}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
