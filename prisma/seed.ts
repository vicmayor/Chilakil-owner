import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DOORDASH_PRICING_REPORTS } from "../src/data/doordash-pricing-reports";
import { phoenixMonday, phoenixToday, shiftIsoDate } from "../src/lib/dates";
import { DOORDASH_STORE_IDS } from "../src/lib/doordash-stores";
import { importFoodCostWorkbook } from "../src/lib/food-cost-import";
import { loadEnvFile } from "../src/lib/load-env";

loadEnvFile();

const prisma = new PrismaClient();

const GLENDALE = "glendale";
const AVONDALE = "avondale";

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

async function main() {
  const today = phoenixToday();
  await ensureLocations();
  await ensureOwner();

  if (process.env.SEED_SAMPLE !== "true") {
    await seedDoorDashPricing();
    await seedFoodCostWorkbook();
    console.log("Owner and locations are ready. Sample financials were not loaded.");
    console.log("DoorDash pricing reports and the food cost workbook were refreshed. Set SEED_SAMPLE=true to load the local demo dataset.");
    return;
  }

  if (process.env.NODE_ENV === "production" && process.env.ALLOW_SAMPLE_RESET !== "true") {
    throw new Error(
      "Refusing to load sample data when NODE_ENV=production. Unset SEED_SAMPLE, or set ALLOW_SAMPLE_RESET=true to override.",
    );
  }

  await prisma.doorDashWeeklyReport.deleteMany();
  await prisma.dailySalesRecord.deleteMany();
  await prisma.aiMessage.deleteMany();
  await prisma.aiThread.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.integrationConfig.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.marketingCampaign.deleteMany();
  await prisma.review.deleteMany();
  await prisma.customerMessage.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.recipeIngredient.deleteMany();
  await prisma.recipe.deleteMany();
  await prisma.ingredient.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.dailyOps.deleteMany();
  await prisma.deliverySummary.deleteMany();
  await prisma.dailySales.deleteMany();
  await prisma.order.deleteMany();
  await prisma.doorDashPricingNote.deleteMany();
  await prisma.doorDashPricingLine.deleteMany();
  await prisma.doorDashPricingReport.deleteMany();

  type DayPlan = {
    offset: number;
    glendale: ChannelDay;
    avondale: ChannelDay;
  };
  type ChannelDay = Record<
    "in_store" | "doordash" | "ubereats" | "grubhub",
    { gross: number; fees: number; orders: number }
  >;

  const days: DayPlan[] = [
    {
      offset: 0,
      glendale: {
        in_store: { gross: 3856.5, fees: 0, orders: 78 },
        doordash: { gross: 1124.0, fees: 337.2, orders: 24 },
        ubereats: { gross: 612.0, fees: 171.36, orders: 14 },
        grubhub: { gross: 250.0, fees: 55.0, orders: 11 },
      },
      avondale: {
        in_store: { gross: 764.75, fees: 0, orders: 18 },
        doordash: { gross: 892.0, fees: 267.6, orders: 22 },
        ubereats: { gross: 542.0, fees: 151.76, orders: 14 },
        grubhub: { gross: 220.0, fees: 48.4, orders: 7 },
      },
    },
    {
      offset: -1,
      glendale: {
        in_store: { gross: 3520.0, fees: 0, orders: 71 },
        doordash: { gross: 980.0, fees: 284.2, orders: 21 },
        ubereats: { gross: 540.0, fees: 151.2, orders: 12 },
        grubhub: { gross: 198.0, fees: 43.56, orders: 8 },
      },
      avondale: {
        in_store: { gross: 690.0, fees: 0, orders: 16 },
        doordash: { gross: 810.0, fees: 234.9, orders: 19 },
        ubereats: { gross: 488.0, fees: 136.64, orders: 12 },
        grubhub: { gross: 176.0, fees: 38.72, orders: 6 },
      },
    },
    {
      offset: -2,
      glendale: {
        in_store: { gross: 4102.0, fees: 0, orders: 84 },
        doordash: { gross: 1260.0, fees: 403.2, orders: 28 },
        ubereats: { gross: 705.0, fees: 197.4, orders: 16 },
        grubhub: { gross: 312.0, fees: 68.64, orders: 13 },
      },
      avondale: {
        in_store: { gross: 840.0, fees: 0, orders: 20 },
        doordash: { gross: 960.0, fees: 307.2, orders: 24 },
        ubereats: { gross: 610.0, fees: 170.8, orders: 15 },
        grubhub: { gross: 240.0, fees: 52.8, orders: 8 },
      },
    },
    {
      offset: -3,
      glendale: {
        in_store: { gross: 2988.0, fees: 0, orders: 62 },
        doordash: { gross: 870.0, fees: 261.0, orders: 18 },
        ubereats: { gross: 490.0, fees: 137.2, orders: 11 },
        grubhub: { gross: 165.0, fees: 36.3, orders: 7 },
      },
      avondale: {
        in_store: { gross: 520.0, fees: 0, orders: 13 },
        doordash: { gross: 640.0, fees: 192.0, orders: 16 },
        ubereats: { gross: 390.0, fees: 109.2, orders: 10 },
        grubhub: { gross: 140.0, fees: 30.8, orders: 5 },
      },
    },
    {
      offset: -4,
      glendale: {
        in_store: { gross: 3310.0, fees: 0, orders: 68 },
        doordash: { gross: 1420.0, fees: 454.4, orders: 31 },
        ubereats: { gross: 680.0, fees: 190.4, orders: 15 },
        grubhub: { gross: 220.0, fees: 48.4, orders: 9 },
      },
      avondale: {
        in_store: { gross: 610.0, fees: 0, orders: 15 },
        doordash: { gross: 1020.0, fees: 336.6, orders: 26 },
        ubereats: { gross: 470.0, fees: 131.6, orders: 12 },
        grubhub: { gross: 155.0, fees: 34.1, orders: 5 },
      },
    },
  ];

  const opsByDay: Record<
    string,
    Record<
      string,
      {
        laborHours: number;
        laborCost: number;
        theoreticalFoodCost: number;
        actualFoodPurchases: number;
        targetLaborPct: number;
        targetFoodCostPct: number;
      }
    >
  > = {
    "0": {
      glendale: {
        laborHours: 62,
        laborCost: 1312,
        theoreticalFoodCost: 1694.33,
        actualFoodPurchases: 1480,
        targetLaborPct: 0.25,
        targetFoodCostPct: 0.3,
      },
      avondale: {
        laborHours: 22,
        laborCost: 486,
        theoreticalFoodCost: 773.99,
        actualFoodPurchases: 620,
        targetLaborPct: 0.22,
        targetFoodCostPct: 0.32,
      },
    },
    "-1": {
      glendale: {
        laborHours: 58,
        laborCost: 1218,
        theoreticalFoodCost: 1571.4,
        actualFoodPurchases: 210,
        targetLaborPct: 0.25,
        targetFoodCostPct: 0.3,
      },
      avondale: {
        laborHours: 20,
        laborCost: 440,
        theoreticalFoodCost: 691.52,
        actualFoodPurchases: 95,
        targetLaborPct: 0.22,
        targetFoodCostPct: 0.32,
      },
    },
    "-2": {
      glendale: {
        laborHours: 66,
        laborCost: 1420,
        theoreticalFoodCost: 1913.7,
        actualFoodPurchases: 1880,
        targetLaborPct: 0.25,
        targetFoodCostPct: 0.3,
      },
      avondale: {
        laborHours: 24,
        laborCost: 528,
        theoreticalFoodCost: 848,
        actualFoodPurchases: 740,
        targetLaborPct: 0.22,
        targetFoodCostPct: 0.32,
      },
    },
    "-3": {
      glendale: {
        laborHours: 52,
        laborCost: 1092,
        theoreticalFoodCost: 1353.9,
        actualFoodPurchases: 180,
        targetLaborPct: 0.25,
        targetFoodCostPct: 0.3,
      },
      avondale: {
        laborHours: 18,
        laborCost: 396,
        theoreticalFoodCost: 540.8,
        actualFoodPurchases: 70,
        targetLaborPct: 0.22,
        targetFoodCostPct: 0.32,
      },
    },
    "-4": {
      glendale: {
        laborHours: 60,
        laborCost: 1488,
        theoreticalFoodCost: 1689,
        actualFoodPurchases: 260,
        targetLaborPct: 0.25,
        targetFoodCostPct: 0.3,
      },
      avondale: {
        laborHours: 21,
        laborCost: 462,
        theoreticalFoodCost: 721.6,
        actualFoodPurchases: 110,
        targetLaborPct: 0.22,
        targetFoodCostPct: 0.32,
      },
    },
  };

  for (const day of days) {
    const date = shiftIsoDate(today, day.offset);
    for (const loc of [GLENDALE, AVONDALE] as const) {
      const channels = day[loc];
      for (const [channel, row] of Object.entries(channels)) {
        await prisma.dailySales.create({
          data: {
            locationId: loc,
            date,
            channel,
            gross: row.gross,
            fees: row.fees,
            net: round2(row.gross - row.fees),
            orderCount: row.orders,
          },
        });
      }

      const gross = Object.values(channels).reduce((sum, row) => sum + row.gross, 0);
      const fees = Object.values(channels).reduce((sum, row) => sum + row.fees, 0);
      const orders = Object.values(channels).reduce((sum, row) => sum + row.orders, 0);
      await prisma.dailySalesRecord.create({
        data: {
          locationId: loc,
          date,
          grossSales: round2(gross),
          netSales: round2(gross - fees),
          discounts: 0,
          refunds: 0,
          tips: 0,
          tax: null,
          orderCount: orders,
          averageTicket: orders > 0 ? round2(gross / orders) : 0,
          inStoreGross: channels.in_store.gross,
          inStoreOrders: channels.in_store.orders,
          doorDashGross: channels.doordash.gross,
          doorDashOrders: channels.doordash.orders,
          uberEatsGross: channels.ubereats.gross,
          uberEatsOrders: channels.ubereats.orders,
          grubhubGross: channels.grubhub.gross,
          grubhubOrders: channels.grubhub.orders,
          source: "sample",
          importedAt: new Date(),
        },
      });

      const dd = channels.doordash;
      const ue = channels.ubereats;
      const gh = channels.grubhub;
      await prisma.deliverySummary.createMany({
        data: [
          {
            locationId: loc,
            platform: "doordash",
            date,
            orderCount: dd.orders,
            gross: dd.gross,
            commission: round2(dd.fees * 0.85),
            otherFees: round2(dd.fees * 0.15),
            net: round2(dd.gross - dd.fees),
            avgPrepMinutes: loc === GLENDALE ? 14 : 11,
            cancelledOrders: day.offset === -4 && loc === GLENDALE ? 2 : 0,
            refunds: day.offset === 0 && loc === AVONDALE ? 18.5 : 0,
          },
          {
            locationId: loc,
            platform: "ubereats",
            date,
            orderCount: ue.orders,
            gross: ue.gross,
            commission: round2(ue.fees * 0.88),
            otherFees: round2(ue.fees * 0.12),
            net: round2(ue.gross - ue.fees),
            avgPrepMinutes: loc === GLENDALE ? 13 : 10,
            cancelledOrders: 0,
            refunds: 0,
          },
          {
            locationId: loc,
            platform: "grubhub",
            date,
            orderCount: gh.orders,
            gross: gh.gross,
            commission: round2(gh.fees * 0.9),
            otherFees: round2(gh.fees * 0.1),
            net: round2(gh.gross - gh.fees),
            avgPrepMinutes: loc === GLENDALE ? 15 : 12,
            cancelledOrders: 0,
            refunds: 0,
          },
        ],
      });

      const ops = opsByDay[String(day.offset)][loc];
      await prisma.dailyOps.create({
        data: { locationId: loc, date, ...ops },
      });
    }
  }

  const sampleOrders: {
    locationId: string;
    channel: string;
    minutesAgo: number;
    gross: number;
    fees: number;
    guestName: string;
    itemSummary: string;
  }[] = [
    {
      locationId: GLENDALE,
      channel: "in_store",
      minutesAgo: 18,
      gross: 42.5,
      fees: 0,
      guestName: "Walk-in",
      itemSummary: "Pastor tacos, horchata",
    },
    {
      locationId: GLENDALE,
      channel: "doordash",
      minutesAgo: 32,
      gross: 38.25,
      fees: 11.48,
      guestName: "J. Ramirez",
      itemSummary: "Burrito Chilakil, chips",
    },
    {
      locationId: GLENDALE,
      channel: "ubereats",
      minutesAgo: 47,
      gross: 51.0,
      fees: 14.28,
      guestName: "A. Chen",
      itemSummary: "Family taco pack",
    },
    {
      locationId: GLENDALE,
      channel: "in_store",
      minutesAgo: 61,
      gross: 67.8,
      fees: 0,
      guestName: "Walk-in",
      itemSummary: "Birria, quesadilla, aguas",
    },
    {
      locationId: GLENDALE,
      channel: "grubhub",
      minutesAgo: 90,
      gross: 24.0,
      fees: 5.28,
      guestName: "K. Patel",
      itemSummary: "Tinga tacos",
    },
    {
      locationId: AVONDALE,
      channel: "doordash",
      minutesAgo: 12,
      gross: 33.5,
      fees: 10.05,
      guestName: "M. Lopez",
      itemSummary: "Asada tacos, elote",
    },
    {
      locationId: AVONDALE,
      channel: "in_store",
      minutesAgo: 28,
      gross: 19.0,
      fees: 0,
      guestName: "Walk-up",
      itemSummary: "Quesadilla",
    },
    {
      locationId: AVONDALE,
      channel: "ubereats",
      minutesAgo: 55,
      gross: 44.75,
      fees: 12.53,
      guestName: "S. Brooks",
      itemSummary: "Torta, jamaica",
    },
    {
      locationId: AVONDALE,
      channel: "doordash",
      minutesAgo: 110,
      gross: 28.0,
      fees: 8.4,
      guestName: "R. Nguyen",
      itemSummary: "Pastor + chips",
    },
  ];

  for (const o of sampleOrders) {
    const orderedAt = new Date(Date.now() - o.minutesAgo * 60_000);
    await prisma.order.create({
      data: {
        locationId: o.locationId,
        channel: o.channel,
        orderedAt,
        gross: o.gross,
        fees: o.fees,
        net: round2(o.gross - o.fees),
        guestName: o.guestName,
        itemSummary: o.itemSummary,
      },
    });
  }

  const expenseRows = [
    { locationId: GLENDALE, date: today, category: "meat", amount: 620, vendor: "Shamrock Foods", notes: "Asada, pastor, chicken" },
    { locationId: GLENDALE, date: today, category: "produce", amount: 310, vendor: "Phoenix Produce", notes: "Cilantro, onion, salsa veg" },
    { locationId: GLENDALE, date: today, category: "dairy", amount: 180, vendor: "Shamrock Foods", notes: "Cheese, crema, horchata mix" },
    { locationId: GLENDALE, date: today, category: "packaging", amount: 145, vendor: "Webstaurant", notes: "Tortilla bags, bowls" },
    { locationId: GLENDALE, date: today, category: "utilities", amount: 225, vendor: "SRP", notes: "Electric estimate", recurring: true },
    { locationId: GLENDALE, date: shiftIsoDate(today, -2), category: "meat", amount: 890, vendor: "Shamrock Foods", notes: "Weekly protein drop" },
    { locationId: GLENDALE, date: shiftIsoDate(today, -2), category: "dry_goods", amount: 420, vendor: "Shamrock Foods", notes: "Tortillas, rice, beans, oil" },
    { locationId: GLENDALE, date: shiftIsoDate(today, -3), category: "repairs", amount: 275, vendor: "Valley Cool", notes: "Prep cooler fan" },
    { locationId: GLENDALE, date: shiftIsoDate(today, -4), category: "marketing", amount: 150, vendor: "Meta Ads", notes: "Glendale weekend boost" },
    { locationId: AVONDALE, date: today, category: "meat", amount: 280, vendor: "Shamrock Foods", notes: "Trailer protein" },
    { locationId: AVONDALE, date: today, category: "produce", amount: 140, vendor: "Phoenix Produce", notes: null },
    { locationId: AVONDALE, date: today, category: "packaging", amount: 90, vendor: "Webstaurant", notes: "Clamshells" },
    { locationId: AVONDALE, date: today, category: "propane", amount: 110, vendor: "AmeriGas", notes: "Tank swap" },
    { locationId: AVONDALE, date: shiftIsoDate(today, -2), category: "meat", amount: 410, vendor: "Shamrock Foods", notes: "Weekly trailer drop" },
    { locationId: AVONDALE, date: shiftIsoDate(today, -2), category: "dry_goods", amount: 220, vendor: "Shamrock Foods", notes: null },
    { locationId: AVONDALE, date: shiftIsoDate(today, -4), category: "repairs", amount: 95, vendor: "Mobile Trailer Fix", notes: "Door latch" },
  ] as const;

  await prisma.expense.createMany({
    data: expenseRows.map((e) => ({
      locationId: e.locationId,
      date: e.date,
      category: e.category,
      amount: e.amount,
      vendor: e.vendor,
      notes: e.notes ?? null,
      recurring: "recurring" in e ? Boolean(e.recurring) : false,
    })),
  });

  await seedMenuAndRecipes();
  await seedPeople(today);
  await seedInboxAndReviews();
  await seedMarketing(today);
  await seedIntegrations();
  await seedAlerts(today);
  await seedDoorDashWeeks(today);
  await seedDoorDashPricing();
  await seedFoodCostWorkbook();

  console.log(`Seeded Chilakil Owner sample data for Phoenix date ${today}`);
  console.log("Daily sales and DoorDash weeks are marked source=sample.");
}

