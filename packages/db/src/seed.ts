import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as wallpaperSchema from "./schema/wallpapers";
import * as schema from "./schema/users";

const client = postgres(process.env.DATABASE_URL!, { ssl: "require", max: 1 });
const db = drizzle(client);

const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;

const CATEGORIES = [
  { name: "Nature", slug: "nature", query: "nature landscape" },
  { name: "Architecture", slug: "architecture", query: "architecture building" },
  { name: "Abstract", slug: "abstract", query: "abstract art" },
  { name: "Dark", slug: "dark", query: "dark moody aesthetic" },
  { name: "Minimal", slug: "minimal", query: "minimal clean" },
  { name: "Neon", slug: "neon", query: "neon city night" },
];

async function fetchUnsplashPhotos(query: string, perPage = 8) {
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=portrait`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Unsplash API error: ${response.statusText}`);
  }

  const data = await response.json() as any;
  return data.results;
}

async function seed() {
  console.log("Seeding database...");

  // Insert categories first
  console.log("Inserting categories...");
  const insertedCategories = await db
    .insert(wallpaperSchema.categories)
    .values(
      CATEGORIES.map((cat, i) => ({
        name: cat.name,
        slug: cat.slug,
        description: `Beautiful ${cat.name.toLowerCase()} wallpapers`,
        sortOrder: i,
      }))
    )
    .onConflictDoNothing()
    .returning();

  console.log(`Inserted ${insertedCategories.length} categories`);

  // Fetch and insert wallpapers for each category
  for (const category of CATEGORIES) {
    console.log(`Fetching ${category.name} wallpapers...`);

    const photos = await fetchUnsplashPhotos(category.query);
    const categoryRecord = insertedCategories.find(
      (c) => c.slug === category.slug
    );

    if (!categoryRecord) {
      console.log(`Skipping ${category.name} - category not found`);
      continue;
    }

    const wallpapers = photos.map((photo: any) => ({
      title: photo.description || photo.alt_description || category.name,
      description: photo.alt_description,
      fileUrl: photo.urls.full,
      blurhash: photo.blur_hash ?? "LKO2:N%2Tw=w]~RBVZRi};RPxuwH",
      dominantColor: photo.color ?? "#000000",
      palette: [photo.color ?? "#000000"],
      width: photo.width,
      height: photo.height,
      fileSizeBytes: 0,
      format: "jpeg" as const,
      categoryId: categoryRecord.id,
      tags: photo.tags?.map((t: any) => t.title) ?? [],
      isPremium: false,
      isFeatured: false,
      isAiGenerated: false,
      downloadCount: Math.floor(Math.random() * 1000),
      likeCount: Math.floor(Math.random() * 500),
      viewCount: Math.floor(Math.random() * 5000),
      status: "approved" as const,
    }));

    await db
      .insert(wallpaperSchema.wallpapers)
      .values(wallpapers)
      .onConflictDoNothing();

    console.log(`Inserted ${wallpapers.length} ${category.name} wallpapers`);

    // Small delay to respect Unsplash rate limits
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  console.log("Seeding complete!");
  await client.end();
}

seed().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});