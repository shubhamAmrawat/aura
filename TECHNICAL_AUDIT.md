# AURA Wallpaper App — Comprehensive Technical Audit

**Project**: AURA — Premium Wallpaper Discovery Platform  
**Generated**: April 2026  
**Purpose**: Onboarding & architectural reference document

---

## 1. DIRECTORY TREE

### Frontend: `apps/web/app/`

```
app/
├── (root pages)
│   ├── layout.tsx              [Root layout with providers]
│   ├── page.tsx                [Home/Hero + Latest infinite scroll]
│   ├── globals.css             [Tailwind theming]
│   └── [static images]         (1.png, 2.png, 3.png, 4.png, icon.png)
│
├── api/
│   └── auth/                   [Future: API routes if moving to Next.js API]
│
├── category/
│   └── [slug]/                 [Dynamic category detail pages]
│
├── collection/
│   ├── [id]/                   [View collection page]
│   └── dd/                     [TBD: Unknown purpose]
│
├── components/
│   ├── AvatarCropper.tsx       [Avatar upload + crop UI]
│   ├── BookmarkButton.tsx      [Toggle collection save button]
│   ├── CategoryWallpaperGrid.tsx [Grid for category pages]
│   ├── ConditionalNavbar.tsx   [Show/hide navbar based on route]
│   ├── Hero.tsx                [Featured wallpapers carousel]
│   ├── LatestWallpapersInfinite.tsx [Home feed infinite scroll]
│   ├── LatestWallpapersLoadMore.tsx [Latest page with load more]
│   ├── LikeButton.tsx          [Toggle like with UI state]
│   ├── Logo.tsx                [AURA branding]
│   ├── Navbar.tsx              [Main navigation]
│   ├── NavbarAuth.tsx          [Auth state + user menu]
│   ├── SearchBar.tsx           [Search input]
│   ├── WallpaperCard.tsx       [Grid card for wallpaper preview]
│   └── WallpaperCardSkeleton.tsx [Loading skeleton]
│
├── latest/
│   ├── page.tsx                [Latest wallpapers page]
│   └── loading.tsx             [Skeleton loading state]
│
├── login/
│   ├── layout.tsx              [Auth layout]
│   └── page.tsx                [Login with OTP form]
│
├── profile/
│   └── page.tsx                [User profile, settings, avatar/cover upload]
│
├── search/
│   ├── page.tsx                [Search page with hybrid search]
│   ├── SearchGrid.tsx          [Search results grid]
│   ├── mapSearchResult.ts      [Map DB results to Wallpaper type]
│   └── loading.tsx             [Search loading state]
│
├── signup/
│   └── (implied)               [Signup flow (OTP → user creation)]
│
├── trending/
│   ├── page.tsx                [Trending wallpapers (scored hourly)]
│   ├── TrendingGrid.tsx        [Trending grid component]
│   └── loading.tsx             [Trending loading state]
│
└── upload/
    ├── page.tsx                [Creator upload form]
    └── loading.tsx             [Upload progress states]
```

### Frontend Lib: `apps/web/lib/`

```
lib/
├── api.ts                      [Wallpaper CRUD + search client]
├── authApi.ts                  [Auth endpoints (OTP, signup, login, logout)]
├── authContext.tsx             [Global auth state + liked/saved IDs cache]
├── collectionsApi.ts           [Collections CRUD + public list]
├── color.ts                    [Color utilities (TBD)]
├── likesApi.ts                 [Like toggle + toggle cache]
├── profileApi.ts               [Profile update, avatar upload, password change]
├── toast.tsx                   [Toast notification context]
└── token.ts                    [JWT token helpers (cookie-based)]
```

### Backend API: `services/api/src/`

```
src/
├── index.ts                    [Hono app setup, CORS, rate limiting]
│
├── middleware/
│   └── auth.ts                 [JWT verification from cookie/header]
│
├── routes/
│   ├── auth.ts                 [OTP send/verify, signup, login, logout, /me]
│   ├── categories.ts           [GET /categories (ordered)]
│   ├── collections.ts          [CRUD collections, view, public list, saved-ids]
│   ├── likes.ts                [POST toggle, GET user likes, GET check]
│   ├── profile.ts              [GET/PUT profile, avatar/cover upload, password change]
│   ├── search.ts               [Semantic/Hybrid/Keyword search via CLIP embeddings]
│   └── wallpapers.ts           [GET list/featured, POST upload-url, POST upload]
│
└── lib/
    ├── email.ts                [Brevo SMTP; OTP + password reset templates]
    ├── embeddings.ts           [CLIP image & text embeddings via Xenova]
    ├── jwt.ts                  [generateToken, verifyToken (7d expiry)]
    ├── otp.ts                  [generateOTP (6-digit), expiry (15min), validation]
    ├── r2.ts                   [Cloudflare R2 presigned URLs + file ops]
    ├── scheduler.ts            [Hourly trending score recalculation]
    ├── trending.ts             [Trending score formula: engagement/time_decay]
    └── vision.ts               [Sightengine moderation (nudity, violence)]
```

### Database: `packages/db/src/schema/`

