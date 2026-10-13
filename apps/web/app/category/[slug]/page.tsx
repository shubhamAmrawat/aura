import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { getWallpapers, getCategoryDetails } from "@/lib/api";
import { CategoryWallpaperGrid } from "@/app/components/CategoryWallpaperGrid";
import { getDevice } from "@/lib/device.server";

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
}

const titleCase = (slug: string) => slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, " ");

export async function generateMetadata({ params }: CategoryPageProps) {
  const { slug } = await params;
  const details = await getCategoryDetails(slug);
  // Unknown or hidden category: 404 here (before the page streams) so crawlers get a real 404 status.
  if (details === null) notFound();
  const name = details?.name ?? titleCase(slug);
  return {
    title: `${name} Wallpapers — Free HD & 4K Download`,
    description:
      details?.description ??
      `Browse and download free ${name.toLowerCase()} wallpapers for phone and desktop, in HD and 4K.`,
    alternates: { canonical: `/category/${details?.slug ?? slug}` },
  };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  const device = await getDevice();

  const [details, wallpapersResult] = await Promise.all([
    getCategoryDetails(slug),
    getWallpapers({ category: slug, limit: 20, device }).then(
      (r) => r,
      () => null
    ),
  ]);

  // Unknown or hidden → 404; renamed or merged → 308 to the current address (keeps old links and rankings).
  if (details === null) notFound();
  if (details?.redirected && details.slug !== slug) permanentRedirect(`/category/${details.slug}`);

  const name = details?.name ?? titleCase(slug);
  const paragraphs = (details?.intro ?? "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const [lead, ...more] = paragraphs;

  return (
    <main
      className="min-h-screen pt-24 px-8 md:px-12"
      style={{ background: "var(--bg-primary)" }}
    >
      <div className="max-w-[1400px] mx-auto">
        <div className="mb-10">
          <Link
            href="/"
            className="text-xs tracking-widest uppercase transition-opacity hover:opacity-60 mb-4 inline-block"
            style={{ color: "var(--text-muted)" }}
          >
            ← Back
          </Link>
          <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>
            {name} wallpapers
          </h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {details?.description ?? `Browse ${name.toLowerCase()} wallpapers`}
          </p>

          {lead && (
            <div className="mt-5 max-w-3xl text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              <p>{lead}</p>
              {more.length > 0 && (
                <details className="group mt-2">
                  <summary
                    className="cursor-pointer list-none text-xs font-medium tracking-wide hover:underline group-open:hidden"
                    style={{ color: "var(--accent)" }}
                  >
                    Read more
                  </summary>
                  {more.map((p, i) => (
                    <p key={i} className="mt-3">{p}</p>
                  ))}
                </details>
              )}
            </div>
          )}
        </div>

        <CategoryWallpaperGrid
          key={device}
          device={device}
          slug={details?.slug ?? slug}
          initialWallpapers={wallpapersResult?.data ?? []}
          initialHasMore={wallpapersResult?.hasMore ?? false}
        />
      </div>
    </main>
  );
}
