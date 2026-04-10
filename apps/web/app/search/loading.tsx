export default function SearchLoading() {
  return (
    <main className="min-h-screen pt-24 px-8 md:px-12" style={{ background: "var(--bg-primary)" }}>
      <div className="max-w-[1400px] mx-auto">
        {/* header skeleton */}
        <div className="mb-8">
          <div className="h-3 w-24 rounded animate-pulse mb-2" style={{ background: "var(--bg-elevated)" }} />
          <div className="h-8 w-48 rounded-lg animate-pulse mb-2" style={{ background: "var(--bg-elevated)" }} />
          <div className="h-4 w-32 rounded animate-pulse" style={{ background: "var(--bg-elevated)" }} />
        </div>

        {/* grid skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[3/4] rounded-2xl animate-pulse"
              style={{ background: "var(--bg-elevated)" }}
            />
          ))}
        </div>
      </div>
    </main>
  );
}