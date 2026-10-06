/**
 * October 6, 2026 DoorDash vs in-store pricing reports.
 * Every figure is transcribed from the location PDFs. Glendale and Avondale
 * are separate reports and must never be merged.
 */

export type PricingLineStatus = "losing" | "ok" | "review" | "not_on_menu";
export type PricingLineKind = "item" | "addon";
export type PricingNoteKind = "check" | "commission" | "exclusion" | "info";

export type PricingLineInput = {
  kind: PricingLineKind;
  name: string;
  inStorePrice: number;
  doorDashPrice: number | null;
  onDoorDash: boolean;
  markupPct: number | null;
  keepNow: number | null;
  vsInStore: number | null;
  breakEvenPrice: number | null;
  recommendedPrice: number | null;
  changeNeeded: number | null;
  keepRecommended: number | null;
  status: PricingLineStatus;
  footnote: string | null;
  squareSold30d: number | null;
};

export type PricingNoteInput = {
  kind: PricingNoteKind;
  body: string;
};

export type PricingReportInput = {
  locationId: "glendale" | "avondale";
  reportDate: string;
  doorDashStoreId: string;
  title: string;
  headline: string;
  summary: string;
  commissionRate: number;
  commissionNote: string;
  exclusionNote: string;
  methodNote: string;
  addonNote: string | null;
  addonNoteTone: "review" | "info" | null;
  popularityLead: string;
  tenOrderExample: string;
  pdfPath: string;
  lines: PricingLineInput[];
  notes: PricingNoteInput[];
};

const METHOD_NOTE =
  "vs in-store = what you keep after 30% minus the in-store price. Break-even = in-store price divided by 0.70. Recommended = break-even rounded up to the next $X.49 or $X.99. Prices are the base item only; add-ons are separate.";

const EXCLUSION_NOTE =
  "Not true profit: food cost is not included. These numbers compare what you keep with an in-store sale. Card fees and tax are also excluded.";

const MENU_PRICING_NOTE =
  'DoorDash "Menu pricing" page shows no in-store menu uploaded and current markup "--" (its per-item "in-store" fields just repeat the DoorDash prices, e.g. Chilaquiles $15, not the $12 Square price). DoorDash may offer a 0% markup program; we previously advised against accepting 0% markup because of the ~30% commission.';

const SQUARE_WINDOW_NOTE =
  "In-store prices come from actual Square sales Sep 6 – Oct 6, 2026 (the Square catalog wasn't readable). Any item that didn't sell in that window isn't shown.";

const DEMAND_NOTE =
  "Customers may order less at a higher price. Consider phasing increases on the top sellers (e.g. Chilaquiles) and watching DoorDash order counts for 2–4 weeks.";

function item(
  name: string,
  inStorePrice: number,
  doorDashPrice: number,
  markupPct: number,
  keepNow: number,
  vsInStore: number,
  breakEvenPrice: number,
  recommendedPrice: number,
  changeNeeded: number,
  keepRecommended: number,
  status: PricingLineStatus,
  extra: { footnote?: string; squareSold30d?: number } = {},
): PricingLineInput {
  return {
    kind: "item",
    name,
    inStorePrice,
    doorDashPrice,
    onDoorDash: true,
    markupPct,
    keepNow,
    vsInStore,
    breakEvenPrice,
    recommendedPrice,
    changeNeeded,
    keepRecommended,
    status,
    footnote: extra.footnote ?? null,
    squareSold30d: extra.squareSold30d ?? null,
  };
}

function addon(
  name: string,
  inStorePrice: number,
  doorDashPrice: number | null,
  markupPct: number | null,
  keepNow: number | null,
  vsInStore: number | null,
  breakEvenPrice: number | null,
  recommendedPrice: number | null,
  changeNeeded: number | null,
  keepRecommended: number | null,
  status: PricingLineStatus,
): PricingLineInput {
  return {
    kind: "addon",
    name,
    inStorePrice,
    doorDashPrice,
    onDoorDash: doorDashPrice !== null,
    markupPct,
    keepNow,
    vsInStore,
    breakEvenPrice,
    recommendedPrice,
    changeNeeded,
    keepRecommended,
    status,
    footnote: null,
    squareSold30d: null,
  };
}

const PROTEIN_3 = addon(
  "Carne Asada, Al Pastor, Chicken",
  3,
  3,
  0,
  2.1,
  -0.9,
  4.29,
  4.49,
  1.49,
  3.14,
  "losing",
);

const SHRIMP = addon("Shrimp", 4, 4, 0, 2.8, -1.2, 5.71, 5.99, 1.99, 4.19, "losing");

const CHORIZO_EGGS = addon(
  "Chorizo, Beans, 2 Eggs (fried/scrambled)",
  2,
  2,
  0,
  1.4,
  -0.6,
  2.86,
  2.99,
  0.99,
  2.09,
  "losing",
);

