import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { BLOG_POSTS, getWallpapersForPosts } from "./posts";

export const metadata: Metadata = {
  title: "Blog | Aurora — Wallpaper Tips, Trends & Guides",
  description:
    "Guides, trends, and inspiration for wallpaper enthusiasts. From OLED optimization to design theory — read everything Aurora.",
};

export default async function BlogIndexPage() {
  /*
    Fetch a representative wallpaper from our own gallery for each post in
    parallel. getWallpapersForPosts is fault-tolerant per-entry: any failure
    falls back to the post's gradient on render.
  */
  const wallpapers = await getWallpapersForPosts(BLOG_POSTS);

  return (
    <main
      className="min-h-screen pt-24 pb-20 px-6 md:px-12"
      style={{ background: "var(--bg-primary)" }}
    >
      <div className="max-w-6xl mx-auto">
        <Link
          href="/"
          className="text-xs tracking-widest uppercase transition-opacity hover:opacity-60 mb-10 inline-block"
          style={{ color: "var(--text-muted)" }}
        >
          ← Back to Aurora
        </Link>

        <header className="mb-12">
          <p
            className="text-[11px] tracking-[0.3em] uppercase mb-4"
            style={{ color: "var(--accent)" }}
          >
            Journal
          </p>
          <h1
            className="text-3xl md:text-5xl font-bold leading-tight mb-4"
            style={{ color: "var(--text-primary)" }}
          >
            From the Aurora Blog
          </h1>
          <p
            className="text-base md:text-lg max-w-2xl"
            style={{ color: "var(--text-secondary)" }}
          >
            Guides, trends, and inspiration for wallpaper enthusiasts.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {BLOG_POSTS.map((post, idx) => {
            const wallpaper = wallpapers[idx] ?? null;
            return (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="group rounded-xl overflow-hidden flex flex-col transition-transform duration-300 hover:-translate-y-1"
                style={{
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border)",
                }}
              >
                <div
                  className="relative h-40 w-full overflow-hidden"
                  style={{
                    background: wallpaper
                      ? wallpaper.dominantColor || "#1a1a1a"
                      : post.gradient,
                  }}
                >
                  {wallpaper && (
                    <Image
                      src={wallpaper.fileUrl}
                      alt={wallpaper.title}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  )}
                  {/* Dark gradient overlay — keeps the category badge readable
                      regardless of the wallpaper's brightness. */}
                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        "linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.1) 60%, transparent 100%)",
                    }}
                  />
                  <span
                    className="absolute bottom-4 left-4 text-[10px] tracking-[0.2em] uppercase font-medium px-2.5 py-1 rounded-full"
                    style={{
                      background: "rgba(0, 0, 0, 0.55)",
                      color: "var(--text-primary)",
                      backdropFilter: "blur(8px)",
                    }}
                  >
                    {post.category}
                  </span>
                </div>

                <div className="flex-1 flex flex-col p-6">
                  <h2
                    className="text-lg font-semibold leading-snug mb-3 transition-colors group-hover:[color:var(--accent)]"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {post.title}
                  </h2>
                  <p
                    className="text-sm leading-relaxed mb-5 flex-1"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {post.excerpt}
                  </p>

                  <div
                    className="flex items-center justify-between text-[11px] tracking-wider uppercase"
                    style={{ color: "var(--text-muted)" }}
                  >
                    <span>
                      {post.date} · {post.readTime}
                    </span>
                    <span style={{ color: "var(--accent)" }}>Read →</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}
