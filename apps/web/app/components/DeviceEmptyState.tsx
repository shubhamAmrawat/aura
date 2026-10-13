"use client";

import { DEVICE_LABEL, type Device } from "@/lib/device";
import { useDevice } from "@/lib/useDevice";

/** Shown when a list is empty only because of the phone / desktop filter. */
export default function DeviceEmptyState({ device }: { device: Exclude<Device, "all"> }) {
  const { setDevice, pending } = useDevice();
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 py-24 rounded-2xl text-center"
      style={{ border: "1px dashed var(--border)" }}
    >
      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
        No {DEVICE_LABEL[device].toLowerCase()} wallpapers here yet.
      </p>
      <button
        type="button"
        onClick={() => setDevice("all")}
        disabled={pending}
        className="text-sm font-medium px-4 py-2 rounded-full transition-opacity hover:opacity-80 disabled:opacity-50"
        style={{ background: "var(--bg-elevated)", color: "var(--text-primary)", border: "1px solid var(--border-hover)" }}
      >
        {pending ? "Loading…" : "Show all wallpapers"}
      </button>
    </div>
  );
}
