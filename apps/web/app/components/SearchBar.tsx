"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useImperativeHandle, useMemo, useRef, useState, type Ref } from "react";
import { DEVICE_LABEL, type Device } from "@/lib/device";
import { useDevice } from "@/lib/useDevice";
import { getAutocomplete, getSearchSuggestions, type Category } from "@/lib/api";
import { HistoryIcon, LayoutGridIcon, MonitorIcon, SearchIcon, SmartphoneIcon, TrendingUpIcon, XIcon } from "lucide-react";

const svg = {
  width: 13,
  height: 13,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

const DEVICE_ICON: Record<Device, React.ReactNode> = {
  all: (
    <LayoutGridIcon {...svg} aria-hidden="true" />
  ),
  phone: (
    <SmartphoneIcon {...svg} aria-hidden="true" />
  ),
  desktop: (
    <MonitorIcon {...svg} aria-hidden="true" />
  ),
};

const ORDER: Device[] = ["phone", "all", "desktop"];
const TRACK_W = 80;
const KNOB = 26;
const KNOB_X: Record<Device, number> = { phone: 2, all: (TRACK_W - 2 - KNOB) / 2 - 1, desktop: TRACK_W - 4 - KNOB };

/**
 * Three-position slider: phone on the left, everything in the middle, desktop on the right.
 * Click a side to pick it (click it again to go back to the middle); arrow keys move the knob.
 * Filters every wallpaper list on the site.
 */
export function DeviceSwitch({ showLabel = false }: { showLabel?: boolean }) {
  const { device, setDevice, pending } = useDevice();
  const refs = useRef<Record<Device, HTMLButtonElement | null>>({ phone: null, all: null, desktop: null });

  const pick = (d: Device) => setDevice(d === device && d !== "all" ? "all" : d);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const i = ORDER.indexOf(device);
    let next: Device | null = null;
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = ORDER[Math.max(0, i - 1)]!;
    else if (e.key === "ArrowRight" || e.key === "ArrowDown") next = ORDER[Math.min(ORDER.length - 1, i + 1)]!;
    else if (e.key === "Home") next = "phone";
    else if (e.key === "End") next = "desktop";
    if (!next) return;
    e.preventDefault();
    setDevice(next);
    refs.current[next]?.focus();
  };

  const tip = (d: Device) => (d === "all" ? "Show all wallpapers" : `Show ${DEVICE_LABEL[d].toLowerCase()} wallpapers${device === d ? " (click again for all)" : ""}`);

  return (
    <div className="flex shrink-0 items-center gap-2">
      <div
        role="radiogroup"
        aria-label="Show wallpapers for"
        aria-busy={pending}
        onKeyDown={onKeyDown}
        className="relative flex shrink-0 items-center rounded-full"
        style={{ width: TRACK_W, height: KNOB + 6, background: "var(--bg-primary)", border: "1px solid var(--border-hover)" }}
      >
        {/* knob */}
        <span
          aria-hidden
          className="pointer-events-none absolute top-[2px] flex items-center justify-center rounded-full"
          style={{
            width: KNOB,
            height: KNOB,
            transform: `translateX(${KNOB_X[device]}px)`,
            transition: "transform 0.32s cubic-bezier(0.34, 1.4, 0.64, 1), background 0.2s",
            background: device === "all" ? "#2a2a2a" : "var(--accent)",
            color: device === "all" ? "#fff" : "var(--bg-primary)",
            boxShadow: device === "all" ? "none" : "0 0 14px rgba(129,238,78,0.45)",
            opacity: pending ? 0.75 : 1,
          }}
        >
          {DEVICE_ICON[device]}
        </span>
        {ORDER.map((d) => {
          const on = device === d;
          return (
            <button
              key={d}
              ref={(el) => {
                refs.current[d] = el;
              }}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on ? 0 : -1}
              aria-label={d === "all" ? "All wallpapers" : `${DEVICE_LABEL[d]} wallpapers`}
              title={tip(d)}
              onClick={() => pick(d)}
              className="relative z-[1] flex h-full flex-1 items-center justify-center rounded-full transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              style={{ color: "var(--text-muted)" }}
            >
              {/* the side icons sit under the knob; the middle shows a dot when the knob is away */}
              <span aria-hidden className="transition-opacity duration-200" style={{ opacity: on ? 0 : 1 }}>
                {d === "all" ? <span className="block h-1 w-1 rounded-full bg-current" /> : DEVICE_ICON[d]}
              </span>
            </button>
          );
        })}
      </div>
      {showLabel && (
        <span className="w-14 text-xs font-medium" style={{ color: device === "all" ? "var(--text-secondary)" : "var(--accent)" }} aria-hidden>
          {DEVICE_LABEL[device]}
        </span>
      )}
    </div>
  );
}