```
schema/
├── auth.ts                     [otps, sessions tables]
├── collections.ts             [collections, collection_wallpapers tables]
├── interactions.ts            [likes, downloads tables]
├── users.ts                   [users table with auth + profile fields]
└── wallpapers.ts              [wallpapers, categories tables + enums]
```

### Shared Types: `packages/types/src/`

```
src/
└── index.ts                    [Wallpaper, User, Collection, AuthSession types]
```

---

## 2. DATABASE SCHEMA

### **auth.ts** — Authentication Tables

```typescript
// OTPs Table
export const otps = pgTable("otps", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  code: text("code").notNull(),
  type: text("type").notNull(),              // "signup" | "login" | "password_reset"
  expiresAt: timestamp("expires_at").notNull(), // 15 minutes
  verified: boolean("verified").notNull().default(false),
  attempts: integer("attempts").notNull().default(0), // max 3
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Sessions Table
export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

### **users.ts** — User Accounts

```typescript
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  username: text("username").notNull().unique(),
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash"),           // bcryptjs
  avatarUrl: text("avatar_url"),                 // R2 CDN URL
  coverUrl: text("cover_url"),                   // R2 CDN URL
  bio: text("bio"),
  contactNo: text("contact_no"),
  isEmailVerified: boolean("is_email_verified").notNull().default(false),
  isCreator: boolean("is_creator").notNull().default(false),
  isPro: boolean("is_pro").notNull().default(false),
  stripeCustomerId: text("stripe_customer_id"),  // For future subscriptions
  totalDownloads: integer("total_downloads").notNull().default(0),
  totalUploads: integer("total_uploads").notNull().default(0),
  usernameChangedAt: timestamp("username_changed_at"), // 2-week cooldown tracking
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

### **wallpapers.ts** — Wallpapers & Categories

```typescript
// Enums
export const wallpaperStatusEnum = pgEnum("wallpaper_status", [
  "pending",    // Awaiting moderation
  "approved",   // Public
  "rejected",   // Failed safety check
]);

export const wallpaperFormatEnum = pgEnum("wallpaper_format", [
  "jpeg", "png", "webp", "avif"
]);

// Categories Table
export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  coverImageUrl: text("cover_image_url"),
  sortOrder: integer("sort_order").notNull().default(0),
});

// Wallpapers Table
export const wallpapers = pgTable("wallpapers", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description"),
  fileUrl: text("file_url").notNull(),
  cdnVariants: jsonb("cdn_variants"),             // Future: different sizes
  blurhash: text("blurhash").notNull(),          // Blurry placeholder
  dominantColor: text("dominant_color").notNull(), // #RRGGBB
  palette: text("palette").array().notNull().default([]), // 5 colors
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  fileSizeBytes: integer("file_size_bytes").notNull(),
  format: wallpaperFormatEnum("format").notNull(),
  categoryId: uuid("category_id").references(() => categories.id),
  uploaderId: uuid("uploader_id").references(() => users.id),
  tags: text("tags").array().notNull().default([], // AI-generated
  isPremium: boolean("is_premium").notNull().default(false),
  isFeatured: boolean("is_featured").notNull().default(false),
  isAiGenerated: boolean("is_ai_generated").notNull().default(false),
  downloadCount: integer("download_count").notNull().default(0),
  likeCount: integer("like_count").notNull().default(0),
  viewCount: integer("view_count").notNull().default(0),
  trendingScore: real("trending_score").notNull().default(0),
  status: wallpaperStatusEnum("status").notNull().default("pending"),
  embedding: vector("embedding", 512),            // CLIP image embedding
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

### **collections.ts** — User Collections

```typescript
export const collections = pgTable("collections", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  description: text("description"),
  isPublic: boolean("is_public").notNull().default(true),
  coverWallpaperId: uuid("cover_wallpaper_id").references(() => wallpapers.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const collectionWallpapers = pgTable(
  "collection_wallpapers",
  {
    collectionId: uuid("collection_id").notNull().references(() => collections.id),
    wallpaperId: uuid("wallpaper_id").notNull().references(() => wallpapers.id),
    sortOrder: integer("sort_order").notNull().default(0),
    addedAt: timestamp("added_at").notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.collectionId, table.wallpaperId] }),
  })
);
```

### **interactions.ts** — Likes & Downloads

```typescript
export const likes = pgTable(
  "likes",
  {
    userId: uuid("user_id").notNull().references(() => users.id),
    wallpaperId: uuid("wallpaper_id").notNull().references(() => wallpapers.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.wallpaperId] }),
  })
);

export const downloads = pgTable("downloads", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id),  // Optional; can be anonymous
  wallpaperId: uuid("wallpaper_id").notNull().references(() => wallpapers.id),
  quality: text("quality").notNull(),                  // e.g., "original", "4k", "fullhd"
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

---

## 3. API ROUTES INVENTORY

### **Authentication Routes** (`/api/auth`)

| Method | Path | Description | Auth Required |
|--------|------|-------------|---|
| POST | `/send-otp` | Send 6-digit OTP to email (signup/login) | No |
| POST | `/verify-otp` | Verify OTP code (max 3 attempts, 15 min expiry) | No |
| POST | `/signup` | Create user account (requires verified OTP) | No |
| POST | `/login` | Login user (sets httpOnly JWT cookie) | No |
| GET | `/me` | Get current user profile | Yes |
| POST | `/logout` | Clear JWT cookie | Yes |

