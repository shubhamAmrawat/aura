# AURA — Admin Dashboard Plan

> **Status (2026-10-11):** Phase 1 live. Phase 2 (review queue) built and tested locally — migration
> `2026-10-11-admin-phase2.sql` applied (adds `wallpapers.review_note`). Tests: contract 144/144, integration 9/9,
> unit 25/25, browser test of the review page; web tsc + eslint + build clean. Next: deploy → Phase 3.

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
Festival drops (scheduled featured sets — builds on Phase 3 + 5), user reports/flagging, email to uploaders on approve/reject, homepage hero ordering, banning, multiple admin roles.

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