/* ---------------- suggestions ---------------- */

type Option =
  | { kind: "query" | "term" | "recent" | "popular"; label: string }
  | { kind: "category"; label: string; slug: string; thumb?: string | null; count?: number };

const RECENT_KEY = "aura_recent_searches";
const RECENT_MAX = 5;

function readRecent(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

function writeRecent(list: string[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    /* private mode / storage full: recent searches just aren't kept */
  }
}

/** Results are cached per device + query for the life of the page. */
const termCache = new Map<string, string[]>();
const popularCache = new Map<Device, Promise<string[]>>();

/** True if the text, or any word in it, starts with q. */
function matchesWordStart(text: string, q: string) {
  const t = text.toLowerCase();
  return t.startsWith(q) || t.includes(` ${q}`);
}

/** Typed part plain, the completion bold — like most search boxes. */
function Highlight({ text, q }: { text: string; q: string }) {
  const lower = text.toLowerCase();
  const i = lower.startsWith(q) ? 0 : lower.indexOf(` ${q}`) + 1;
  if (!q || i < 0 || (i === 0 && !lower.startsWith(q))) return <span className="font-semibold">{text}</span>;
  return (
    <span>
      <span className="font-semibold">{text.slice(0, i)}</span>
      <span style={{ color: "var(--text-secondary)" }}>{text.slice(i, i + q.length)}</span>
      <span className="font-semibold">{text.slice(i + q.length)}</span>
    </span>
  );
}

const ICON = {
  search: (
    <SearchIcon size={15} strokeWidth={2} aria-hidden />
  ),
  recent: (
    <HistoryIcon size={15} strokeWidth={2} aria-hidden />
  ),
  popular: (
    <TrendingUpIcon size={15} strokeWidth={2} aria-hidden />
  ),
};

interface SearchBarProps {
  defaultValue?: string;
  inputRef?: Ref<HTMLInputElement>;
  /** Show the "/" shortcut hint (desktop navbar). */
  showShortcut?: boolean;
  /** Called after a search is submitted (e.g. to close a menu). */
  onSearch?: () => void;
  /** Show the All / Phone / Desktop switch inside the field (default true). */
  showDevice?: boolean;
  /** Categories to suggest while typing. */
  categories?: Category[];
}

/** Search field with suggestions as you type and the device switch built in. */
const SearchBar = ({ defaultValue = "", inputRef, showShortcut = false, onSearch, showDevice = true, categories = [] }: SearchBarProps) => {
  const router = useRouter();
  const { device } = useDevice();
  const listId = useId();
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [terms, setTerms] = useState<string[]>([]);
  const [termsFor, setTermsFor] = useState("");
  const [popular, setPopular] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>(readRecent);
  const inputEl = useRef<HTMLInputElement | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      if (debounce.current) clearTimeout(debounce.current);
      abort.current?.abort();
    },
    []
  );

  // Hand the input to the parent (the navbar's "/" shortcut focuses it).
  useImperativeHandle(inputRef, () => inputEl.current as HTMLInputElement, []);

  const q = value.trim().toLowerCase();

  const fetchTerms = (query: string) => {
    if (debounce.current) clearTimeout(debounce.current);
    abort.current?.abort();
    if (query.length < 2) return;
    const key = `${device}|${query}`;
    const hit = termCache.get(key);
    if (hit) {
      setTerms(hit);
      setTermsFor(query);
      return;
    }
    debounce.current = setTimeout(() => {
      const ctrl = new AbortController();
      abort.current = ctrl;
      getAutocomplete(query, device, ctrl.signal)
        .then((data) => {
          termCache.set(key, data);
          setTerms(data);
          setTermsFor(query);
        })
        .catch(() => {});
    }, 150);
  };

  const loadPopular = () => {
    let p = popularCache.get(device);
    if (!p) {
      p = getSearchSuggestions(device).catch(() => []);
      popularCache.set(device, p);
    }
    p.then(setPopular);
  };

  const options = useMemo<Option[]>(() => {
    if (q.length < 2) {
      const r: Option[] = recent.map((label) => ({ kind: "recent", label }));
      const p: Option[] = popular.filter((t) => !recent.includes(t)).slice(0, 6).map((label) => ({ kind: "popular", label }));
      return [...r, ...p];
    }
    const out: Option[] = [{ kind: "query", label: value.trim() }];
    // Only show terms that belong to what is typed now (avoids flashing stale ones).
    const fresh = termsFor && q.startsWith(termsFor) ? terms.filter((t) => matchesWordStart(t, q) && t.length <= 40 && !t.includes(",")) : [];
    for (const t of fresh) if (t !== q && out.length < 7) out.push({ kind: "term", label: t });
    categories
      .filter((c) => matchesWordStart(c.name, q))
      .slice(0, 3)
      .forEach((c) => out.push({ kind: "category", label: c.name, slug: c.slug, thumb: c.coverThumbUrl, count: c.wallpaperCount }));
    return out;
  }, [q, value, recent, popular, terms, termsFor, categories]);

  const close = () => {
    setOpen(false);
    setActive(-1);
  };

  const go = (query: string) => {
    const term = query.trim();
    if (!term) return;
    const next = [term, ...recent.filter((r) => r.toLowerCase() !== term.toLowerCase())].slice(0, RECENT_MAX);
    setRecent(next);
    writeRecent(next);
    router.push(`/search?q=${encodeURIComponent(term)}`);
    setValue("");
    close();
    inputEl.current?.blur();
    onSearch?.();
  };

  const choose = (o: Option) => {
    if (o.kind === "category") {
      router.push(`/category/${o.slug}`);
      setValue("");
      close();
      inputEl.current?.blur();
      onSearch?.();
    } else {
      go(o.label);
    }
  };

  const removeRecent = (label: string) => {
    const next = recent.filter((r) => r !== label);
    setRecent(next);
    writeRecent(next);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) setOpen(true);
      const n = options.length;
      if (!n) return;
      setActive((i) => (e.key === "ArrowDown" ? (i + 1) % n : i <= 0 ? n - 1 : i - 1));
    } else if (e.key === "Enter" && open && active >= 0 && options[active]) {
      e.preventDefault();
      choose(options[active]);
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        close();
      } else {
        inputEl.current?.blur();
      }
    }
  };

  const showList = open && options.length > 0;
  const optionId = (i: number) => `${listId}-opt-${i}`;

  // Section headings, shown before the first option of each kind.
  const heading = (o: Option, i: number) => {
    const prev = options[i - 1];
    if (prev && (prev.kind === o.kind || (o.kind === "term" && prev.kind === "query"))) return null;
    const label = o.kind === "recent" ? "Recent" : o.kind === "popular" ? "Popular searches" : o.kind === "category" ? "Categories" : null;
    if (!label) return null;
    return (
      <li role="presentation" className="flex items-center justify-between px-4 pb-1 pt-2.5 text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--text-muted)" }}>
        {label}
        {o.kind === "recent" && (
          <button
            type="button"
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setRecent([]);
              writeRecent([]);
            }}
            className="normal-case tracking-normal hover:underline"
            style={{ color: "var(--text-secondary)" }}
          >
            Clear
          </button>
        )}
      </li>
    );
  };

  return (
    <div
      className="relative w-full"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) close();
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (open && active >= 0 && options[active]) choose(options[active]);
          else go(value);
        }}
        role="search"
        className={`group flex h-10 w-full items-center gap-2 rounded-full pl-3.5 ${showDevice ? "pr-1" : "pr-3.5"} transition-colors focus-within:border-[var(--accent)]`}
        style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-hover)" }}
      >
        <button type="submit" aria-label="Search" className="shrink-0 transition-opacity hover:opacity-70" style={{ color: "var(--text-secondary)" }}>
          <SearchIcon size={16} strokeWidth={2} aria-hidden />
        </button>
        <input
          ref={inputEl}
          type="search"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={listId}
          aria-activedescendant={showList && active >= 0 ? optionId(active) : undefined}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setActive(-1);
            setOpen(true);
            fetchTerms(e.target.value.trim().toLowerCase());
          }}
          onFocus={() => {
            setOpen(true);
            loadPopular();
          }}
          onKeyDown={onKeyDown}
          placeholder="Search wallpapers, colours, moods…"
          aria-label="Search wallpapers"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--text-muted)] [&::-webkit-search-cancel-button]:hidden"
          style={{ color: "var(--text-primary)" }}
        />
        {showShortcut && !value && (
          <kbd
            className="hidden shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[11px] lg:inline group-focus-within:hidden"
            style={{ color: "var(--text-muted)", border: "1px solid var(--border-hover)" }}
            aria-hidden
          >
            /
          </kbd>
        )}
        {showDevice && <DeviceSwitch />}
      </form>

      {showList && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Search suggestions"
          className="absolute inset-x-0 top-[calc(100%+6px)] z-[60] max-h-[70vh] overflow-y-auto rounded-2xl py-1.5"
          style={{ background: "#121212", border: "1px solid var(--border-hover)", boxShadow: "0 18px 48px rgba(0,0,0,0.55)" }}
        >
          {options.map((o, i) => (
            <SuggestionRow
              key={`${o.kind}-${o.label}`}
              id={optionId(i)}
              option={o}
              q={q}
              active={i === active}
              heading={heading(o, i)}
              onHover={() => setActive(i)}
              onChoose={() => choose(o)}
              onRemove={o.kind === "recent" ? () => removeRecent(o.label) : undefined}
            />
          ))}
        </ul>
      )}
    </div>
  );
};

