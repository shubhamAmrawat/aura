# AURA API — Hono → Express Migration Plan

> **Goal:** Rebuild `services/api` as a standard Node + Express backend
> (routes / controllers / services / models / middleware / utils) with **zero
> behaviour change** for the web and mobile clients.
>
> **Golden rule:** this migration changes *structure only*. Same URLs, same
> status codes, same JSON shapes, same error messages, same cookies and headers.
> Known bugs are **not** fixed here (see Phase 9), because fixing them would make
> the old and new APIs impossible to compare.

> ## ✅ Status (2026-10-10)
> Phases 0–6 **done**. Hono, `src/_legacy` and `packages/db` are removed; the API now runs on Express 5.
> - Contract suite: **107/107** against the old Hono API (baseline) **and** against the new Express build (`dist/server.js`).
> - Unit tests: **19/19**. Side-by-side diff of 132 edge-case requests: only the 3 accepted deltas below.
> - Schema drift check: identical drizzle snapshots. Real DB row counts unchanged, 0 test users left.
> - **Remaining for Shubham:** Phase 7 (manual app testing) and Phase 8 (Render commands + merge).

---

## 0. Decisions (locked)

| Topic | Decision |
|---|---|
| Framework | **Express 5** (async errors reach the error handler automatically) |
| Models | Move the Drizzle schema + DB client **out of `packages/db` into `services/api/src/models` + `src/config/db.ts`**. Delete `packages/db` at cutover. |
| Validation | **zod**, via one `validate()` middleware |
| Errors | Services throw `ApiError(status, message)` → one central `errorHandler` |
| Tests | **vitest** + **supertest**, plus a black-box HTTP contract suite run against BOTH servers |
| Database | **Real (prod) Supabase DB + real R2 bucket.** No test DB. Tests follow the *Real-DB Safety Rules* below. |
| Branch | `feat/express-migration` from `local-dev`. **Shubham commits/pushes himself** at each ✅ checkpoint. |

---

## 0.1 Real-DB Safety Rules (apply to every test, every phase)

1. **Backup first.** Supabase backup or `pg_dump` before Phase 1 and before cutover.
2. **Never truncate, never bulk-delete.** No `DELETE`/`UPDATE` without a `WHERE` on test-owned ids.
3. **Test-owned data only.** Every test user's email is `aura-test+<runId>-<n>@example.com`; every row a test creates is tracked and deleted in `afterAll`.
4. **Real data is read-only.** Read endpoints (feeds, trending, search, similar, categories, public collections) are tested against real wallpapers, never modified.
5. **Counters only on test wallpapers.** Like/unlike, `/:id/download`, collections use a wallpaper the test inserts itself (status `pending`, so invisible on the site) and deletes after.
6. **Uploads insert as `pending`** (forced via invalid Sightengine creds in `.env.test`, see Phase 0). Never visible in public feeds; deleted (DB row + R2 object) in `afterAll`. Tests assert `moderationStatus === "pending"` first and abort if not.
7. **Global-write admin endpoints are auth-checked only:** `POST /trending/recalculate` and `POST /reembed-text` are tested for 401 without/with wrong secret, **never executed for real**.
8. **No real emails:** `EMAIL_TRANSPORT=log`; tests read the OTP from the `otps` table (only their own email).
9. **R2:** test files live under the test user's id prefix and are deleted with the user.
10. **Leftover sweeper:** `pnpm test:cleanup` deletes every user matching `aura-test+%@example.com` and all their dependents (likes, collections, collection items, OTPs, uploads + R2 files). Run after every test session and after any crash.
11. **No `drizzle-kit push` to prod** during the migration. Schema checks are offline (see Phase 3).
12. **Rate-limit test** runs against a separate local server instance only (state is in-memory, no DB impact).

---

## 1. Target structure