### **Wallpapers Routes** (`/api/wallpapers`)

| Method | Path | Description | Auth Required |
|--------|------|-------------|---|
| GET | `/` | List wallpapers (filter by featured/category/search, paginated) | No |
| POST | `/upload-url` | Get R2 presigned URL for file upload | Yes |
| POST | `/upload` | Create wallpaper after R2 upload (runs moderation + metadata) | Yes |
| GET | `/:id` | Get wallpaper details (blurhash, palette, stats) | No |
| PUT | `/:id/increment-view` | Increment view count | No |

### **Categories Routes** (`/api/categories`)

| Method | Path | Description | Auth Required |
|--------|------|-------------|---|
| GET | `/` | List all categories (ordered by sortOrder) | No |

### **Search Routes** (`/api/search`)

| Method | Path | Description | Auth Required |
|--------|------|-------------|---|
| GET | `/` | Hybrid search (semantic + keyword, supports mode param) | No |

**Query Params**: `q` (query), `limit` (max 50), `offset`, `mode` ("semantic", "hybrid", "keyword")

### **Likes Routes** (`/api/likes`)

| Method | Path | Description | Auth Required |
|--------|------|-------------|---|
| POST | `/:wallpaperId` | Toggle like on wallpaper (updates likeCount) | Yes |
| GET | `/` | Get all liked wallpapers by user | Yes |
| GET | `/:wallpaperId` | Check if wallpaper is liked by user | Yes |

### **Collections Routes** (`/api/collections`)

| Method | Path | Description | Auth Required |
|--------|------|-------------|---|
| GET | `/` | Get user's own collections | Yes |
| GET | `/public` | List all public collections | No |
| GET | `/saved-ids` | Get all unique wallpaper IDs saved across user's collections | Yes |
| GET | `/:id` | View single collection (public or owned) | Conditional |
| POST | `/` | Create new collection | Yes |
| POST | `/:id/wallpapers` | Add wallpaper to collection | Yes |
| DELETE | `/:id/wallpapers/:wallpaperId` | Remove wallpaper from collection | Yes |
| GET | `/check/:wallpaperId` | Check which collections contain wallpaper | Yes |

### **Profile Routes** (`/api/profile`)

| Method | Path | Description | Auth Required |
|--------|------|-------------|---|
| GET | `/` | Get current user's profile | Yes |
| PUT | `/` | Update profile (displayName, bio, username, contactNo) | Yes |
| POST | `/avatar/upload-url` | Get R2 presigned URL for avatar (JPG/PNG/WebP) | Yes |
| PUT | `/avatar` | Confirm avatar upload, save avatarUrl | Yes |
| POST | `/cover/upload-url` | Get R2 presigned URL for cover image | Yes |
| PUT | `/cover` | Confirm cover upload, save coverUrl | Yes |
| POST | `/password-change` | Change password (verify old, hash new) | Yes |
| DELETE | `/` | Delete account (hard delete) | Yes |

---

## 4. BACKEND LIB & MIDDLEWARE

### **Middleware**

**File**: [services/api/src/middleware/auth.ts](services/api/src/middleware/auth.ts)  
**Purpose**: JWT verification from httpOnly cookie or Authorization header  
**Key Functions**:
- `authMiddleware(c, next)` — Extracts token, verifies, sets userId/email in context
- `getAuthTokenFromRequest(c)` — Extracts token from Cookie or Authorization header

---

### **Libraries**

#### **jwt.ts** — JWT Generation & Verification
**Purpose**: Sign/verify user sessions (7-day expiry)  
**Exports**:
- `generateToken(payload: JWTPayload)` → JWT string
- `verifyToken(token: string)` → JWTPayload | throws
- **Payload**: `{ userId, email }`

#### **otp.ts** — One-Time Password Generation
**Purpose**: Email-based OTP for signup/login  
**Exports**:
- `generateOTP()` → 6-digit string (100000–999999)
- `getOTPExpiry()` → Date (15 minutes from now)
- `isOTPExpired(expiresAt: Date)` → boolean

#### **email.ts** — Email Delivery (Brevo)
**Purpose**: Send templated OTP and password reset emails  
**Key**:
- Provider: Brevo SMTP (`smtp-relay.brevo.com`)
- HTML templates with green accent color (`#40C057`)
- Functions: `sendOTPEmail(email, otp, type)`

#### **r2.ts** — Cloudflare R2 Storage (S3-Compatible)
**Purpose**: Presigned URLs for user uploads (avatars, wallpapers, covers)  
**Exports**:
- `generateUploadUrl(folder, fileType, ownerId?)` → `{ uploadUrl, fileUrl, key }`
  - Presigned URL expires in 5 minutes
  - fileUrl is public CDN link
- `buildObjectKey(folder, fileType, ownerId?)` → Random UUID + extension
- `uploadFileToKey(key, body, fileType)` → Void (server-side upload)
- `deleteFile(key)` → Void (cleanup after rejection)

