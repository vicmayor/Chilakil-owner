import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { csvToRecords } from "../src/lib/csv";
import {
  DAILY_SALES_NUMERIC_COLUMNS,
  DOORDASH_WEEKLY_NUMERIC_COLUMNS,
  EMPLOYEE_HOURS_NUMERIC_COLUMNS,
  UBEREATS_WEEKLY_NUMERIC_COLUMNS,
} from "../src/lib/ingest";
import { loadEnvFile } from "../src/lib/load-env";

loadEnvFile();

const kinds = {
  "daily-sales": {
    path: "/api/ingest/daily-sales",
    numeric: DAILY_SALES_NUMERIC_COLUMNS,
  },
  "doordash-weekly": {
    path: "/api/ingest/doordash-weekly",
    numeric: DOORDASH_WEEKLY_NUMERIC_COLUMNS,
  },
  "ubereats-weekly": {
    path: "/api/ingest/ubereats-weekly",
    numeric: UBEREATS_WEEKLY_NUMERIC_COLUMNS,
  },
  "employee-hours": {
    path: "/api/ingest/employee-hours",
    numeric: EMPLOYEE_HOURS_NUMERIC_COLUMNS,
  },
} as const;

async function main() {
  const kind = process.argv[2] as keyof typeof kinds | undefined;
  const file = process.argv[3];
  if (!kind || !(kind in kinds) || !file) {
    console.error(
      "Usage: npm run ingest -- <daily-sales|doordash-weekly|ubereats-weekly|employee-hours> <file.json|file.csv>",
    );
    process.exit(1);
  }

  const token = process.env.INGEST_TOKEN;
  if (!token) {
    console.error("Set INGEST_TOKEN before posting.");
    process.exit(1);
  }

  const base = (process.env.INGEST_BASE_URL || process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const text = readFileSync(file, "utf8");
  const payload =
    extname(file).toLowerCase() === ".csv" ? csvToRecords(text, kinds[kind].numeric) : JSON.parse(text);

  const response = await fetch(`${base}${kinds[kind].path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const body = await response.text();
  if (!response.ok) {
    console.error(body);
    process.exit(1);
  }
  console.log(body);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
