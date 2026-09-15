import { prisma } from "@/lib/db";
import { phoenixToday, shiftIsoDate } from "@/lib/dates";
import { moneyExact, pct } from "@/lib/format";
import {
  COMBINED_LABEL,
  isCombinedScope,
  locationIdsForScope,
  LOCATIONS,
  type LocationScope,
} from "@/lib/location";
import { getDashboardData } from "@/lib/metrics";

export type BusinessSnapshot = {
  generatedAt: string;
  timezone: "America/Phoenix";
  source: "local SQLite seed — no live DoorDash, Uber Eats, Grubhub, Square, Meta, or bank APIs";
  scope: LocationScope;
  notice: string;
  today: Awaited<ReturnType<typeof getDashboardData>>;
  channels: {
    locationId: string;
    locationName: string;
    channel: string;
    gross: number;
    fees: number;
    net: number;
    orderCount: number;
  }[];
  expensesToday: {
    locationId: string;
    category: string;
    vendor: string;
    amount: number;
  }[];
  pendingMessages: {
    locationId: string;
    customerName: string;
    category: string;
    language: string;
    sensitive: boolean;
    requiresOwnerApproval: boolean;
    preview: string;
  }[];
  reviews: {
    locationId: string;
    platform: string;
    rating: number;
    author: string;
    responded: boolean;
    text: string;
  }[];
  laborToday: {
    locationId: string;
    employee: string;
    role: string;
    hours: number;
    laborCost: number;
  }[];
  menuCosting: {
    locationId: string;
    name: string;
    price: number;
    recipeCost: number;
    foodCostPct: number;
  }[];
};

export async function buildSnapshot(scope: LocationScope): Promise<BusinessSnapshot> {
  const date = phoenixToday();
  const ids = locationIdsForScope(scope);
  const today = await getDashboardData(scope, date);

  const [sales, expenses, messages, reviews, shifts, menuItems] = await Promise.all([
    prisma.dailySales.findMany({ where: { locationId: { in: ids }, date } }),
    prisma.expense.findMany({ where: { locationId: { in: ids }, date } }),
    prisma.customerMessage.findMany({
      where: {
        locationId: { in: ids },
        status: { in: ["pending_approval", "new"] },
      },
      orderBy: { receivedAt: "desc" },
    }),
    prisma.review.findMany({
      where: { locationId: { in: ids } },
      orderBy: { reviewedAt: "desc" },
      take: 12,
    }),
    prisma.shift.findMany({
      where: { locationId: { in: ids }, date },
      include: { employee: true },
    }),
    prisma.menuItem.findMany({
      where: { locationId: { in: ids }, active: true },
      include: { recipe: { include: { ingredients: { include: { ingredient: true } } } } },
    }),
  ]);

  const menuCosting = menuItems.map((item) => {
    const recipeCost =
      item.recipe?.ingredients.reduce(
        (sum, line) => sum + line.quantity * line.ingredient.costPerUnit,
        0,
      ) ?? 0;
    return {
      locationId: item.locationId,
      name: item.name,
      price: item.price,
      recipeCost,
      foodCostPct: item.price > 0 ? recipeCost / item.price : 0,
    };
  });

  const notice = isCombinedScope(scope)
    ? `${COMBINED_LABEL}. Per-location rows are listed separately — do not treat unlabeled numbers as a single store.`
    : `Scope is ${LOCATIONS[scope].name} only. Do not include the other location.`;

  return {
    generatedAt: new Date().toISOString(),
    timezone: "America/Phoenix",
    source: "local SQLite seed — no live DoorDash, Uber Eats, Grubhub, Square, Meta, or bank APIs",
    scope,
    notice,
    today,
    channels: sales.map((s) => ({
      locationId: s.locationId,
      locationName: s.locationId === "glendale" ? "Glendale Restaurant" : "Avondale Food Trailer",
      channel: s.channel,
      gross: s.gross,
      fees: s.fees,
      net: s.net,
      orderCount: s.orderCount,
    })),
    expensesToday: expenses.map((e) => ({
      locationId: e.locationId,
      category: e.category,
      vendor: e.vendor,
      amount: e.amount,
    })),
    pendingMessages: messages.map((m) => ({
      locationId: m.locationId,
      customerName: m.customerName,
      category: m.category,
      language: m.language,
      sensitive: m.sensitive,
      requiresOwnerApproval: m.requiresOwnerApproval,
      preview: m.body.slice(0, 180),
    })),
    reviews: reviews.map((r) => ({
      locationId: r.locationId,
      platform: r.platform,
      rating: r.rating,
      author: r.author,
      responded: r.responded,
      text: r.text,
    })),
    laborToday: shifts.map((s) => ({
      locationId: s.locationId,
      employee: s.employee.name,
      role: s.role,
      hours: s.hours,
      laborCost: s.laborCost,
    })),
    menuCosting,
  };
}

