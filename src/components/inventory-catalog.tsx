"use client";

import { useMemo, useState } from "react";
import { Accordion } from "@/components/design/accordion";
import { AlertCard } from "@/components/design/alert-card";
import { RecordCard } from "@/components/design/record-card";
import { FilterSelect, SearchField } from "@/components/design/search-field";
import { SectionTabs } from "@/components/design/section-tabs";
import { StatPill } from "@/components/design/stat-pill";
import { formatPhoenixDateTime } from "@/lib/dates";
import type { LocationId } from "@/lib/location";
import {
  INVENTORY_CHIPS,
  categoryLabel,
  filterInventoryItems,
  groupInventoryByCategory,
  type InventoryChip,
  type InventoryItemView,
  type InventoryLocationBlock,
} from "@/lib/team-inventory";

export type InventoryChipSelection = Record<LocationId, InventoryChip | null>;

export function InventoryCatalog({
  block,
  chips,
}: {
  block: InventoryLocationBlock;
  chips: InventoryChipSelection;
}) {
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const chip = chips[block.locationId];
  const categories = useMemo(() => {
    const labels = [...new Set(block.items.map((item) => categoryLabel(item.category)))];
    const known = new Map(groupInventoryByCategory(block.items).map((group, index) => [group.label, index]));
    return labels.sort((a, b) => (known.get(a) ?? 0) - (known.get(b) ?? 0));
  }, [block.items]);
  const visible = filterInventoryItems(block.items, {
    chip,
    category: category || null,
    search,
  });

  return (
    <div className="space-y-3">
      <SectionTabs
        ariaLabel={`${block.locationId} inventory filters`}
        tabs={[
          {
            id: `${block.locationId}-all`,
            href: chipHref(block.locationId, null, chips),
            label: "All",
            active: chip == null,
          },
          ...INVENTORY_CHIPS.map((option) => ({
            id: `${block.locationId}-${option.id}`,
            href: chipHref(block.locationId, option.id, chips),
            label: `${option.label} ${block.summary[option.id]}`,
            active: chip === option.id,
          })),
        ]}
      />
      <div className="flex flex-col gap-2">
        <label className="sr-only" htmlFor={`search-${block.locationId}`}>
          Search products
        </label>
        <SearchField
          id={`search-${block.locationId}`}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search products"
        />
        <label className="text-xs font-semibold text-muted" htmlFor={`category-${block.locationId}`}>
          Category
        </label>
        <FilterSelect
          id={`category-${block.locationId}`}
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          <option value="">All categories</option>
          {categories.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </FilterSelect>
        <p className="text-xs text-muted">
          Pending counts a product once when it is low, out, unreviewed, or marked needed.
        </p>
      </div>
      {visible.length === 0 ? (
        <AlertCard tone="notice" title="No products match" />
      ) : (
        <div className="space-y-2">
          {groupInventoryByCategory(visible).map((group) => (
            <Accordion
              key={group.label}
              title={group.label}
              count={group.items.length}
              pending={group.pending}
              defaultOpen={group.pending > 0}
            >
              <ul className="space-y-3">
                {group.items.map((item) => (
                  <li key={item.itemId}>
                    <ItemCard item={item} />
                  </li>
                ))}
              </ul>
            </Accordion>
          ))}
        </div>
      )}
    </div>
  );
}

function chipHref(locationId: LocationId, chip: InventoryChip | null, chips: InventoryChipSelection): string {
  const next: InventoryChipSelection = { ...chips, [locationId]: chip };
  const params = new URLSearchParams();
  for (const id of ["glendale", "avondale"] as const) {
    const value = next[id];
    if (value) params.set(id, value);
  }
  const query = params.toString();
  return query ? `/inventory?${query}` : "/inventory";
}

function ItemCard({ item }: { item: InventoryItemView }) {
  return (
    <RecordCard
      title={item.name}
      kicker={`${item.nameEn} · ${categoryLabel(item.category)}`}
      status={item.statusLabel}
      statusTone={statusTone(item.status)}
      fields={[
        { label: "Compra", value: item.purchaseLabel },
        { label: "Entrega", value: item.deliveryLabel },
      ]}
    >
      <p className="font-display text-3xl font-black leading-none">{item.quantityText}</p>
      {item.unitLabel ? <p className="mt-1 text-xs text-muted">{item.unitLabel}</p> : null}
      {item.supplier ? <p className="mt-1 text-xs text-muted">{item.supplier}</p> : null}
      {item.neededLabel ? (
        <p className={`mt-3 flex flex-wrap items-center gap-2 text-sm font-bold ${item.neededOverdue ? "text-danger" : "text-ink"}`}>
          <span>
            {item.neededByLabel ? `${item.neededByLabel} · ` : ""}
            {item.neededLabel}
          </span>
          {item.neededOverdue ? <StatPill tone="pending">Vencido</StatPill> : null}
        </p>
      ) : null}
      <p className="mt-3 text-xs text-muted">Último conteo: {countLabel(item.lastCountedAt, item.lastCountedBy)}</p>
      {item.lastUpdatedAt ? (
        <p className="text-xs text-muted">Actualizado: {countLabel(item.lastUpdatedAt, item.lastUpdatedBy)}</p>
      ) : null}
    </RecordCard>
  );
}

function statusTone(status: InventoryItemView["status"]): "muted" | "pending" | "ok" {
  if (status === "sufficient") return "ok";
  if (status === "unreviewed") return "muted";
  return "pending";
}

function countLabel(at: string | null, by: string | null): string {
  if (!at) return "Sin contar";
  const when = formatPhoenixDateTime(new Date(at));
  return by ? `${when} · ${by}` : when;
}
