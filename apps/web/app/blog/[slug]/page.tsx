import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import {
  BLOG_POSTS,
  getPostBySlug,
  getRelatedPosts,
  getWallpaperForPost,
  getWallpapersForPosts,
  type BlogBlock,
} from "../posts";

interface BlogArticlePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return BLOG_POSTS.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: BlogArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) {
    return { title: "Article Not Found | Aurora Blog" };
  }
  return {
    title: `${post.title} | Aurora Blog`,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: "article",
    },
  };
}

function ArticleBlock({ block }: { block: BlogBlock }) {
  if (block.type === "h2") {
    return (
      <h2
        className="text-xl md:text-2xl font-semibold mt-10 mb-4"
        style={{ color: "var(--text-primary)" }}
      >
        {block.text}
      </h2>
    );
  }

  if (block.type === "ul") {
    return (
      <ul
        className="space-y-2 my-5 list-disc list-inside text-base leading-relaxed"
        style={{ color: "var(--text-secondary)" }}
      >
        {block.items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    );
  }

  return (
    <p
      className="text-base leading-[1.85] mb-5"
      style={{ color: "var(--text-secondary)" }}
    >
      {block.text}
    </p>
  );
}

export default async function BlogArticlePage({ params }: BlogArticlePageProps) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const related = getRelatedPosts(slug, 3);

  /*
    Fetch the hero wallpaper for this article and the related posts'
    wallpapers in parallel. Each is independently fault-tolerant — any
    failure falls back to that post's gradient on render.
  */
  const [heroWallpaper, relatedWallpapers] = await Promise.all([
    getWallpaperForPost(post),
    getWallpapersForPosts(related),
  ]);

  return (
    <main
      className="min-h-screen pt-24 pb-20 px-6 md:px-12"
      style={{ background: "var(--bg-primary)" }}
    >
      <div className="max-w-2xl mx-auto">
        <Link
          href="/blog"
          className="text-xs tracking-widest uppercase transition-opacity hover:opacity-60 mb-10 inline-block"
          style={{ color: "var(--text-muted)" }}
        >
          ← Blog
        </Link>

        <header className="mb-10">
          <span
            className="inline-block text-[10px] tracking-[0.2em] uppercase font-medium px-2.5 py-1 rounded-full mb-5"
            style={{
              background: "var(--accent-muted)",
              color: "var(--accent)",
            }}
          >
            {post.category}
          </span>
          <h1
            className="text-3xl md:text-4xl font-bold leading-tight mb-5"
            style={{ color: "var(--text-primary)" }}
          >
            {post.title}
          </h1>
          <div
            className="flex items-center gap-3 text-xs tracking-wider uppercase"
            style={{ color: "var(--text-muted)" }}
          >
            <span>{post.date}</span>
            <span
              className="w-1 h-1 rounded-full"
              style={{ background: "var(--text-muted)" }}
              aria-hidden
            />
            <span>{post.readTime}</span>
          </div>
        </header>

        {/* Hero — real wallpaper from the platform when available,
            gradient placeholder otherwise. */}
        <div
          className="relative h-56 md:h-80 rounded-2xl mb-4 overflow-hidden"
          style={{
            background: heroWallpaper
              ? heroWallpaper.dominantColor || "#1a1a1a"
              : post.gradient,
          }}
        >
          {heroWallpaper && (
            <>
              <Image
                src={heroWallpaper.fileUrl}
                alt={heroWallpaper.title}
                fill
                sizes="(max-width: 768px) 100vw, 720px"
                className="object-cover"
                priority
              />
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(to top, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.05) 70%, transparent 100%)",
                }}
              />
            </>
          )}
        </div>
        {heroWallpaper && (
          <p
            className="text-[11px] tracking-wider uppercase mb-10"
            style={{ color: "var(--text-muted)" }}
          >
            Featured wallpaper —{" "}
            <Link
              href={`/wallpaper/${heroWallpaper.id}`}
              className="transition-opacity hover:opacity-70"
              style={{ color: "var(--accent)" }}
            >
              {heroWallpaper.title}
            </Link>
          </p>
        )}
        {!heroWallpaper && <div className="mb-10" />}

        <article>
          {post.content.map((block, i) => (
            <ArticleBlock key={i} block={block} />
          ))}
        </article>
      </div>

      {related.length > 0 && (
        <section
          className="max-w-6xl mx-auto mt-20 pt-16 border-t"
          style={{ borderColor: "var(--border)" }}
        >
          <h2
            className="text-xl md:text-2xl font-semibold mb-8"
            style={{ color: "var(--text-primary)" }}
          >
            More Articles
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {related.map((rel, idx) => {
              const relWallpaper = relatedWallpapers[idx] ?? null;
              return (
                <Link
                  key={rel.slug}
                  href={`/blog/${rel.slug}`}
                  className="group rounded-xl overflow-hidden flex flex-col transition-transform duration-300 hover:-translate-y-1"
                  style={{
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div
                    className="relative h-32 w-full overflow-hidden"
                    style={{
                      background: relWallpaper
                        ? relWallpaper.dominantColor || "#1a1a1a"
                        : rel.gradient,
                    }}
                  >
                    {relWallpaper && (
                      <Image
                        src={relWallpaper.fileUrl}
                        alt={relWallpaper.title}
                        fill
                        sizes="(max-width: 768px) 100vw, 33vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    )}
                    <div
                      className="absolute inset-0"
                      style={{
                        background:
                          "linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.1) 60%, transparent 100%)",
                      }}
                    />
                    <span
                      className="absolute bottom-3 left-3 text-[10px] tracking-[0.2em] uppercase font-medium px-2.5 py-1 rounded-full"
                      style={{
                        background: "rgba(0, 0, 0, 0.55)",
                        color: "var(--text-primary)",
                        backdropFilter: "blur(8px)",
                      }}
                    >
                      {rel.category}
                    </span>
                  </div>
                  <div className="flex-1 flex flex-col p-5">
                    <h3
                      className="text-base font-semibold leading-snug mb-3 transition-colors group-hover:[color:var(--accent)]"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {rel.title}
                    </h3>
                    <div
                      className="mt-auto text-[11px] tracking-wider uppercase"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {rel.readTime}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}