async function seedFoodCostWorkbook() {
  const result = await importFoodCostWorkbook(prisma);
  console.log(
    `Food cost workbook refreshed for ${result.locations} locations (${result.menuItems} menu items, ${result.ingredients} ingredients). Re-running updates those rows and does not duplicate them.`,
  );
}

async function ensureLocations() {
  const rows = [
    {
      id: GLENDALE,
      name: "Glendale Restaurant",
      shortName: "Glendale",
      type: "restaurant",
      timezone: "America/Phoenix",
      address: "5832 W Camelback Rd",
      city: "Glendale, AZ",
      phone: "(623) 555-0148",
    },
    {
      id: AVONDALE,
      name: "Avondale Food Trailer",
      shortName: "Avondale",
      type: "trailer",
      timezone: "America/Phoenix",
      address: "Civic Center Plaza (trailer pad)",
      city: "Avondale, AZ",
      phone: "(623) 555-0194",
    },
  ];
  for (const row of rows) {
    await prisma.location.upsert({
      where: { id: row.id },
      create: row,
      update: row,
    });
  }
}

async function ensureOwner() {
  const ownerEmail = process.env.OWNER_EMAIL?.trim();
  const ownerPassword = process.env.OWNER_PASSWORD;
  const ownerName = process.env.OWNER_NAME?.trim() || "Victor Mayorga";
  if (!ownerEmail || !ownerPassword) {
    throw new Error(
      "OWNER_EMAIL and OWNER_PASSWORD are required. The seed will not create an owner with a built-in demo password.",
    );
  }
  if (ownerPassword.length < 10) {
    throw new Error("OWNER_PASSWORD must be at least 10 characters.");
  }
  const passwordHash = await bcrypt.hash(ownerPassword, 12);
  await prisma.user.upsert({
    where: { email: ownerEmail.toLowerCase() },
    create: {
      email: ownerEmail.toLowerCase(),
      name: ownerName,
      passwordHash,
      role: "owner",
    },
    update: {
      name: ownerName,
      passwordHash,
      role: "owner",
    },
  });
  console.log(`Owner ready: ${ownerEmail.toLowerCase()}`);
}

