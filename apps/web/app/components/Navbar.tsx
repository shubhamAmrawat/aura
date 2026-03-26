import Link from "next/link";

const Navbar = () => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-4 border-b border-white/5 bg-[#0a0a0a]/80 backdrop-blur-md">
      
      {/* logo */}
      <Link 
        href="/" 
        className="text-xl font-bold tracking-[0.2em] text-white hover:text-white/70 transition-colors"
      >
        AURA
      </Link>

      {/* links */}
      <div className="hidden md:flex items-center gap-8">
        <Link href="/" className="text-sm text-white/50 hover:text-white transition-colors">
          Discover
        </Link>
        <Link href="/categories" className="text-sm text-white/50 hover:text-white transition-colors">
          Categories
        </Link>
        <Link href="/trending" className="text-sm text-white/50 hover:text-white transition-colors">
          Trending
        </Link>
      </div>

      {/* cta */}
      <button className="text-sm px-4 py-2 rounded-full border border-white/20 text-white/70 hover:border-white/50 hover:text-white transition-all">
        Sign in
      </button>

    </nav>
  );
};

export default Navbar;