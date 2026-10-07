"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveFoodCostWorkbook } from "@/app/actions/food-cost";
import { LocationDot, Card } from "@/components/ui";
import { moneyExact, pct } from "@/lib/format";
import { LOCATIONS, type LocationId } from "@/lib/location";
import {
  PROTEIN_ADDON_PRICE,
  TARGET_FOOD_COST_PCT,
  costInputValue,
  costsDiffer,
  isProteinIngredient,
  parseCostInput,
  proteinAddonsForLocation,
  quoteSale,
  recipeCost,
  type FoodCostIngredient,
  type FoodCostLocation,
  type FoodCostMenuItem,
} from "@/lib/food-cost";

type LocationDraft = {
  costs: Record<string, string>;
  prices: Record<string, string>;
  addonPrices: Record<string, string>;
};

function draftFrom(location: FoodCostLocation): LocationDraft {
  const addons = proteinAddonsForLocation(location.ingredients, location.items);
  return {
    costs: Object.fromEntries(
      location.ingredients.map((ingredient) => [ingredient.id, costInputValue(ingredient.costPerUnit)]),
    ),
    prices: Object.fromEntries(location.items.map((item) => [item.id, costInputValue(item.price)])),
    addonPrices: Object.fromEntries(
      addons.map((addon) => [addon.ingredientId, costInputValue(PROTEIN_ADDON_PRICE)]),
    ),
  };
}

function draftsFrom(locations: FoodCostLocation[]): Record<string, LocationDraft> {
  return Object.fromEntries(locations.map((location) => [location.locationId, draftFrom(location)]));
}