async function seedDoorDashWeeks(today: string) {
  const monday = phoenixMonday(today);
  const weeks = [
    { deltaWeeks: 0, gSub: 1840, gOrders: 41, gComm: 552, gMkt: 40, gErr: 12, aSub: 980, aOrders: 26, aComm: 323.4, aMkt: 25, aErr: 18 },
    { deltaWeeks: 1, gSub: 6120, gOrders: 132, gComm: 1836, gMkt: 240, gErr: 55, aSub: 4380, aOrders: 108, aComm: 1445.4, aMkt: 190, aErr: 70 },
    { deltaWeeks: 2, gSub: 5890, gOrders: 126, gComm: 1710, gMkt: 210, gErr: 40, aSub: 4010, aOrders: 99, aComm: 1283.2, aMkt: 160, aErr: 48 },
    { deltaWeeks: 3, gSub: 5540, gOrders: 121, gComm: 1662, gMkt: 180, gErr: 36, aSub: 3760, aOrders: 94, aComm: 1240.8, aMkt: 150, aErr: 44 },
  ];

  for (const week of weeks) {
    const weekStart = shiftIsoDate(monday, -7 * week.deltaWeeks);
    const weekEnd = shiftIsoDate(weekStart, 6);
    for (const loc of [GLENDALE, AVONDALE] as const) {
      const subtotal = loc === GLENDALE ? week.gSub : week.aSub;
      const orderCount = loc === GLENDALE ? week.gOrders : week.aOrders;
      const commission = loc === GLENDALE ? week.gComm : week.aComm;
      const marketingFees = loc === GLENDALE ? week.gMkt : week.aMkt;
      const errorCharges = loc === GLENDALE ? week.gErr : week.aErr;
      const deliveryOrders = Math.round(orderCount * (loc === GLENDALE ? 0.72 : 0.81));
      const pickupOrders = orderCount - deliveryOrders;
      await prisma.doorDashWeeklyReport.create({
        data: {
          locationId: loc,
          doorDashStoreId: DOORDASH_STORE_IDS[loc],
          weekStart,
          weekEnd,
          subtotal,
          gross: subtotal,
          orderCount,
          commission,
          marketingFees,
          errorCharges,
          adjustments: 0,
          netPayout: round2(subtotal - commission - marketingFees - errorCharges),
          effectiveCommissionPct: round2(commission / subtotal),
          deliveryOrders,
          pickupOrders,
          deliverySubtotal: round2(subtotal * (deliveryOrders / orderCount)),
          pickupSubtotal: round2(subtotal * (pickupOrders / orderCount)),
          source: "sample",
          importedAt: new Date(),
        },
      });
    }
  }
}