export function deterministicAnswer(question: string, snapshot: BusinessSnapshot): string {
  const q = question.toLowerCase();
  const lines: string[] = [];
  lines.push(snapshot.notice);
  lines.push(`Data source: ${snapshot.source}. Phoenix date ${snapshot.today.date}.`);
  lines.push("");

  const intent = detectIntent(q);

  if (intent === "compare" && snapshot.scope !== "all") {
    lines.push(
      "You are on a single location. Switch the location switcher to ALL to compare Glendale and Avondale. Here is only the selected location:",
    );
    lines.push("");
  }

  if (intent === "messages") {
    if (snapshot.pendingMessages.length === 0) {
      lines.push("No messages waiting on you in this location scope.");
    } else {
      lines.push(`${snapshot.pendingMessages.length} message(s) waiting:`);
      for (const m of snapshot.pendingMessages) {
        const loc = m.locationId === "glendale" ? "Glendale" : "Avondale";
        const gate = m.requiresOwnerApproval ? "OWNER APPROVAL REQUIRED" : "routine";
        lines.push(
          `• ${loc} · ${m.customerName} · ${m.language.toUpperCase()} · ${m.category} · ${gate}`,
        );
        lines.push(`  “${m.preview}”`);
      }
    }
    return lines.join("\n");
  }

  if (intent === "reviews") {
    const low = snapshot.reviews.filter((r) => r.rating <= 2);
    lines.push(`${snapshot.reviews.length} recent reviews in scope, ${low.length} at 2 stars or below.`);
    for (const r of snapshot.reviews) {
      const loc = r.locationId === "glendale" ? "Glendale" : "Avondale";
      lines.push(
        `• ${loc} · ${r.platform} · ${r.rating}★ · ${r.author}${r.responded ? " (replied)" : " (needs reply)"}`,
      );
      lines.push(`  ${r.text}`);
    }
    return lines.join("\n");
  }

  if (intent === "expenses") {
    const total = snapshot.expensesToday.reduce((s, e) => s + e.amount, 0);
    lines.push(`Purchases booked today: ${moneyExact(total)}.`);
    for (const e of snapshot.expensesToday) {
      const loc = e.locationId === "glendale" ? "Glendale" : "Avondale";
      lines.push(`• ${loc} · ${e.category} · ${e.vendor} · ${moneyExact(e.amount)}`);
    }
    return lines.join("\n");
  }

  if (intent === "food") {
    if (snapshot.today.combined) {
      lines.push(`${COMBINED_LABEL} estimated food cost: ${moneyExact(snapshot.today.combined.foodCost)} (${pct(snapshot.today.combined.foodCostPct)} of gross).`);
    }
    for (const loc of snapshot.today.locations) {
      lines.push(
        `${loc.name}: theoretical food cost ${moneyExact(loc.foodCost)} (${pct(loc.foodCostPct)}; target ${pct(loc.targetFoodCostPct)}). Actual purchases today ${moneyExact(loc.actualFoodPurchases)}.`,
      );
    }
    const costly = [...snapshot.menuCosting].sort((a, b) => b.foodCostPct - a.foodCostPct).slice(0, 6);
    lines.push("");
    lines.push("Highest recipe food-cost % in this scope:");
    for (const item of costly) {
      const loc = item.locationId === "glendale" ? "Glendale" : "Avondale";
      lines.push(
        `• ${loc} · ${item.name} · sell ${moneyExact(item.price)} · cost ${moneyExact(item.recipeCost)} · ${pct(item.foodCostPct)}`,
      );
    }
    return lines.join("\n");
  }

  if (intent === "labor") {
    if (snapshot.today.combined) {
      lines.push(`${COMBINED_LABEL} labor: ${moneyExact(snapshot.today.combined.labor)} (${pct(snapshot.today.combined.laborPct)} of gross).`);
    }
    for (const loc of snapshot.today.locations) {
      const flag = loc.laborPct > loc.targetLaborPct ? "OVER TARGET" : "within target";
      lines.push(
        `${loc.name}: ${moneyExact(loc.labor)} / ${loc.laborHours} hrs (${pct(loc.laborPct)}; target ${pct(loc.targetLaborPct)}) — ${flag}.`,
      );
    }
    lines.push("");
    for (const s of snapshot.laborToday) {
      const loc = s.locationId === "glendale" ? "Glendale" : "Avondale";
      lines.push(`• ${loc} · ${s.employee} (${s.role}) · ${s.hours}h · ${moneyExact(s.laborCost)}`);
    }
    return lines.join("\n");
  }

  if (intent === "delivery" || intent === "doordash" || intent === "ubereats" || intent === "grubhub") {
    const want =
      intent === "doordash"
        ? "doordash"
        : intent === "ubereats"
          ? "ubereats"
          : intent === "grubhub"
            ? "grubhub"
            : null;
    const rows = snapshot.channels.filter((c) => (want ? c.channel === want : c.channel !== "in_store"));
    if (snapshot.today.combined) {
      lines.push(
        `${COMBINED_LABEL} delivery gross: ${moneyExact(snapshot.today.combined.deliveryGross)} of ${moneyExact(snapshot.today.combined.gross)} gross.`,
      );
    }
    for (const row of rows) {
      lines.push(
        `• ${row.locationName} · ${row.channel}: gross ${moneyExact(row.gross)}, fees ${moneyExact(row.fees)}, net ${moneyExact(row.net)}, ${row.orderCount} orders`,
      );
    }
    return lines.join("\n");
  }

  // Default / sales
  if (snapshot.today.combined) {
    const c = snapshot.today.combined;
    lines.push(`${COMBINED_LABEL}`);
    lines.push(
      `Gross ${moneyExact(c.gross)} · delivery ${moneyExact(c.deliveryGross)} · net after fees ${moneyExact(c.net)} · labor ${moneyExact(c.labor)} · food ${moneyExact(c.foodCost)} · ${c.orderCount} orders · avg ticket ${moneyExact(c.averageTicket)}.`,
    );
    lines.push("");
  }
  for (const loc of snapshot.today.locations) {
    lines.push(`${loc.name}`);
    lines.push(
      `Gross ${moneyExact(loc.gross)} · in-store ${moneyExact(loc.inStoreGross)} · delivery ${moneyExact(loc.deliveryGross)} · fees ${moneyExact(loc.fees)} · net ${moneyExact(loc.net)}.`,
    );
    lines.push(
      `Labor ${moneyExact(loc.labor)} (${pct(loc.laborPct)}) · estimated food cost ${moneyExact(loc.foodCost)} (${pct(loc.foodCostPct)}) · ${loc.orderCount} orders · avg ticket ${moneyExact(loc.averageTicket)}.`,
    );
    lines.push("");
  }

  if (intent === "help" || q.length < 8) {
    lines.push("You can ask about sales, net after fees, DoorDash / Uber Eats / Grubhub mix, labor, food cost, expenses, reviews, or messages that need approval.");
  }

  return lines.join("\n").trim();
}