```
services/api/
├── drizzle.config.ts            # moved from packages/db
├── vitest.config.ts
├── src/
│   ├── server.ts                # app.listen + start jobs
│   ├── app.ts                   # build express app (exported for supertest)
│   ├── config/
│   │   ├── env.ts               # zod-validated process.env (fail fast on boot)
│   │   └── db.ts                # postgres-js + drizzle client
│   ├── models/                  # Drizzle table definitions (the "models")
│   │   ├── index.ts
│   │   ├── user.model.ts
│   │   ├── wallpaper.model.ts   # + categories, enums, vector type
│   │   ├── collection.model.ts
│   │   ├── interaction.model.ts # likes, downloads
│   │   └── auth.model.ts        # otps, sessions
│   ├── routes/                  # URL → middleware → controller (no logic)
│   │   ├── index.ts             # mounts everything under /api
│   │   ├── auth.routes.ts
│   │   ├── category.routes.ts
│   │   ├── wallpaper.routes.ts
│   │   ├── search.routes.ts
│   │   ├── like.routes.ts
│   │   ├── collection.routes.ts
│   │   └── profile.routes.ts
│   ├── controllers/             # read req → call service → send res
│   │   └── *.controller.ts
│   ├── services/                # business logic + DB queries
│   │   └── *.service.ts
│   ├── validators/              # zod schemas per module
│   │   └── *.schema.ts
│   ├── middleware/
│   │   ├── auth.ts              # requireAuth, optionalAuth
│   │   ├── adminSecret.ts       # X-Admin-Secret check
│   │   ├── rateLimit.ts         # general 100/min, upload 10/hr
│   │   ├── upload.ts            # multer memoryStorage (avatar/cover direct)
│   │   ├── validate.ts          # zod → body/query/params
│   │   ├── notFound.ts
│   │   └── errorHandler.ts
│   ├── integrations/            # third-party APIs
│   │   ├── r2.ts
│   │   ├── email.ts             # Brevo (+ EMAIL_TRANSPORT=log for tests)
│   │   ├── openai.ts            # embeddings + vision metadata
│   │   └── sightengine.ts       # moderation
│   ├── jobs/
│   │   └── trending.job.ts      # hourly scheduler + recalc SQL
│   ├── utils/
│   │   ├── ApiError.ts
│   │   ├── jwt.ts
│   │   ├── otp.ts
│   │   ├── cookies.ts           # set/clear aura_token (prod domain logic)
│   │   ├── imageMetadata.ts     # sharp: colour, palette, blurhash, isMobile
│   │   ├── screenFilter.ts      # shared ?screen= parsing
│   │   └── pagination.ts
│   └── types/
│       └── express.d.ts         # req.userId, req.email
└── tests/
    ├── setup/                   # env loading, DB reset, fixtures, helpers
    ├── contract/                # black-box HTTP suite (runs vs Hono AND Express)
    ├── unit/                    # services/utils with mocked integrations
    └── integration/             # supertest against app.ts
```

**Request flow:** `route → middleware (rateLimit, auth, validate, upload) → controller → service → models/db` → response. Any thrown error → `errorHandler`.

---

## 2. Endpoint inventory (49), all must pass parity

| Module | Endpoints |
|---|---|
| root (2) | `GET /`, `GET /health` |
| auth (7) | `POST send-otp`, `POST verify-otp`, `POST signup`, `POST login`, `GET me`, `POST logout`, `PUT become-creator` |
| categories (1) | `GET /` |
| wallpapers (9) | `GET /`, `GET /trending`, `GET /:id`, `GET /:id/similar`, `POST /:id/download`, `POST /upload-url`, `POST /upload`, `POST /trending/recalculate` (admin), `POST /reembed-text` (admin) |
| search (3) | `GET /`, `GET /suggestions`, `GET /autocomplete` |
| likes (3) | `POST /:wallpaperId`, `GET /`, `GET /:wallpaperId` |
| collections (10) | `GET /public`, `GET /saved-ids`, `GET /:id` (optional auth), `GET /`, `POST /`, `PUT /:id`, `DELETE /:id`, `POST /:id/wallpapers`, `DELETE /:id/wallpapers/:wallpaperId`, `GET /check/:wallpaperId` |
| profile (14) | `GET /`, `PUT /`, `POST avatar/upload-url`, `PUT avatar`, `POST avatar/direct`, `POST cover/upload-url`, `PUT cover`, `POST cover/direct`, `POST change-password/verify`, `POST change-password/confirm`, `DELETE /`, `GET uploads`, `PUT uploads/:id`, `DELETE uploads/:id` |