async function seedMenuAndRecipes() {
  const specs = [
    {
      name: "Carne asada",
      unit: "lb",
      gCost: 8.4,
      aCost: 8.7,
      gOn: 42,
      aOn: 18,
      vendor: "Shamrock Foods",
    },
    {
      name: "Pastor pork",
      unit: "lb",
      gCost: 5.1,
      aCost: 5.3,
      gOn: 38,
      aOn: 16,
      vendor: "Shamrock Foods",
    },
    {
      name: "Chicken thigh",
      unit: "lb",
      gCost: 3.8,
      aCost: 4.0,
      gOn: 30,
      aOn: 12,
      vendor: "Shamrock Foods",
    },
    {
      name: "Corn tortillas",
      unit: "each",
      gCost: 0.08,
      aCost: 0.09,
      gOn: 900,
      aOn: 400,
      vendor: "La Sonorense",
    },
    {
      name: "Flour tortillas",
      unit: "each",
      gCost: 0.18,
      aCost: 0.2,
      gOn: 240,
      aOn: 80,
      vendor: "La Sonorense",
    },
    {
      name: "Oaxaca cheese",
      unit: "lb",
      gCost: 6.2,
      aCost: 6.4,
      gOn: 14,
      aOn: 6,
      vendor: "Shamrock Foods",
    },
    {
      name: "Cabbage / onion mix",
      unit: "lb",
      gCost: 1.4,
      aCost: 1.5,
      gOn: 22,
      aOn: 9,
      vendor: "Phoenix Produce",
    },
    {
      name: "Salsa roja",
      unit: "oz",
      gCost: 0.12,
      aCost: 0.13,
      gOn: 320,
      aOn: 140,
      vendor: "In-house",
    },
    {
      name: "Rice",
      unit: "oz",
      gCost: 0.06,
      aCost: 0.07,
      gOn: 400,
      aOn: 160,
      vendor: "Shamrock Foods",
    },
    {
      name: "Beans",
      unit: "oz",
      gCost: 0.07,
      aCost: 0.08,
      gOn: 360,
      aOn: 140,
      vendor: "Shamrock Foods",
    },
    {
      name: "Horchata mix",
      unit: "oz",
      gCost: 0.09,
      aCost: 0.1,
      gOn: 180,
      aOn: 70,
      vendor: "Shamrock Foods",
    },
    {
      name: "Clamshell",
      unit: "each",
      gCost: 0.22,
      aCost: 0.22,
      gOn: 500,
      aOn: 220,
      vendor: "Webstaurant",
    },
  ];

  const ingredientIds: Record<string, Record<string, string>> = {
    glendale: {},
    avondale: {},
  };

  for (const spec of specs) {
    const g = await prisma.ingredient.create({
      data: {
        locationId: GLENDALE,
        name: spec.name,
        unit: spec.unit,
        costPerUnit: spec.gCost,
        onHand: spec.gOn,
        reorderPoint: spec.gOn * 0.25,
        vendor: spec.vendor,
      },
    });
    const a = await prisma.ingredient.create({
      data: {
        locationId: AVONDALE,
        name: spec.name,
        unit: spec.unit,
        costPerUnit: spec.aCost,
        onHand: spec.aOn,
        reorderPoint: spec.aOn * 0.3,
        vendor: spec.vendor,
      },
    });
    ingredientIds.glendale[spec.name] = g.id;
    ingredientIds.avondale[spec.name] = a.id;
  }

  const recipes: {
    name: string;
    category: string;
    price: number;
    lines: [string, number][];
  }[] = [
    {
      name: "Tacos al pastor (3)",
      category: "Tacos",
      price: 13.5,
      lines: [
        ["Pastor pork", 0.35],
        ["Corn tortillas", 3],
        ["Cabbage / onion mix", 0.12],
        ["Salsa roja", 2],
        ["Clamshell", 1],
      ],
    },
    {
      name: "Carne asada tacos (3)",
      category: "Tacos",
      price: 14.5,
      lines: [
        ["Carne asada", 0.38],
        ["Corn tortillas", 3],
        ["Cabbage / onion mix", 0.12],
        ["Salsa roja", 2],
        ["Clamshell", 1],
      ],
    },
    {
      name: "Burrito Chilakil",
      category: "Burritos",
      price: 14.0,
      lines: [
        ["Carne asada", 0.3],
        ["Flour tortillas", 1],
        ["Rice", 5],
        ["Beans", 4],
        ["Oaxaca cheese", 0.12],
        ["Salsa roja", 2],
        ["Clamshell", 1],
      ],
    },
    {
      name: "Chicken tinga quesadilla",
      category: "Quesadillas",
      price: 12.0,
      lines: [
        ["Chicken thigh", 0.28],
        ["Flour tortillas", 1],
        ["Oaxaca cheese", 0.18],
        ["Salsa roja", 1.5],
        ["Clamshell", 1],
      ],
    },
    {
      name: "Horchata 16oz",
      category: "Drinks",
      price: 3.75,
      lines: [["Horchata mix", 16]],
    },
  ];

  for (const loc of [GLENDALE, AVONDALE] as const) {
    for (const recipe of recipes) {
      const created = await prisma.recipe.create({
        data: {
          locationId: loc,
          name: recipe.name,
          yieldQty: 1,
          yieldUnit: "serving",
          notes: loc === AVONDALE ? "Trailer portion — slightly tighter yield" : "Restaurant plate-up",
        },
      });
      for (const [ingName, qty] of recipe.lines) {
        await prisma.recipeIngredient.create({
          data: {
            recipeId: created.id,
            ingredientId: ingredientIds[loc][ingName],
            quantity: qty,
          },
        });
      }
      await prisma.menuItem.create({
        data: {
          locationId: loc,
          name: recipe.name,
          category: recipe.category,
          price: loc === AVONDALE && recipe.category !== "Drinks" ? recipe.price - 0.5 : recipe.price,
          recipeId: created.id,
          active: true,
        },
      });
    }
  }
}

