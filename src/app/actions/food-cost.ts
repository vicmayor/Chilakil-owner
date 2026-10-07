"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { MAX_MONEY_INPUT } from "@/lib/food-cost";

const moneyOrNull = z.union([z.null(), z.number().finite().min(0).max(MAX_MONEY_INPUT)]);

const saveSchema = z
  .object({
    locationId: z.enum(["glendale", "avondale"]),
    ingredients: z
      .array(
        z.object({
          id: z.string().min(1).max(64),
          costPerUnit: moneyOrNull,
          addonPrice: moneyOrNull,
        }),
      )
      .max(300),
    menuItems: z
      .array(
        z.object({
          id: z.string().min(1).max(64),
          price: moneyOrNull,
        }),
      )
      .max(300),
  })
  .superRefine((value, ctx) => {
    const ingredientIds = value.ingredients.map((row) => row.id);
    const menuIds = value.menuItems.map((row) => row.id);
    if (new Set(ingredientIds).size !== ingredientIds.length || new Set(menuIds).size !== menuIds.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Duplicate rows" });
    }
    if (ingredientIds.length + menuIds.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Nothing to save" });
    }
  });

export type SaveFoodCostResult = { ok: true } | { ok: false; error: string };

export async function saveFoodCostWorkbook(input: unknown): Promise<SaveFoodCostResult> {
  const session = await requireSession();
  if (session.role !== "owner") {
    return { ok: false, error: "Only the owner can save workbook prices." };
  }

  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) {
    const empty = parsed.error.issues.some((issue) => issue.message === "Nothing to save");
    return {
      ok: false,
      error: empty ? "Nothing to save for this kitchen." : "Check the numbers and try again.",
    };
  }

  const { locationId, ingredients, menuItems } = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      for (const row of ingredients) {
        const result = await tx.ingredient.updateMany({
          where: { id: row.id, locationId },
          data: { costPerUnit: row.costPerUnit, addonPrice: row.addonPrice },
        });
        if (result.count !== 1) {
          throw new Error("INGREDIENT_SCOPE");
        }
      }
      for (const row of menuItems) {
        const result = await tx.menuItem.updateMany({
          where: { id: row.id, locationId, active: true },
          data: { price: row.price },
        });
        if (result.count !== 1) {
          throw new Error("MENU_SCOPE");
        }
      }
    });
  } catch (error) {
    if (error instanceof Error && (error.message === "INGREDIENT_SCOPE" || error.message === "MENU_SCOPE")) {
      return {
        ok: false,
        error: "Those prices are not in this kitchen. Refresh and try again.",
      };
    }
    throw error;
  }

  revalidatePath("/food-cost");
  revalidatePath("/menu");
  return { ok: true };
}
