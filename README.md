# Chilakil Owner

Mobile-first owner app for **Chilakil To Go**. Two operations are tracked as separate businesses and **never silently combined**:

| ID | Name | Type | Timezone |
| --- | --- | --- | --- |
| `glendale` | Glendale Restaurant | restaurant | America/Phoenix |
| `avondale` | Avondale Food Trailer | trailer | America/Phoenix |

The location switcher (**ALL / GLENDALE / AVONDALE**) sits on every financial screen. **ALL** shows each location labeled, plus optional totals marked **Combined total (Glendale + Avondale)**. A single location shows only that store.

Phase 1 UI, auth, and the assistant are still here. Sales days and DoorDash weeks can now be imported into Postgres. There are still **no live DoorDash, Uber Eats, Grubhub, Square, Meta, or bank API calls** — reports are posted to the ingest API. Integration rows store env var *names* (`secretRef`), never secret values.

## Run locally

Postgres is required. Pick one:

**Docker**

```bash
docker compose up -d
```

**Neon dev database**

Create a Neon branch and copy its pooled URL into `DATABASE_URL` and its direct URL into `DIRECT_URL`.

Then:

```bash
cp .env.example .env
# Fill in AUTH_SECRET, INGEST_TOKEN, and OWNER_PASSWORD.
# Generate secrets with: openssl rand -base64 32
# For the local demo dataset, set SEED_SAMPLE=true

npm install
npx prisma migrate deploy
npx prisma db seed
npm run dev
```

Or `npm run setup && npm run dev` after `.env` is filled in.