function SuggestionRow({ id, option: o, q, active, heading, onHover, onChoose, onRemove }: {
  id: string;
  option: Option;
  q: string;
  active: boolean;
  heading: React.ReactNode;
  onHover: () => void;
  onChoose: () => void;
  onRemove?: () => void;
}) {
  return (
    <>
      {heading}
      <li
        id={id}
        role="option"
        aria-selected={active}
        onMouseDown={(e) => e.preventDefault()}
        onMouseMove={onHover}
        onClick={onChoose}
        className="mx-1.5 flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 text-sm"
        style={{ background: active ? "rgba(255,255,255,0.07)" : undefined, color: "var(--text-primary)" }}
      >
        {o.kind === "category" ? (
          o.thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={o.thumb} alt="" className="h-7 w-7 shrink-0 rounded-md object-cover" />
          ) : (
            <span className="h-7 w-7 shrink-0 rounded-md" style={{ background: "var(--bg-elevated)" }} />
          )
        ) : (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center" style={{ color: "var(--text-muted)" }}>
            {o.kind === "recent" ? ICON.recent : o.kind === "popular" ? ICON.popular : ICON.search}
          </span>
        )}
        <span className="min-w-0 flex-1 truncate">
          {o.kind === "query" ? (
            <>
              Search for <span className="font-semibold">&ldquo;{o.label}&rdquo;</span>
            </>
          ) : o.kind === "term" || o.kind === "category" ? (
            <Highlight text={o.label} q={q} />
          ) : (
            o.label
          )}
        </span>
        {o.kind === "category" && o.count !== undefined && (
          <span className="shrink-0 text-xs" style={{ color: "var(--text-muted)" }}>
            {o.count} wallpapers
          </span>
        )}
        {onRemove && (
          <button
            type="button"
            tabIndex={-1}
            aria-label={`Remove “${o.label}” from recent searches`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md hover:bg-white/10"
            style={{ color: "var(--text-muted)" }}
          >
            <XIcon size={12} strokeWidth={2.5} aria-hidden />
          </button>
        )}
      </li>
    </>
  );
}

export default SearchBar;
