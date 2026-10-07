"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveFoodCostWorkbook } from "@/app/actions/food-cost";
import { LocationDot } from "@/components/ui";
import { moneyExact, pct } from "@/lib/format";
import { LOCATIONS, type LocationId } from "@/lib/location";
import {
  MAX_MONEY_INPUT,
  buildFoodCostReport,
  withFoodCostEdits,
  type FoodCostEdits,
  type FoodCostInput,
  type FoodLine,
} from "@/lib/food-cost";

export type SimulatorIngredient = {
  id: string;
  sourceKey: string;
  sortOrder: number;
  name: string;
  vendor: string | null;
  purchaseQty: number | null;
  unit: string;
  purchaseCost: number | null;
  yieldPct: number | null;
  costPerUnit: number | null;
  notes: string | null;
  addonPrice: number | null;
  portionQty: number | null;
  isStandardTopping: boolean;
};

export type SimulatorItem = {
  id: string;
  sourceKey: string;
  recipeKey: string;
  sortOrder: number;
  name: string;
  category: string;
  price: number | null;
  packagingCost: number;
  standardToppings: boolean;
  notes: string | null;
  lines: FoodLine[];
};

export type SimulatorLocation = {
  locationId: LocationId;
  targetFoodCostPct: number;
  caveat: string | null;
  ingredients: SimulatorIngredient[];
  items: SimulatorItem[];
};

type LocationDraft = {
  costs: Record<string, string>;
  prices: Record<string, string>;
  addonPrices: Record<string, string>;
};

function isProteinAddon(ingredient: SimulatorIngredient): boolean {
  return ingredient.portionQty != null && ingredient.addonPrice != null;
}

function moneyText(amount: number | null): string {
  if (amount == null || !Number.isFinite(amount)) return "";
  return String(Math.round(amount * 10000) / 10000);
}

function draftFrom(location: SimulatorLocation): LocationDraft {
  return {
    costs: Object.fromEntries(location.ingredients.map((row) => [row.sourceKey, moneyText(row.costPerUnit)])),
    prices: Object.fromEntries(location.items.map((row) => [row.sourceKey, moneyText(row.price)])),
    addonPrices: Object.fromEntries(
      location.ingredients.filter(isProteinAddon).map((row) => [row.sourceKey, moneyText(row.addonPrice)]),
    ),
  };
}

function parseMoney(raw: string): number | null | "invalid" {
  const trimmed = raw.trim().replace(/^\$/, "");
  if (!trimmed) return null;
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return "invalid";
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0 || value > MAX_MONEY_INPUT) return "invalid";
  return value;
}

function moneyDiffer(a: number | null, b: number | null): boolean {
  if (a == null || b == null) return a !== b;
  return moneyText(a) !== moneyText(b);
}

function toInput(location: SimulatorLocation): FoodCostInput {
  return {
    targetFoodCostPct: location.targetFoodCostPct,
    caveat: location.caveat,
    ingredients: location.ingredients.map((row) => ({
      sourceKey: row.sourceKey,
      sortOrder: row.sortOrder,
      name: row.name,
      vendor: row.vendor,
      purchaseQty: row.purchaseQty,
      unit: row.unit,
      purchaseCost: row.purchaseCost,
      yieldPct: row.yieldPct,
      costPerUnit: row.costPerUnit,
      notes: row.notes,
      addonPrice: row.addonPrice,
      portionQty: row.portionQty,
      isStandardTopping: row.isStandardTopping,
    })),
    menuItems: location.items.map((item) => ({
      sourceKey: item.sourceKey,
      recipeKey: item.recipeKey,
      sortOrder: item.sortOrder,
      name: item.name,
      category: item.category,
      price: item.price,
      packagingCost: item.packagingCost,
      standardToppings: item.standardToppings,
      notes: item.notes,
      lines: item.lines,
    })),
  };
}

