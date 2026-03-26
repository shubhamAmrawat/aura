import Link from "next/link";

const Navbar = () => {
  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-12 py-2 border-b backdrop-blur-md"
      style={{
        background: 'rgba(10, 10, 10, 0.92)',
        borderColor: 'var(--border)'
      }}
    >
      {/* logo */}
      <Link
        href="/"
        className="text-2xl font-bold tracking-[0.3em] transition-opacity hover:opacity-70"
        style={{ color: 'var(--accent)' }}
      >
        AURA
      </Link>

      {/* links */}
      <div className="hidden md:flex items-center gap-12">
        {[
          { label: "Discover", href: "/" },
          { label: "Categories", href: "/categories" },
          { label: "Trending", href: "/trending" },
        ].map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="text-sm font-medium tracking-widest uppercase transition-colors duration-200 hover:text-white"
            style={{ color: 'var(--text-secondary)' }}
          >
            {link.label}
          </Link>
        ))}
      </div>

      {/* cta */}
      <Link
        href="/login"
        className="text-sm font-medium px-7 py-2.5 rounded-full border transition-all duration-200 hover:opacity-80 tracking-wider"
        style={{
          borderColor: 'var(--accent)',
          color: 'var(--accent)',
        }}
      >
        Sign in
      </Link>
    </nav>
  );
};

export default Navbar;