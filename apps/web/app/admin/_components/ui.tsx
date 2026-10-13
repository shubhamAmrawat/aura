"use client";

import { useEffect } from "react";

/** Centered dialog with backdrop; Esc / backdrop click closes (unless busy). */
export function Modal({ onClose, busy, children, width = 420, labelledBy }: {
  onClose: () => void;
  busy?: boolean;
  children: React.ReactNode;
  width?: number;
  labelledBy?: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, busy]);
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={() => !busy && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="rounded-xl p-5 flex flex-col gap-4 max-h-[90vh] overflow-auto"
        style={{ width: `min(${width}px, 92vw)`, background: "var(--bg-elevated)", border: "1px solid var(--border-hover)", boxShadow: "0 16px 48px rgba(0,0,0,0.5)" }}
      >
        {children}
      </div>
    </div>
  );
}

export function ConfirmDialog({ title, body, confirmLabel, danger, busy, onCancel, onConfirm }: {
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal onClose={onCancel} busy={busy} width={400} labelledBy="confirm-title">
      <div>
        <p id="confirm-title" className="font-semibold" style={{ color: "var(--text-primary)" }}>{title}</p>
        <div className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>{body}</div>
      </div>
      <div className="flex justify-end gap-2">
        <button autoFocus disabled={busy} onClick={onCancel} className="text-sm px-3 py-2 rounded-lg hover:bg-white/5 disabled:opacity-40" style={{ color: "var(--text-secondary)" }}>
          Cancel
        </button>
        <button
          disabled={busy}
          onClick={onConfirm}
          className="text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60"
          style={danger ? { background: "#ef4444", color: "#fff" } : { background: "var(--accent)", color: "var(--bg-primary)" }}
        >
          {busy ? "Working…" : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

const STATUS_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  approved: { bg: "rgba(87,168,58,0.15)", fg: "#7bc95a", label: "Live" },
  pending: { bg: "rgba(234,179,8,0.12)", fg: "#eab308", label: "Pending" },
  rejected: { bg: "rgba(239,68,68,0.12)", fg: "#ef4444", label: "Rejected" },
  hidden: { bg: "rgba(148,163,184,0.14)", fg: "#94a3b8", label: "Hidden" },
};

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? { bg: "rgba(255,255,255,0.06)", fg: "var(--text-secondary)", label: status };
  return <span className="text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: s.bg, color: s.fg }}>{s.label}</span>;
}

export const inputStyle: React.CSSProperties = {
  background: "var(--bg-primary)",
  color: "var(--text-primary)",
  border: "1px solid var(--border-hover)",
  outline: "none",
};

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <label className="flex items-center justify-between gap-3 py-1.5 cursor-pointer select-none">
      <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className="relative w-9 h-5 rounded-full transition-colors disabled:opacity-40"
        style={{ background: checked ? "var(--accent)" : "rgba(255,255,255,0.15)" }}
      >
        <span className="absolute top-0.5 w-4 h-4 rounded-full transition-all" style={{ left: checked ? 18 : 2, background: checked ? "var(--bg-primary)" : "#ddd" }} />
      </button>
    </label>
  );
}