const ONE_EGG = addon(
  "1 Egg (fried/scrambled)",
  1,
  1,
  0,
  0.7,
  -0.3,
  1.43,
  1.49,
  0.49,
  1.04,
  "losing",
);

export const DOORDASH_PRICING_REPORTS: PricingReportInput[] = [
  {
    locationId: "glendale",
    reportDate: "2026-10-06",
    doorDashStoreId: "32669627",
    title: "Chilakil To Go – Glendale Restaurant – DoorDash vs In-Store Pricing",
    headline:
      "9 of 10 items keep less than in-store after ~30% commission, plus 1 needs review.",
    summary:
      "Right now, 9 of your 10 DoorDash items leave you with less money than selling the same item in-store, after DoorDash's ~30% commission; the 10th (OG Breakfast Burrito) also loses money but needs a quick check on which in-store item it matches. The biggest gap is the Chilakil Burrito: same $12.00 price on both, so you keep only $8.40 per DoorDash sale (-$3.60 vs in-store). Your #1 item, Chilaquiles, keeps $10.50 vs $12.00 in-store (-$1.50 each). The recommended prices below bring every item back to at least what you'd get at the counter.",
    commissionRate: 0.3,
    commissionNote:
      "Commission: Glendale's actual commission measured earlier was about 29.4% on delivery, plus 6% on pickup orders. This report uses 30% for simplicity.",
    exclusionNote: EXCLUSION_NOTE,
    methodNote: METHOD_NOTE,
    addonNote:
      'On DoorDash the Chilakil Concha "Keto Proteins" list shows Chorizo, Chicken and 1 egg as free and 2 eggs as +$1 (Asada/Al Pastor +$3, Beans +$2, Shrimp +$4). In-store, a few one-off charges differed (Asada/Al Pastor $2 on Keto Chilaquiles, 2 Fried Eggs $3 on Torta, Asada $0 on Concha). NEEDS REVIEW before changing those lists.',
    addonNoteTone: "review",
    popularityLead:
      "Chilaquiles is your #1 item – 547 sold in-store in the last 30 days. Next among items also on DoorDash: Chilakil Burrito 48, OG Breakfast Burrito 47, Morning Breakfast Box | Kids Menu 26, Mini Chilaquiles Box | Kids Menu 23. These are in-store counts, shown only to tell you which items matter most; DoorDash item counts were not available, so no monthly or yearly loss is estimated.",
    tenOrderExample:
      "Every 10 DoorDash Chilaquiles orders at the current price = $15.00 less than 10 in-store sales (10 × $10.50 kept vs 10 × $12.00; base price only, before add-ons).",
    pdfPath: "/reports/glendale-doordash-pricing-2026-10-06.pdf",
    lines: [
      item("Chilaquiles", 12, 15, 25, 10.5, -1.5, 17.14, 17.49, 2.49, 12.24, "losing", {
        squareSold30d: 547,
      }),
      item("Chialkil Concha", 10, 12, 20, 8.4, -1.6, 14.29, 14.49, 2.49, 10.14, "losing"),
      item("Keto Chilaquiles", 12, 14, 17, 9.8, -2.2, 17.14, 17.49, 3.49, 12.24, "losing"),
      item("Chilakil Burrito", 12, 12, 0, 8.4, -3.6, 17.14, 17.49, 5.49, 12.24, "losing", {
        squareSold30d: 48,
      }),
      item(
        "Morning Breakfast Box | Kids Menu",
        8,
        10,
        25,
        7,
        -1,
        11.43,
        11.49,
        1.49,
        8.04,
        "losing",
        { squareSold30d: 26 },
      ),
      item("Chorizo Combo Box | Kids Menu", 8, 10, 25, 7, -1, 11.43, 11.49, 1.49, 8.04, "losing"),
      item(
        "Mini Chilaquiles Box | Kids Menu",
        8,
        10,
        25,
        7,
        -1,
        11.43,
        11.49,
        1.49,
        8.04,
        "losing",
        { squareSold30d: 23 },
      ),
      item("Churro", 2.5, 2.5, 0, 1.75, -0.75, 3.57, 3.99, 1.49, 2.79, "losing"),
      item("Chilakil Torta", 9, 10, 11, 7, -2, 12.86, 12.99, 2.99, 9.09, "losing"),
      item(
        "OG Breakfast Burrito",
        11,
        14.99,
        36,
        10.49,
        -0.51,
        15.71,
        15.99,
        1,
        11.19,
        "review",
        {
          squareSold30d: 47,
          footnote:
            "DD $14.99 equals the in-store OG Breakfast Burrito COMBO price ($14.99). If DD item = combo, break-even is $21.41 (rec. $21.49).",
        },
      ),
      PROTEIN_3,
      SHRIMP,
      addon(
        "Trio Meat (Asada, Al Pastor & Chorizo)",
        4,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        "not_on_menu",
      ),
      CHORIZO_EGGS,
      ONE_EGG,
    ],
    notes: [
      { kind: "check", body: MENU_PRICING_NOTE },
      {
        kind: "commission",
        body: "Commission: Glendale's actual commission measured earlier was about 29.4% on delivery, plus 6% on pickup orders. This report uses 30% for simplicity.",
      },
      { kind: "exclusion", body: EXCLUSION_NOTE },
      { kind: "info", body: SQUARE_WINDOW_NOTE },
      {
        kind: "info",
        body: "Gansito changed from $2 to $1 in-store (Square shows $2 only on Sep 6–8 sales); $1 is used. Gansito is not on the DoorDash menu.",
      },
      {
        kind: "info",
        body: "Sold in-store but not on DoorDash: Agua Fresca | Cultura Mia, BOING!, Chilakil Fries, Chilakiles Combo, Chocolate Milk, Chorizo Breakfast Burrito, Coffee, Gansito, Kids Milk, OG Breakfast Burrito Combo, Soda Can, water bottle.",
      },
      { kind: "info", body: DEMAND_NOTE },
    ],
  },
  {
    locationId: "avondale",
    reportDate: "2026-10-06",
    doorDashStoreId: "27859030",
    title: "Chilakil To Go – Avondale Food Trailer – DoorDash vs In-Store Pricing",
    headline: "5 of 5 items keep less than in-store after ~30% commission.",
    summary:
      "Right now, all 5 of your 5 DoorDash items leave you with less money than selling the same item at the trailer, after DoorDash's ~30% commission. The biggest gap is the Chilakil Burrito: same $12.00 price on both, so you keep only $8.40 per DoorDash sale (-$3.60 vs in-store). Your #1 item, Chilaquiles, keeps $10.50 vs $12.00 in-store (-$1.50 each). The recommended prices below bring every item back to at least what you'd get at the window.",
    commissionRate: 0.3,
    commissionNote:
      "Commission: Avondale's rate has not been verified; 30% is assumed, per Victor. (Glendale measured about 29.4% on delivery plus 6% on pickup.)",
    exclusionNote: EXCLUSION_NOTE,
    methodNote: METHOD_NOTE,
    addonNote:
      'Salsas, toppings and soda flavors are free on DoorDash (as in-store). Trio Meat is offered under "Extra Protein" lists but not under "1st Protein Addition".',
    addonNoteTone: "info",
    popularityLead:
      "Chilaquiles is your #1 item – 1,270 sold in-store in the last 30 days. Next among items also on DoorDash: Soda 211, Chilakil Burrito 59, Chilakil Torta 35, Keto Chilaquiles 7. These are in-store counts, shown only to tell you which items matter most; DoorDash item counts were not available, so no monthly or yearly loss is estimated.",
    tenOrderExample:
      "Every 10 DoorDash Chilaquiles orders at the current price = $15.00 less than 10 in-store sales (10 × $10.50 kept vs 10 × $12.00; base price only, before add-ons).",
    pdfPath: "/reports/avondale-doordash-pricing-2026-10-06.pdf",
    lines: [
      item("Keto Chilaquiles", 12, 14, 17, 9.8, -2.2, 17.14, 17.49, 3.49, 12.24, "losing", {
        squareSold30d: 7,
      }),
      item("Chilaquiles", 12, 15, 25, 10.5, -1.5, 17.14, 17.49, 2.49, 12.24, "losing", {
        squareSold30d: 1270,
      }),
      item("Soda", 2, 2, 0, 1.4, -0.6, 2.86, 2.99, 0.99, 2.09, "losing", {
        squareSold30d: 211,
      }),
      item("Chilakil Burrito", 12, 12, 0, 8.4, -3.6, 17.14, 17.49, 5.49, 12.24, "losing", {
        squareSold30d: 59,
      }),
      item("Chilakil Torta", 9, 10, 11, 7, -2, 12.86, 12.99, 2.99, 9.09, "losing", {
        squareSold30d: 35,
        footnote:
          "DoorDash's pricing page lists this item's in-store price as $0.00; Square charges $9.",
      }),
      PROTEIN_3,
      addon(
        "Shrimp; Trio Meat (Asada, Al Pastor & Chorizo)",
        4,
        4,
        0,
        2.8,
        -1.2,
        5.71,
        5.99,
        1.99,
        4.19,
        "losing",
      ),
      CHORIZO_EGGS,
      ONE_EGG,
    ],
    notes: [
      {
        kind: "check",
        body: "Torta data entry: DoorDash's menu-pricing page shows the Chilakil Torta's in-store price as $0.00, while Square charges $9. Please check that entry.",
      },
      { kind: "check", body: MENU_PRICING_NOTE },
      {
        kind: "commission",
        body: "Commission: Avondale's rate has not been verified; 30% is assumed, per Victor. (Glendale measured about 29.4% on delivery plus 6% on pickup.)",
      },
      { kind: "exclusion", body: EXCLUSION_NOTE },
      { kind: "info", body: SQUARE_WINDOW_NOTE },
      { kind: "info", body: DEMAND_NOTE },
    ],
  },
];
