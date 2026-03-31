"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";

type ToastType = "success" | "error";

interface ToastData {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export function queueToast(message: string, type: ToastType = "success") {
  sessionStorage.setItem(
    "aura_toast",
    JSON.stringify({ message, type })
  );
}

const DURATION = 4000;
const ANIM_MS = 350;

function ToastItem({
  data,
  onRemove,
}: {
  data: ToastData;
  onRemove: (id: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(100);
  const dismissed = useRef(false);

  const dismiss = useCallback(() => {
    if (dismissed.current) return;
    dismissed.current = true;
    setVisible(false);
    setTimeout(() => onRemove(data.id), ANIM_MS);
  }, [data.id, onRemove]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setVisible(true);
      setProgress(0);
    });
    const timer = setTimeout(dismiss, DURATION);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [dismiss]);

  const accent = data.type === "success" ? "var(--accent)" : "#ef4444";

  return (
    <div
      role="alert"
      onClick={dismiss}
      className="relative overflow-hidden rounded-lg pl-4 pr-5 py-3.5 min-w-[300px] max-w-[400px] cursor-pointer"
      style={{
        background: "rgba(26, 26, 26, 0.96)",
        border: "1px solid var(--border-hover)",
        borderLeft: `3px solid ${accent}`,
        backdropFilter: "blur(16px)",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5)",
        transform: visible
          ? "translateX(0)"
          : "translateX(calc(100% + 32px))",
        opacity: visible ? 1 : 0,
        transition: `all ${ANIM_MS}ms cubic-bezier(0.16, 1, 0.3, 1)`,
      }}
    >
      <div className="flex items-center gap-3">
        {data.type === "success" ? (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke={accent}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="flex-shrink-0"
          >
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        ) : (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke={accent}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="flex-shrink-0"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        )}
        <span
          className="text-sm font-medium"
          style={{ color: "var(--text-primary)" }}
        >
          {data.message}
        </span>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-[2px]">
        <div
          style={{
            height: "100%",
            width: `${progress}%`,
            background: accent,
            opacity: 0.4,
            transition: `width ${DURATION}ms linear`,
          }}
        />
      </div>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const pathname = usePathname();

  const addToast = useCallback(
    (message: string, type: ToastType = "success") => {
      const id = Math.random().toString(36).slice(2, 10);
      setToasts((prev) => [...prev, { id, message, type }]);
    },
    []
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("aura_toast");
      if (!raw) return;
      sessionStorage.removeItem("aura_toast");
      const { message, type } = JSON.parse(raw);
      setTimeout(() => addToast(message, type), 150);
    } catch {}
  }, [pathname, addToast]);

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      {toasts.length > 0 && (
        <div
          className="fixed top-6 right-6 z-[100] flex flex-col gap-3"
          style={{ pointerEvents: "none" }}
        >
          {toasts.map((t) => (
            <div key={t.id} style={{ pointerEvents: "auto" }}>
              <ToastItem data={t} onRemove={removeToast} />
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}
