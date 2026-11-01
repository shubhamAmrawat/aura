"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  getUserNotifications,
  listAdminWallpapers,
  listDrops,
  previewAudience,
  searchNotifyUsers,
  sendNotification,
  sendTestNotification,
  type AdminDropSummary,
  type AdminNotificationsOverview,
  type AdminWallpaper,
  type NotifyAction,
  type NotifyAudience,
  type NotifyMessage,
  type NotifyUser,
  type UserNotifications,
} from "@/lib/adminApi";
import { useToast } from "@/lib/toast";
import { ConfirmDialog, Modal, inputStyle } from "../_components/ui";

const PLAY_URL = "https://play.google.com/store/apps/details?id=com.shubhzx09.aurorawalls";

type Segment = "everyone" | "signedIn" | "signedOut" | "creators" | "person";
const SEGMENTS: { key: Segment; label: string }[] = [
  { key: "everyone", label: "Everyone" },
  { key: "signedIn", label: "Signed in" },
  { key: "signedOut", label: "Signed out" },
  { key: "creators", label: "Creators" },
  { key: "person", label: "One person" },
];

type Opens = { kind: "inbox" } | { kind: "drop"; id: string; title: string } | { kind: "wallpaper"; id: string; title: string } | { kind: "link"; url: string };
type Picked = { user: NotifyUser; devices: UserNotifications | null; selected: Set<string> };

const card = { background: "var(--bg-secondary)", border: "1px solid var(--border)" };
const label = "flex flex-col gap-1.5 text-xs font-semibold";

function Step({ n, title, children, right }: { n: number; title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="rounded-2xl p-5 flex flex-col gap-4" style={card}>
      <div className="flex items-center gap-2.5">
        <span className="w-6 h-6 rounded-full text-xs font-extrabold flex items-center justify-center" style={{ background: "var(--bg-elevated)", color: "var(--text-primary)" }}>{n}</span>
        <h2 className="text-[15px] font-bold" style={{ color: "var(--text-primary)" }}>{title}</h2>
        <span className="ml-auto">{right}</span>
      </div>
      {children}
    </section>
  );
}

function Pill({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className="h-9 px-3.5 rounded-full text-[13px] font-bold"
      style={{ border: `1px solid ${on ? "var(--accent)" : "var(--border-hover)"}`, background: on ? "rgba(129,238,78,0.12)" : "var(--bg-primary)", color: on ? "var(--accent)" : "var(--text-secondary)" }}
    >
      {children}
    </button>
  );
}