export function FoodCostSimulator({ locations }: { locations: SimulatorLocation[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [savingId, setSavingId] = useState<LocationId | null>(null);
  const [saved, setSaved] = useState(locations);
  const [drafts, setDrafts] = useState(() =>
    Object.fromEntries(locations.map((location) => [location.locationId, draftFrom(location)])),
  );
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [justSaved, setJustSaved] = useState<LocationId | null>(null);

  function updateDraft(locationId: LocationId, patch: (draft: LocationDraft) => LocationDraft) {
    setJustSaved((current) => (current === locationId ? null : current));
    setDrafts((current) => {
      const baseline = saved.find((location) => location.locationId === locationId);
      const draft = current[locationId] ?? (baseline ? draftFrom(baseline) : { costs: {}, prices: {}, addonPrices: {} });
      return { ...current, [locationId]: patch(draft) };
    });
  }

  function resetLocation(locationId: LocationId) {
    const location = saved.find((entry) => entry.locationId === locationId);
    if (!location) return;
    setJustSaved((current) => (current === locationId ? null : current));
    setErrors((current) => ({ ...current, [locationId]: null }));
    setDrafts((current) => ({ ...current, [locationId]: draftFrom(location) }));
  }

  function saveLocation(locationId: LocationId) {
    const location = saved.find((entry) => entry.locationId === locationId);
    const draft = drafts[locationId];
    if (!location || !draft) return;
    const payload = payloadFor(location, draft);
    if (!payload.ok) {
      setErrors((current) => ({ ...current, [locationId]: payload.error }));
      return;
    }
    setSavingId(locationId);
    start(async () => {
      const result = await saveFoodCostWorkbook(payload.data);
      setSavingId(null);
      if (!result.ok) {
        setErrors((current) => ({ ...current, [locationId]: result.error }));
        return;
      }
      setSaved((current) =>
        current.map((entry) => (entry.locationId === locationId ? applySaved(entry, payload.data) : entry)),
      );
      setErrors((current) => ({ ...current, [locationId]: null }));
      setJustSaved(locationId);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-ink bg-chile px-4 py-4 text-ink">
        <h2 className="text-base font-extrabold">Cost simulator</h2>
        <p className="mt-1 text-sm leading-5">
          Change a unit cost, an add-on price, or a selling price. Recipe cost, food cost %, profit, and
          the suggested price update here. Nothing is written until you tap Save on that kitchen.
        </p>
        {locations.length > 1 ? (
          <p className="mt-2 text-sm leading-5">
            Glendale and Avondale each keep their own workbook. A what-if in one kitchen stays there.
          </p>
        ) : null}
      </section>

      {locations.map((location) => {
        const baseline = saved.find((entry) => entry.locationId === location.locationId) ?? location;
        const draft = drafts[location.locationId] ?? draftFrom(baseline);
        return (
          <KitchenSimulator
            key={location.locationId}
            location={baseline}
            draft={draft}
            pending={pending}
            saving={savingId === location.locationId}
            error={errors[location.locationId] ?? null}
            justSaved={justSaved === location.locationId}
            onCost={(key, value) =>
              updateDraft(location.locationId, (current) => ({
                ...current,
                costs: { ...current.costs, [key]: value },
              }))
            }
            onPrice={(key, value) =>
              updateDraft(location.locationId, (current) => ({
                ...current,
                prices: { ...current.prices, [key]: value },
              }))
            }
            onAddonPrice={(key, value) =>
              updateDraft(location.locationId, (current) => ({
                ...current,
                addonPrices: { ...current.addonPrices, [key]: value },
              }))
            }
            onReset={() => resetLocation(location.locationId)}
            onSave={() => saveLocation(location.locationId)}
          />
        );
      })}
    </div>
  );
}

function KitchenSimulator({
  location,
  draft,
  pending,
  saving,
  error,
  justSaved,
  onCost,
  onPrice,
  onAddonPrice,
  onReset,
  onSave,
}: {
  location: SimulatorLocation;
  draft: LocationDraft;
  pending: boolean;
  saving: boolean;
  error: string | null;
  justSaved: boolean;
  onCost: (sourceKey: string, value: string) => void;
  onPrice: (sourceKey: string, value: string) => void;
  onAddonPrice: (sourceKey: string, value: string) => void;
  onReset: () => void;
  onSave: () => void;
}) {
  const parsed = parsedDraft(location, draft);
  const report = buildFoodCostReport(withFoodCostEdits(toInput(location), parsed.edits));
  const proteins = location.ingredients.filter(isProteinAddon);
  const otherIngredients = location.ingredients.filter((row) => !isProteinAddon(row));
  const name = LOCATIONS[location.locationId].name;
  const workbookDirty = location.ingredients.some((row) => {
    const cost = parsed.costs.get(row.sourceKey);
    const addon = parsed.addonPrices.get(row.sourceKey);
    return (
      (cost !== undefined && moneyDiffer(cost, row.costPerUnit)) ||
      (addon !== undefined && moneyDiffer(addon, row.addonPrice))
    );
  }) || location.items.some((item) => {
    const price = parsed.prices.get(item.sourceKey);
    return price !== undefined && moneyDiffer(price, item.price);
  });
  const canSave = workbookDirty && parsed.invalidKeys.length === 0;
  const targetLabel = pct(location.targetFoodCostPct, 0);
  const costedMenu = location.items.filter((item) => item.lines.length > 0);
  const openMenu = location.items.filter((item) => item.lines.length === 0);

  return (
    <section className="space-y-3" data-location={location.locationId} aria-label={name}>
      <h3 className="flex items-center gap-2 px-1 text-sm font-semibold">
        <LocationDot id={location.locationId} />
        <span className="sr-only">{name}</span>
      </h3>

      <div className="rounded-2xl border border-line bg-card p-4">
        <h4 className="text-sm font-semibold">Protein add-ons</h4>
        <p className="mt-1 text-xs leading-5 text-muted">
          From this kitchen’s workbook. Portion cost follows the unit cost. Suggested plate price uses the{" "}
          {targetLabel} target.
        </p>
        {proteins.length === 0 ? (
          <p className="mt-3 text-sm text-muted">This kitchen has no protein add-on rows in the workbook.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {proteins.map((ingredient) => {
              const unit = parsed.costs.get(ingredient.sourceKey);
              const addon = parsed.addonPrices.get(ingredient.sourceKey);
              const unitInvalid = parsed.invalidKeys.includes(`cost:${ingredient.sourceKey}`);
              const addonInvalid = parsed.invalidKeys.includes(`addon:${ingredient.sourceKey}`);
              const unitDirty = unit !== undefined && moneyDiffer(unit, ingredient.costPerUnit);
              const addonDirty = addon !== undefined && moneyDiffer(addon, ingredient.addonPrice);
              const portionCost =
                unit == null || ingredient.portionQty == null ? null : unit * ingredient.portionQty;
              const addonPct = portionCost == null || addon == null || addon === 0 ? null : portionCost / addon;
              const over = addonPct != null && addonPct > location.targetFoodCostPct;
              return (
                <li
                  key={ingredient.sourceKey}
                  data-protein-addon={ingredient.name}
                  className={`rounded-xl border p-3 ${unitDirty ? "border-ink bg-chile" : "border-line bg-paper-2"}`}
                >
                  <p className="font-semibold">{ingredient.name}</p>
                  <p className="text-xs text-muted">
                    {qtyLabel(ingredient.portionQty ?? 0)} {ingredient.unit} portion
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <MoneyField
                      id={`${location.locationId}-cost-${ingredient.sourceKey}`}
                      label={`${ingredient.name} cost per ${ingredient.unit}`}
                      caption={`Per ${ingredient.unit}`}
                      value={draft.costs[ingredient.sourceKey] ?? ""}
                      invalid={unitInvalid}
                      dirty={unitDirty}
                      onChange={(value) => onCost(ingredient.sourceKey, value)}
                    />
                    <MoneyField
                      id={`${location.locationId}-addon-${ingredient.sourceKey}`}
                      label={`${ingredient.name} add-on price`}
                      caption="Add-on price"
                      value={draft.addonPrices[ingredient.sourceKey] ?? ""}
                      invalid={addonInvalid}
                      dirty={addonDirty}
                      onChange={(value) => onAddonPrice(ingredient.sourceKey, value)}
                    />
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <Stat label="Portion cost" value={portionCost == null ? "—" : moneyExact(portionCost)} />
                    <Stat label="Food cost" value={addonPct == null ? "—" : pct(addonPct)} tone={over ? "text-warn" : "text-sage"} />
                    <Stat
                      label="Keeps"
                      value={portionCost == null || addon == null ? "—" : moneyExact(addon - portionCost)}
                    />
                  </div>
                  {unitDirty ? (
                    <p className="mt-2 text-xs text-muted">
                      Saved unit cost {ingredient.costPerUnit == null ? "blank" : moneyExact(ingredient.costPerUnit)}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <h4 className="px-1 text-sm font-semibold">Menu food cost</h4>
      {costedMenu.map((item) => (
        <MenuPriceCard
          key={item.id}
          item={item}
          location={location}
          draft={draft}
          parsed={parsed}
          report={report}
          targetLabel={targetLabel}
          onPrice={onPrice}
        />
      ))}

      {openMenu.length > 0 ? (
        <div className="space-y-3" data-section="workbook-open-recipes">
          <div className="px-1">
            <h4 className="text-sm font-semibold">Named on the sheet, no recipe yet</h4>
            <p className="mt-1 text-xs leading-5 text-muted">
              These names are in the workbook. The recipe rows have an empty ingredient cell, and Menu Summary
              has no typed sell price. A formula that returns $0 is not a price, so food cost stays blank.
            </p>
          </div>
          {openMenu.map((item) => (
            <MenuPriceCard
              key={item.id}
              item={item}
              location={location}
              draft={draft}
              parsed={parsed}
              report={report}
              targetLabel={targetLabel}
              onPrice={onPrice}
            />
          ))}
        </div>
      ) : null}

      {report.plates.length > 0 ? (
        <div className="rounded-2xl border border-line bg-card p-4">
          <h4 className="text-sm font-semibold">Item + protein</h4>
          <p className="mt-1 text-xs text-muted">
            Sell price is the menu price plus the add-on. Cost is the base plus that protein portion.
          </p>
          <ul className="mt-3 divide-y divide-line">
            {report.plates.map((plate) => (
              <li key={plate.label} className="flex items-start justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-semibold">{plate.label}</p>
                  <p className="text-xs text-muted">
                    Sell {moneyExact(plate.sellPrice)} · cost {moneyExact(plate.totalCost)} · profit{" "}
                    {moneyExact(plate.profit)}
                  </p>
                </div>
                <p className={`tabular text-sm font-extrabold ${plate.foodCostPct > location.targetFoodCostPct ? "text-warn" : "text-sage"}`}>
                  {pct(plate.foodCostPct)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <details className="rounded-2xl border border-line bg-card p-4">
        <summary className="min-h-11 cursor-pointer text-sm font-semibold">Other ingredient unit costs</summary>
        <ul className="mt-2 divide-y divide-line">
          {otherIngredients.map((ingredient) => {
            const unit = parsed.costs.get(ingredient.sourceKey);
            const invalid = parsed.invalidKeys.includes(`cost:${ingredient.sourceKey}`);
            const dirty = unit !== undefined && moneyDiffer(unit, ingredient.costPerUnit);
            return (
              <li key={ingredient.sourceKey} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{ingredient.name}</p>
                  <p className="text-xs text-muted">per {ingredient.unit}</p>
                </div>
                <MoneyField
                  id={`${location.locationId}-other-${ingredient.sourceKey}`}
                  label={`${ingredient.name} cost per ${ingredient.unit}`}
                  value={draft.costs[ingredient.sourceKey] ?? ""}
                  invalid={invalid}
                  dirty={dirty}
                  onChange={(value) => onCost(ingredient.sourceKey, value)}
                />
              </li>
            );
          })}
        </ul>
      </details>

      {error ? <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p> : null}
      {justSaved ? <p className="text-sm font-semibold text-sage">Saved to this kitchen’s workbook.</p> : null}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onReset}
          disabled={pending || !workbookDirty}
          className="rounded-full border border-ink bg-card px-3 text-sm font-bold disabled:opacity-50"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={pending || !canSave}
          className="rounded-full bg-chile px-3 text-sm font-bold text-ink disabled:opacity-50"
        >
          {saving ? "Saving…" : `Save ${LOCATIONS[location.locationId].shortName}`}
        </button>
      </div>
      <p className="px-1 text-xs text-muted">
        Save writes {LOCATIONS[location.locationId].shortName} only. Blank cells stay blank.
      </p>
      {location.caveat ? <p className="px-1 text-xs text-muted">{location.caveat}</p> : null}
    </section>
  );
}

function MenuPriceCard({
  item,
  location,
  draft,
  parsed,
  report,
  targetLabel,
  onPrice,
}: {
  item: SimulatorItem;
  location: SimulatorLocation;
  draft: LocationDraft;
  parsed: ParsedDraft;
  report: ReturnType<typeof buildFoodCostReport>;
  targetLabel: string;
  onPrice: (sourceKey: string, value: string) => void;
}) {
  const row = report.menu.find((entry) => entry.sourceKey === item.sourceKey);
  const priceInvalid = parsed.invalidKeys.includes(`price:${item.sourceKey}`);
  const livePrice = parsed.prices.get(item.sourceKey);
  const priceDirty = livePrice !== undefined && moneyDiffer(livePrice ?? null, item.price);
  const over = row?.foodCostPct != null && row.foodCostPct > location.targetFoodCostPct;
  return (
    <article
      data-menu-item={item.name}
      data-costed={item.lines.length > 0 ? "true" : "false"}
      className="rounded-2xl border border-line bg-card p-4"
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{item.category}</p>
      <h5 className="font-display text-lg font-extrabold leading-tight">{item.name}</h5>
      <div className="mt-3">
        <MoneyField
          id={`${location.locationId}-price-${item.sourceKey}`}
          label={`${item.name} selling price`}
          caption="Selling price"
          value={draft.prices[item.sourceKey] ?? ""}
          invalid={priceInvalid}
          dirty={priceDirty}
          onChange={(value) => onPrice(item.sourceKey, value)}
        />
        {priceDirty ? (
          <p className="mt-1 text-xs text-muted">Saved sell {item.price == null ? "blank" : moneyExact(item.price)}</p>
        ) : null}
      </div>
      <div className={`mt-3 rounded-xl px-3 py-3 ${over ? "bg-chile text-ink" : "bg-paper-2"}`} aria-live="polite">
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Recipe cost" value={row?.menuCost == null ? "—" : moneyExact(row.menuCost)} />
          <Stat
            label="Food cost"
            value={row?.foodCostPct == null ? "—" : pct(row.foodCostPct)}
            tone={over ? "text-warn" : "text-sage"}
          />
          <Stat label="Gross profit" value={row?.grossProfit == null ? "—" : moneyExact(row.grossProfit)} />
          <Stat
            label={`Suggest @ ${targetLabel}`}
            value={row?.suggestedPrice == null ? "—" : moneyExact(row.suggestedPrice)}
            emphasis
          />
        </div>
      </div>
      {row && row.lines.length > 0 ? (
        <ul className="mt-3 divide-y divide-line">
          {row.lines.map((line) => (
            <li
              key={`${line.name}-${line.kind}-${line.quantity}`}
              className="flex items-start justify-between gap-3 py-2 text-sm"
            >
              <span>
                {line.name}
                <span className="ml-1 text-xs text-muted">
                  {qtyLabel(line.quantity)} {line.unit}
                </span>
                {line.notes ? <span className="mt-0.5 block text-xs text-muted">{line.notes}</span> : null}
              </span>
              <span className="tabular shrink-0 text-xs font-semibold">
                {line.menuCost == null ? "—" : moneyExact(line.menuCost)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs leading-5 text-muted">
          No ingredient on this recipe row, and no typed sell price. Food cost % stays blank.
        </p>
      )}
    </article>
  );
}

function MoneyField({
  id,
  label,
  caption,
  value,
  invalid,
  dirty,
  onChange,
}: {
  id: string;
  label: string;
  caption?: string;
  value: string;
  invalid: boolean;
  dirty: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="min-w-0">
      {caption ? <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{caption}</p> : null}
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <div
        className={`mt-1 flex items-center rounded-xl border ${
          invalid ? "border-warn bg-warn-soft" : dirty ? "border-ink bg-chile" : "border-line bg-card"
        }`}
      >
        <span className="pl-2 text-sm font-semibold" aria-hidden>
          $
        </span>
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          value={value}
          aria-invalid={invalid}
          onChange={(event) => onChange(event.target.value)}
          className="w-full min-w-0 bg-transparent px-1 text-base font-semibold outline-none"
        />
      </div>
      {invalid ? <p className="mt-1 text-xs text-warn">Enter 0 or more, or leave blank</p> : null}
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "text-ink",
  emphasis = false,
}: {
  label: string;
  value: string;
  tone?: string;
  emphasis?: boolean;
}) {
  return (
    <div className={`rounded-xl px-2 py-2 ${emphasis ? "bg-chile" : "bg-paper-2"}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className={`tabular mt-0.5 text-sm font-semibold ${emphasis ? "text-ink" : tone}`}>{value}</p>
    </div>
  );
}

function qtyLabel(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

type ParsedDraft = {
  edits: FoodCostEdits;
  costs: Map<string, number | null>;
  prices: Map<string, number | null>;
  addonPrices: Map<string, number | null>;
  invalidKeys: string[];
};

function parsedDraft(location: SimulatorLocation, draft: LocationDraft): ParsedDraft {
  const costs = new Map<string, number | null>();
  const prices = new Map<string, number | null>();
  const addonPrices = new Map<string, number | null>();
  const invalidKeys: string[] = [];
  const costEdits: Record<string, number | null> = {};
  const priceEdits: Record<string, number | null> = {};
  const addonEdits: Record<string, number | null> = {};

  for (const ingredient of location.ingredients) {
    const raw = draft.costs[ingredient.sourceKey];
    const parsed = raw === undefined ? ingredient.costPerUnit : parseMoney(raw);
    if (parsed === "invalid") {
      invalidKeys.push(`cost:${ingredient.sourceKey}`);
      costs.set(ingredient.sourceKey, ingredient.costPerUnit);
    } else {
      costs.set(ingredient.sourceKey, parsed);
      costEdits[ingredient.sourceKey] = parsed;
    }
    if (!isProteinAddon(ingredient)) continue;
    const addonRaw = draft.addonPrices[ingredient.sourceKey];
    const addon = addonRaw === undefined ? ingredient.addonPrice : parseMoney(addonRaw);
    if (addon === "invalid") {
      invalidKeys.push(`addon:${ingredient.sourceKey}`);
      addonPrices.set(ingredient.sourceKey, ingredient.addonPrice);
    } else {
      addonPrices.set(ingredient.sourceKey, addon);
      addonEdits[ingredient.sourceKey] = addon;
    }
  }

  for (const item of location.items) {
    const raw = draft.prices[item.sourceKey];
    const parsed = raw === undefined ? item.price : parseMoney(raw);
    if (parsed === "invalid") {
      invalidKeys.push(`price:${item.sourceKey}`);
      prices.set(item.sourceKey, item.price);
    } else {
      prices.set(item.sourceKey, parsed);
      priceEdits[item.sourceKey] = parsed;
    }
  }

  return {
    edits: { costPerUnit: costEdits, prices: priceEdits, addonPrices: addonEdits },
    costs,
    prices,
    addonPrices,
    invalidKeys,
  };
}

function payloadFor(
  location: SimulatorLocation,
  draft: LocationDraft,
):
  | {
      ok: true;
      data: {
        locationId: LocationId;
        ingredients: { id: string; costPerUnit: number | null; addonPrice: number | null }[];
        menuItems: { id: string; price: number | null }[];
      };
    }
  | { ok: false; error: string } {
  const ingredients: { id: string; costPerUnit: number | null; addonPrice: number | null }[] = [];
  for (const ingredient of location.ingredients) {
    const cost = parseMoney(draft.costs[ingredient.sourceKey] ?? "");
    if (cost === "invalid") return { ok: false, error: `Enter a unit cost for ${ingredient.name}, or leave it blank.` };
    let addonPrice = ingredient.addonPrice;
    let addonDirty = false;
    if (isProteinAddon(ingredient)) {
      const addon = parseMoney(draft.addonPrices[ingredient.sourceKey] ?? "");
      if (addon === "invalid") return { ok: false, error: `Enter an add-on price for ${ingredient.name}, or leave it blank.` };
      addonPrice = addon;
      addonDirty = moneyDiffer(addon, ingredient.addonPrice);
    }
    if (!moneyDiffer(cost, ingredient.costPerUnit) && !addonDirty) continue;
    ingredients.push({
      id: ingredient.id,
      costPerUnit: moneyDiffer(cost, ingredient.costPerUnit) ? cost : ingredient.costPerUnit,
      addonPrice,
    });
  }
  const menuItems: { id: string; price: number | null }[] = [];
  for (const item of location.items) {
    const price = parseMoney(draft.prices[item.sourceKey] ?? "");
    if (price === "invalid") return { ok: false, error: `Enter a selling price for ${item.name}, or leave it blank.` };
    if (!moneyDiffer(price, item.price)) continue;
    menuItems.push({ id: item.id, price });
  }
  if (ingredients.length + menuItems.length === 0) {
    return { ok: false, error: "Nothing to save for this kitchen." };
  }
  return { ok: true, data: { locationId: location.locationId, ingredients, menuItems } };
}

function applySaved(
  location: SimulatorLocation,
  data: {
    ingredients: { id: string; costPerUnit: number | null; addonPrice: number | null }[];
    menuItems: { id: string; price: number | null }[];
  },
): SimulatorLocation {
  const costs = new Map(data.ingredients.map((row) => [row.id, row]));
  const prices = new Map(data.menuItems.map((row) => [row.id, row.price]));
  return {
    ...location,
    ingredients: location.ingredients.map((ingredient) => {
      const saved = costs.get(ingredient.id);
      if (!saved) return ingredient;
      return { ...ingredient, costPerUnit: saved.costPerUnit, addonPrice: saved.addonPrice };
    }),
    items: location.items.map((item) => ({
      ...item,
      price: prices.has(item.id) ? (prices.get(item.id) ?? null) : item.price,
    })),
  };
}
