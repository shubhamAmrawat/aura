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
  sessionStorage.setItem("aura_toast", JSON.stringify({ message, type }));
}

const DURATION = 4000;
const ANIM_MS = 400;

function ToastItem({
  data,
  onRemove,
}: {
  data: ToastData;
  onRemove: (id: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  const dismissed = useRef(false);

  const dismiss = useCallback(() => {
    if (dismissed.current) return;
    dismissed.current = true;
    setVisible(false);
    setTimeout(() => onRemove(data.id), ANIM_MS);
  }, [data.id, onRemove]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(dismiss, DURATION);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [dismiss]);

  const isSuccess = data.type === "success";

  return (
    <div
      role="alert"
      onClick={dismiss}
      className="flex items-center gap-3 px-5 py-3.5 rounded-full cursor-pointer select-none"
      style={{
        background: isSuccess ? "var(--accent)" : "#ef4444",
        color: isSuccess ? "var(--bg-primary)" : "#fff",
        boxShadow: isSuccess
          ? "0 8px 32px rgba(201,168,76,0.35), 0 2px 8px rgba(0,0,0,0.4)"
          : "0 8px 32px rgba(239,68,68,0.35), 0 2px 8px rgba(0,0,0,0.4)",
        transform: visible
          ? "translateY(0) scale(1)"
          : "translateY(24px) scale(0.95)",
        opacity: visible ? 1 : 0,
        transition: `all ${ANIM_MS}ms cubic-bezier(0.16, 1, 0.3, 1)`,
        whiteSpace: "nowrap",
      }}
    >
      {/* icon */}
      {isSuccess ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      )}

      <span className="text-sm font-semibold tracking-wide">
        {data.message}
      </span>

      {/* progress bar */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full overflow-hidden"
        style={{ opacity: 0.3 }}
      >
        <div
          style={{
            height: "100%",
            background: "currentColor",
            animation: `shrink ${DURATION}ms linear forwards`,
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
      setTimeout(() => addToast(message, type), 200);
    } catch {}
  }, [pathname, addToast]);

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}

      {/* bottom center toast stack */}
      {toasts.length > 0 && (
        <div
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-3"
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