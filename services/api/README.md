# AURA API (`@aura/api`)

Node + **Express 5** + TypeScript backend for aurora-walls.com (web) and the Aurora Walls app.
PostgreSQL (Supabase, pgvector) via **Drizzle ORM**, files on **Cloudflare R2**, AI via **OpenAI**.

## Structure

```
src/
├── server.ts          # starts HTTP server + hourly trending job
├── app.ts             # express app: middleware order + routes (exported for tests)
├── config/            # env.ts (zod-validated env), db.ts (drizzle client)
├── models/            # Drizzle table definitions (users, wallpapers, collections, likes, otps…)
├── routes/            # URL → middleware → controller (no logic)
├── controllers/       # read request → call service → send response
├── services/          # business logic + database queries
├── validators/        # zod request schemas
├── middleware/        # auth, rate limit, admin secret, multer upload, validate, errors
├── integrations/      # R2, Brevo email, OpenAI, Sightengine
├── jobs/              # trending score recalculation (hourly)
├── utils/             # ApiError, jwt, otp, cookies, screen filter, image metadata…
└── types/             # Express Request augmentation (req.userId)
```

Request flow: `route → middleware → controller → service → models/db`; any thrown `ApiError`
(or unexpected error) is turned into `{ "error": "..." }` by `middleware/errorHandler.ts`.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Run with `../../.env` (watch mode) |
| `pnpm dev:test` | Run with `../../.env.test` (emails logged, uploads forced to `pending`) |
| `pnpm build` / `pnpm start` | Compile to `dist/` / run `dist/server.js` |
| `pnpm test` | Unit tests (offline) |
| `pnpm test:contract` | Black-box HTTP contract suite against `API_BASE_URL` (default `http://localhost:3001`) |
| `pnpm test:cleanup` | Delete every leftover `aura-test+…@example.com` user and their data/files |
| `pnpm db:push` / `db:studio` / `db:generate` | drizzle-kit (schema in `src/models`) |

## Contract tests run against the real database

Read `docs/express-migration-plan.md` → *Real-DB Safety Rules* first. In short: start the server with
`pnpm dev:test`, run `pnpm test:contract`, then `pnpm test:cleanup`. Tests only create and delete their
own `aura-test+…@example.com` users; real data is read-only.
