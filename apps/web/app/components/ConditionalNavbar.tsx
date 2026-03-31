"use client";

import { usePathname } from "next/navigation";

const HIDDEN_NAVBAR_ROUTES = ["/login", "/signup"];

const ConditionalNavbar = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();

  if (HIDDEN_NAVBAR_ROUTES.includes(pathname)) {
    return null;
  }

  return <>{children}</>;
};

export default ConditionalNavbar;