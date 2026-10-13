"use client";

import { useCallback, useEffect, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DEVICE_COOKIE, DEVICE_COOKIE_MAX_AGE, parseDevice, type Device } from "./device";

const EVENT = "aura:device";

function read(): Device {
  const hit = document.cookie.split("; ").find((c) => c.startsWith(`${DEVICE_COOKIE}=`));
  return parseDevice(hit?.slice(DEVICE_COOKIE.length + 1));
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}

/**
 * The device choice on the client. `setDevice` saves the cookie and re-renders the
 * current page on the server, so every list on it reloads with the new filter.
 */
export function useDevice() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Server snapshot is "all": the switch shows the saved choice right after hydration.
  const device = useSyncExternalStore(subscribe, read, () => "all" as Device);

  // While the page re-renders with the new filter, mark <html> so CSS can dim the content
  // and show a progress line straight away (see globals.css).
  useEffect(() => {
    if (!pending) return;
    const root = document.documentElement;
    root.dataset.devicePending = "";
    return () => {
      delete root.dataset.devicePending;
    };
  }, [pending]);

  const setDevice = useCallback(
    (next: Device) => {
      if (next === read()) return;
      document.cookie =
        next === "all"
          ? `${DEVICE_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`
          : `${DEVICE_COOKIE}=${next}; Path=/; Max-Age=${DEVICE_COOKIE_MAX_AGE}; SameSite=Lax`;
      window.dispatchEvent(new Event(EVENT));
      startTransition(() => router.refresh());
    },
    [router]
  );

  return { device, setDevice, pending };
}
