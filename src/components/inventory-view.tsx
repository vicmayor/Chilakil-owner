"use client";

import { useMemo, useState, useTransition } from "react";
import { TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { setLocationScope } from "@/app/actions/location";
import { SyncInventoryButton } from "@/components/sync-inventory-button";
import { Card, LocationDot } from "@/components/ui";
import { formatPhoenixDateTime } from "@/lib/dates";
import type { LocationScope } from "@/lib/location";
import { LOCATIONS } from "@/lib/location";
import {
  INVENTORY_CHIPS,
  filterInventoryItems,
  formatInventorySyncedAt,
  inventoryActionAlert,
  type InventoryChip,
  type InventoryItemView,
  type InventoryLocationBlock,
  type InventoryPageData,
} from "@/lib/team-inventory";
import type { MappedInventorySummary } from "@/lib/team-inventory-mapper";

export function InventoryScreen({
  data,
  scope,
  connected,
}: {
  data: InventoryPageData;
  scope: LocationScope;
  connected: boolean;
}) {
  const singleBlock = scope === "all" ? null : data.blocks[0];

  return (
    <>
      <header
        className="bg-paper px-4 pb-2"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        <div className="mx-auto max-w-lg">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-muted">Chilakil / Team</p>
          <h1 className="font-display mt-1 text-[2.6rem] font-extrabold leading-none tracking-tight">INVENTORY</h1>
          <div className="mt-4">
            <InventoryLocationSwitch scope={scope} />
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <span
                className={`inline-block h-2.5 w-2.5 rounded-full ${data.lastSuccessAt && !data.stale ? "bg-sage" : "bg-mesa"}`}
                aria-hidden
              />
              {data.lastSuccessAt ? formatInventorySyncedAt(data.lastSuccessAt) : "Not synced yet"}
            </p>
            {connected ? <SyncInventoryButton /> : null}
          </div>
          {scope === "all" ? (
            <p className="mt-2 text-xs text-muted">Both locations. Each block stays on its own.</p>
          ) : null}
        </div>
      </header>
      <main className="space-y-4 px-4 py-4">
        {connected ? null : (
          <Card>
            <p className="text-base font-medium">Not connected</p>
            <p className="mt-1 text-sm text-muted">
              Set CHILAKIL_TEAM_API_KEY and turn on inventory access in Team → Owner API. The base URL defaults to
              https://team.chilakiltogo.com.
            </p>
          </Card>
        )}
        {data.stale && data.lastError ? (
          <div className="rounded-2xl border border-warn bg-warn-soft p-4 text-sm">
            <p className="font-bold">Inventario desactualizado · Inventory may be stale</p>
            <p className="mt-1">{data.lastError}</p>
          </div>
        ) : null}
        {singleBlock?.hasSummary ? <InventoryActionAlert summary={singleBlock.summary} /> : null}
        <p className="text-xs text-muted">Read-only. Consulting this report does not confirm receipts or purchases.</p>
        {data.blocks.map((block) => (
          <LocationInventory key={block.locationId} block={block} showAlert={scope === "all"} labeled={scope === "all"} />
        ))}
      </main>
    </>
  );
}

function InventoryLocationSwitch({ scope }: { scope: LocationScope }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function select(next: LocationScope) {
    if (next === scope) return;
    start(async () => {
      await setLocationScope(next);
      router.refresh();
    });
  }

  return (
    <div className={pending ? "opacity-70" : ""}>
      <div role="tablist" aria-label="Location" className="grid grid-cols-2 gap-1 rounded-2xl border border-line bg-white p-1">
        <LocationChoice
          active={scope === "glendale"}
          tone="ink"
          kicker="Restaurant"
          label="Glendale"
          onSelect={() => select("glendale")}
        />
        <LocationChoice
          active={scope === "avondale"}
          tone="gray"
          kicker="Trailer"
          label="Avondale"
          onSelect={() => select("avondale")}
        />
      </div>
      {scope === "all" ? null : (
        <button
          type="button"
          onClick={() => select("all")}
          className="mt-2 inline-flex items-center text-sm font-bold text-ink"
        >
          Both locations
        </button>
      )}
    </div>
  );
}

function LocationChoice({
  active,
  tone,
  kicker,
  label,
  onSelect,
}: {
  active: boolean;
  tone: "ink" | "gray";
  kicker: string;
  label: string;
  onSelect: () => void;
}) {
  const selected =
    tone === "ink" ? "bg-ink text-white" : "bg-paper-2 text-ink";
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onSelect}
      className={`flex min-h-14 flex-col items-center justify-center rounded-xl px-2 leading-tight ${
        active ? selected : "bg-transparent text-muted"
      }`}
    >
      <span className="text-[10px] font-bold uppercase tracking-[0.14em]">{kicker}</span>
      <span className="text-sm font-extrabold">{label}</span>
    </button>
  );
}