**Behaviour that must be preserved exactly:**
- Route order: static paths (`/trending`, `/saved-ids`, `/check/:id`, `/upload-url`) before `/:id`.
- Auth token from `aura_token` cookie **or** `Authorization: Bearer`, cookie wins.
- `Set-Cookie` strings for signup/login/logout (prod: `Domain=.aurora-walls.com; Secure`).
- Every `Cache-Control` header currently set.
- CORS origins + `credentials: true`.
- Rate limits: 100 req/min/IP global, 10/hr/IP on `/api/wallpapers/upload*`, same 429 bodies.
- Limit/offset clamping per endpoint (e.g. `/wallpapers` default 150, max 100 when given; trending default 50).
- All `{ error: "..." }` messages, word for word, because the clients display them.

**Accepted, documented deltas** (framework differences, invisible to clients; confirmed by the diff probe):
- Unknown route → JSON `{ error: "Not found" }` 404 (Hono returned plain text `404 Not Found`).
- Malformed / missing JSON body → 400 with the field's validation message or `Invalid JSON body` (Hono's handlers returned 500).
- Wrong-type fields (e.g. collection `title: 5`) → 400 validation message instead of 500.
- Uncaught errors in endpoints without a catch-all → JSON `{ error: "Internal Server Error" }` (Hono: plain text).
- Routing is slightly more lenient: trailing slash and path case are ignored by Express (Hono returned 404).

---

## Phase 0 — Prep (½ day)

- [x] Create branch `feat/express-migration` from `local-dev` (Shubham).
- [x] **Prod DB backed up** with `pg_dump` 17.9 → `backups/aura_public_20261010_0929.dump` (gitignored). Row counts at backup: users 10, wallpapers 1968, categories 27, likes 78, collections 7, collection_wallpapers 23, otps 5, downloads 0, sessions 0.
- [x] Create `.env.test` (gitignored): copy of `.env` (real `DATABASE_URL`, real R2) **plus** `EMAIL_TRANSPORT=log`. Keep real `JWT_SECRET`/`ADMIN_SECRET`; keep `OPENAI_API_KEY` so semantic search is tested for real (cost ≈ negligible).
- [x] In `.env.test` set `SIGHTENGINE_API_USER=invalid` / `SIGHTENGINE_API_SECRET=invalid`. Invalid creds make Sightengine fail, and the existing code then saves the upload as **`pending`** (rule 6). ⚠️ Do NOT just remove the keys: missing keys = auto-**approved** = visible on the live site.
- [x] Render's current config recorded (service `aura-api`, Singapore, branch `main`, auto-deploy **On Commit**, no root dir):
  - Build: `cd /opt/render/project/src && npm install -g pnpm && pnpm install && pnpm --filter @aura/types build && pnpm --filter @aura/db build && pnpm --filter @aura/api build`
  - Start: `node /opt/render/project/src/services/api/dist/index.js`
  - ⚠️ Auto-deploys every commit on `main`, so nothing reaches prod until the branch is merged to `main`.

✅ **Checkpoint 0:** backup done, `.env.test` loads.

---

## Phase 1 — Safety net: contract tests against the CURRENT Hono API (1–1.5 days)

The most important phase. Tests are written as **black-box HTTP calls to `API_BASE_URL`**, so the identical suite later runs against Express.

