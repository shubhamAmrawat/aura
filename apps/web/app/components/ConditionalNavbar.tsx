"use client";

import { usePathname } from "next/navigation";

const HIDDEN_NAVBAR_ROUTES = ["/login", "/signup", "/welcome", "/upload"];

/**
 * Hides site chrome: the navbar on auth pages, and everything on the admin area
 * (which has its own layout). `adminOnly` hides only on /admin (used for the footer).
 */
const ConditionalNavbar = ({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) => {
  const pathname = usePathname();
  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");

  if (isAdmin || (!adminOnly && HIDDEN_NAVBAR_ROUTES.includes(pathname))) {
    return null;
  }

  return <>{children}</>;
};

export default ConditionalNavbar;