import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import AppToast, { type ToastPosition, type ToastType } from "../components/AppToast";

type ToastState = {
  visible: boolean;
  message: string;
  type: ToastType;
  duration: number;
  position: ToastPosition;
};

type ShowToastOptions = {
  type?: ToastType;
  duration?: number;
  position?: ToastPosition;
};

type ToastContextValue = {
  showToast: (message: string, options?: ShowToastOptions) => void;
  hideToast: () => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [toast, setToast] = useState<ToastState>({
    visible: false,
    message: "",
    type: "info",
    duration: 2600,
    position: "bottom",
  });

  const clearTimer = useCallback(() => {
    if (!timeoutRef.current) return;
    clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }, []);

  const hideToast = useCallback(() => {
    clearTimer();
    setToast((prev) => ({ ...prev, visible: false }));
  }, [clearTimer]);

  const showToast = useCallback(
    (message: string, options?: ShowToastOptions) => {
      const type = options?.type ?? "info";
      const duration = options?.duration ?? 2600;
      const position = options?.position ?? "bottom";
      clearTimer();
      setToast({ visible: true, message, type, duration, position });
    },
    [clearTimer]
  );

  useEffect(() => {
    if (!toast.visible) return;
    timeoutRef.current = setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
      timeoutRef.current = null;
    }, toast.duration);
    return clearTimer;
  }, [toast.visible, toast.duration, clearTimer]);

  const value = useMemo(
    () => ({
      showToast,
      hideToast,
    }),
    [showToast, hideToast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <AppToast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        position={toast.position}
        onClose={hideToast}
      />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
