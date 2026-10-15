<p align="center">
  <img src="apps/web/public/brand/aurora-app-icon-512.png" alt="Aurora" width="96" />
</p>

<h1 align="center">Aurora</h1>

<p align="center">
  Curated wallpapers for every screen you own: on the web and on Android.<br />
  <a href="https://www.aurora-walls.com">aurora-walls.com</a>
</p>

---

## What it is

Aurora is a wallpaper platform with a website, an Android app and an admin panel, all running on one API.

- **Browse and search** about 1,300 phone and desktop wallpapers, organised into categories.
- **Search by meaning:** "cozy rainy evening" finds matching wallpapers even without those words, thanks to text embeddings.
- **Made for your device:** the app shows phone wallpapers only; the website's hero shows desktop ones.
- **One tap to apply** on Android (home screen, lock screen or both, with cropping), or download in full resolution.
- **Accounts** with email, one-time codes or Google sign-in; likes and downloads sync between web and app.

Behind the scenes, every upload is checked for unsafe content and analysed by AI, which suggests a title, description, tags and categories for an admin to review before it goes live.

## How it's built

| Part | Stack |
| --- | --- |
| Website + admin panel | Next.js 16, React 19, Tailwind CSS 4 (Vercel) |
| Android app | Expo SDK 54, React Native, expo-router (EAS Build) |
| API | Node.js, Express 5, TypeScript, Drizzle ORM, Zod (Render) |
| Data | PostgreSQL on Supabase with pgvector |
| Images | Cloudflare R2 + CDN, Sharp thumbnails, blurhash placeholders |
| AI and safety | OpenAI (analysis and embeddings), Sightengine (moderation) |

## Repository

```
apps/web          Next.js website and admin panel
apps/mobileApp    Expo Android app (uses npm)
services/api      Express API, database models, scripts, tests
packages/types    Shared TypeScript types
```

## Running locally

Requires Node.js 20+ and pnpm. Environment files are not committed.

```bash
pnpm install                              # API, website, shared types
cd services/api && pnpm dev               # API on http://localhost:3001
cd apps/web && pnpm dev                   # website on http://localhost:3000
cd apps/mobileApp && npm install && npx expo run:android --device   # Android app
```

The full developer documentation (architecture, API, database, deployment) is shared separately with contributors.

## Status

Live at [aurora-walls.com](https://www.aurora-walls.com); the Android app is in testing.
