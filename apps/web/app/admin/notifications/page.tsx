"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getNotificationsOverview, type AdminNotificationsOverview } from "@/lib/adminApi";
import Compose from "./Compose";
import Campaigns from "./Campaigns";
import Rules from "./Rules";
import Templates from "./Templates";

type Tab = "compose" | "templates" | "campaigns" | "rules";
const TABS: { key: Tab; label: string }[] = [
  { key: "compose", label: "Compose" },
  { key: "templates", label: "Templates" },
  { key: "campaigns", label: "Campaigns" },
  { key: "rules", label: "Rules" },
];

export default function AdminNotificationsPage() {
  return (
    <Suspense fallback={null}>
      <NotificationCenter />
    </Suspense>
  );
}

/** Admin › Notifications: send to anyone (or one person), see how sends did, set the rules. */
function NotificationCenter() {
  const router = useRouter();
  const params = useSearchParams();
  const tab = (TABS.find((t) => t.key === params.get("tab"))?.key ?? (params.get("campaign") ? "campaigns" : "compose")) as Tab;
  const [data, setData] = useState<AdminNotificationsOverview | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setData(await getNotificationsOverview());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const go = (t: Tab, extra = "") => router.replace(`/admin/notifications?tab=${t}${extra}`, { scroll: false });

  return (
    <div className="pb-24">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Notifications</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            {data
              ? `${data.devices.total} phone${data.devices.total === 1 ? "" : "s"} · ${data.devices.signedIn} signed in · ${data.devices.browsers} browser${data.devices.browsers === 1 ? "" : "s"}${data.webPush ? "" : " (website push not set up)"}`
              : "Loading…"}
          </p>
        </div>
        <div role="tablist" aria-label="Notifications sections" className="inline-flex p-1 rounded-xl" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => go(t.key)}
              className="text-sm font-semibold px-4 py-1.5 rounded-lg"
              style={tab === t.key ? { background: "var(--accent)", color: "var(--bg-primary)" } : { color: "var(--text-secondary)" }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="mt-6 text-sm px-4 py-3 rounded-lg" style={{ color: "#ef4444", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>{error}</p>}

      <div className="mt-6">
        {tab === "compose" && data && (
          <Compose
            key={params.get("template") ?? "blank"}
            overview={data}
            initialUserId={params.get("user")}
            templateId={params.get("template")}
            onClearTemplate={() => go("compose")}
            onSent={(id) => go("campaigns", `&campaign=${id}`)}
          />
        )}
        {tab === "templates" && <Templates onUse={(id) => go("compose", `&template=${id}`)} />}
        {tab === "campaigns" && <Campaigns selectedId={params.get("campaign")} onSelect={(id) => go("campaigns", id ? `&campaign=${id}` : "")} />}
        {tab === "rules" && data && <Rules overview={data} onSaved={load} />}
      </div>
    </div>
  );
}
