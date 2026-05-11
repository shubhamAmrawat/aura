import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About Aurora | Premium Wallpaper Discovery",
  description:
    "Aurora is a curated wallpaper discovery platform — an editorial space for high-resolution art from independent photographers and digital artists.",
};

export default function AboutPage() {
  return (
    <main
      className="min-h-screen pt-24 pb-20 px-6 md:px-12"
      style={{ background: "var(--bg-primary)" }}
    >
      <div className="max-w-4xl mx-auto">
        <Link
          href="/"
          className="text-xs tracking-widest uppercase transition-opacity hover:opacity-60 mb-10 inline-block"
          style={{ color: "var(--text-muted)" }}
        >
          ← Back to Aurora
        </Link>

        {/* Section 1 — Hero */}
        <section className="mb-20">
          <p
            className="text-[11px] tracking-[0.3em] uppercase mb-5"
            style={{ color: "var(--accent)" }}
          >
            About Aurora
          </p>
          <h1
            className="text-4xl md:text-5xl font-bold leading-tight mb-6"
            style={{ color: "var(--text-primary)" }}
          >
            Where Art Meets Your Screen
          </h1>
          <p
            className="text-base md:text-lg leading-relaxed max-w-3xl"
            style={{ color: "var(--text-secondary)" }}
          >
            Aurora is a curated wallpaper discovery platform built for people who
            think the screen they look at every day deserves more than a stock
            gradient. We&apos;re not a wallpaper dump — we&apos;re an editorial
            experience, hand-reviewing every image for resolution, composition,
            and atmosphere before it reaches the gallery. Behind every wallpaper
            is a real photographer, illustrator, or 3D artist, and our job is to
            make sure their work is seen the way it was meant to be seen. The
            vision is simple: make every screen, on every device, feel a little
            more alive.
          </p>
        </section>

        {/* Section 2 — Our Mission */}
        <section className="mb-20">
          <div
            className="pl-6 md:pl-8 border-l-2"
            style={{ borderColor: "var(--accent)" }}
          >
            <h2
              className="text-2xl md:text-3xl font-bold mb-6"
              style={{ color: "var(--text-primary)" }}
            >
              Our Mission
            </h2>
            <p
              className="text-base leading-relaxed mb-5"
              style={{ color: "var(--text-secondary)" }}
            >
              Premium visual art shouldn&apos;t live behind a paywall or buried
              on someone&apos;s portfolio. Aurora exists to democratize access to
              high-quality, hand-picked wallpapers — bringing the kind of imagery
              you&apos;d expect from a coffee-table art book to the device sitting
              in your pocket. Everything we surface is free to download, free to
              use on your personal devices, and free to share with someone whose
              lock screen could use a refresh.
            </p>
            <p
              className="text-base leading-relaxed"
              style={{ color: "var(--text-secondary)" }}
            >
              We also exist for the artists. Independent photographers,
              illustrators, and digital creators carry the entire visual web on
              their shoulders, and yet most platforms strip away credit the
              moment a file gets re-shared. Aurora keeps the creator at the
              center — every upload is tied to its author, every download
              respects the work, and our growing community is built around
              recognizing the people behind the pixels, not just the pixels
              themselves.
            </p>
          </div>
        </section>

        {/* Section 3 — What Makes Aurora Different */}
        <section className="mb-20">
          <h2
            className="text-2xl md:text-3xl font-bold mb-10"
            style={{ color: "var(--text-primary)" }}
          >
            What Makes Aurora Different
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                title: "Curated Quality",
                body: "Every wallpaper is reviewed before it lands in the gallery. Resolution, composition, color, atmosphere — if it doesn’t hold up, it doesn’t go live. No upscaled blurs, no AI noise, no low-effort uploads.",
              },
              {
                title: "Creator First",
                body: "Photographers and artists keep their identity attached to their work. Every wallpaper links to its creator’s profile, and we never strip metadata or hide credit lines behind a paywall.",
              },
              {
                title: "Every Screen",
                body: "From a 6.1-inch phone to a 32-inch ultrawide, Aurora serves the right resolution for the right device. Mobile-portrait, desktop-landscape, tablet — we deliver the file your screen actually needs.",
              },
            ].map((card) => (
              <div
                key={card.title}
                className="rounded-xl p-6"
                style={{
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border)",
                }}
              >
                <div
                  className="w-10 h-[2px] mb-5"
                  style={{ background: "var(--accent)" }}
                />
                <h3
                  className="text-lg font-semibold mb-3"
                  style={{ color: "var(--text-primary)" }}
                >
                  {card.title}
                </h3>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {card.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Section 4 — Content & Licensing */}
        <section className="mb-20">
          <h2
            className="text-2xl md:text-3xl font-bold mb-6"
            style={{ color: "var(--text-primary)" }}
          >
            Our Content
          </h2>
          <p
            className="text-base leading-relaxed mb-5"
            style={{ color: "var(--text-secondary)" }}
          >
            Aurora&apos;s gallery comes from three sources, each with a clear
            license trail. We pull a portion of our catalog from Unsplash, which
            is free for commercial and non-commercial use under the Unsplash
            license. We accept direct uploads from independent creators, who
            confirm ownership and grant Aurora the right to display their work
            at the moment of upload. And we commission a small set of original
            wallpapers from artists we partner with, which are exclusive to the
            platform.
          </p>
          <p
            className="text-base leading-relaxed"
            style={{ color: "var(--text-secondary)" }}
          >
            All wallpapers on Aurora are free to download and use on your
            personal devices — phones, tablets, laptops, monitors. Commercial
            use, redistribution, or use inside a paid product requires explicit
            permission from the original creator. If you want to license a piece
            for something bigger, reach out and we&apos;ll connect you with the
            artist directly.
          </p>
        </section>

        {/* Section 5 — Contact CTA */}
        <section
          className="rounded-2xl p-8 md:p-10 text-center"
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
          }}
        >
          <h2
            className="text-xl md:text-2xl font-semibold mb-3"
            style={{ color: "var(--text-primary)" }}
          >
            Have questions or want to collaborate?
          </h2>
          <p
            className="text-sm mb-6"
            style={{ color: "var(--text-secondary)" }}
          >
            We&apos;d love to hear from creators, partners, and curious
            visitors.
          </p>
          <Link
            href="/contact"
            className="inline-block px-6 py-3 rounded-full text-sm font-medium transition-opacity hover:opacity-80"
            style={{
              background: "var(--accent)",
              color: "var(--bg-primary)",
            }}
          >
            Get in Touch →
          </Link>
        </section>
      </div>
    </main>
  );
}
