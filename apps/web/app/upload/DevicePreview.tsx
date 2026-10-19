"use client";

/** The wallpaper on a phone lock screen or a desktop, so creators see how it will really look. */

const now = () => {
  const d = new Date();
  return {
    time: d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hour12: false }),
    date: d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" }),
  };
};

/** Lock screen shows the clock; home screen shows app icons and a dock. */
export function PhonePreview({ src, dim = false, screen = "lock" }: { src: string; dim?: boolean; screen?: "lock" | "home" }) {
  const { time, date } = now();
  return (
    <div
      className="relative rounded-[44px] p-[10px] shrink-0 transition-[filter] duration-300"
      style={{
        width: "min(286px, 62vw)",
        aspectRatio: "286 / 590",
        background: "#050505",
        boxShadow: "0 0 0 1.5px rgba(255,255,255,0.12), 0 40px 80px rgba(0,0,0,0.6)",
        filter: dim ? "brightness(0.45) saturate(0.7)" : undefined,
      }}
    >
      <div className="relative w-full h-full rounded-[35px] overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={screen === "lock" ? "Your wallpaper on a phone lock screen" : "Your wallpaper on a phone home screen"} className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-[86px] h-6 rounded-full bg-black" aria-hidden="true" />
        {screen === "lock" ? (
          <div className="absolute top-[12%] inset-x-0 text-center text-white" style={{ textShadow: "0 2px 16px rgba(0,0,0,0.35)" }} aria-hidden="true">
            <div className="text-[13px] font-medium opacity-90">{date}</div>
            <div className="text-[64px] font-semibold leading-[1.05] tracking-[-0.03em]">{time}</div>
          </div>
        ) : (
          <div aria-hidden="true">
            <div className="absolute top-3.5 left-6 text-[12px] font-semibold text-white" style={{ textShadow: "0 1px 6px rgba(0,0,0,0.35)" }}>{time}</div>
            <div className="absolute top-[13%] inset-x-[9%] grid grid-cols-4 gap-x-[9%] gap-y-[14px]">
              {Array.from({ length: 16 }, (_, i) => (
                <span key={i} className="aspect-square rounded-[24%] backdrop-blur-md" style={{ background: `rgba(255,255,255,${i % 3 ? 0.32 : 0.48})`, boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }} />
              ))}
            </div>
            <div className="absolute bottom-3 inset-x-3 h-[70px] rounded-[26px] px-[7%] flex items-center justify-between backdrop-blur-md" style={{ background: "rgba(255,255,255,0.2)" }}>
              {[0, 1, 2, 3].map((i) => <span key={i} className="w-[46px] h-[46px] rounded-[24%]" style={{ background: "rgba(255,255,255,0.5)" }} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function DesktopPreview({ src, dim = false }: { src: string; dim?: boolean }) {
  return (
    <div className="w-[88%] max-w-[640px] flex flex-col items-center transition-[filter] duration-300" style={{ filter: dim ? "brightness(0.45) saturate(0.7)" : undefined }}>
      <div className="w-full aspect-[16/10] rounded-[14px] p-2" style={{ background: "#050505", boxShadow: "0 0 0 1.5px rgba(255,255,255,0.12), 0 40px 80px rgba(0,0,0,0.6)" }}>
        <div className="relative w-full h-full rounded-lg overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="Your wallpaper on a desktop" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute left-1/2 bottom-2.5 -translate-x-1/2 h-10 px-2.5 rounded-[14px] flex items-center gap-2 backdrop-blur-md" style={{ background: "rgba(255,255,255,0.22)" }} aria-hidden="true">
            {[0.7, 0.55, 0.7, 0.55, 0.7].map((o, i) => <span key={i} className="w-[26px] h-[26px] rounded-[7px]" style={{ background: `rgba(255,255,255,${o})` }} />)}
          </div>
        </div>
      </div>
      <div className="w-[30%] h-3.5 rounded-b-lg" style={{ background: "#1a1a1a" }} aria-hidden="true" />
    </div>
  );
}