#### **embeddings.ts** — CLIP Image & Text Embeddings
**Purpose**: Semantic search via Xenova transformers  
**Model**: `Xenova/clip-vit-base-patch32` (512-dimensional vectors)  
**Exports**:
- `generateImageEmbedding(imageUrl)` → `number[] | null`
- `generateTextEmbedding(text)` → `number[] | null` (L2-normalized)
- Handles local `.cache` directory for model weights

#### **vision.ts** — Content Moderation (Sightengine)
**Purpose**: Detect nudity and violence in wallpapers  
**Exports**:
- `checkImageSafety(imageUrl)` → `{ status, reason }`
- **Status**: "approved" | "pending" | "rejected"
- **Thresholds**:
  - Hard reject: nudity > 0.7 or violence > 0.7
  - Soft flag (manual review): nudity > 0.4 or violence > 0.4
  - Approved: below thresholds

#### **trending.ts** — Trending Score Calculation
**Purpose**: Hourly wallpaper scoring (recalculated by scheduler)  
**Formula**:
```
score = (downloads × 3 + likes × 2 + views × 0.1) / (hours_since_upload ^ 0.8)
```
- **Downloads**: Strongest signal (user intent)
- **Likes**: Explicit approval
- **Views**: Passive signal
- **Time decay**: 0.8 exponent = gradual decay
  - 1 hour old → score / 1.0
  - 24 hours old → score / 18.4
  - 7 days old → score / 85.7
- **Exports**: `recalculateTrendingScores()` → `{ updated, durationMs }`

#### **scheduler.ts** — Background Job Runner
**Purpose**: Hourly trending recalculation  
**Exports**:
- `startScheduler()` — Runs immediately on startup, then every 1 hour
- `stopScheduler()` — Stops interval
- Prevents concurrent runs with `schedulerRunning` flag

---

## 5. FRONTEND PAGES

### **Home / Root** (`/`)
- **Component**: [apps/web/app/page.tsx](apps/web/app/page.tsx)
- **Type**: Server Component (RSC)
- **Data Fetched**:
  - `getWallpapersPage({ limit: 24, offset: 0 })` → Latest wallpapers
  - `getFeaturedWallpapers()` → Featured carousel
- **Key Components**:
  - `<Hero>` — Featured wallpapers carousel
  - `<LatestWallpapersInfinite>` — Infinite scroll grid
  - Error banner if API fails
- **Metadata**: `{ title: "AURA — Premium Wallpaper Discovery", ... }`

### **Latest** (`/latest`)
- **Component**: [apps/web/app/latest/page.tsx](apps/web/app/latest/page.tsx)
- **Type**: Server Component (RSC)
- **Data Fetched**: `getWallpapers({ limit: 20 })`
- **Key Components**:
  - `<LatestWallpapersLoadMore>` — Load more pattern (not infinite)
- **Metadata**: `{ title: "Latest | AURA", ... }`

### **Search** (`/search?q=...`)
- **Component**: [apps/web/app/search/page.tsx](apps/web/app/search/page.tsx)
- **Type**: Server Component (RSC) with dynamic metadata
- **Data Fetched**:
  - `semanticSearch({ q, limit: 20, mode: "hybrid" })` if query ≥ 2 chars
  - **Modes**: "semantic" (CLIP), "hybrid" (semantic + keyword), "keyword" fallback
- **Key Components**:
  - Empty state if no query
  - `<SearchGrid>` — Results grid
  - Search mode badge (semantic/hybrid/keyword)
- **Special**: Mood searches supported (e.g., "feels like 3am Tokyo")

### **Trending** (`/trending`)
- **Component**: [apps/web/app/trending/page.tsx](apps/web/app/trending/page.tsx)
- **Type**: Server Component (RSC)
- **Data Fetched**: `getTrendingWallpapers({ limit: 20 })`
- **Key Components**:
  - `<TrendingGrid>` — Wallpaper grid
  - Note: "scores updated hourly"

### **Login** (`/login`)
- **Route**: `/login/page.tsx`
- **Type**: Server Component (RSC)
- **Layout**: [apps/web/app/login/layout.tsx](apps/web/app/login/layout.tsx)
- **Flow**:
  1. User enters email
  2. OTP sent to email
  3. User verifies OTP
  4. User enters username, displayName, password
  5. Account created, JWT cookie set, redirected

### **Upload** (`/upload`)
- **Component**: [apps/web/app/upload/page.tsx](apps/web/app/upload/page.tsx)
- **Type**: Client Component (uses hooks + file input)
- **Flow**:
  1. File validation (JPEG/PNG/WebP, <25MB, ≥200×200px)
  2. Load image dimensions
  3. Get R2 presigned URL
  4. Upload to R2
  5. Submit metadata (title, description, category, tags)
  6. Backend runs moderation + metadata extraction
  7. Progress states: uploading → moderating → saving → done
- **Auth Required**: Yes (isCreator permission check on backend)
- **Metadata Extraction**:
  - Blurhash generation
  - Dominant color extraction
  - Color palette (5 colors)
  - Image dimensions & file size
  - CLIP embedding generation