- [ ] Add `vitest` + `tsx` to `services/api` devDeps; `pnpm test:contract` script.
- [ ] One small test-only hook in the *old* code: `EMAIL_TRANSPORT=log` → `sendOTPEmail` logs instead of calling Brevo. Tests read the OTP code straight from the `otps` table.
- [ ] `tests/setup/`:
  - `runId.ts`: unique id per run → test emails `aura-test+<runId>-<n>@example.com`.
  - `tracker.ts`: records every id a test creates (users, wallpapers, collections, R2 keys) → deleted in `afterAll`, children first.
  - `fixtures.ts`: `createTestWallpaper(ownerId)` inserts a `pending` wallpaper (copying a real one's vector so SQL paths run) for counter/collection tests.
  - `auth.ts`: `createUser()` (send-otp → read own OTP from DB → verify → signup) returning `{ token, cookie }`; `makeCreator()`.
  - `scripts/test-cleanup.ts` → `pnpm test:cleanup` (rule 10).
- [ ] Contract tests per module, covering for **every** endpoint:
  - happy path: status, response keys/types (zod response schemas), important headers
  - validation failures (missing fields → exact message)
  - auth: no token → 401, bad token → 401, cookie vs Bearer
  - ownership: other user's collection/upload → 403/404
  - pagination: `limit`, `offset`, `hasMore`, clamping, `screen=mobile|tablet|invalid`
  - side effects verified in DB on **test-owned rows only** (likeCount ±1 on test wallpaper, totalUploads on test user, OTP deleted after login, etc.)
  - read endpoints vs real data: shape + invariants (only `approved` returned, `screen` filter respected, sort order, `hasMore`), not exact rows
  - OTP edge cases: wrong code ×3 → 429, expired, signup with existing email → 409, login unknown → 404
  - rate limit (separate file, own local server instance): 101st request → 429
  - admin endpoints: 401 only (rule 7)
  - CORS preflight from allowed vs disallowed origin
- [ ] Record known-buggy behaviour **as-is** with a `// KNOWN BUG (Phase 9)` comment (e.g. account delete with likes → 500). Test users hit by this are removed by the tracker/sweeper.
- [x] Run suite vs Hono (`pnpm --filter @aura/api dev` with `.env.test`) → **100% green**.
- [x] Run `pnpm test:cleanup` → verify 0 `aura-test+%` users remain.

✅ **Checkpoint 1:** baseline suite green on Hono. This is the definition of "correct".

---

## Phase 2 — Park the old code (15 min)

- [x] Move `services/api/src/*` → `services/api/src/_legacy/` (imports unchanged, still uses `@aura/db`).
- [ ] Point `dev:legacy` script at `src/_legacy/index.ts`.
- [x] Re-run contract suite vs legacy → green.

✅ **Checkpoint 2.**

---

## Phase 3 — Models + DB inside the API (½ day)

- [ ] Copy schema → `src/models/*.model.ts` (identical column definitions, names, enums, defaults, vector type).
- [ ] `src/config/db.ts`: same postgres-js options (`ssl: require`, `max: 5`, IPv4-first DNS).
- [ ] Move `drizzle.config.ts` → `services/api/`, schema glob → `./src/models/*.model.ts`; move `db:push`, `db:studio`, `db:generate` scripts.
- [ ] Add `drizzle-orm`, `postgres`, `drizzle-kit` to the api package.
- [x] **Verify zero schema drift (offline, no DB writes):** run `drizzle-kit generate` with the old `packages/db` schema and with the new `src/models` schema into two temp folders → the two snapshot JSONs must be identical (diff = empty). Temp folders deleted after.
- [ ] `packages/db` stays until cutover (legacy still uses it).

✅ **Checkpoint 3:** no drift.

---

## Phase 4 — Express skeleton + core layer (1 day)

- [ ] Deps: `express@5`, `cors`, `cookie-parser`, `morgan`, `multer`, `zod` (+ `@types/*`, `supertest`). Keep `jsonwebtoken`, `bcryptjs`, `sharp`, `blurhash`, `openai`, `@aws-sdk/*`.
- [ ] `config/env.ts`: zod schema for every env var actually used; crash on boot with a clear message if one is missing.
- [ ] `utils/`: `ApiError`, `jwt`, `otp`, `cookies`, `screenFilter`, `pagination`.
- [ ] `middleware/`: `rateLimit` (same Map logic + sweep), `requireAuth`, `optionalAuth`, `adminSecret`, `validate(schema, "body"|"query"|"params")`, `upload` (multer, field `avatar` / `cover`), `notFound`, `errorHandler` (ApiError → `{ error }`; ZodError → 400 first-issue message; multer errors; unknown → 500 + log).
- [ ] `types/express.d.ts` for `req.userId` / `req.email`.
- [ ] `app.ts` middleware order: rateLimit → morgan → cors → cookieParser → `express.json()` → routes → notFound → errorHandler. `server.ts`: listen on `0.0.0.0:PORT`, start trending job.
- [ ] `integrations/` + `jobs/` ported from `_legacy/lib`.
- [ ] Unit tests: jwt, otp, cookies (dev vs prod strings), screenFilter, pagination, errorHandler, validate.
- [ ] Contract: root + health + CORS + rate-limit files green vs Express.

✅ **Checkpoint 4.**

---

## Phase 5 — Port modules one at a time (3–4 days)

For **each** module, in this order (low → high risk):

1. categories → 2. auth → 3. wallpapers (read: list/trending/:id/similar/download) → 4. search → 5. likes → 6. collections → 7. profile → 8. wallpapers (write: upload-url, upload, admin)

Per-module checklist:
- [ ] `validators/<m>.schema.ts`: zod that accepts **exactly** what the old code accepts and returns the **same** messages. Query params: coerce + clamp like before (no new 400s).
- [ ] `services/<m>.service.ts`: logic + Drizzle queries copied 1:1 from legacy; throw `ApiError` instead of returning `c.json(...)`.
- [ ] `controllers/<m>.controller.ts`: thin; set headers (`Cache-Control`, cookies), call service, `res.status().json()`.
- [ ] `routes/<m>.routes.ts`: same paths, same order, same middleware.
- [ ] Unit tests for the service (mock `integrations/*`; DB calls only on test-owned rows).
- [ ] Run **that module's** contract tests vs Express → green. Re-run the full suite → still green.

Module-specific notes:
- **auth:** `/me` and `/become-creator` move onto shared `requireAuth` (same responses).
- **wallpapers/upload:** keep the `Promise.all([moderation, metadata, embedding])`, key-prefix check, 200px minimum, R2 delete on reject.
- **collections `GET /:id`:** `optionalAuth` (public, or private if owner).
- **profile direct uploads:** multer memory storage replaces `c.req.formData()`; same size/type checks and messages.
- **search/similar:** raw SQL copied verbatim; test with fake vectors.

✅ **Checkpoint 5.x** after each module (8 commits).

---

## Phase 6 — Cutover (½ day)

- [ ] `package.json` scripts: `dev` → `tsx watch --env-file=../../.env src/server.ts`, `build` → `tsc`, `start` → `node dist/server.js`, `test`, `test:contract`.
- [ ] Remove `hono`, `@hono/node-server`, `@aura/db` deps.
- [ ] Delete `src/_legacy/` and `packages/db/`; `pnpm install` to refresh the lockfile.
- [ ] Root: confirm `pnpm-workspace.yaml` / `turbo.json` still fine (`packages/*` now only has `types`).
- [ ] Fresh DB backup.
- [ ] `tsc --noEmit` clean, `pnpm build` → run `node dist/server.js` → full suite green against the **built** output → `pnpm test:cleanup`.
- [ ] Unused env vars listed in the PR description (not deleted from Render yet).

✅ **Checkpoint 6.**

---

## Phase 7 — Manual end-to-end with the real clients (½–1 day)

Run the API locally against the real DB (same safety rules: use a test account `aura-test+manual@example.com`-style, run `pnpm test:cleanup` after; test uploads → delete them from the profile page).

**Web** (`NEXT_PUBLIC_API_URL=http://localhost:3001`, `pnpm --filter @aura/web dev`):
- [ ] Home feed + infinite scroll, Hero featured
- [ ] Latest, Trending, Category pages
- [ ] Wallpaper page: details, similar, download
- [ ] Search: semantic results, keyword fallback
- [ ] Signup with OTP → cookie set → navbar shows user → refresh keeps session
- [ ] Logout → login with OTP
- [ ] Like / unlike; liked state persists
- [ ] Collections: create, add, remove, delete, public view
- [ ] Become creator → upload wallpaper (presigned R2) → appears in feeds
- [ ] Profile: edit name/bio/username, avatar + cover (signed **and** direct fallback), change password, my uploads edit/delete

**Mobile** (`EXPO_PUBLIC_API_URL=http://<LAN-IP>:3001`):
- [ ] Home / Search (suggestions, autocomplete) / Trending / Latest with screen filter
- [ ] Wallpaper detail carousel + similar
- [ ] Download + apply wallpaper (home/lock/both)
- [ ] OTP login/signup, session restore after app restart, profile edit with avatar/cover

✅ **Checkpoint 7:** all boxes ticked.

---

## Phase 8 — Deploy (½ day)

- [ ] Pin Node: add `"engines": { "node": ">=20" }` to root `package.json` (or `NODE_VERSION` env on Render). Express 5 needs Node ≥ 18.
- [ ] New Render commands (the `@aura/db` step is removed, entry file changes):
  - Build: `cd /opt/render/project/src && npm install -g pnpm && pnpm install && pnpm --filter @aura/types build && pnpm --filter @aura/api build`
  - Start: `node /opt/render/project/src/services/api/dist/server.js`
- [ ] Create a **staging** Render service from `feat/express-migration` with the new commands and the same env vars as prod.
- [ ] Run the **read-only** contract subset against staging (`API_BASE_URL=https://<staging>`), with no writes to prod data.
- [ ] Smoke test web + mobile against staging.
- [ ] **Update the prod Render build/start commands first**, then merge → `local-dev` → `main` (Shubham). The merge auto-deploys, and the old commands would fail because `packages/db` and `dist/index.js` no longer exist.
- [ ] Post-deploy: `/health`, read-only contract subset vs prod, watch Render logs ~30 min (trending job runs on the hour).
- [ ] **Rollback plan:** Render "Rollback to previous deploy" (Hono build), or redeploy the last pre-migration commit.

✅ **Done.**

---

## Phase 9 — After migration (separate tasks, one at a time, each with a test first)

0. **The 10 uploads/hour limit never worked** (Hono `upload*` pattern never matched). Not ported; decide whether to enable it (`express-rate-limit` on `/api/wallpapers/upload*`). Test `99-rate-limit` documents current behaviour.
0. If `ADMIN_SECRET` is ever unset, the admin endpoints accept requests with no header (`undefined === undefined`). Make the check fail closed.
0. Unused dependencies in `services/api`: `nodemailer`, `@aura/types` (left in place to avoid scope creep).

1. Account delete fails on FK (likes/collections/uploads): cascade or explicit cleanup.
2. `viewCount` never incremented.
3. `downloads` table never written; no dedupe on `/:id/download`.
4. Remove unused `sessions` table + CLIP `embedding` column; add HNSW index on `text_embedding`.
5. Rate limiter trusts `x-forwarded-for` + in-memory state: use `trust proxy` + `express-rate-limit`.
6. Web search ignores `screen`; `/wallpapers` default limit 150.
7. Clean unused env vars.

---

## Estimated effort
| Phase | Time |
|---|---|
| 0 Prep | 0.5 d |
| 1 Contract baseline | 1–1.5 d |
| 2–3 Park + models | 0.5 d |
| 4 Skeleton/core | 1 d |
| 5 Modules | 3–4 d |
| 6 Cutover | 0.5 d |
| 7 Manual E2E | 0.5–1 d |
| 8 Deploy | 0.5 d |
| **Total** | **~8–10 working days** |
