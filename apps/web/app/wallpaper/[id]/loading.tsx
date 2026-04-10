export default function WallpaperLoading() {
  return (
    <main className="min-h-screen" style={{ background: "var(--bg-primary)" }}>

      {/* full bleed image skeleton — landscape layout default */}
      <div
        className="w-full pt-[72px] animate-pulse"
        style={{ height: "85vh", background: "var(--bg-elevated)" }}
      />

      {/* details skeleton below image */}
      <div
        className="w-full px-8 md:px-12 py-12"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <div className="max-w-[1400px] mx-auto">

          {/* top row — title left, buttons right */}
          <div className="flex items-start justify-between gap-8 mb-8">
            <div className="flex flex-col gap-3 flex-1">
              {/* tag pill */}
              <div className="h-6 w-36 rounded-full animate-pulse" style={{ background: "var(--bg-elevated)" }} />
              {/* title */}
              <div className="h-9 w-3/4 rounded-lg animate-pulse" style={{ background: "var(--bg-elevated)" }} />
              {/* description */}
              <div className="h-4 w-1/2 rounded animate-pulse" style={{ background: "var(--bg-elevated)" }} />
            </div>
            {/* download button */}
            <div className="h-12 w-40 rounded-full animate-pulse flex-shrink-0" style={{ background: "var(--bg-elevated)" }} />
          </div>

          {/* stats row */}
          <div className="flex items-center gap-6 mb-8">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-3 w-16 rounded animate-pulse" style={{ background: "var(--bg-elevated)" }} />
                <div className="h-4 w-20 rounded animate-pulse" style={{ background: "var(--bg-elevated)" }} />
              </div>
            ))}
          </div>

          {/* color palette + tags row */}
          <div className="flex items-start gap-12">
            <div className="flex gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="w-8 h-8 rounded-full animate-pulse" style={{ background: "var(--bg-elevated)" }} />
              ))}
            </div>
            <div className="flex gap-2 flex-wrap">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-6 w-16 rounded-full animate-pulse" style={{ background: "var(--bg-elevated)" }} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* similar wallpapers skeleton */}
      <div className="px-8 md:px-12 py-16" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="max-w-[1400px] mx-auto">
          <div className="h-5 w-40 rounded animate-pulse mb-2" style={{ background: "var(--bg-elevated)" }} />
          <div className="h-3 w-28 rounded animate-pulse mb-8" style={{ background: "var(--bg-elevated)" }} />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] rounded-2xl animate-pulse" style={{ background: "var(--bg-elevated)" }} />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}