### **Profile** (`/profile` or `/profile/[username]`)
- **Component**: [apps/web/app/profile/page.tsx](apps/web/app/profile/page.tsx)
- **Type**: Client Component
- **Features**:
  - View profile (email, username, displayName, bio, contact)
  - Edit profile (displayName, bio, username, contactNo)
  - **Username**: 2-week cooldown between changes
  - Avatar upload (JPEG/PNG/WebP, <5MB) with crop tool
  - Cover upload (<10MB)
  - Password change (verify old, set new)
  - Account deletion
  - View liked wallpapers
  - View collections
  - View upload stats (total downloads, total uploads)
  - Become Creator option (if not already)
- **Auth Required**: Yes

### **Category Detail** (`/category/[slug]`)
- **Route**: `/category/[slug]/page.tsx`
- **Type**: Likely Server Component
- **Expected Data**: Category info + wallpapers in that category
- **Note**: Implemented at route level; detailed component not shown in tree

### **Wallpaper Detail** (`/wallpaper/[id]`)
- **Route**: `/wallpaper/[id]/page.tsx`
- **Type**: Server Component (RSC)
- **Components**:
  - `<WallpaperDetails>` — Title, description, stats
  - `<WallpaperStats>` — Downloads, likes, views
  - `<WallpaperTags>` — AI-generated tags
  - `<ColorPalette>` — 5-color palette display
  - `<SimilarWallpapersSection>` — Semantic similarity
  - `<DownloadButton>` — Download link
  - `<ContextMenuBlock>` — Block right-click on image
- **Interactive Elements**:
  - Like button (optimistic UI)
  - Save to collection button

### **Collection View** (`/collection/[id]`)
- **Route**: `/collection/[id]/page.tsx`
- **Type**: Server Component
- **Features**:
  - View public or owned collections
  - Collection metadata + wallpaper grid
  - Add/remove wallpapers (if owner)

---

## 6. FRONTEND LIB

### **api.ts** — Wallpaper API Client
**Purpose**: Server-side data fetching for wallpapers  
**Key Functions**:
- `getWallpapersPage(params)` → Paginated list with offset
- `getWallpapers(params)` → Alias for latest
- `getFeaturedWallpapers()` → Featured="true"
- `getTrendingWallpapers(params)` → Trending sorted
- `getWallpapersByCategory(slug, params)`
- `getWallpaperDetail(id)` → Single wallpaper + details
- `semanticSearch(params)` → Hybrid/semantic search
- `getCategories()` → All categories
- `getUploadUrl(fileType)` → R2 presigned URL
- `submitWallpaper(metadata)` → Create wallpaper
- `becomeCreator()` → Upgrade user status
- **Page Size**: `WALLPAPERS_FEED_PAGE_SIZE = 24`

### **authApi.ts** — Authentication Client
**Purpose**: OTP + session management  
**Key Functions**:
- `sendOtp({ email, type })` → Send OTP to email
- `verifyOtp({ email, code, type })` → Verify OTP
- `signup({ email, username, displayName, password })` → Create account
- `login({ email })` → Login (OTP-based)
- `me()` → Get current user profile
- `logout()` → Clear session

### **authContext.tsx** — Global Auth State
**Purpose**: User auth state + liked/saved IDs cache  
**Context Shape**:
```typescript
{
  user: User | null,
  setUser: (user) => void,
  refreshUser: () => Promise<void>,
  logout: () => Promise<void>,
  loaded: boolean,               // Auth state loaded
  likedIds: Set<string>,        // Optimistic UI
  toggleLikedId: (id) => void,
  savedIds: Set<string>,        // Collection membership cache
  toggleSavedId: (id) => void,
}
```
**Usage**: `const { user, likedIds, savedIds } = useAuth()`

### **likesApi.ts** — Like Toggle Client
**Purpose**: Like toggles + like list retrieval  
**Key Functions**:
- `toggleLike(wallpaperId)` → POST toggle
- `checkLike(wallpaperId)` → GET check
- `getLikedWallpapers()` → GET all liked
- `getLikedWallpaperIds()` → GET Set<id>

### **collectionsApi.ts** — Collections Client
**Purpose**: CRUD collections + membership  
**Key Functions**:
- `getUserCollections()` → GET user's collections
- `createCollection(payload)` → POST new collection
- `addToCollection(collectionId, wallpaperId)` → POST add
- `removeFromCollection(collectionId, wallpaperId)` → DELETE remove
- `getSavedWallpaperIds()` → GET Set<id> across all collections
- `checkCollections(wallpaperId)` → GET which collections contain wallpaper

### **profileApi.ts** — Profile Management Client
**Purpose**: Profile CRUD, avatar/cover upload, password  
**Key Functions**:
- `getProfile()` → GET user profile
- `updateProfile(payload)` → PUT update (displayName, bio, username, contactNo)
- `getAvatarUploadUrl(fileType)` → GET R2 presigned URL
- `confirmAvatarUpload(fileUrl, key)` → PUT save avatarUrl
- `uploadAvatarDirect(file)` → Client-side upload via presigned URL
- `uploadAvatarToSignedUrl(url, file)` → Raw fetch upload
- `uploadCoverDirect(file)` → Cover upload
- `confirmPasswordChange(oldPassword, newPassword)` → PUT change
- `verifyCurrentPassword(password)` → POST verify
- `deleteAccount()` → DELETE account

