"use client";

import Logo from "@/app/components/Logo";
import Link from "next/link";

import { useEffect, useState } from "react";
import { getToken } from "@/lib/token";
import { me } from "@/lib/authApi";
import { User } from "@aura/types";
import NavbarAuth from "@/app/components/NavbarAuth";


const Navbar = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoaded(true);
      return;
    }
    me(token)
      .then((data) => {
        setUser(data.user);
        setLoaded(true);
      })
      .catch(() => {
        setLoaded(true);
      });
  }, []);

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-12 py-2 border-b backdrop-blur-md"
      style={{
        background: 'rgba(10, 10, 10, 0.92)',
        borderColor: 'var(--border)'
      }}
    >
      <Logo size="sm" />

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

      {loaded && <NavbarAuth user={user} />}
    </nav>
  );
};

export default Navbar;