async function seedPeople(today: string) {
  const glendaleStaff = [
    { name: "Maria Soto", role: "General manager", rate: 28, phone: "623-555-1101" },
    { name: "Luis Herrera", role: "Lead cook", rate: 22, phone: "623-555-1102" },
    { name: "Ana Ruiz", role: "Cashier", rate: 16.5, phone: "623-555-1103" },
    { name: "Diego Peña", role: "Prep", rate: 17, phone: "623-555-1104" },
    { name: "Sofia Navarro", role: "Cashier", rate: 16.5, phone: "623-555-1105" },
    { name: "Carmen Díaz", role: "Cook", rate: 19, phone: "623-555-1106" },
    { name: "Jose Vega", role: "Expo", rate: 17.5, phone: "623-555-1107" },
    { name: "Elena Cruz", role: "Prep", rate: 17, phone: "623-555-1108" },
  ];
  const avondaleStaff = [
    { name: "Marco Jiménez", role: "Trailer lead", rate: 24, phone: "623-555-2201" },
    { name: "Rosa Méndez", role: "Cook / cashier", rate: 19, phone: "623-555-2202" },
    { name: "Ivan Torres", role: "Cook", rate: 18, phone: "623-555-2203" },
  ];

  async function staffWithShifts(
    locationId: string,
    staff: typeof glendaleStaff,
    todayShifts: { name: string; start: string; end: string; hours: number }[],
  ) {
    const created = [];
    for (const s of staff) {
      created.push(
        await prisma.employee.create({
          data: {
            locationId,
            name: s.name,
            role: s.role,
            hourlyRate: s.rate,
            phone: s.phone,
            active: true,
          },
        }),
      );
    }
    const byName = Object.fromEntries(created.map((e) => [e.name, e]));
    for (const shift of todayShifts) {
      const emp = byName[shift.name];
      await prisma.shift.create({
        data: {
          employeeId: emp.id,
          locationId,
          date: today,
          startTime: shift.start,
          endTime: shift.end,
          hours: shift.hours,
          laborCost: round2(shift.hours * emp.hourlyRate),
          role: emp.role,
        },
      });
    }
    for (const emp of created) {
      await prisma.shift.create({
        data: {
          employeeId: emp.id,
          locationId,
          date: shiftIsoDate(today, -1),
          startTime: "10:00",
          endTime: "16:00",
          hours: locationId === GLENDALE ? 6 : 6,
          laborCost: round2(6 * emp.hourlyRate),
          role: emp.role,
        },
      });
    }
  }

  await staffWithShifts(GLENDALE, glendaleStaff, [
    { name: "Maria Soto", start: "09:00", end: "17:00", hours: 8 },
    { name: "Luis Herrera", start: "08:00", end: "16:00", hours: 8 },
    { name: "Ana Ruiz", start: "10:00", end: "18:00", hours: 8 },
    { name: "Diego Peña", start: "08:00", end: "14:00", hours: 6 },
    { name: "Sofia Navarro", start: "16:00", end: "21:00", hours: 5 },
    { name: "Carmen Díaz", start: "11:00", end: "20:00", hours: 9 },
    { name: "Jose Vega", start: "11:00", end: "20:00", hours: 9 },
    { name: "Elena Cruz", start: "08:00", end: "17:00", hours: 9 },
  ]);

  await staffWithShifts(AVONDALE, avondaleStaff, [
    { name: "Marco Jiménez", start: "10:00", end: "19:00", hours: 8.5 },
    { name: "Rosa Méndez", start: "10:00", end: "18:00", hours: 7.5 },
    { name: "Ivan Torres", start: "11:00", end: "17:00", hours: 6 },
  ]);
}

