export default async function HomePage() {
  const response = await fetch("http://localhost:3001/api/wallpapers", {
    cache: "no-store",
  });

  const { data: wallpapers } = await response.json();

  return (
    <main className="min-h-screen bg-[#0a0a0a]">
      <div className="p-8">
        <h1 className="text-4xl font-bold text-white mb-2">AURA</h1>
        <p className="text-[#888] mb-8">
          {wallpapers.length} wallpapers loaded
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {wallpapers.map((wallpaper: any) => (
            <div
              key={wallpaper.id}
              className="relative aspect-[3/4] rounded-xl overflow-hidden bg-[#111]"
              style={{ backgroundColor: wallpaper.dominantColor }}
            >
              <img
                src={wallpaper.fileUrl}
                alt={wallpaper.title}
                className="w-full h-full object-cover"
              />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}