export function FoodCostSimulator({ locations }: { locations: FoodCostLocation[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(locations);
  const [drafts, setDrafts] = useState(() => draftsFrom(locations));
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [justSaved, setJustSaved] = useState<LocationId | null>(null);
  const [savingId, setSavingId] = useState<LocationId | null>(null);

  function updateDraft(locationId: LocationId, patch: (draft: LocationDraft) => LocationDraft) {
    setJustSaved((current) => (current === locationId ? null : current));
    setDrafts((current) => {
      const draft = current[locationId] ?? draftFrom(savedLocation(saved, locationId));
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
      const nextSaved = applySaved(location, payload.data);
      setSaved((current) => current.map((entry) => (entry.locationId === locationId ? nextSaved : entry)));
      setErrors((current) => ({ ...current, [locationId]: null }));
      setJustSaved(locationId);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <Card className="bg-chile">
        <h2 className="text-base font-extrabold">Cost simulator</h2>
        <p className="mt-1 text-sm leading-5">
          Change a unit cost or a selling price and the recipe cost, food cost %, profit, and 30%
          price update here. Nothing is written until you tap Save on that kitchen.
        </p>
        {locations.length > 1 ? (
          <p className="mt-2 text-sm leading-5">
            Glendale and Avondale stay separate. A what-if in one kitchen does not change the other.
          </p>
        ) : null}
      </Card>

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
            onCost={(id, value) =>
              updateDraft(location.locationId, (current) => ({
                ...current,
                costs: { ...current.costs, [id]: value },
              }))
            }
            onPrice={(id, value) =>
              updateDraft(location.locationId, (current) => ({
                ...current,
                prices: { ...current.prices, [id]: value },
              }))
            }
            onAddonPrice={(id, value) =>
              updateDraft(location.locationId, (current) => ({
                ...current,
                addonPrices: { ...current.addonPrices, [id]: value },
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

function savedLocation(locations: FoodCostLocation[], locationId: LocationId): FoodCostLocation {
  return (
    locations.find((location) => location.locationId === locationId) ?? {
      locationId,
      ingredients: [],
      items: [],
    }
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
  location: FoodCostLocation;
  draft: LocationDraft;
  pending: boolean;
  saving: boolean;
  error: string | null;
  justSaved: boolean;
  onCost: (id: string, value: string) => void;
  onPrice: (id: string, value: string) => void;
  onAddonPrice: (id: string, value: string) => void;
  onReset: () => void;
  onSave: () => void;
}) {
  const parsed = parsedKitchen(location, draft);
  const name = LOCATIONS[location.locationId].name;
  const dirtyCosts = location.ingredients.filter((ingredient) => {
    const value = parsed.costs.get(ingredient.id);
    return value !== undefined && costsDiffer(value, ingredient.costPerUnit);
  });
  const dirtyPrices = location.items.filter((item) => {
    const value = parsed.prices.get(item.id);
    return value !== undefined && costsDiffer(value, item.price);
  });
  const addonPriceDirty = parsed.addons.some((addon) => {
    const value = parsed.addonPrices.get(addon.ingredientId);
    return value !== undefined && costsDiffer(value, PROTEIN_ADDON_PRICE);
  });
  const workbookDirty = dirtyCosts.length + dirtyPrices.length > 0;
  const canSave = workbookDirty && parsed.invalidCostIds.length === 0 && parsed.invalidPriceIds.length === 0;

  return (
    <section className="space-y-3" data-location={location.locationId} aria-label={name}>
      <h3 className="flex items-center gap-2 px-1 text-sm font-semibold">
        <LocationDot id={location.locationId} />
        <span className="sr-only">{name}</span>
      </h3>

      {location.ingredients.length === 0 && location.items.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">No recipe workbook for this kitchen yet.</p>
        </Card>
      ) : (
        <>
          <Card>
            <h4 className="text-sm font-semibold">Ingredient unit costs</h4>
            <p className="mt-1 text-xs text-muted">Proteins are listed first. Cost is per unit.</p>
            <ul className="mt-2 divide-y divide-line">
              {location.ingredients.map((ingredient) => {
                const value = draft.costs[ingredient.id] ?? "";
                const invalid = parsed.invalidCostIds.includes(ingredient.id);
                const dirty =
                  !invalid &&
                  parsed.costs.get(ingredient.id) !== undefined &&
                  costsDiffer(parsed.costs.get(ingredient.id) ?? ingredient.costPerUnit, ingredient.costPerUnit);
                return (
                  <li key={ingredient.id} className="py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{ingredient.name}</p>
                        <p className="text-xs text-muted">
                          {isProteinIngredient(ingredient.name) ? "Protein · " : ""}per {ingredient.unit}
                        </p>
                      </div>
                      <MoneyField
                        id={`${location.locationId}-cost-${ingredient.id}`}
                        label={`${ingredient.name} cost per ${ingredient.unit}`}
                        value={value}
                        invalid={invalid}
                        dirty={dirty}
                        onChange={(next) => onCost(ingredient.id, next)}
                      />
                    </div>
                    {invalid ? (
                      <p className="mt-1 text-right text-xs text-warn">Enter 0 or more</p>
                    ) : null}
                    {dirty ? (
                      <p className="mt-1 text-right text-xs text-muted">
                        Saved {moneyExact(ingredient.costPerUnit)}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </Card>

          <h4 className="px-1 text-sm font-semibold">Menu prices</h4>
          {location.items.map((item) => (
            <MenuQuote
              key={item.id}
              locationId={location.locationId}
              item={item}
              priceRaw={draft.prices[item.id] ?? ""}
              invalidPrice={parsed.invalidPriceIds.includes(item.id)}
              livePrice={parsed.prices.get(item.id) ?? null}
              liveCost={itemCost(item, parsed)}
              savedCost={recipeCost(item.lines, savedCostMap(location.ingredients))}
              costs={parsed.costs}
              invalidCostIds={parsed.invalidCostIds}
              onPrice={(value) => onPrice(item.id, value)}
            />
          ))}

          <Card>
            <h4 className="text-sm font-semibold">Protein add-ons</h4>
            <p className="mt-1 text-xs leading-5 text-muted">
              Same portion as the plate. The add-on cost follows that protein. The selling price
              here is a what-if and is not saved.
            </p>
            <ul className="mt-3 space-y-3">
              {parsed.addons.map((addon) => {
                const priceRaw = draft.addonPrices[addon.ingredientId] ?? "";
                const invalidPrice = parsed.invalidAddonIds.includes(addon.ingredientId);
                const livePrice = parsed.addonPrices.get(addon.ingredientId) ?? null;
                const proteinDirty = dirtyCosts.some((ingredient) => ingredient.id === addon.ingredientId);
                const quote =
                  livePrice === null || parsed.invalidCostIds.includes(addon.ingredientId)
                    ? null
                    : quoteSale(addon.recipeCost, livePrice);
                return (
                  <li
                    key={addon.ingredientId}
                    data-protein-addon={addon.ingredientName}
                    className={`rounded-xl border p-3 ${proteinDirty ? "border-ink bg-chile" : "border-line bg-paper-2"}`}
                  >
                    <p className="text-sm font-semibold">{addon.label}</p>
                    <p className="text-xs text-muted">
                      {formatQty(addon.portionQty)} {addon.unit} · portion from {addon.portionFromRecipe}
                    </p>
                    <div className="mt-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                        Selling price
                      </p>
                      <MoneyField
                        id={`${location.locationId}-addon-${addon.ingredientId}`}
                        label={`${addon.label} selling price`}
                        value={priceRaw}
                        invalid={invalidPrice}
                        dirty={
                          !invalidPrice && livePrice !== null && costsDiffer(livePrice, PROTEIN_ADDON_PRICE)
                        }
                        wide
                        onChange={(next) => onAddonPrice(addon.ingredientId, next)}
                      />
                    </div>
                    <QuoteGrid
                      quote={quote}
                      savedHint={
                        proteinDirty ? `Saved add-on cost ${moneyExact(savedAddonCost(location, addon.ingredientId))}` : null
                      }
                    />
                  </li>
                );
              })}
            </ul>
          </Card>

          {error ? <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p> : null}
          {justSaved ? <p className="text-sm font-semibold text-sage">Saved to this kitchen’s workbook.</p> : null}
          {addonPriceDirty && !workbookDirty ? (
            <p className="text-xs text-muted">Add-on selling prices stay on this screen. Save stores ingredient costs and menu prices.</p>
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onReset}
              disabled={pending || (!workbookDirty && !addonPriceDirty)}
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
            Save writes {LOCATIONS[location.locationId].shortName} only. Suggested price = recipe cost ÷{" "}
            {pct(TARGET_FOOD_COST_PCT, 0)}.
          </p>
        </>
      )}
    </section>
  );
}

function MenuQuote({
  locationId,
  item,
  priceRaw,
  invalidPrice,
  livePrice,
  liveCost,
  savedCost,
  costs,
  invalidCostIds,
  onPrice,
}: {
  locationId: LocationId;
  item: FoodCostMenuItem;
  priceRaw: string;
  invalidPrice: boolean;
  livePrice: number | null;
  liveCost: number | null;
  savedCost: number;
  costs: Map<string, number>;
  invalidCostIds: string[];
  onPrice: (value: string) => void;
}) {
  const quote = liveCost === null || livePrice === null ? null : quoteSale(liveCost, livePrice);
  const priceDirty = livePrice !== null && costsDiffer(livePrice, item.price);
  const costDirty = liveCost !== null && costsDiffer(liveCost, savedCost);

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">{item.name}</p>
          <p className="text-xs text-muted">{item.category}</p>
        </div>
      </div>
      <div className="mt-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Selling price</p>
        <MoneyField
          id={`${locationId}-price-${item.id}`}
          label={`${item.name} selling price`}
          value={priceRaw}
          invalid={invalidPrice}
          dirty={priceDirty}
          wide
          onChange={onPrice}
        />
        {priceDirty ? (
          <p className="mt-1 text-xs text-muted">Saved sell {moneyExact(item.price)}</p>
        ) : null}
      </div>
      <QuoteGrid quote={quote} savedHint={costDirty ? `Saved recipe ${moneyExact(savedCost)}` : null} />
      <details className="mt-2">
        <summary className="min-h-11 cursor-pointer py-2 text-xs font-semibold text-muted">
          Recipe ingredients
        </summary>
        <ul className="space-y-1 pb-1 text-sm">
          {item.lines.map((line) => {
            const unitCost = costs.get(line.ingredientId);
            const lineInvalid = invalidCostIds.includes(line.ingredientId) || unitCost === undefined;
            return (
              <li key={line.ingredientId} className="flex justify-between gap-3 text-muted">
                <span>
                  {line.name}
                  <span className="ml-1 text-xs">
                    {formatQty(line.quantity)} {line.unit}
                  </span>
                </span>
                <span className="tabular">{lineInvalid ? "—" : moneyExact(line.quantity * unitCost)}</span>
              </li>
            );
          })}
        </ul>
      </details>
    </Card>
  );
}

function QuoteGrid({ quote, savedHint }: { quote: ReturnType<typeof quoteSale> | null; savedHint: string | null }) {
  const foodTone =
    quote?.foodCostPct == null ? "text-muted" : quote.foodCostPct > TARGET_FOOD_COST_PCT ? "text-warn" : "text-sage";
  return (
    <div className="mt-3" aria-live="polite">
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Recipe cost" value={quote ? moneyExact(quote.recipeCost) : "—"} />
        <Stat label="Food cost" value={quote?.foodCostPct == null ? "—" : pct(quote.foodCostPct)} tone={foodTone} />
        <Stat label="Gross profit" value={quote ? moneyExact(quote.grossProfit) : "—"} />
        <Stat label="Suggest @ 30%" value={quote ? moneyExact(quote.suggestedPrice) : "—"} emphasis />
      </div>
      {savedHint ? <p className="mt-2 text-xs text-muted">{savedHint}</p> : null}
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
    <div className={`rounded-xl px-2.5 py-2 ${emphasis ? "bg-chile" : "bg-paper-2"}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className={`tabular mt-0.5 text-base font-bold ${emphasis ? "text-ink" : tone}`}>{value}</p>
    </div>
  );
}

function MoneyField({
  id,
  label,
  value,
  invalid,
  dirty,
  wide = false,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  invalid: boolean;
  dirty: boolean;
  wide?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className={wide ? "mt-1 w-full" : "w-28 shrink-0"}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <div
        className={`flex items-center rounded-xl border ${
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
    </div>
  );
}

type ParsedKitchen = {
  costs: Map<string, number>;
  prices: Map<string, number>;
  addonPrices: Map<string, number>;
  invalidCostIds: string[];
  invalidPriceIds: string[];
  invalidAddonIds: string[];
  addons: ReturnType<typeof proteinAddonsForLocation>;
};

function parsedKitchen(location: FoodCostLocation, draft: LocationDraft): ParsedKitchen {
  const costs = new Map<string, number>();
  const invalidCostIds: string[] = [];
  for (const ingredient of location.ingredients) {
    const raw = draft.costs[ingredient.id];
    const parsed = raw === undefined ? ingredient.costPerUnit : parseCostInput(raw);
    if (parsed === null) invalidCostIds.push(ingredient.id);
    else costs.set(ingredient.id, parsed);
  }

  const prices = new Map<string, number>();
  const invalidPriceIds: string[] = [];
  for (const item of location.items) {
    const raw = draft.prices[item.id];
    const parsed = raw === undefined ? item.price : parseCostInput(raw);
    if (parsed === null) invalidPriceIds.push(item.id);
    else prices.set(item.id, parsed);
  }

  const pricedIngredients = location.ingredients.map((ingredient) => ({
    ...ingredient,
    costPerUnit: costs.get(ingredient.id) ?? ingredient.costPerUnit,
  }));
  const addons = proteinAddonsForLocation(pricedIngredients, location.items).map((addon) => ({
    ...addon,
    costPerUnit: costs.get(addon.ingredientId) ?? addon.costPerUnit,
    recipeCost:
      addon.portionQty * (costs.get(addon.ingredientId) ?? addon.costPerUnit),
  }));

  const addonPrices = new Map<string, number>();
  const invalidAddonIds: string[] = [];
  for (const addon of addons) {
    const raw = draft.addonPrices[addon.ingredientId];
    const parsed = raw === undefined ? PROTEIN_ADDON_PRICE : parseCostInput(raw);
    if (parsed === null) invalidAddonIds.push(addon.ingredientId);
    else addonPrices.set(addon.ingredientId, parsed);
  }

  return { costs, prices, addonPrices, invalidCostIds, invalidPriceIds, invalidAddonIds, addons };
}

function itemCost(item: FoodCostMenuItem, parsed: ParsedKitchen): number | null {
  if (item.lines.some((line) => parsed.invalidCostIds.includes(line.ingredientId) || !parsed.costs.has(line.ingredientId))) {
    return null;
  }
  return recipeCost(item.lines, parsed.costs);
}

function savedCostMap(ingredients: FoodCostIngredient[]) {
  return new Map(ingredients.map((ingredient) => [ingredient.id, ingredient.costPerUnit]));
}

function savedAddonCost(location: FoodCostLocation, ingredientId: string): number {
  const addon = proteinAddonsForLocation(location.ingredients, location.items).find(
    (entry) => entry.ingredientId === ingredientId,
  );
  return addon?.recipeCost ?? 0;
}

function payloadFor(
  location: FoodCostLocation,
  draft: LocationDraft,
):
  | {
      ok: true;
      data: {
        locationId: LocationId;
        ingredients: { id: string; costPerUnit: number }[];
        menuItems: { id: string; price: number }[];
      };
    }
  | { ok: false; error: string } {
  const ingredients: { id: string; costPerUnit: number }[] = [];
  for (const ingredient of location.ingredients) {
    const parsed = parseCostInput(draft.costs[ingredient.id] ?? "");
    if (parsed === null) return { ok: false, error: `Enter a cost for ${ingredient.name}.` };
    ingredients.push({ id: ingredient.id, costPerUnit: parsed });
  }
  const menuItems: { id: string; price: number }[] = [];
  for (const item of location.items) {
    const parsed = parseCostInput(draft.prices[item.id] ?? "");
    if (parsed === null) return { ok: false, error: `Enter a selling price for ${item.name}.` };
    menuItems.push({ id: item.id, price: parsed });
  }
  if (ingredients.length + menuItems.length === 0) {
    return { ok: false, error: "Nothing to save for this kitchen." };
  }
  return { ok: true, data: { locationId: location.locationId, ingredients, menuItems } };
}

function applySaved(
  location: FoodCostLocation,
  data: {
    ingredients: { id: string; costPerUnit: number }[];
    menuItems: { id: string; price: number }[];
  },
): FoodCostLocation {
  const costs = new Map(data.ingredients.map((row) => [row.id, row.costPerUnit]));
  const prices = new Map(data.menuItems.map((row) => [row.id, row.price]));
  return {
    ...location,
    ingredients: location.ingredients.map((ingredient) => ({
      ...ingredient,
      costPerUnit: costs.get(ingredient.id) ?? ingredient.costPerUnit,
    })),
    items: location.items.map((item) => ({
      ...item,
      price: prices.get(item.id) ?? item.price,
    })),
  };
}

function formatQty(quantity: number): string {
  return String(Math.round(quantity * 1000) / 1000);
}