async function seedInboxAndReviews() {
  const now = new Date();
  await prisma.customerMessage.createMany({
    data: [
      {
        locationId: GLENDALE,
        platform: "doordash",
        customerName: "Priya S.",
        language: "en",
        body: "Hi — I have a severe peanut allergy. Does the salsa or the pastor marinade have peanuts or peanut oil?",
        receivedAt: new Date(now.getTime() - 40 * 60_000),
        status: "pending_approval",
        category: "allergy",
        sensitive: true,
        requiresOwnerApproval: true,
        sensitivityFlags: JSON.stringify(["allergy"]),
        draftReply:
          "Thank you for flagging this, Priya. Our pastor marinade and house salsas are made without peanuts or peanut oil, but we are not a peanut-free kitchen and share fryers and prep tables. If you would like, we can hold the salsa and note the ticket for extra care. Please wait for our owner-approved confirmation before ordering if your allergy is severe.",
      },
      {
        locationId: GLENDALE,
        platform: "google",
        customerName: "Tom H.",
        language: "en",
        body: "The order was 25 minutes late and the asada was dry. I want a refund for the whole $48.",
        receivedAt: new Date(now.getTime() - 2 * 60 * 60_000),
        status: "pending_approval",
        category: "refund",
        sensitive: true,
        requiresOwnerApproval: true,
        sensitivityFlags: JSON.stringify(["refund", "complaint"]),
        draftReply:
          "Tom, I'm sorry the asada and the wait missed the mark. We can refund the asada tacos ($14.50) and add a $10 store credit for the delay. A full $48 refund needs owner approval — we'll confirm shortly.",
      },
      {
        locationId: GLENDALE,
        platform: "email",
        customerName: "Westgate Office Park",
        language: "en",
        body: "We'd like to cater tacos for 80 people this Friday, 11:30am drop-off. Can you do a mixed pastor/asada/tinga spread with salsas, rice, beans, and aguas? Budget is around $1,200.",
        receivedAt: new Date(now.getTime() - 5 * 60 * 60_000),
        status: "pending_approval",
        category: "catering",
        sensitive: true,
        requiresOwnerApproval: true,
        sensitivityFlags: JSON.stringify(["catering", "large_order"]),
        draftReply:
          "Thank you for thinking of Chilakil for 80 guests. A mixed taco spread with rice, beans, salsas, and aguas is in range of your $1,200 budget at the Glendale kitchen. Owner will confirm capacity and a written quote before we lock Friday 11:30am.",
      },
      {
        locationId: GLENDALE,
        platform: "ubereats",
        customerName: "Lina G.",
        language: "en",
        body: "Can I add extra salsa roja to my burrito that's already paid?",
        receivedAt: new Date(now.getTime() - 25 * 60_000),
        status: "pending_approval",
        category: "general",
        sensitive: false,
        requiresOwnerApproval: false,
        sensitivityFlags: JSON.stringify([]),
        draftReply:
          "Yes — we'll add a side of salsa roja to the ticket. It should go out with the current Uber Eats bag.",
      },
      {
        locationId: AVONDALE,
        platform: "doordash",
        customerName: "Héctor R.",
        language: "es",
        body: "El pedido llegó incompleto: faltaron los tacos de pastor. Quiero reembolso o que me los manden otra vez.",
        receivedAt: new Date(now.getTime() - 70 * 60_000),
        status: "pending_approval",
        category: "refund",
        sensitive: true,
        requiresOwnerApproval: true,
        sensitivityFlags: JSON.stringify(["refund", "complaint", "missing_items"]),
        draftReply:
          "Héctor, disculpa que el pastor no haya llegado. Podemos reembolsar los tacos de pastor o preparar un reemplazo si el trailer todavía está en servicio. El dueño confirmará cuál opción aplicamos.",
      },
      {
        locationId: AVONDALE,
        platform: "instagram",
        customerName: "Valeria M.",
        language: "es",
        body: "¿A qué hora cierra el trailer hoy y si todavía tienen birria?",
        receivedAt: new Date(now.getTime() - 15 * 60_000),
        status: "pending_approval",
        category: "general",
        sensitive: false,
        requiresOwnerApproval: false,
        sensitivityFlags: JSON.stringify([]),
        draftReply:
          "Hola Valeria — el trailer en Avondale cierra a las 8:00pm. Hoy no hay birria en el trailer; sí hay pastor, asada y tinga.",
      },
      {
        locationId: AVONDALE,
        platform: "phone",
        customerName: "Chris D.",
        language: "en",
        body: "My kid has a dairy allergy. Is the quesadilla the only item with cheese, or is cheese in the beans too?",
        receivedAt: new Date(now.getTime() - 3 * 60 * 60_000),
        status: "pending_approval",
        category: "allergy",
        sensitive: true,
        requiresOwnerApproval: true,
        sensitivityFlags: JSON.stringify(["allergy"]),
        draftReply:
          "Thanks for asking. Cheese is in the quesadilla and sprinkled on some plates; our beans are made without dairy. We can leave cheese off and change gloves. Because this is an allergy question, the owner will confirm before we send.",
      },
      {
        locationId: GLENDALE,
        platform: "grubhub",
        customerName: "Nate P.",
        language: "en",
        body: "Food was great, just saying thanks — extra cilantro next time if you can!",
        receivedAt: new Date(now.getTime() - 26 * 60 * 60_000),
        status: "sent",
        category: "general",
        sensitive: false,
        requiresOwnerApproval: false,
        sensitivityFlags: JSON.stringify([]),
        draftReply: "Appreciate you, Nate. We'll put extra cilantro on the ticket next time.",
        approvedReply: "Appreciate you, Nate. We'll put extra cilantro on the ticket next time.",
      },
    ],
  });

  await prisma.review.createMany({
    data: [
      {
        locationId: GLENDALE,
        platform: "google",
        rating: 5,
        author: "Andrea V.",
        text: "Pastor is the real deal. Fast for a weeknight pickup.",
        reviewedAt: new Date(now.getTime() - 6 * 60 * 60_000),
        responded: true,
        responseText: "Gracias Andrea — glad the pastor hit. See you on Camelback.",
      },
      {
        locationId: GLENDALE,
        platform: "yelp",
        rating: 2,
        author: "Brad K.",
        text: "Waited 20 minutes at the counter and the salsa was too hot with no warning. Won't be back.",
        reviewedAt: new Date(now.getTime() - 9 * 60 * 60_000),
        responded: false,
      },
      {
        locationId: GLENDALE,
        platform: "doordash",
        rating: 4,
        author: "Michelle T.",
        text: "Burrito was huge. Driver was late but food still warm.",
        reviewedAt: new Date(now.getTime() - 30 * 60 * 60_000),
        responded: false,
      },
      {
        locationId: AVONDALE,
        platform: "google",
        rating: 5,
        author: "Omar F.",
        text: "Trailer slaps. Asada tacos + elote after the game.",
        reviewedAt: new Date(now.getTime() - 4 * 60 * 60_000),
        responded: true,
        responseText: "Let's go Omar — trailer will be at Civic Center again this week.",
      },
      {
        locationId: AVONDALE,
        platform: "ubereats",
        rating: 3,
        author: "Kim S.",
        text: "Missing salsa cups. Tacos themselves were good.",
        reviewedAt: new Date(now.getTime() - 20 * 60 * 60_000),
        responded: false,
      },
      {
        locationId: AVONDALE,
        platform: "doordash",
        rating: 1,
        author: "Anonymous",
        text: "Order never showed. App said delivered. Very upset.",
        reviewedAt: new Date(now.getTime() - 8 * 60 * 60_000),
        responded: false,
      },
    ],
  });
}