function InventoryActionAlert({ summary }: { summary: MappedInventorySummary }) {
  const alert = inventoryActionAlert(summary);
  return (
    <div className="flex gap-3 rounded-2xl bg-danger-soft px-4 py-3 text-danger">
      <TriangleAlert className="mt-0.5 shrink-0" size={22} aria-hidden />
      <div>
        <p className="font-bold leading-5">{alert.headline}</p>
        <p className="mt-0.5 text-sm font-semibold">{alert.detail}</p>
      </div>
    </div>
  );
}

function LocationInventory({
  block,
  showAlert,
  labeled,
}: {
  block: InventoryLocationBlock;
  showAlert: boolean;
  labeled: boolean;
}) {
  const [chip, setChip] = useState<InventoryChip | null>(null);
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const categories = useMemo(
    () => [...new Set(block.items.map((item) => item.category))].sort(),
    [block.items],
  );
  const visible = filterInventoryItems(block.items, {
    chip,
    category: category || null,
    search,
  });
  const place = LOCATIONS[block.locationId].name;

  const placeTitle = block.locationId === "avondale" ? "Trailer · Avondale" : "Restaurant · Glendale";

  return (
    <section className="space-y-3" aria-label={place}>
      {labeled ? (
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-extrabold">{placeTitle}</h2>
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
        <div className="flex flex-wrap gap-2">
          {INVENTORY_CHIPS.map((option) => {
            const active = chip === option.id;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={active}
                onClick={() => setChip(active ? null : option.id)}
                className={`inline-flex min-h-11 items-center rounded-full px-3 text-xs font-bold ${
                  active ? "bg-chile text-ink" : "border border-line bg-card text-ink"
                }`}
              >
                {option.label} {block.summary[option.id]}
              </button>
            );
          })}
        </div>
      ) : (
        <Card>
          <p className="text-base font-medium">Sin inventario sincronizado</p>
          <p className="mt-1 text-sm text-muted">This location has no inventory report yet.</p>
        </Card>
      )}
      {block.hasSummary ? (
        <>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-muted" htmlFor={`search-${block.locationId}`}>
              Buscar
            </label>
            <input
              id={`search-${block.locationId}`}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nombre, categoría, proveedor"
              className="min-h-11 rounded-2xl border border-line bg-card px-3 text-sm"
            />
            <label className="text-xs font-semibold text-muted" htmlFor={`category-${block.locationId}`}>
              Categoría
            </label>
            <select
              id={`category-${block.locationId}`}
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="min-h-11 rounded-2xl border border-line bg-card px-3 text-sm font-semibold"
            >
              <option value="">Todas</option>
              {categories.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          {visible.length === 0 ? (
            <Card>
              <p className="text-sm font-medium">Nada coincide</p>
            </Card>
          ) : (
            <ul className="space-y-2">
              {visible.map((item) => (
                <li key={item.itemId}>
                  <ItemCard item={item} />
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </section>
  );
}

function ItemCard({ item }: { item: InventoryItemView }) {
  return (
    <article className="rounded-2xl border border-line bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold leading-5">{item.name}</h3>
          <p className="text-xs text-muted">
            {item.nameEn} · {item.category}
          </p>
        </div>
        <StatusBadge status={item.status} label={item.statusLabel} />
      </div>
      <p className="mt-3 font-display text-2xl font-extrabold leading-none">{item.quantityText}</p>
      {item.unitLabel ? <p className="mt-1 text-xs text-muted">{item.unitLabel}</p> : null}
      {item.supplier ? <p className="mt-1 text-xs text-muted">{item.supplier}</p> : null}
      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">Compra</dt>
          <dd className="font-bold">{item.purchaseLabel}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">Entrega</dt>
          <dd className="font-bold">{item.deliveryLabel}</dd>
        </div>
      </dl>
      {item.neededLabel ? (
        <p className={`mt-3 text-sm font-bold ${item.neededOverdue ? "text-danger" : "text-ink"}`}>
          {item.neededByLabel ? `${item.neededByLabel} · ` : ""}
          {item.neededLabel}
        </p>
      ) : null}
      <p className="mt-3 text-xs text-muted">
        Último conteo: {countLabel(item.lastCountedAt, item.lastCountedBy)}
      </p>
      {item.lastUpdatedAt ? (
        <p className="text-xs text-muted">
          Actualizado: {countLabel(item.lastUpdatedAt, item.lastUpdatedBy)}
        </p>
      ) : null}
    </article>
  );
}

function StatusBadge({ status, label }: { status: InventoryItemView["status"]; label: string }) {
  const tone =
    status === "out"
      ? "bg-ink text-white"
      : status === "low"
        ? "bg-chile text-ink"
        : status === "sufficient"
          ? "bg-sage-soft text-sage"
          : "bg-paper-2 text-ink";
  return (
    <span className={`inline-flex shrink-0 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${tone}`}>
      {label}
    </span>
  );
}

function countLabel(at: string | null, by: string | null): string {
  if (!at) return "Sin contar";
  const when = formatPhoenixDateTime(new Date(at));
  return by ? `${when} · ${by}` : when;
}
