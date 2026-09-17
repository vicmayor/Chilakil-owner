# Chilakil Owner

Mobile-first owner app for **Chilakil To Go**. Two operations are tracked as separate businesses and **never silently combined**:

| ID | Name | Type | Timezone |
| --- | --- | --- | --- |
| `glendale` | Glendale Restaurant | restaurant | America/Phoenix |
| `avondale` | Avondale Food Trailer | trailer | America/Phoenix |

The location switcher (**ALL / GLENDALE / AVONDALE**) sits on every financial screen. **ALL** shows each location labeled, plus optional totals marked **Combined total (Glendale + Avondale)**. A single location shows only that store.

This is **Phase 1**: UI, SQLite schema, seed data, auth shell, and an assistant that reads the local database. There are **no live DoorDash, Uber Eats, Grubhub, Square, Meta, Google Ads, TikTok, or bank API calls**. Integration rows store env var *names* (`secretRef`), never secret values.

## Run locally

```bash
cp .env.example .env
# set AUTH_SECRET / NEXTAUTH_SECRET to a long random string:
#   openssl rand -base64 32

npm install
npx prisma generate
npx prisma db push
npx prisma db seed
npm run dev
```

Or `npm run setup && npm run dev`.

Open [http://localhost:3000](http://localhost:3000). On iPhone Safari: Share → Add to Home Screen (PWA manifest is included).

### Seed login

| | |
| --- | --- |
| Email | `owner@chilakil.com` |
| Password | `ChilakilOwner1!` (override with `OWNER_PASSWORD`) |

Change that password before any shared or production use. It exists only so the local demo can sign in.

### One-liner reset

```bash
npm run db:reset
```

## Stack

- Next.js App Router + TypeScript + Tailwind CSS v4
- SQLite via Prisma (see `prisma/schema.prisma`)
- Signed HTTP-only JWT session (`jose` + `bcryptjs`). `NEXTAUTH_SECRET` is accepted as an alias for `AUTH_SECRET` so the env list matches common Auth.js setups
- Optional OpenAI for the assistant (`OPENAI_API_KEY`). If unset, answers are deterministic from SQLite

### Path to Postgres

1. Change `provider = "sqlite"` to `provider = "postgresql"` in `prisma/schema.prisma`
2. Point `DATABASE_URL` at Postgres
3. `npx prisma migrate dev`

Keep location-scoped rows (`locationId` on sales, expenses, labor, messages, etc.). Do not add unscoped “company total” tables that skip the switcher.

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
11. Marketing — Meta / Google / TikTok sample spend/reach/clicks/results by location (live ad APIs are Phase 2)
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
- `DailySales` + `Order` — `channel`: `in_store | doordash | ubereats | grubhub | other`
- `DeliverySummary` — per location + platform + date
- `DailyOps` — labor hours/cost, theoretical food cost, actual purchases, targets
- `Expense`, `Ingredient`, `Recipe`, `RecipeIngredient`, `MenuItem`
- `CustomerMessage` — `language` `en|es`, sensitivity flags, draft/approved reply
- `Review`, `MarketingCampaign` (`platform` `meta|google|tiktok`, `reach`, `results`, `resultType`; `locationId` null = business-wide)
- `AdDailyStats` — per-campaign daily spend/reach/impressions/clicks/results for Meta, Google Ads, and TikTok (seeded; no live API)
- `Employee`, `Shift`
- `IntegrationConfig` — `secretRef` env var name only. Paid ads: `META_*`, `GOOGLE_ADS_*`, `TIKTOK_*`
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

Today’s seeded paid ads (sample, not live):

| | Glendale | Avondale | Business-wide (ALL only) |
| --- | --- | --- | --- |
| Meta | $79.70 | $30.15 | $35.00 |
| Google Ads | $37.50 | $8.25 | $14.00 |
| TikTok | $16.80 | $9.50 | $12.00 |

## Env vars

See `.env.example`. Required for local run: `DATABASE_URL`, `AUTH_SECRET` (or `NEXTAUTH_SECRET`). Optional: `OPENAI_API_KEY`. Future per-location placeholders: `DOORDASH_*`, `UBEREATS_*`, `GRUBHUB_*`, `SQUARE_*`, `META_*`, `GOOGLE_ADS_*`, `TIKTOK_*`, `BANKING_*`.

### Paid ads (Phase 1 placeholders)

Marketing is a phone hub with **META / GOOGLE / TIKTOK** tabs. Each tab shows **seeded** campaigns so ALL / GLENDALE / AVONDALE changes the numbers. There are **no live Meta, Google Ads, or TikTok API calls**.

| Env var | Used as |
| --- | --- |
| `META_GLENDALE_ACCESS_TOKEN` / `META_AVONDALE_ACCESS_TOKEN` | Meta `secretRef` |
| `META_AD_ACCOUNT_ID` | Meta `storeRef` (shared ad account) |
| `GOOGLE_ADS_GLENDALE_ACCESS_TOKEN` / `GOOGLE_ADS_AVONDALE_ACCESS_TOKEN` | Google Ads `secretRef` |
| `GOOGLE_ADS_CUSTOMER_ID` | Google Ads `storeRef` |
| `TIKTOK_GLENDALE_ACCESS_TOKEN` / `TIKTOK_AVONDALE_ACCESS_TOKEN` | TikTok `secretRef` |
| `TIKTOK_ADVERTISER_ID` | TikTok `storeRef` |

Leave them blank until Phase 2. Never put token values in the database.

Business-wide campaigns (`locationId` null) appear **only on ALL**, labeled **Business-wide**. They are never attributed to Glendale or Avondale.

## Tests

```bash
npm test
```

Location isolation helpers: ALL returns both ids; a single scope never includes the other store; combined totals keep an explicit label.
