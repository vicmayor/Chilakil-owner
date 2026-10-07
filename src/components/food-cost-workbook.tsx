import { moneyExact, pct } from "@/lib/format";
import type { FoodCostReport, MenuCostReport, ReportLine } from "@/lib/food-cost";
import { LocationDot } from "@/components/ui";

function moneyOrDash(amount: number | null): string {
  return amount == null ? "—" : moneyExact(amount);
}

function qtyLabel(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

function purchaseLabel(row: FoodCostReport["priceList"][number]): string {
  const pack = row.purchaseQty == null ? row.unit : `${qtyLabel(row.purchaseQty)} ${row.unit}`;
  if (row.purchaseCost == null || row.costPerUnit == null) return `${pack} · price not entered`;
  return `${pack} · ${moneyExact(row.purchaseCost)} · ${moneyExact(row.costPerUnit)}/${row.unit}`;
}

function lineCostLabel(line: ReportLine): string {
  if (line.menuCost == null) return "—";
  if (line.catalogCost != null && Math.abs(line.menuCost - line.catalogCost) > 0.005) {
    return `${moneyExact(line.menuCost)} on the recipe · list ${moneyExact(line.catalogCost)}`;
  }
  return moneyExact(line.menuCost);
}

export function FoodCostWorkbook({
  locationIds,
  report,
}: {
  locationIds: string[];
  report: FoodCostReport;
}) {
  const costed = report.menu.filter((item) => item.costed && item.price != null);
  const openItems = report.menu.filter((item) => !item.costed || item.price == null);
  const targetLabel = pct(report.targetFoodCostPct, 0);

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-ink bg-chile px-4 py-4 text-ink">
        <div className="flex flex-wrap gap-2">
          {locationIds.map((id) => (
            <LocationDot key={id} id={id} />
          ))}
        </div>
        <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide">Target food cost</p>
        <p className="font-display text-4xl font-extrabold tabular leading-none">{targetLabel}</p>
        <p className="mt-2 text-sm">
          {locationIds.length > 1
            ? "Both kitchens use this workbook. Suggested price is recipe cost divided by the target."
            : "Suggested price is recipe cost divided by the target."}
        </p>
      </div>

      {report.missingPrices.length > 0 ? (
        <div className="rounded-2xl border border-line bg-card p-4">
          <h2 className="text-sm font-semibold">Prices still blank</h2>
          <p className="mt-1 text-xs text-muted">
            {report.missingPrices.length} ingredient {report.missingPrices.length === 1 ? "row has" : "rows have"} no
            purchase cost. Those stay blank.
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {report.missingPrices.map((row) => (
              <li
                key={`${row.name}-${row.unit}-${row.purchaseQty ?? "x"}`}
                className="rounded-full bg-chile px-2.5 py-1 text-xs font-semibold text-ink"
              >
                {row.name}
                <span className="font-medium"> · {row.purchaseQty ?? "—"} {row.unit}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="space-y-3">
        <h2 className="px-1 text-sm font-semibold">Menu food cost</h2>
        {costed.map((item) => (
          <MenuCard key={item.sourceKey} item={item} target={report.targetFoodCostPct} toppings={report.toppings} />
        ))}
      </div>

      {report.proteins.length > 0 ? (
        <div className="rounded-2xl border border-line bg-card p-4">
          <h2 className="text-sm font-semibold">Protein add-ons</h2>
          <p className="mt-1 text-xs text-muted">4 oz portion. Add-on food cost is portion cost divided by the add-on price.</p>
          <ul className="mt-3 divide-y divide-line">
            {report.proteins.map((protein) => {
              const over = protein.addonCostPct != null && protein.addonCostPct > report.targetFoodCostPct;
              return (
                <li key={protein.name} className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{protein.name}</p>
                      <p className="text-xs text-muted">
                        {qtyLabel(protein.portionQty)} oz
                        {protein.costPerLb != null ? ` · ${moneyExact(protein.costPerLb)}/lb` : ""}
                      </p>
                    </div>
                    <p className={`tabular text-sm font-extrabold ${over ? "text-ink" : "text-sage"}`}>
                      {protein.addonCostPct == null ? "—" : pct(protein.addonCostPct)}
                    </p>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                    <Stat label="Portion" value={moneyOrDash(protein.portionCost)} />
                    <Stat label="Add-on" value={moneyExact(protein.addonPrice)} />
                    <Stat label="Keeps" value={moneyOrDash(protein.contribution)} />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {report.plates.length > 0 ? (
        <div className="rounded-2xl border border-line bg-card p-4">
          <h2 className="text-sm font-semibold">Item + protein</h2>
          <p className="mt-1 text-xs text-muted">
            Sell price is the menu price plus the add-on. Cost is the onion-and-cilantro base plus that protein.
          </p>
          <ul className="mt-3 divide-y divide-line">
            {report.plates.map((plate) => {
              const over = plate.foodCostPct > report.targetFoodCostPct;
              return (
                <li key={plate.label} className="flex items-start justify-between gap-3 py-3">
                  <div>
                    <p className="text-sm font-semibold">{plate.label}</p>
                    <p className="text-xs text-muted">
                      Sell {moneyExact(plate.sellPrice)} · cost {moneyExact(plate.totalCost)} · profit{" "}
                      {moneyExact(plate.profit)}
                    </p>
                  </div>
                  <p className={`tabular text-sm font-extrabold ${over ? "" : "text-sage"}`}>{pct(plate.foodCostPct)}</p>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {openItems.length > 0 ? (
        <div className="rounded-2xl border border-line bg-card p-4">
          <h2 className="text-sm font-semibold">Not costed yet</h2>
          <ul className="mt-2 divide-y divide-line">
            {openItems.map((item) => (
              <li key={item.sourceKey} className="flex items-center justify-between py-2.5 text-sm">
                <span>{item.name}</span>
                <span className="text-xs font-semibold uppercase tracking-wide text-muted">Open</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="rounded-2xl border border-line bg-card p-4">
        <h2 className="text-sm font-semibold">Ingredient prices</h2>
        <ul className="mt-2 divide-y divide-line">
          {report.priceList.map((row, index) => (
            <li key={`${row.name}-${row.unit}-${index}`} className="py-2.5">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium">{row.name}</p>
                <p className="tabular text-sm font-semibold">{moneyOrDash(row.costPerUnit)}</p>
              </div>
              <p className="text-xs text-muted">
                {row.vendor ? `${row.vendor} · ` : ""}
                {purchaseLabel(row)}
                {row.addonPrice != null ? ` · add-on ${moneyExact(row.addonPrice)}` : ""}
              </p>
              {row.notes ? <p className="mt-0.5 text-xs text-muted">{row.notes}</p> : null}
            </li>
          ))}
        </ul>
      </div>

      {report.caveat ? <p className="px-1 text-xs text-muted">{report.caveat}</p> : null}
    </section>
  );
}

function MenuCard({
  item,
  target,
  toppings,
}: {
  item: MenuCostReport;
  target: number;
  toppings: FoodCostReport["toppings"];
}) {
  const over = item.foodCostPct != null && item.foodCostPct > target;
  return (
    <article className="rounded-2xl border border-line bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{item.category}</p>
          <h3 className="font-display text-lg font-extrabold leading-tight">{item.name}</h3>
        </div>
        <p className="tabular text-lg font-extrabold">{moneyOrDash(item.price)}</p>
      </div>
      <div className={`mt-3 rounded-xl px-3 py-3 ${over ? "bg-chile text-ink" : "bg-sage-soft text-ink"}`}>
        <p className="text-[11px] font-semibold uppercase tracking-wide">{over ? "Above target" : "Within target"}</p>
        <p className="font-display text-3xl font-extrabold tabular leading-none">
          {item.foodCostPct == null ? "—" : pct(item.foodCostPct)}
        </p>
        <p className="mt-1 text-xs">
          Recipe {moneyOrDash(item.menuCost)}
          {item.grossProfit != null ? ` · profit ${moneyExact(item.grossProfit)}` : ""}
          {item.suggestedPrice != null ? ` · suggested ${moneyExact(item.suggestedPrice)}` : ""}
        </p>
      </div>
      <ul className="mt-3 divide-y divide-line">
        {item.lines.map((line) => (
          <li key={`${line.name}-${line.quantity}-${line.kind}`} className="flex items-start justify-between gap-3 py-2 text-sm">
            <span>
              {line.name}
              <span className="ml-1 text-xs text-muted">
                {qtyLabel(line.quantity)} {line.unit}
              </span>
              {line.notes ? <span className="mt-0.5 block text-xs text-muted">{line.notes}</span> : null}
            </span>
            <span className="tabular shrink-0 text-right text-xs font-semibold">{lineCostLabel(line)}</span>
          </li>
        ))}
      </ul>
      {item.baseCost != null &&
      (item.standardToppings ||
        (item.menuCost != null && Math.abs(item.baseCost - item.menuCost) > 0.005)) ? (
        <div className="mt-3 rounded-xl bg-paper-2 px-3 py-2 text-sm">
          <p>
            Base without protein <span className="tabular font-semibold">{moneyExact(item.baseCost)}</span>
          </p>
          {item.standardToppings && item.baseWithToppings != null ? (
            <p className="mt-1">
              With {toppings.map((topping) => topping.name.toLowerCase()).join(" and ") || "onion and cilantro"}{" "}
              <span className="tabular font-semibold">{moneyExact(item.baseWithToppings)}</span>
              {item.baseWithToppingsPct != null ? (
                <span className="text-muted"> · {pct(item.baseWithToppingsPct)} of the sell price</span>
              ) : null}
            </p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-paper-2 px-2 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="tabular mt-0.5 text-sm font-semibold">{value}</p>
    </div>
  );
}