function detectIntent(q: string): string {
  if (/(message|inbox|approval|alerg|allerg|refund|cater)/.test(q)) return "messages";
  if (/(review|yelp|google|star)/.test(q)) return "reviews";
  if (/(expense|vendor|shamrock|bill|spent)/.test(q)) return "expenses";
  if (/(food cost|cogs|recipe|ingredient|theoretical)/.test(q)) return "food";
  if (/(labor|wage|payroll|staff|shift|hours)/.test(q)) return "labor";
  if (/doordash/.test(q)) return "doordash";
  if (/uber/.test(q)) return "ubereats";
  if (/grubhub/.test(q)) return "grubhub";
  if (/(delivery|commission|fee mix|platform)/.test(q)) return "delivery";
  if (/(compare|vs|versus|both|difference)/.test(q)) return "compare";
  if (/(help|what can you)/.test(q)) return "help";
  return "sales";
}

export async function llmAnswer(question: string, snapshot: BusinessSnapshot): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const OpenAI = (await import("openai")).default;
  const client = new OpenAI({ apiKey });
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  const completion = await client.chat.completions.create({
    model,
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content: `You are the owner assistant for Chilakil To Go, a Mexican restaurant (Glendale) and food trailer (Avondale).
Answer only from the JSON snapshot. Never invent live DoorDash, Uber Eats, Grubhub, Square, Meta, or bank data.
If scope is a single location, do not quote the other location's numbers.
When scope is ALL, always label Glendale vs Avondale, and label any sum as "${COMBINED_LABEL}".
Keep answers tight and useful on a phone: lead with numbers, then one recommendation.
Today in the snapshot is ${phoenixToday()} (${shiftIsoDate(phoenixToday(), 0)}) America/Phoenix.`,
      },
      {
        role: "user",
        content: `SNAPSHOT:\n${JSON.stringify(snapshot)}\n\nQUESTION:\n${question}`,
      },
    ],
  });

  return completion.choices[0]?.message?.content ?? null;
}

export const SUGGESTED_QUESTIONS = [
  "How were sales today?",
  "What's our food cost vs target?",
  "Is labor over target?",
  "Break down DoorDash vs in-store",
  "What needs my approval in messages?",
  "Compare Glendale and Avondale",
];
