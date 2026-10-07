import { PrismaClient } from "@prisma/client";
import { importFoodCostWorkbook } from "../src/lib/food-cost-import";
import { loadEnvFile } from "../src/lib/load-env";

loadEnvFile();

const prisma = new PrismaClient();

async function main() {
  const filePath = process.argv[2];
  const result = await importFoodCostWorkbook(prisma, filePath);
  console.log(
    `Food cost workbook loaded for ${result.locations} locations: ${result.ingredients} ingredients, ${result.menuItems} menu items. Existing workbook rows were updated in place.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