Open [http://localhost:3000](http://localhost:3000). On iPhone Safari: Share → Add to Home Screen. The PWA manifest and PNG icons are included.

### Owner login

`npx prisma db seed` creates the owner from `OWNER_EMAIL` and `OWNER_PASSWORD`. Both are required. The app does not ship a demo password. Re-running the seed updates that owner's password to the current `OWNER_PASSWORD`.

Set `SEED_SAMPLE=true` only when you want the local demo financials. Those rows are marked `source = sample` and show a SAMPLE badge. Production should leave `SEED_SAMPLE` unset.

### Reset the local database

```bash
npm run db:reset
```

## Stack

- Next.js App Router + TypeScript + Tailwind CSS v4
- PostgreSQL via Prisma (`DATABASE_URL` at runtime, `DIRECT_URL` for migrations)
- Signed HTTP-only JWT session (`jose` + `bcryptjs`). `NEXTAUTH_SECRET` is accepted as an alias for `AUTH_SECRET`
- Optional OpenAI for the assistant (`OPENAI_API_KEY`). If unset, answers are deterministic from the database

Keep location-scoped rows (`locationId` on sales, expenses, labor, messages, etc.). Do not add unscoped “company total” tables that skip the switcher.

## Deploy to Vercel + Neon

Do this from the Vercel dashboard. Nothing in this repo deploys itself.

1. Import the GitHub repo as a Vercel project (Next.js). The build command is `npm run build`, which runs `prisma generate`, `prisma migrate deploy`, and `next build`.
2. In the Vercel project, open **Storage** (or Integrations) and add **Neon** from the Marketplace. Create the database and connect it to this project.
3. Copy the Neon URLs into Vercel environment variables for Production (and Preview, if you want preview databases):
   - `DATABASE_URL` = the **pooled** Neon URL
   - `DIRECT_URL` = the **unpooled / direct** Neon URL (`DATABASE_URL_UNPOOLED` or `POSTGRES_URL_NON_POOLING` in the Neon integration)
4. Set the rest of the required variables (same values are not stored in git):

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Pooled Postgres URL |
| `DIRECT_URL` | Yes | Direct Postgres URL for migrations |
| `AUTH_SECRET` | Yes | `openssl rand -base64 32` |
| `INGEST_TOKEN` | Yes | Bearer token for `/api/ingest/*`. Same generator |
| `OWNER_EMAIL` | Yes | Used by the one-time seed, not by the Vercel build |
| `OWNER_PASSWORD` | Yes | At least 10 characters. Used by the one-time seed |
| `OWNER_NAME` | No | Defaults to Victor Mayorga |
| `APP_URL` | No | Public URL, for example `https://your-app.vercel.app` |
| `OPENAI_API_KEY` | No | Assistant only. Leave unset to use local analysis |
| `NEXTAUTH_SECRET` | No | Optional alias of `AUTH_SECRET` |
| `SEED_SAMPLE` | No | Leave **unset** in production |

5. Deploy. The first deploy applies `prisma/migrations`.
6. Create the owner once, from your machine, pointed at the production database. Do not put the password in the Vercel build command.

```bash
DATABASE_URL="postgresql://…" \
DIRECT_URL="postgresql://…" \
OWNER_EMAIL="owner@chilakil.com" \
OWNER_PASSWORD="…" \
OWNER_NAME="Victor Mayorga" \
npx prisma db seed
```

Leave `SEED_SAMPLE` unset for that command. It upserts the two locations and the owner, and does not load demo sales.

7. Add to the iPhone Home Screen from Safari. Confirm the icon is the Chilakil mark.

## Import daily sales and DoorDash weeks

`POST /api/ingest/daily-sales` and `POST /api/ingest/doordash-weekly` require `Authorization: Bearer $INGEST_TOKEN`. Each accepts one JSON object, a JSON array, or `{ "records": [ ... ] }`. CSV is accepted when `Content-Type` is `text/csv`. Unknown locations are rejected. A DoorDash store id must match the location (`32669627` Glendale, `27859030` Avondale) or the whole request is rejected and nothing is written. Re-posting the same location and date (or location and week start) updates that row.

```bash
npm run ingest -- daily-sales examples/daily-sales.json
npm run ingest -- doordash-weekly examples/doordash-weekly.csv
```

Example files live in `examples/`. `source` cannot be `sample` on these endpoints; that value is only for the local demo seed.

## Modules

Bottom tabs: **Home · Sales · Inbox · Ask · More**. More opens the full grid.

1. Dashboard — today’s gross, delivery, estimated net after fees, labor, estimated food cost, order count, average ticket, alerts
2. Sales — channel mix, 5-day trend, recent tickets
3. DoorDash / 4. Uber Eats / 5. Grubhub — per-location daily summaries + secret-ref placeholders
6. Expenses
7. Food Cost — theoretical vs purchases + recipe %
8. Menu & Recipes
9. Customer Messages — EN/ES chrome; sensitive types require owner Approve / Edit / Reject
10. Reviews
11. Marketing
12. Employees
13. AI Assistant — queries seeded data; respects the location filter

## Customer messages (approval gate)

AI may draft a reply. The app **must not send** without owner approval when the message is a complaint, refund, allergy question, large catering request, or otherwise flagged sensitive. Those rows have `requiresOwnerApproval = true` and `sensitive = true`. The detail screen shows the draft plus **Approve & send**, **Save draft**, and **Reject**.

## AI Assistant

`POST /api/assistant` loads a snapshot from Prisma for the current location scope, then:

1. If `OPENAI_API_KEY` is set, asks the model to answer **only from that snapshot**
2. Otherwise (or on LLM failure) uses rule-based analysis of the same snapshot

It never invents live platform API results. The snapshot `source` field says so.

## Schema (core)

- `Location` — stable ids `glendale` / `avondale`
- `DailySales` + `Order` — channel mix: `in_store | doordash | ubereats | grubhub | other`
- `DailySalesRecord` — one imported Phoenix day per location (unique on location + date)
- `DoorDashWeeklyReport` — one DoorDash merchant week per location (unique on location + week start)
- `DeliverySummary` — per location + platform + date
- `DailyOps` — labor hours/cost, theoretical food cost, actual purchases, targets
- `Expense`, `Ingredient`, `Recipe`, `RecipeIngredient`, `MenuItem`
- `CustomerMessage` — `language` `en|es`, sensitivity flags, draft/approved reply
- `Review`, `MarketingCampaign`, `Employee`, `Shift`
- `IntegrationConfig` — `secretRef` env var name only
- `Alert`, `AiThread`, `AiMessage`, `User`

Seed covers **today (America/Phoenix)** plus four prior days for both locations, with deliberately different volume so switching ALL / GLENDALE / AVONDALE is obvious.

Today’s seeded shape (Phoenix “today”, not a fixed calendar date):

| | Glendale | Avondale |
| --- | --- | --- |
| Gross | $5,842.50 | $2,418.75 |
| Delivery | $1,986.00 | $1,654.00 |
| Net after fees | $5,278.94 | $1,950.99 |
| Labor | $1,312 | $486 |
| Theoretical food | $1,694.33 | $773.99 |
| Orders | 127 | 61 |

## Env vars

See `.env.example`. Required: `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `INGEST_TOKEN`, `OWNER_EMAIL`, `OWNER_PASSWORD`. Optional: `OPENAI_API_KEY`, `APP_URL`, `OWNER_NAME`, `SEED_SAMPLE`. Future per-location placeholders: `DOORDASH_*`, `UBEREATS_*`, `GRUBHUB_*`, `SQUARE_*`, `META_*`, `BANKING_*`.

`DailySales` is still the channel-level sample mix. Imported days live in `DailySalesRecord` (unique on location + Phoenix date). DoorDash merchant weeks live in `DoorDashWeeklyReport` (unique on location + week start). The dashboard uses `DailySalesRecord` for today when a row exists.

## Tests

```bash
npm test
```

Location isolation helpers: ALL returns both ids; a single scope never includes the other store; combined totals keep an explicit label.
