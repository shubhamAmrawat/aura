"use client";

import { useEffect, useRef, useState } from "react";

// Minimal typings for Google Identity Services (https://accounts.google.com/gsi/client)
type CredentialResponse = { credential: string };
type GsiId = {
  initialize(config: {
    client_id: string;
    callback: (r: CredentialResponse) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
    context?: "signin" | "signup" | "use";
    itp_support?: boolean;
    use_fedcm_for_button?: boolean;
  }): void;
  renderButton(parent: HTMLElement, options: Record<string, unknown>): void;
  prompt(): void;
  cancel(): void;
};
declare global {
  interface Window {
    google?: { accounts: { id: GsiId } };
  }
}

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const SCRIPT_SRC = "https://accounts.google.com/gsi/client";

let scriptPromise: Promise<void> | null = null;
function loadGsi(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.accounts?.id) return Promise.resolve();
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => {
      scriptPromise = null;
      reject(new Error("Failed to load Google sign-in"));
    };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

type Props = {
  /** Called with Google's ID token; should POST it to /api/auth/google. */
  onCredential: (credential: string) => void;
  /** Wording on the button / One Tap card. */
  context?: "signin" | "signup";
  /** Show the One Tap account suggestion when the page opens. */
  oneTap?: boolean;
};

/**
 * "Continue with Google" button + optional One Tap prompt (Google suggests the account
 * already signed in to the browser). Renders nothing if NEXT_PUBLIC_GOOGLE_CLIENT_ID is unset.
 */
export default function GoogleSignIn({ onCredential, context = "signin", oneTap = true }: Props) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(onCredential);
  const [failed, setFailed] = useState(false);

  // Keep the latest handler without re-initializing Google on every render.
  useEffect(() => {
    callbackRef.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    if (!CLIENT_ID) return;
    let cancelled = false;

    loadGsi()
      .then(() => {
        const gsi = window.google?.accounts.id;
        if (cancelled || !gsi || !buttonRef.current) return;
        gsi.initialize({
          client_id: CLIENT_ID,
          callback: (r) => callbackRef.current(r.credential),
          auto_select: false,
          cancel_on_tap_outside: true,
          context,
          itp_support: true,
          use_fedcm_for_button: true,
        });
        const width = Math.min(400, Math.max(200, Math.round(buttonRef.current.offsetWidth || 340)));
        gsi.renderButton(buttonRef.current, {
          type: "standard",
          theme: "filled_black",
          size: "large",
          shape: "pill",
          text: context === "signup" ? "signup_with" : "continue_with",
          logo_alignment: "left",
          width,
        });
        if (oneTap) gsi.prompt();
      })
      .catch(() => !cancelled && setFailed(true));

    return () => {
      cancelled = true;
      window.google?.accounts.id.cancel();
    };
  }, [context, oneTap]);

  if (!CLIENT_ID) return null;
  if (failed) {
    return (
      <p className="text-xs text-center" style={{ color: "var(--text-muted)" }}>
        Google sign-in is unavailable right now.
      </p>
    );
  }
  return <div ref={buttonRef} className="w-full flex justify-center" style={{ minHeight: 44 }} />;
}