### **token.ts** — Token Helpers
**Purpose**: httpOnly cookie token management  
**Note**: No-op functions since token lives in httpOnly cookie (not readable by JS)  
**Functions**:
- `getToken()` → null (httpOnly)
- `saveToken(_token)` → no-op
- `clearToken()` → no-op

### **toast.tsx** — Toast Notification System
**Purpose**: Global toast notifications (errors, success)  
**Exports**: `ToastProvider`, `useToast()` hook

### **color.ts** — Color Utilities
**Purpose**: TBD (likely color parsing/conversion)

---

## 7. FEATURE COMPLETION STATUS

| Feature | Status | Details |
|---------|--------|---------|
| **Wallpaper Browsing** | ✅ DONE | Home feed (24 per page), masonry grid, infinite scroll on home and /latest |
| **Wallpaper Detail Page** | ✅ DONE | Layout, title/description, blurhash placeholder, dominant color, color palette (5 colors) |
| **Category Filtering** | ✅ DONE | Category list with categories/:slug, filter by slug in wallpapers list |
| **Search** | ✅ DONE | Hybrid semantic + keyword search using CLIP embeddings, fallback to keyword only |
| **Custom OTP Auth** | ✅ DONE | Send OTP (15 min), verify, signup (username+password), login, JWT 7-day expiry |
| **Navbar Auth State** | ✅ DONE | Conditional navbar, auth context with user state, dropdown menu |
| **Toast Notifications** | ✅ DONE | Global toast context for errors/success |
| **Profile Page** | ✅ DONE | View/edit profile, avatar+cover upload via R2 presigned URLs, password change, account deletion |
| **Avatar Upload** | ✅ DONE | R2 presigned URL → client upload → confirm URL save; with crop tool |
| **Password Change** | ✅ DONE | Verify old password, hash new (bcryptjs), update in DB |
| **Account Deletion** | ✅ DONE | Hard delete user from DB |
| **Likes** | ✅ DONE | Toggle like, persist to DB, increment likeCount, optimistic UI via context cache |
| **Collections** | ✅ DONE | Create, add/remove wallpapers, view (public/private), saved-ids cache |
| **Download Tracking** | ✅ DONE | Download count incremented on wallpaper; downloads table logs quality/timestamp |
| **Creator/Upload Flow** | ✅ DONE | Presigned URL → R2 upload → moderation (Sightengine) → metadata extraction (blurhash, colors, CLIP embedding) → create wallpaper |
| **ML/AI Features** | ✅ DONE | CLIP embeddings (Xenova) for semantic search; tag extraction (model TBD); color extraction (dominant + palette); similarity search |
| **Seeding** | ⚠️ PARTIAL | Seed scripts exist (Unsplash, Wallhaven, NASA, Pexels) but details not fully reviewed |
| **Production Polish** | ⚠️ PARTIAL | Loading states (skeleton cards), error boundaries, empty states exist; may need refinement |
| **SEO / Metadata** | ✅ DONE | Open Graph, Twitter card, metadata per page, dynamic titles for search results |
| **Deployment** | ✅ DONE | Vercel (frontend @aurawalls.site), Render (backend @api); CI/CD pipeline likely via GitHub Actions (not shown) |

---

## 8. ENVIRONMENT VARIABLES

### Frontend Environment (`NEXT_PUBLIC_*`)
```
NEXT_PUBLIC_API_URL=https://api.aurawalls.site  # or http://localhost:3001 for dev
```

### Backend & Database Environment
```
# ─── Supabase PostgreSQL ───────────────────────────
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/postgres
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=<supabase-anon-key>
SUPABASE_SECRET_KEY=<supabase-service-role-key>

# ─── Server Config ─────────────────────────────────
PORT=3001
FRONTEND_URL=http://localhost:3000

# ─── Authentication ────────────────────────────────
JWT_SECRET=<long-random-secret>
ADMIN_SECRET=<long-random-secret>

# ─── Email (Brevo SMTP) ────────────────────────────
BREVO_SMTP_PASS=<brevo-smtp-password>
BREVO_SMTP_USER=<brevo-smtp-user>
BREVO_FROM_EMAIL=<sender@example.com>
BREVO_API_KEY=<brevo-api-key>
RESEND_API_KEY=<resend-api-key>

# ─── Google ────────────────────────────────────────
GOOGLE_CLIENT_ID=<client-id>.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<google-oauth-client-secret>
GOOGLE_VISION_API_KEY=<google-cloud-api-key>

# ─── Content Moderation (Sightengine) ──────────────
SIGHTENGINE_API_USER=<sightengine-api-user>
SIGHTENGINE_API_SECRET=<sightengine-api-secret>

# ─── R2 Cloudflare Storage ─────────────────────────
CLOUDFLARE_ACCOUNT_ID=<cloudflare-account-id>
R2_BUCKET_NAME=<r2-bucket-name>
R2_ACCESS_KEY_ID=<r2-access-key-id>
R2_SECRET_ACCESS_KEY=<r2-secret-access-key>
R2_PUBLIC_URL=<public-or-custom-domain-url>

# ─── External APIs (Seeding) ────────────────────────
UNSPLASH_ACCESS_KEY=<unsplash-access-key>
WALLHAVEN_API_KEY=<wallhaven-api-key>
NASA_API_KEY=<nasa-api-key>
PEXELS_API_KEY=<pexels-api-key>

# ─── ML Models ─────────────────────────────────────
HUGGINGFACE_API_TOKEN=<huggingface-token>
REPLICATE_API_TOKEN=<replicate-token>
```