async function seedMarketing(today: string) {
  await prisma.marketingCampaign.createMany({
    data: [
      {
        locationId: GLENDALE,
        name: "Camelback lunch specials",
        channel: "instagram",
        status: "active",
        startDate: shiftIsoDate(today, -10),
        endDate: shiftIsoDate(today, 4),
        spend: 180,
        impressions: 24100,
        clicks: 640,
        notes: "Stories + reel of pastor trompo. Glendale only.",
      },
      {
        locationId: GLENDALE,
        name: "Google Business posts",
        channel: "google",
        status: "active",
        startDate: shiftIsoDate(today, -20),
        spend: 0,
        impressions: 4100,
        clicks: 190,
        notes: "Organic GBP. Do not mix with Avondale listing.",
      },
      {
        locationId: AVONDALE,
        name: "Trailer tonight geo-fence",
        channel: "facebook",
        status: "active",
        startDate: today,
        endDate: today,
        spend: 45,
        impressions: 8200,
        clicks: 210,
        notes: "1-mile radius around Civic Center. Avondale spend only.",
      },
      {
        locationId: AVONDALE,
        name: "SMS: trailer hours",
        channel: "sms",
        status: "scheduled",
        startDate: shiftIsoDate(today, 1),
        spend: 22,
        notes: "Opt-in list for Avondale regulars.",
      },
      {
        locationId: null,
        name: "Brand: Chilakil To Go awareness",
        channel: "instagram",
        status: "draft",
        startDate: shiftIsoDate(today, 7),
        spend: 0,
        notes: "Brand-level creative. No location spend until you assign it.",
      },
    ],
  });
}

