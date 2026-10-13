# AURA — Admin Dashboard Plan

> **Status (2026-10-11):** Phases 1–2 live; Overview redesigned (charts + daily view/download tracking).
> Phase 3 (wallpaper management) built and tested locally — contract tests 14-admin-wallpapers (12/12),
> browser-tested list/filters/edit drawer/bulk/delete. Status changes stay on the review endpoints
> (approve / reject / restore), PATCH edits metadata + flags only. Next: deploy → Phase 4 (bulk upload).
>
> **Featured (2026-10-11):** `/admin/featured` — drag (or ↑/↓, keyboard) to order; home-page limit 1–10 (the rest wait
> in reserve); add/remove. Saves refresh the home hero instantly. `wallpapers.featured_order` + `site_settings`
> (migration `2026-10-11-featured-order.sql`, applied). Public `GET /api/featured`; admin `GET /api/admin/featured`,
> `PUT /api/admin/featured/order`, `PUT /api/admin/featured/limit`. Contract 15 (8/8) + browser-tested.
>
> **Phase 4 — Bulk upload (2026-10-11, built + tested locally):** `/admin/upload`. `POST /api/admin/uploads/urls`
> presigns a whole batch (1–50 files, 1-hour links, each locked to its declared size ≤ 25 MB, keys under
> `wallpapers/admin/<adminId>/`); `POST /api/admin/uploads` creates one wallpaper per file (one request each →
> short requests, no Render timeouts, stays under the 100 req/min limit). Same pipeline as creator uploads; no hourly
> quota; Sightengine never blocks (returned as a warning); duplicate warning (same pixels + bytes). Publish now
> (approved, admin = reviewer) or hold for review (pending). Admin uploads have **no uploader** (like the seeded
> wallpapers) — the admin is in `reviewed_by` + the audit log (`wallpaper.upload`). Web: drop zone, batch defaults,
> per-file title/category/tags, 3 parallel, auto-retry ×2 (fresh link on a failed PUT), retry failed, summary.
> Contract 16 (8/8) + browser test incl. simulated network failures. No DB migration.
>
> **Phase 5 — Categories (2026-10-13, built + tested locally):** `/admin/categories`. `GET/POST /api/admin/categories`,
> `PATCH /:id` (name, slug, description, cover — cover must be an Aurora-hosted image), `PUT /order { ids }` (full list),
> `DELETE /:id?moveTo=` (a non-empty category must move its wallpapers first — also how to merge; one transaction).
> Names (case-insensitive) and slugs unique; slugs auto-generated. All audited (`category.*`). Web: drag/↑↓ order + save
> bar, filter, edit modal with cover picker (top 12 live wallpapers), slug-change warning, move-&-delete dialog,
> "needs attention" panel (802 uncategorized = 41%). Public site refreshes instantly via `POST /api/admin/revalidate
> { tags }` (web `getCategories` now tagged `categories`). Contract 17 (7/7) + browser-tested. No DB migration.
>
> **Category cleanup (2026-10-13):** migration `2026-10-13-category-cleanup.sql` (applied; backup
> `aura_public_20261013_0125_pre_categories.dump`): `category_redirects` (old slug → category; written on slug rename and
> merge; web middleware answers old `/category/<slug>` with a 308, API list filter follows old slugs) and
> `category_suggestions`. AI pass (`scripts/ai-categorize.mts`, GPT-4o-mini vision, $1.14 for 1,971) → review screen
> `/admin/categories/review` (Uncategorized / Probably miscategorized; change target, apply, dismiss).
> `scripts/category-cleanup.mts [--apply]` (run AFTER deploying): merges Urban→City, Landscape→Nature, slug
> hindusm→hinduism, auto-applies 629 uncategorized where AI + vector centroids agree; 173 + 104 left for review.
> Bulk upload: category "✨ Auto" (AI picks; falls back to Uncategorized + review row). Contract 16–18 + browser-tested.
>
> **Phase 6 — Users (2026-10-13, built + tested locally):** `/admin/users`. `GET /api/admin/users` (search email/username/
> name; role, creator, sign-in method, locked; sort by joined/uploads/downloads/likes/name; live counts + last active),
> `GET /:id` (profile, counts, recent uploads/downloads/likes, admin history), `PATCH /:id { isCreator }`,
> `POST /:id/unlock`, `DELETE /:id { confirmEmail }` (shares `purgeAccount` with self-delete). Admin accounts and your own
> account can't be changed from the dashboard. All audited (`user.*`). Contract 19 (8/8) + browser-tested.
> **Disable accounts:** migration `2026-10-13-user-disable.sql` (applied; backup `…_1117_pre_user_disable.dump`):
> `users.disabled_at/_reason/_by`, wallpaper status `hidden`. `POST /:id/disable { reason }` / `POST /:id/enable`.
> Disabled = 403 on every sign-in route (password only after a correct password; no reset code sent) and on every
> authenticated request (`requireAuth` checks the account, 30 s cache cleared on change; `/me` + become-creator too);
> live uploads → `hidden` (404 on the public page, removed from likes/collections lists, can't be approved), restored on
> enable.

## Where we are today (checked against code + prod DB)

| Area | Today |
|---|---|
| Admin access | Only two secret-header endpoints (`X-Admin-Secret`): recalculate trending, re-embed text. No admin users, no UI. |
| Moderation | Sightengine marks an upload `approved`, `rejected` (score > 0.7) or **`pending`** (0.4–0.7, or the service failed). **Nothing can ever approve a `pending` upload** — it stays hidden forever. The reason isn't stored. |
| Wallpapers | 1,968, all `approved`; 1,958 have no uploader (seeded); 5 featured. Featuring/editing/deleting = manual SQL. |
| Categories | 27; API is read-only (`GET /api/categories`). Add/rename/reorder = manual SQL. |
| Users | 11 users, 1 creator. No way to view/support users except SQL. |
| Stats | `downloads` table logs every download since the bug-fix release (0 rows so far); views/likes are counters on `wallpapers`. |
| Upload limit | Creators: 10 uploads/hour — would block admin bulk uploads. |

## 0. Decisions (locked)

| # | Topic | Decision |
|---|---|---|
| 1 | Who is an admin | **Separate admin accounts**, created only by `scripts/create-admin.mts` (never converts an existing user; no API/sign-up path to admin). `role` column on `users`. |
| 2 | Where it lives | `/admin` in the web app. Same login page: admins land on `/admin` and are redirected there from every public page; everyone else gets a 404 for `/admin/*` (decided in the Next.js middleware from the signed token's `role` claim, verified with `JWT_SECRET`). Admin accounts can't sign in on mobile. |
| 3 | Admin uploads | Auto-approved, but still run Sightengine and **show** its score as a warning (never block an admin). No hourly limit for admins. |
| 4 | Rejecting an upload | Status → `rejected`, file kept 30 days (so a mistake can be undone), then a cleanup job deletes it from R2. |
| 5 | Bulk upload size | Up to 50 files per batch, ≤ 25 MB each, JPEG/PNG/WebP. |
| 6 | Banning users | **Not in v1** (no abuse yet). v1 can: make/remove creator, unlock a locked account, delete an account. |
| 7 | Charts | Recharts (small, works with Next/React 19). |

## 1. Architecture

### Database (additive only — safe while the current API runs; backup first)
- `users.role text NOT NULL DEFAULT 'user'` (check `role IN ('user','admin')`).
- `wallpapers.moderation_reason text NULL` — why Sightengine flagged it (shown in the review queue).
- `wallpapers.reviewed_by uuid NULL`, `wallpapers.reviewed_at timestamp NULL`, `wallpapers.rejected_at timestamp NULL`.
- New table `admin_actions` — audit log:
  `id uuid pk, admin_id uuid → users, action text, target_type text, target_id text, details jsonb, created_at timestamp`.
- Indexes: `wallpapers(status, created_at)`, `downloads(created_at)`, `admin_actions(created_at)`.

### API (`/api/admin/*`, same MVC layout)
- `middleware/requireAdmin.ts` = `requireAuth` + **role read from the DB on every request** (not from the JWT, so removing a role takes effect immediately). Non-admin → `403 "Admin access required."`.
- Files: `routes/admin.routes.ts`, `controllers/admin/*.controller.ts`, `services/admin/*.service.ts`, `validators/admin.schema.ts` (zod), `utils/audit.ts` (`logAdminAction(...)`).
- Every mutation writes one `admin_actions` row (inside the same transaction where possible).
- `GET /api/auth/me` and `/api/profile` add `role` so the web knows to show the Admin link.
- The two `X-Admin-Secret` endpoints stay (for scripts/cron); the dashboard gets session-based equivalents.

### Web (`apps/web/app/admin/*`)
- `admin/layout.tsx`: sidebar (Overview · Review queue · Wallpapers · Upload · Categories · Users · Activity), checks `/me` → redirects non-admins to `/`. The API is the real guard.
- `noindex` meta, excluded from `sitemap.ts` / `robots.ts`.
- Shared admin UI bits: data table (search, filters, sort, pagination, row selection), confirm dialog, toast, status badges.
- Navbar dropdown shows "Admin" only for admins.

## 2. Features & endpoints (by phase)

### Phase 1 — Foundation + Overview
- DB migration; `requireAdmin`; audit helper; `scripts/make-admin.mts <email>` (dry-run by default).
- `GET /admin/stats/overview` → totals + last 7/30 days: users (new sign-ups), wallpapers by status, **pending count**, downloads, views, likes; storage used (sum of `file_size_bytes`).
- Web: admin layout + Overview page (stat cards, "N waiting for review" link).

### Phase 2 — Review queue (moderation)
- `GET /admin/wallpapers?status=pending` (oldest first, with uploader + `moderation_reason`).
- `POST /admin/wallpapers/:id/approve` — sets `approved`, makes sure the text embedding exists (search), logs.
- `POST /admin/wallpapers/:id/reject { reason }` — sets `rejected` + `rejected_at`, logs.
- `POST /admin/wallpapers/bulk { ids, action: approve|reject }`.
- Upload service stores `moderation_reason` from now on.
- Job: delete files of wallpapers rejected > 30 days ago (runs with the trending job).
- Web: queue grid (large preview, uploader, reason, Approve / Reject with reason), keyboard shortcuts (A / R / →).

### Phase 3 — Wallpaper management
- `GET /admin/wallpapers` — search (title/tags), filters (status, category, featured, premium, mobile, AI, uploader, date range), sort (newest, downloads, likes, trending), pagination.
- `GET /admin/wallpapers/:id` — full row incl. stats.
- `PATCH /admin/wallpapers/:id` — title, description, tags, category, `isFeatured`, `isPremium`, `isMobile`, `isAiGenerated`, status. Re-generates the text embedding when title/description/tags change.
- `DELETE /admin/wallpapers/:id` — same cleanup as the creator delete (likes, downloads, collections, R2 file, uploader counter).
- `POST /admin/wallpapers/bulk { ids, action: feature|unfeature|setCategory|addTags|delete }`.
- Web: table + filters, edit drawer with image preview, bulk action bar.

### Phase 4 — Bulk upload
- Flow: pick/drag many files → client reads dimensions → for each file `POST /admin/wallpapers/upload-url` (presigned PUT, `wallpapers/admin/...`) → upload straight to R2 (3 in parallel, retry ×2) → `POST /admin/wallpapers/batch { items: [{ key, fileUrl, title, tags, categoryId, flags }] }`.
- Server reuses the existing upload pipeline (metadata, blurhash, colours, CLIP + text embeddings, Sightengine score) but: auto-approve, no hourly limit, `uploader_id` = the admin. Processes items one by one and returns per-item `ok | error`; a failed item never fails the batch.
- Batch defaults (category, tags, flags) applied to all, editable per file; title defaults from the file name.
- Web: drop zone, per-file progress + status, editable metadata grid, "retry failed", summary at the end.

### Phase 5 — Categories
- `GET/POST /admin/categories`, `PATCH /admin/categories/:id` (name, slug, description, cover image URL or upload), `PUT /admin/categories/order { ids }`, `DELETE /admin/categories/:id` (only if empty, or with `moveTo`).
- Web: list with counts, drag to reorder, edit dialog, cover picker (choose one of its wallpapers).

### Phase 6 — Users
- `GET /admin/users` (search email/username, filter creator/admin/Google/has password, sort by joined / uploads / downloads).
- `GET /admin/users/:id` — profile, sign-in methods, lockout state, uploads, recent downloads.
- `PATCH /admin/users/:id { isCreator }`, `POST /admin/users/:id/unlock`, `DELETE /admin/users/:id` (reuses account deletion).
- Safety: an admin can't delete or demote themselves; role changes only via the script in v1.

### Phase 7 — Analytics + tools
- `GET /admin/stats/timeseries?metric=signups|downloads|uploads&days=30` (per day).
- `GET /admin/stats/top?by=downloads|likes|views|trending&days=30` (wallpapers), `GET /admin/stats/categories` (wallpapers + downloads per category).
- `POST /admin/tools/recalculate-trending`, `POST /admin/tools/reembed-text` (session-based versions of the secret endpoints).
- Web: line charts (sign-ups, downloads), top-10 tables, category breakdown, tool buttons with last-run time.

### Phase 8 — Activity log
- `GET /admin/actions` (filter by admin, action, target, date) + web table; each row links to its target.

### Later (not v1)
Festival drops (scheduled featured sets — builds on Phase 3 + 5), user reports/flagging, email to uploaders on approve/reject, banning, multiple admin roles.

## 3. Security
- API is the only gate (`requireAdmin` on the whole `/api/admin` router); UI checks are cosmetic.
- Role checked from the DB every request; audit log for every change; admin actions rate-limited (e.g. 120/min).
- Cookie auth is `SameSite=Lax` + JSON-only bodies → no cross-site form posts.
- Inputs validated with zod; IDs are UUIDs; R2 keys for admin uploads must start with `wallpapers/admin/<adminId>/`.
- `/admin` is `noindex` and not in the sitemap.

## 4. Testing (same approach as the migration + auth work)
- **Contract tests** (`tests/contract/11-admin-*.test.ts`) for every endpoint: anonymous → 401, normal user → 403, admin → success; validation errors; audit row written; real-DB safety rules (only `aura-test+…` data, cleaned up after).
- Test admin = a test user promoted in the fixture, removed in cleanup.
- **Unit tests** for filters/sort parsing and the bulk-batch item handling.
- **Web:** `tsc`, eslint, `next build`; manual checklist per phase on localhost, then staging, then prod.

## 5. Delivery order
1. Phase 1 (foundation + overview) → deploy.
2. Phase 2 (review queue) → deploy — fixes the "pending forever" gap.
3. Phase 3 (wallpapers) → Phase 4 (bulk upload) → deploy.
4. Phase 5 (categories) → Phase 6 (users) → deploy.
5. Phase 7 (analytics) → Phase 8 (activity log) → deploy.

Each phase: backup (if DB changes) → code + tests → you test on localhost → commit/push (you) → staging → prod.