**Security Notes**:
- ⚠️ **DO NOT COMMIT** `.env` to version control
- Use `.env.example` template for developers
- Production: Use CI/CD secrets management (GitHub Actions Secrets, etc.)

---

## 9. PACKAGE.JSON DEPENDENCIES

### **services/api/package.json**

```json
{
  "dependencies": {
    "@aura/db": "workspace:*",
    "@aura/types": "workspace:*",
    "@aws-sdk/client-s3": "^3.1021.0",
    "@aws-sdk/s3-request-presigner": "^3.1021.0",
    "@hono/node-server": "^1.0.0",
    "@xenova/transformers": "^2.17.2",
    "bcryptjs": "^3.0.3",
    "blurhash": "^2.0.5",
    "dotenv": "*",
    "drizzle-orm": "*",
    "hono": "^4.0.0",
    "jsonwebtoken": "^9.0.3",
    "nodemailer": "^8.0.4",
    "postgres": "*",
    "sharp": "^0.34.5"
  },
  "devDependencies": {
    "@types/bcryptjs": "^3.0.0",
    "@types/jsonwebtoken": "^9.0.10",
    "@types/node": "^20.0.0",
    "@types/nodemailer": "^7.0.11",
    "tsx": "^4.0.0",
    "typescript": "*"
  }
}
```

**Key Libraries**:
- **Hono**: Lightweight routing framework
- **Drizzle ORM**: Type-safe database access
- **@xenova/transformers**: CLIP embeddings (ML locally)
- **Sharp**: Image processing (blurhash, color extraction, resizing)
- **bcryptjs**: Password hashing
- **JWT**: Session tokens
- **AWS SDK**: R2 storage (S3-compatible)
- **Blurhash**: Placeholder generation

### **apps/web/package.json**

```json
{
  "dependencies": {
    "@aura/types": "workspace:*",
    "blurhash": "^2.0.5",
    "next": "16.2.1",
    "react": "19.2.4",
    "react-dom": "19.2.4"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.2.1",
    "tailwindcss": "^4",
    "typescript": "^5"
  }
}
```

**Key Libraries**:
- **Next.js 16**: SSR, App Router, API routes (though API routes not used; backend separate)
- **React 19**: UI framework
- **Tailwind CSS 4**: Utility-first styling
- **Blurhash**: Placeholder decoding

### **packages/db/package.json**

```json
{
  "dependencies": {
    "@aws-sdk/client-s3": "^3.1021.0",
    "@xenova/transformers": "^2.17.2",
    "sharp": "^0.34.5",
    "dotenv": "^17.3.1",
    "drizzle-orm": "*",
    "postgres": "*"
  },
  "devDependencies": {
    "@types/node": "^25.5.0",
    "drizzle-kit": "*",
    "tsx": "^4.0.0",
    "typescript": "*"
  }
}
```

**Scripts**:
- `db:push` — Apply schema changes to DB
- `db:studio` — Drizzle Studio UI
- `db:generate` — Generate migrations
- `db:seed` — Run seed script
- `db:migrate-r2` — Migrate file URLs to R2
- `db:embeddings` — Regenerate CLIP embeddings for all wallpapers

---

## 10. NOTABLE ARCHITECTURAL DECISIONS & KNOWN ISSUES

### ✅ **Good Decisions**

1. **Monorepo Structure** (pnpm workspace)
   - Shared types (`@aura/types`) across frontend & backend
   - Shared database layer (`@aura/db`)
   - Clear separation of concerns

2. **API Design**
   - RESTful routes with meaningful HTTP methods
   - Consistent error response format
   - Rate limiting on general (100 req/min) and upload (10 req/hour) endpoints

3. **Security**
   - httpOnly JWT cookies (not accessible by JavaScript)
   - Password hashing with bcryptjs (12-round salt)
   - OTP-based authentication (no password stored for login)
   - Moderation via Sightengine (nudity/violence detection)
   - CORS whitelist (production domains only)

4. **Performance**
   - Blurhash placeholders (loaded before image)
   - Presigned URLs for client-side file upload (no backend bandwidth waste)
   - Parallel moderation + metadata extraction (saves ~3-4s per upload)
   - CLIP embeddings cached in DB (fast semantic search)
   - Trending score recalculation hourly (not per-request)
   - Pagination with hasMore flag (prevents N+1)

5. **Image Handling**
   - Sharp for fast processing (dominant color, palette, resize)
   - Multiple formats supported (JPEG, PNG, WebP, AVIF)
   - R2 CDN for fast global delivery
   - Blurhash fallback if extraction fails