async function seedIntegrations() {
  const rows = [
    [GLENDALE, "doordash", "DOORDASH_GLENDALE_API_KEY", "DOORDASH_GLENDALE_STORE_ID"],
    [GLENDALE, "ubereats", "UBEREATS_GLENDALE_CLIENT_SECRET", "UBEREATS_GLENDALE_STORE_ID"],
    [GLENDALE, "grubhub", "GRUBHUB_GLENDALE_API_KEY", "GRUBHUB_GLENDALE_STORE_ID"],
    [GLENDALE, "square", "SQUARE_GLENDALE_ACCESS_TOKEN", "SQUARE_GLENDALE_LOCATION_ID"],
    [GLENDALE, "meta", "META_GLENDALE_PAGE_TOKEN", null],
    [GLENDALE, "banking", "BANKING_GLENDALE_SECRET_REF", null],
    [AVONDALE, "doordash", "DOORDASH_AVONDALE_API_KEY", "DOORDASH_AVONDALE_STORE_ID"],
    [AVONDALE, "ubereats", "UBEREATS_AVONDALE_CLIENT_SECRET", "UBEREATS_AVONDALE_STORE_ID"],
    [AVONDALE, "grubhub", "GRUBHUB_AVONDALE_API_KEY", "GRUBHUB_AVONDALE_STORE_ID"],
    [AVONDALE, "square", "SQUARE_AVONDALE_ACCESS_TOKEN", "SQUARE_AVONDALE_LOCATION_ID"],
    [AVONDALE, "meta", "META_AVONDALE_PAGE_TOKEN", null],
    [AVONDALE, "banking", "BANKING_AVONDALE_SECRET_REF", null],
  ] as const;

  await prisma.integrationConfig.createMany({
    data: rows.map(([locationId, provider, secretRef, storeRef]) => ({
      locationId,
      provider,
      status: "placeholder",
      secretRef,
      storeRef,
      notes: "Phase 1: env placeholder only. No live API calls.",
    })),
  });
}

async function seedAlerts(today: string) {
  await prisma.alert.createMany({
    data: [
      {
        locationId: GLENDALE,
        type: "fees",
        severity: "warning",
        title: "High DoorDash fee day",
        body: "DoorDash commission + fees are 30% of DoorDash gross today ($337 on $1,124). Mix is still healthy in-store.",
        date: today,
        href: "/doordash",
      },
      {
        locationId: GLENDALE,
        type: "labor",
        severity: "warning",
        title: "Closer overlap tonight",
        body: "Labor is $1,312 on $5,842.50 gross (22.5%), still under the 25% target. Sofia and the expo both close — send one home if tickets slow after 8.",
        date: today,
        href: "/employees",
      },
      {
        locationId: GLENDALE,
        type: "review",
        severity: "critical",
        title: "2-star Yelp review",
        body: "Brad K. mentioned a 20-minute counter wait and salsa heat. No owner reply yet.",
        date: today,
        href: "/reviews",
      },
      {
        locationId: GLENDALE,
        type: "message",
        severity: "critical",
        title: "Allergy + catering need approval",
        body: "Peanut allergy question and a 80-guest catering request are waiting. Do not send drafts until you approve.",
        date: today,
        href: "/messages",
      },
      {
        locationId: AVONDALE,
        type: "fees",
        severity: "warning",
        title: "Delivery-heavy mix",
        body: "Trailer delivery is 68% of gross today. Net after commissions is thinner than Glendale — $1,951 net on $2,419 gross.",
        date: today,
        href: "/sales",
      },
      {
        locationId: AVONDALE,
        type: "review",
        severity: "critical",
        title: "1-star DoorDash: never arrived",
        body: "Customer says the app marked delivered. Needs a reply and possibly a DoorDash support ticket (Phase 2).",
        date: today,
        href: "/reviews",
      },
      {
        locationId: AVONDALE,
        type: "message",
        severity: "critical",
        title: "Spanish refund + dairy allergy",
        body: "Héctor's missing pastor tacos and Chris's dairy allergy both require owner approval.",
        date: today,
        href: "/messages",
      },
      {
        locationId: GLENDALE,
        type: "labor",
        severity: "warning",
        title: "Labor over target (Fri)",
        body: "Four days ago labor hit $1,488 / $5,630 gross (26.4%), over the 25% target — closer overlap.",
        date: shiftIsoDate(today, -4),
        href: "/employees",
      },
    ],
  });
}

async function seedDoorDashPricing() {
  await prisma.doorDashPricingNote.deleteMany();
  await prisma.doorDashPricingLine.deleteMany();
  await prisma.doorDashPricingReport.deleteMany();
  for (const report of DOORDASH_PRICING_REPORTS) {
    await prisma.doorDashPricingReport.create({
      data: {
        locationId: report.locationId,
        reportDate: report.reportDate,
        doorDashStoreId: report.doorDashStoreId,
        title: report.title,
        headline: report.headline,
        summary: report.summary,
        commissionRate: report.commissionRate,
        commissionNote: report.commissionNote,
        exclusionNote: report.exclusionNote,
        methodNote: report.methodNote,
        addonNote: report.addonNote,
        addonNoteTone: report.addonNoteTone,
        popularityLead: report.popularityLead,
        tenOrderExample: report.tenOrderExample,
        pdfPath: report.pdfPath,
        lines: {
          create: report.lines.map((line, sortOrder) => ({
            kind: line.kind,
            sortOrder,
            name: line.name,
            inStorePrice: line.inStorePrice,
            doorDashPrice: line.doorDashPrice,
            onDoorDash: line.onDoorDash,
            markupPct: line.markupPct,
            keepNow: line.keepNow,
            vsInStore: line.vsInStore,
            breakEvenPrice: line.breakEvenPrice,
            recommendedPrice: line.recommendedPrice,
            changeNeeded: line.changeNeeded,
            keepRecommended: line.keepRecommended,
            status: line.status,
            footnote: line.footnote,
            squareSold30d: line.squareSold30d,
          })),
        },
        notes: {
          create: report.notes.map((note, sortOrder) => ({
            sortOrder,
            kind: note.kind,
            body: note.body,
          })),
        },
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