/** "now" as a value for <input type="datetime-local">, 30 minutes ahead. */
function soonLocal() {
  const d = new Date(Date.now() + 30 * 60_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function Compose({ overview, initialUserId, onSent }: { overview: AdminNotificationsOverview; initialUserId: string | null; onSent: (campaignId: string) => void }) {
  const { toast } = useToast();
  // audience
  const [segment, setSegment] = useState<Segment>(initialUserId ? "person" : "everyone");
  const [screen, setScreen] = useState<"" | "mobile" | "tablet">("");
  const [versionBelow, setVersionBelow] = useState("");
  const [active, setActive] = useState<"" | "7" | "-30">("");
  const [includeWeb, setIncludeWeb] = useState(overview.webPush);
  const [people, setPeople] = useState<Picked[]>([]);
  const [count, setCount] = useState<{ phones: number; browsers: number; people: number } | null>(null);
  // message
  const [type, setType] = useState<NotifyMessage["type"]>("announcement");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [opens, setOpens] = useState<Opens>({ kind: "inbox" });
  const [buttons, setButtons] = useState<NotifyAction[]>([]);
  // when
  const [later, setLater] = useState(false);
  const [at, setAt] = useState(soonLocal());
  const [respectQuiet, setRespectQuiet] = useState(true);
  // ui
  const [drops, setDrops] = useState<AdminDropSummary[]>([]);
  const [picker, setPicker] = useState<"image" | "opens" | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState<"send" | "test" | null>(null);

  useEffect(() => {
    listDrops().then((d) => setDrops(d.filter((x) => x.status !== "draft"))).catch(() => undefined);
  }, []);

  // Coming from a user's page (?user=): pick them.
  useEffect(() => {
    if (!initialUserId) return;
    getUserNotifications(initialUserId)
      .then((devices) => {
        const user: NotifyUser = { ...devices.user, phones: devices.phones.length, browsers: devices.browsers.length };
        setPeople([{ user, devices, selected: allTargets(devices) }]);
      })
      .catch(() => undefined);
  }, [initialUserId]);

  // Type presets: an app update opens the Play Store and has an Update button.
  useEffect(() => {
    if (type === "update") {
      setOpens({ kind: "link", url: PLAY_URL });
      setButtons([{ id: "update", label: "Update", url: "aurora://update" }]);
      setSegment((s) => (s === "person" ? s : "everyone"));
    }
  }, [type]);

  const audience: NotifyAudience | null = useMemo(() => {
    if (segment === "person") {
      if (!people.length) return null;
      const everyDevice = people.every((p) => !p.devices || p.selected.size === allTargets(p.devices).size);
      if (everyDevice) return { kind: "users", userIds: people.map((p) => p.user.id) };
      const targets = people.flatMap((p) => [...p.selected]);
      return targets.length ? { kind: "devices", targets } : null;
    }
    return {
      kind: segment,
      screen: screen || null,
      versionBelow: versionBelow.trim() || null,
      activeDays: active ? Number(active) : null,
      includeWeb: includeWeb && overview.webPush,
    };
  }, [segment, people, screen, versionBelow, active, includeWeb, overview.webPush]);

  // Live reach count
  useEffect(() => {
    if (!audience) {
      setCount(null);
      return;
    }
    let alive = true;
    const t = setTimeout(() => {
      previewAudience(audience, type)
        .then((c) => alive && setCount(c))
        .catch(() => alive && setCount(null));
    }, 350);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [audience, type]);

  const url = opens.kind === "inbox" ? null : opens.kind === "link" ? opens.url.trim() || null : opens.kind === "drop" ? `/collection/${opens.id}` : `/wallpaper/${opens.id}`;
  const message: NotifyMessage = { type, title: title.trim(), body: body.trim() || null, imageUrl: imageUrl.trim() || null, url, actions: buttons.filter((b) => b.label.trim() && b.url.trim()) };
  const canSend = !!message.title && !!audience && (!later || !!at);

  const presets: NotifyAction[] = [
    ...(opens.kind === "drop"
      ? [
          { id: "explore", label: "Explore", url: `/collection/${opens.id}` },
          { id: "autochange", label: "Auto-change", url: `/settings/wallpaper-changer?dropId=${opens.id}&dropName=${encodeURIComponent(opens.title)}` },
        ]
      : []),
    ...(opens.kind === "wallpaper"
      ? [
          { id: "apply", label: "Set as wallpaper", url: `/wallpaper/${opens.id}?apply=1` },
          { id: "save", label: "Save", url: `/wallpaper/${opens.id}?save=1` },
        ]
      : []),
    { id: "update", label: "Update", url: "aurora://update" },
  ];

  const reach = count
    ? [count.phones && `${count.phones} phone${count.phones === 1 ? "" : "s"}`, count.browsers && `${count.browsers} browser${count.browsers === 1 ? "" : "s"}`].filter(Boolean).join(" · ") || "Nobody yet"
    : "…";

  const send = async () => {
    setBusy("send");
    try {
      const r = await sendNotification({ message, audience: audience!, scheduledFor: later ? new Date(at).toISOString() : null, respectQuiet });
      setConfirm(false);
      const c = r.campaign;
      toast(
        c.status === "scheduled" ? "Scheduled." : c.status === "held" ? "Held for quiet hours — it goes out when they end." : `Sent to ${c.sent} of ${c.targeted}.`,
        "success"
      );
      onSent(c.id);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to send", "error");
    } finally {
      setBusy(null);
    }
  };

  const test = async () => {
    setBusy("test");
    try {
      const r = await sendTestNotification(message);
      toast(`Test sent to ${r.campaign.sent} of your phone${r.campaign.targeted === 1 ? "" : "s"}/browsers.`, "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to send the test", "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-wrap gap-5 items-start">
      <div className="flex-[999_1_520px] min-w-0 flex flex-col gap-4">
        {/* 1. Who */}
        <Step n={1} title="Who gets it">
          <div role="radiogroup" aria-label="Audience" className="flex flex-wrap gap-2">
            {SEGMENTS.map((s) => (
              <Pill key={s.key} on={segment === s.key} onClick={() => setSegment(s.key)}>{s.label}</Pill>
            ))}
          </div>

          {segment === "person" ? (
            <PersonPicker people={people} setPeople={setPeople} />
          ) : (
            <div className="flex flex-wrap gap-3">
              <label className={label} style={{ color: "var(--text-secondary)" }}>
                Device
                <select value={screen} onChange={(e) => setScreen(e.target.value as typeof screen)} className="h-9 rounded-lg px-2 text-sm font-normal [color-scheme:dark]" style={inputStyle}>
                  <option value="">Phones and tablets</option>
                  <option value="mobile">Phones</option>
                  <option value="tablet">Tablets</option>
                </select>
              </label>
              <label className={label} style={{ color: "var(--text-secondary)" }}>
                App older than
                <input value={versionBelow} onChange={(e) => setVersionBelow(e.target.value)} placeholder="any version" className="h-9 w-32 rounded-lg px-3 text-sm font-normal" style={inputStyle} />
              </label>
              <label className={label} style={{ color: "var(--text-secondary)" }}>
                Last active
                <select value={active} onChange={(e) => setActive(e.target.value as typeof active)} className="h-9 rounded-lg px-2 text-sm font-normal [color-scheme:dark]" style={inputStyle}>
                  <option value="">Anytime</option>
                  <option value="7">In the last 7 days</option>
                  <option value="-30">Not in 30 days</option>
                </select>
              </label>
              <label className="flex items-end gap-2 pb-2 text-sm" style={{ color: overview.webPush ? "var(--text-secondary)" : "var(--text-muted)" }} title={overview.webPush ? undefined : "Website push isn't set up yet (VAPID keys)"}>
                <input type="checkbox" checked={includeWeb && overview.webPush} disabled={!overview.webPush || !!screen || !!versionBelow.trim()} onChange={(e) => setIncludeWeb(e.target.checked)} className="w-4 h-4 accent-[var(--accent)]" />
                Also website (browser push)
              </label>
            </div>
          )}

          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm" style={{ background: "var(--bg-primary)" }}>
            <span className="font-bold" style={{ color: "var(--text-primary)" }}>{audience ? reach : "Pick who gets it"}</span>
            {count && segment !== "person" ? (
              <span style={{ color: "var(--text-muted)" }}>· only those with “{type === "drop" ? "New drops" : "App updates and news"}” on</span>
            ) : count && segment === "person" ? (
              <span style={{ color: "var(--text-muted)" }}>· a direct message: skips their switches</span>
            ) : null}
          </div>
        </Step>

        {/* 2. Message */}
        <Step
          n={2}
          title="Message"
          right={
            <label className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
              Type
              <select value={type} onChange={(e) => setType(e.target.value as NotifyMessage["type"])} className="h-8 rounded-lg px-2 text-xs [color-scheme:dark]" style={inputStyle}>
                <option value="announcement">Announcement</option>
                <option value="update">App update</option>
                <option value="drop">Drop</option>
              </select>
            </label>
          }
        >
          <label className={label} style={{ color: "var(--text-secondary)" }}>
            <span className="flex justify-between">Title <span className="font-normal" style={{ color: title.length > 65 ? "#ef4444" : "var(--text-muted)" }}>{title.length} / 65</span></span>
            <input value={title} maxLength={65} onChange={(e) => setTitle(e.target.value)} placeholder={type === "update" ? "Aurora 1.0.3 is ready" : "Diwali Drops ends tonight"} className="rounded-lg px-3 py-2 text-sm font-normal" style={inputStyle} />
          </label>
          <label className={label} style={{ color: "var(--text-secondary)" }}>
            <span className="flex justify-between">Message <span className="font-normal" style={{ color: "var(--text-muted)" }}>{body.length} / 240</span></span>
            <textarea value={body} maxLength={240} rows={2} onChange={(e) => setBody(e.target.value)} className="rounded-lg px-3 py-2 text-sm font-normal resize-none" style={inputStyle} />
          </label>
          <div className="flex flex-wrap gap-3">
            <div className={`${label} flex-1 min-w-[220px]`} style={{ color: "var(--text-secondary)" }}>
              Image
              <div className="flex items-center gap-2 p-2 rounded-lg" style={inputStyle}>
                {imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imageUrl} alt="" className="w-8 h-11 rounded object-cover" />
                ) : (
                  <span className="w-8 h-11 rounded" style={{ background: "var(--bg-elevated)" }} />
                )}
                <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://… or pick a wallpaper" className="flex-1 min-w-0 bg-transparent outline-none text-sm font-normal" style={{ color: "var(--text-primary)" }} />
                <button type="button" onClick={() => setPicker("image")} className="text-xs px-2.5 py-1.5 rounded-md hover:bg-white/5" style={{ border: "1px solid var(--border-hover)", color: "var(--text-secondary)" }}>Pick</button>
              </div>
            </div>
            <div className={`${label} flex-1 min-w-[220px]`} style={{ color: "var(--text-secondary)" }}>
              Tap opens
              <div className="flex items-center gap-2 p-2 rounded-lg" style={inputStyle}>
                <select
                  value={opens.kind}
                  onChange={(e) => {
                    const k = e.target.value as Opens["kind"];
                    if (k === "inbox") setOpens({ kind: "inbox" });
                    else if (k === "link") setOpens({ kind: "link", url: "" });
                    else if (k === "drop" && drops[0]) setOpens({ kind: "drop", id: drops[0].id, title: drops[0].title });
                    else if (k === "wallpaper") setPicker("opens");
                  }}
                  className="h-8 rounded-md px-2 text-sm font-normal outline-none [color-scheme:dark]"
                  style={{ color: "var(--text-primary)", background: "var(--bg-elevated)" }}
                  aria-label="Tap opens"
                >
                  <option value="inbox">Notifications inbox</option>
                  <option value="drop" disabled={!drops.length}>A drop</option>
                  <option value="wallpaper">A wallpaper</option>
                  <option value="link">A link</option>
                </select>
                {opens.kind === "drop" && (
                  <select
                    value={opens.id}
                    onChange={(e) => {
                      const d = drops.find((x) => x.id === e.target.value);
                      if (d) setOpens({ kind: "drop", id: d.id, title: d.title });
                    }}
                    className="h-8 flex-1 min-w-0 rounded-md px-2 text-sm font-normal outline-none [color-scheme:dark]"
                    style={{ color: "var(--text-primary)", background: "var(--bg-elevated)" }}
                    aria-label="Drop"
                  >
                    {drops.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
                  </select>
                )}
                {opens.kind === "wallpaper" && (
                  <button type="button" onClick={() => setPicker("opens")} className="flex-1 min-w-0 truncate text-left text-sm font-normal" style={{ color: "var(--text-primary)" }}>{opens.title}</button>
                )}
                {opens.kind === "link" && (
                  <input value={opens.url} onChange={(e) => setOpens({ kind: "link", url: e.target.value })} placeholder="/category/… or https://…" className="flex-1 min-w-0 bg-transparent outline-none text-sm font-normal" style={{ color: "var(--text-primary)" }} />
                )}
              </div>
            </div>
          </div>

          <div className={label} style={{ color: "var(--text-secondary)" }}>
            Buttons (up to 2)
            <div className="flex flex-col gap-2">
              {buttons.map((b, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <input value={b.label} maxLength={24} onChange={(e) => setButtons(buttons.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} placeholder="Label" className="w-40 rounded-lg px-3 py-2 text-sm font-normal" style={inputStyle} aria-label="Button label" />
                  <input value={b.url} onChange={(e) => setButtons(buttons.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} placeholder="/wallpaper/… or https://…" className="flex-1 min-w-[180px] rounded-lg px-3 py-2 text-sm font-normal" style={inputStyle} aria-label="Button opens" />
                  <button type="button" onClick={() => setButtons(buttons.filter((_, j) => j !== i))} aria-label="Remove button" className="w-8 h-8 rounded-full hover:bg-white/5" style={{ color: "var(--text-secondary)" }}>×</button>
                </div>
              ))}
              {buttons.length < 2 && (
                <div className="flex flex-wrap gap-2">
                  {presets.filter((p) => !buttons.some((b) => b.id === p.id)).map((p) => (
                    <button key={p.id} type="button" onClick={() => setButtons([...buttons, p])} className="h-8 px-3 rounded-full text-xs font-semibold hover:bg-white/5" style={{ border: "1px dashed var(--border-hover)", color: "var(--text-secondary)" }}>+ {p.label}</button>
                  ))}
                  <button type="button" onClick={() => setButtons([...buttons, { id: `b${Date.now() % 100000}`, label: "", url: "" }])} className="h-8 px-3 rounded-full text-xs font-semibold hover:bg-white/5" style={{ border: "1px dashed var(--border-hover)", color: "var(--text-secondary)" }}>+ Custom</button>
                </div>
              )}
            </div>
          </div>
        </Step>

        {/* 3. When */}
        <Step n={3} title="When">
          <div role="radiogroup" aria-label="When" className="flex flex-wrap gap-2">
            <Pill on={!later} onClick={() => setLater(false)}>Send now</Pill>
            <Pill on={later} onClick={() => setLater(true)}>Schedule</Pill>
          </div>
          {later && <input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} className="w-64 rounded-lg px-3 py-2 text-sm [color-scheme:dark]" style={inputStyle} aria-label="Send at" />}
          <label className="flex items-center gap-2.5 text-sm" style={{ color: "var(--text-secondary)" }}>
            <input type="checkbox" checked={respectQuiet} onChange={(e) => setRespectQuiet(e.target.checked)} className="w-4 h-4 accent-[var(--accent)]" />
            Respect quiet hours ({overview.rules.quietStart}–{overview.rules.quietEnd} IST) and the daily cap ({overview.rules.dailyCap})
          </label>
        </Step>
      </div>

      {/* Preview + send */}
      <aside className="flex-[1_1_320px] max-w-[380px] flex flex-col gap-3 lg:sticky lg:top-6">
        <div className="rounded-3xl p-4 flex flex-col gap-2.5" style={{ background: "linear-gradient(160deg, #1b1712, #0d0d10)", border: "1px solid var(--border)" }}>
          <span className="text-[11px] font-bold tracking-wider px-1" style={{ color: "var(--text-muted)" }}>PREVIEW · ANDROID</span>
          <div className="rounded-3xl p-3 flex flex-col gap-2" style={{ background: "rgba(36,34,34,.96)" }}>
            <div className="flex items-center gap-2 text-[11.5px]" style={{ color: "#A8A49E" }}>
              <span className="w-[18px] h-[18px] rounded-full text-[10px] font-extrabold flex items-center justify-center" style={{ background: "var(--accent)", color: "#0A0A0A" }}>A</span>
              <span className="font-semibold" style={{ color: "#EDEAE6" }}>Aurora</span> · now
            </div>
            <span className="text-sm font-bold" style={{ color: "#F5F0EB" }}>{message.title || "Title"}</span>
            {message.body && <span className="text-[12.5px] -mt-1" style={{ color: "#C9C5BF" }}>{message.body}</span>}
            {message.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={message.imageUrl} alt="" className="w-full h-36 object-cover rounded-2xl" />
            )}
            {message.actions.length > 0 && (
              <div className="flex gap-1.5">
                {message.actions.map((a) => (
                  <span key={a.id} className="flex-1 h-8 rounded-full text-[12.5px] font-bold flex items-center justify-center" style={{ background: "rgba(255,255,255,.1)", color: "#F5F0EB" }}>{a.label}</span>
                ))}
              </div>
            )}
          </div>
        </div>
        <button type="button" disabled={!message.title || busy !== null} onClick={() => void test()} className="h-11 rounded-xl text-sm font-bold disabled:opacity-40 hover:bg-white/5" style={{ border: "1px solid var(--border-hover)", color: "var(--text-primary)" }}>
          {busy === "test" ? "Sending test…" : "Send test to my phone"}
        </button>
        <div className="rounded-2xl p-4 flex flex-col gap-3" style={card}>
          <span className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
            {later ? `Scheduled for ${at ? new Date(at).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "…"}` : "Goes out now"} · {audience ? reach : "nobody picked"}. Also lands in their inbox.
          </span>
          <button type="button" disabled={!canSend || busy !== null} onClick={() => setConfirm(true)} className="h-12 rounded-xl text-[14.5px] font-extrabold disabled:opacity-40" style={{ background: "var(--accent)", color: "var(--bg-primary)" }}>
            {later ? "Schedule…" : "Send…"}
          </button>
        </div>
      </aside>

      {confirm && (
        <ConfirmDialog
          title={later ? "Schedule this notification?" : "Send this notification?"}
          body={<>“{message.title}” {later ? "will go" : "goes"} to {reach}{segment !== "person" ? " and into their inbox" : ""}. {later ? "You can cancel it under Campaigns until it goes out." : "It can't be unsent."}</>}
          confirmLabel={later ? "Schedule" : "Send"}
          busy={busy === "send"}
          onCancel={() => setConfirm(false)}
          onConfirm={send}
        />
      )}

      {picker && (
        <WallpaperPicker
          onClose={() => setPicker(null)}
          onPick={(w) => {
            if (picker === "image") setImageUrl(w.thumbUrl ?? w.fileUrl);
            else {
              setOpens({ kind: "wallpaper", id: w.id, title: w.title });
              if (!imageUrl) setImageUrl(w.thumbUrl ?? w.fileUrl);
            }
            setPicker(null);
          }}
        />
      )}
    </div>
  );
}

function allTargets(d: UserNotifications) {
  return new Set([...d.phones.filter((p) => !p.disabledAt).map((p) => p.token), ...d.browsers.filter((b) => !b.disabledAt).map((b) => b.endpoint)]);
}

const ago = (iso: string) => {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 60) return `${Math.max(m, 1)} min ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h} h ago` : `${Math.floor(h / 24)} days ago`;
};

function browserName(ua: string | null) {
  if (!ua) return "Browser";
  const b = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /Mac OS/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${b} on ${os}` : b;
}

/** Search people; each picked person shows their phones and browsers (all ticked = every device they have). */
function PersonPicker({ people, setPeople }: { people: Picked[]; setPeople: (p: Picked[]) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<NotifyUser[]>([]);
  const peopleRef = useRef(people);
  peopleRef.current = people;

  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setResults([]);
      return;
    }
    let alive = true;
    const t = setTimeout(() => {
      searchNotifyUsers(term).then((r) => alive && setResults(r)).catch(() => alive && setResults([]));
    }, 300);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q]);

  const add = async (u: NotifyUser) => {
    setQ("");
    setResults([]);
    if (peopleRef.current.some((p) => p.user.id === u.id)) return;
    const devices = await getUserNotifications(u.id).catch(() => null);
    setPeople([...peopleRef.current, { user: u, devices, selected: devices ? allTargets(devices) : new Set() }]);
  };

  const toggle = (userId: string, target: string) =>
    setPeople(
      people.map((p) => {
        if (p.user.id !== userId) return p;
        const s = new Set(p.selected);
        if (s.has(target)) s.delete(target);
        else s.add(target);
        return { ...p, selected: s };
      })
    );

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find by @username, name or email" className="w-full rounded-lg px-3 py-2 text-sm" style={inputStyle} aria-label="Find a person" />
        {results.length > 0 && (
          <ul className="absolute z-20 left-0 right-0 top-11 rounded-xl overflow-hidden" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-hover)", boxShadow: "0 16px 40px rgba(0,0,0,.5)" }}>
            {results.map((u) => (
              <li key={u.id}>
                <button type="button" onClick={() => void add(u)} className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-white/5">
                  <span className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: "var(--bg-secondary)", color: "var(--text-primary)" }}>{u.displayName[0]?.toUpperCase()}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>@{u.username} · {u.displayName}</span>
                    <span className="block text-xs truncate" style={{ color: "var(--text-muted)" }}>{u.email} · {u.phones} phone{u.phones === 1 ? "" : "s"}, {u.browsers} browser{u.browsers === 1 ? "" : "s"}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {people.map((p) => (
        <div key={p.user.id} className="rounded-xl p-3 flex flex-col gap-2" style={{ background: "var(--bg-primary)", border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold flex-1" style={{ color: "var(--text-primary)" }}>@{p.user.username}</span>
            <button type="button" onClick={() => setPeople(people.filter((x) => x.user.id !== p.user.id))} className="text-xs px-2 py-1 rounded hover:bg-white/5" style={{ color: "var(--text-secondary)" }}>Remove</button>
          </div>
          {!p.devices || (p.devices.phones.length === 0 && p.devices.browsers.length === 0) ? (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>No phone or browser with notifications. It still lands in their inbox.</span>
          ) : (
            <>
              {p.devices.phones.map((d) => (
                <label key={d.token} className="flex items-center gap-3 text-sm" style={{ color: d.disabledAt ? "var(--text-muted)" : "var(--text-primary)" }}>
                  <input type="checkbox" disabled={!!d.disabledAt} checked={p.selected.has(d.token)} onChange={() => toggle(p.user.id, d.token)} className="w-4 h-4 accent-[var(--accent)]" />
                  <span className="flex-1">{d.deviceName || "Android phone"} <span className="text-xs" style={{ color: "var(--text-muted)" }}>· app {d.appVersion ?? "?"} · seen {ago(d.lastSeenAt)}{d.disabledAt ? " · notifications off" : ""}</span></span>
                </label>
              ))}
              {p.devices.browsers.map((b) => (
                <label key={b.endpoint} className="flex items-center gap-3 text-sm" style={{ color: b.disabledAt ? "var(--text-muted)" : "var(--text-primary)" }}>
                  <input type="checkbox" disabled={!!b.disabledAt} checked={p.selected.has(b.endpoint)} onChange={() => toggle(p.user.id, b.endpoint)} className="w-4 h-4 accent-[var(--accent)]" />
                  <span className="flex-1">{browserName(b.userAgent)} <span className="text-xs" style={{ color: "var(--text-muted)" }}>· website · seen {ago(b.lastSeenAt)}{b.disabledAt ? " · off" : ""}</span></span>
                </label>
              ))}
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function WallpaperPicker({ onClose, onPick }: { onClose: () => void; onPick: (w: AdminWallpaper) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<AdminWallpaper[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const page = await listAdminWallpapers({ q: q.trim() || undefined, status: "approved", sort: q.trim() ? "trending" : "newest", limit: 36 });
        if (alive) setResults(page.data);
      } catch {
        if (alive) setResults([]);
      } finally {
        if (alive) setLoading(false);
      }
    }, 300);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q]);
  return (
    <Modal onClose={onClose} width={820} labelledBy="wp-picker">
      <div className="flex items-center justify-between">
        <p id="wp-picker" className="font-semibold" style={{ color: "var(--text-primary)" }}>Pick a wallpaper</p>
        <button onClick={onClose} className="text-sm px-2 py-1 rounded hover:bg-white/5" style={{ color: "var(--text-secondary)" }}>Close</button>
      </div>
      <input value={q} onChange={(e) => setQ(e.target.value)} autoFocus placeholder="Search live wallpapers" className="rounded-lg px-3 py-2 text-sm" style={inputStyle} />
      <div className="grid gap-3 grid-cols-3 sm:grid-cols-4 md:grid-cols-6 max-h-[60vh] overflow-y-auto pr-1" style={{ opacity: loading ? 0.6 : 1 }}>
        {results.map((w) => (
          <button key={w.id} onClick={() => onPick(w)} title={w.title} className="relative rounded-lg overflow-hidden aspect-[9/16]" style={{ background: w.dominantColor, border: "1px solid var(--border)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={w.thumbUrl ?? w.fileUrl} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
            <span className="absolute inset-x-0 bottom-0 p-1.5 text-[11px] text-left truncate" style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.85))", color: "#fff" }}>{w.title}</span>
          </button>
        ))}
        {!loading && results.length === 0 && <p className="col-span-full text-sm text-center py-10" style={{ color: "var(--text-muted)" }}>Nothing matches.</p>}
      </div>
    </Modal>
  );
}