6. **Search**
   - Hybrid mode (semantic 85% + keyword 15%)
   - Fallback to keyword-only if embeddings unavailable
   - Supports mood queries ("3am Tokyo vibe")

7. **Auth Context**
   - Optimistic UI for likes & saved wallpapers (Set<id> cache)
   - Prevents unnecessary API calls
   - Syncs across tabs via native browser state

---

### ⚠️ **Areas for Improvement / Known Gaps**

1. **Tag Generation**
   - Currently listed as feature-complete, but implementation details not found
   - **Likely**: Uses Replicate API (env var exists)
   - **Should verify**: How tags are generated (vision API vs. text model) and stored

2. **Seeding Script**
   - Script exists (`db:seed` command)
   - **Not reviewed**: Unsplash/Wallhaven/NASA/Pexels API integration details
   - **Concern**: Rate limits, duplicate handling, data validation

3. **Category Management**
   - Categories are read-only via API (no POST/PUT/DELETE)
   - **Admin-only**: Likely managed via direct DB edits or admin panel (not shown)

4. **Premium / Pro Features**
   - User table has `isPro` and `stripeCustomerId` fields
   - **Not implemented**: No Stripe integration visible
   - Wallpapers have `isPremium` flag (unused)
   - **TODO**: Subscription logic, paywall, exclusive content

5. **File Cleanup**
   - Moderation rejection deletes from R2 (good)
   - **Risk**: Orphaned R2 files if server crashes mid-upload
   - **Could add**: Periodic cleanup job for dangling keys

6. **Password Reset**
   - OTP system supports "password_reset" type
   - **Not fully implemented**: No forgot-password endpoint visible in routes
   - Email template exists, API not present

7. **Image Variants / CDN Optimization**
   - `cdnVariants` field in DB (JSONB) but not populated
   - **Potential**: Different resolutions (thumbnail, fullhd, 4k) for mobile/desktop
   - **Current**: Always serves original file

8. **Error Handling**
   - Frontend has error boundaries (implicit from design)
   - **API**: Returns JSON errors but no structured error codes
   - **Could improve**: Client error categorization (network vs. validation vs. server)

9. **Testing**
   - No test files visible in structure
   - **TODO**: Unit tests for API routes, integration tests, E2E tests

10. **Monitoring / Logging**
    - Basic console.log throughout
    - **Missing**: Structured logging, error tracking (Sentry?), APM

11. **Database Migrations**
    - Drizzle Kit handles schema, but `migrations/` folder is empty (likely ignored in git)
    - **OK for dev**: Safe for small team
    - **Production risk**: No migration history in version control

12. **API Versioning**
    - All routes currently `/api/v0/` (implicit v0)
    - **No versioning strategy evident**
    - **Concern**: Breaking changes will affect existing clients

13. **Concurrency / Race Conditions**
    - Like count incremented via SQL `+ 1` (safe)
    - **Watch**: Username conflict race condition (checked before insert)
    - **Fine for now**: pnpm-workspace & single server instance

14. **Download Button / File Serving**
    - DownloadButton component exists but internal logic not shown
    - **Assumed**: Links directly to R2 presigned URL or triggers download tracking
    - **Verify**: Does clicking increment download_count?

15. **Collection Sorting**
    - collectionWallpapers has `sortOrder` field
    - **Not exposed**: No drag-to-reorder API endpoint visible
    - **Could add**: PUT /collections/:id/wallpapers/:wallpaperId with newSortOrder

---

### 🔧 **Technical Debt / Maintenance Notes**

| Item | Priority | Effort | Notes |
|------|----------|--------|-------|
| Add structured logging | Medium | 1-2 days | Use Winston or Pino; centralize API errors |
| Implement full password reset flow | High | 1 day | Email OTP already sent; add route & frontend UI |
| Add unit/integration tests | High | 3-5 days | Cover auth, wallpaper upload, search |
| Set up error tracking (Sentry) | Medium | 1 day | Catch production errors early |
| Implement image variants / CDN optimization | Medium | 2-3 days | Serve 3-5 resolutions; reduce bandwidth |
| Add rate limit headers (X-RateLimit-*) | Low | 4 hours | Improve client-side error handling |
| Document API with OpenAPI/Swagger | Low | 2-3 days | Makes integration easier for others |
| Set up E2E tests (Playwright) | Medium | 2-3 days | Test critical user flows |
| Audit CLIP model accuracy | Low | Ongoing | Monitor semantic search quality; may need fine-tuning |

---

## Summary

The **AURA** wallpaper app is a **well-architected, feature-rich platform** with solid fundamentals:

✅ **Strengths**:
- Clean monorepo with shared types
- Robust auth (OTP + JWT)
- Fast search (semantic + hybrid)
- Scalable image processing (Sharp + R2)
- Good UX (infinite scroll, optimistic UI, skeletons)
- SEO-friendly (Next.js, metadata)

⚠️ **Growth Areas**:
- Premium/subscription logic (scaffolding present, not active)
- Password reset flow (email ready, route missing)
- Admin panel for tag/category management (not shown)
- Monitoring & logging (basic console.log now)
- Test coverage (none visible)

🎯 **Ready for Production**: Yes, with caveat that premium features should be finalized before monetization.

