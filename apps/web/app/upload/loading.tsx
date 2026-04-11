export default function UploadLoading() {
  return (
    <main className="min-h-screen pt-24 px-4 sm:px-8 md:px-12 pb-16"
      style={{ background: "var(--bg-primary)" }}>
      <div className="max-w-3xl mx-auto">
        <div className="h-4 w-20 rounded animate-pulse mb-8"
          style={{ background: "var(--bg-elevated)" }} />
        <div className="h-8 w-56 rounded-lg animate-pulse mb-2"
          style={{ background: "var(--bg-elevated)" }} />
        <div className="h-4 w-80 rounded animate-pulse mb-8"
          style={{ background: "var(--bg-elevated)" }} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-[360px] rounded-2xl animate-pulse"
            style={{ background: "var(--bg-elevated)" }} />
          <div className="flex flex-col gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 rounded-xl animate-pulse"
                style={{ background: "var(--bg-elevated)" }} />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
