import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  AppState,
  Easing,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import Constants from "expo-constants";
import * as IntentLauncher from "expo-intent-launcher";
import Header from "../../components/Header";
import SignInPrompt from "../../components/SignInPrompt";
import LockClockPreview from "../../components/LockClockPreview";
import ProgressRing from "../../components/ProgressRing";
import Sheet from "../../components/Sheet";
import { SettingsRow, SettingsSection } from "../../components/SettingsRow";
import { Colors } from "../../constants";
import { useInsets } from "../../hooks/useInsets";
import AuroraWallpaper from "../../modules/aurora-wallpaper";
import { Category } from "../../lib/api";
import { useAuth } from "../../lib/AuthContext";
import { useCollections } from "../../lib/CollectionsContext";
import { useScreenFilter } from "../../lib/ScreenFilterContext";
import { useToast } from "../../lib/ToastContext";
import { getCategories } from "../../lib/wallpaperApi";
import { fetchPool, runChange } from "../../lib/wallpaperChanger/engine";
import {
  ChangerSource,
  ChangerState,
  ChangerTarget,
  clampHours,
  intervalLabel,
  loadState,
  MAX_HOURS,
  MIN_HOURS,
  PoolItem,
  PRESET_HOURS,
  saveState,
  updateState,
} from "../../lib/wallpaperChanger/state";
import { scheduleChanger, scheduleTestRunInOneMinute, unscheduleChanger } from "../../lib/wallpaperChanger/task";

const PACKAGE = Constants.expoConfig?.android?.package ?? "com.shubhzx09.aurorawalls";
const AMBER = "#E8B04A";
const RED = "#E45A5A";
const CARD = Colors.bgSecondary;
const CARD_BORDER = "rgba(255,255,255,0.07)";

const TARGETS: { value: ChangerTarget; label: string; home: boolean; lock: boolean }[] = [
  { value: "home", label: "Home", home: true, lock: false },
  { value: "lock", label: "Lock", home: false, lock: true },
  { value: "both", label: "Both", home: true, lock: true },
];

const sameSource = (a: ChangerSource | null, b: ChangerSource | null) =>
  a === b ||
  (!!a &&
    !!b &&
    a.kind === b.kind &&
    (a.kind === "liked" ||
      (a.kind === "collection" && b.kind === "collection" && a.id === b.id) ||
      (a.kind === "category" && b.kind === "category" && a.slug === b.slug)));

const tick = () => void Haptics.selectionAsync().catch(() => undefined);
const thump = () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
const thumb = (p: PoolItem) => p.thumbUrl || p.fileUrl;
const shortLabel = (h: number) => (h < 1 ? `${Math.round(h * 60)} min` : h === 24 ? "Daily" : `${h} h`);
const clock = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

/** When the next scheduled change is due: the native side saves it each time it sets the alarm. */
function nextChangeAt(s: ChangerState): number | null {
  if (s.nextAt) return s.nextAt;
  return s.lastChangedAt ? s.lastChangedAt + s.intervalHours * 3600_000 : null;
}

function inAbout(ms: number) {
  const m = Math.round((ms - Date.now()) / 60000);
  if (m <= 1) return "in a moment";
  if (m < 60) return `in ${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `in ${h} h ${rest} min` : `in ${h} h`;
}

const isBatteryUnrestricted = () => {
  try {
    return AuroraWallpaper?.isIgnoringBatteryOptimizations() ?? true;
  } catch {
    return true;
  }
};

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/**
 * Make sure the next wallpaper is already decided, so the screen can show "Up next".
 * Fills an empty round the same way the background job would (current wallpaper last).
 */
async function withUpNext(s: ChangerState): Promise<ChangerState> {
  if (!s.source || s.pool.length < 2) return s;
  const ids = new Set(s.pool.map((p) => p.id));
  if (s.queue.some((id) => ids.has(id))) return s;
  const queue = shuffled([...ids]).filter((id) => id !== s.lastWallpaperId);
  if (s.lastWallpaperId && ids.has(s.lastWallpaperId)) queue.push(s.lastWallpaperId);
  const next = { ...s, queue };
  try {
    await saveState(next);
  } catch {
    return s;
  }
  return next;
}

/**
 * Settings › Wallpaper changer. Every setting applies the moment it's tapped (no save step);
 * the top card previews the wallpaper on screen now, the next one, and when it changes.
 */
const WallpaperChanger = () => {
  const { user, loaded } = useAuth();
  const { collections } = useCollections();
  const { screen } = useScreenFilter();
  const { showToast } = useToast();
  const { bottomPadding } = useInsets();

  const [state, setState] = useState<ChangerState | null>(null);
  const [busy, setBusy] = useState<"toggle" | "change" | "source" | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [permissionOpen, setPermissionOpen] = useState(false);
  const [batteryOk, setBatteryOk] = useState(true);
  const [customOpen, setCustomOpen] = useState(false);
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [now, setNow] = useState(() => Date.now());
  /** Bumped after each successful save, so that section flashes "Saved". */
  const [saved, setSaved] = useState({ interval: 0, target: 0 });
  /** Set when the user starts from "Choose wallpapers": picking a source then turns the changer on. */
  const pendingEnableRef = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  const reload = useCallback(async () => {
    const s = await withUpNext(await loadState());
    setState(s);
    return s;
  }, []);

  useEffect(() => {
    void reload().then((s) => setCustomOpen(!PRESET_HOURS.includes(s.intervalHours)));
    setBatteryOk(isBatteryUnrestricted());
    const sub = AppState.addEventListener("change", (st) => {
      if (st !== "active") return;
      setBatteryOk(isBatteryUnrestricted());
      void reload(); // a background change may have happened
    });
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, [reload]);

  useEffect(() => {
    getCategories(screen)
      .then(setCategories)
      .catch(() => setCategories([]));
  }, [screen]);

  const persist = async (patch: Partial<ChangerState>) => {
    const next = await updateState(patch);
    setState(next);
    return next;
  };

  // ─── Actions ───
  const changeNow = async (opts: { quiet?: boolean } = {}) => {
    setBusy("change");
    const res = await runChange();
    await reload();
    setNow(Date.now());
    setBusy(null);
    if (res.ok) {
      thump();
      if (!opts.quiet) showToast(res.title ? `Wallpaper changed: ${res.title}` : "Wallpaper changed.", { type: "success", position: "top" });
    } else {
      showToast(res.error, { type: "error", position: "top" });
    }
    return res.ok;
  };

  /** Turn the changer on: schedule it, then change right away so it's clear it works. */
  const enable = async (s: ChangerState) => {
    if (!s.source) return;
    if (!AuroraWallpaper) {
      showToast("Update the app to use the wallpaper changer.", { type: "error", position: "top" });
      return;
    }
    setBusy("toggle");
    try {
      await scheduleChanger(s.intervalHours);
      await persist({ enabled: true });
    } catch {
      setBusy(null);
      showToast("Couldn't start the schedule. Try again.", { type: "error", position: "top" });
      return;
    }
    setBusy(null);
    await changeNow();
    if (!isBatteryUnrestricted()) setPermissionOpen(true);
  };

  const toggle = async () => {
    const s = state;
    if (!s || busy) return;
    tick();
    if (!s.enabled) {
      if (!s.source) {
        pendingEnableRef.current = true;
        setPickerOpen(true);
        return;
      }
      await enable(s);
      return;
    }
    setBusy("toggle");
    try {
      await unscheduleChanger();
      await persist({ enabled: false });
      showToast("Auto-change turned off.", { type: "success", position: "top" });
    } catch {
      showToast("Couldn't turn it off. Try again.", { type: "error", position: "top" });
    } finally {
      setBusy(null);
    }
  };

  const restoreSource = async (prev: { source: ChangerSource | null; pool: PoolItem[] }) => {
    try {
      const next = await persist({ source: prev.source, pool: prev.pool, queue: [], lastError: null, lastErrorAt: null });
      if (next.enabled) await AuroraWallpaper?.ensureScheduled(); // fetch the next one from this source
      await reload();
      showToast(prev.source ? `Back to ${prev.source.name}.` : "Undone.", { type: "success", position: "top" });
    } catch {
      showToast("Couldn't undo. Try again.", { type: "error", position: "top" });
    }
  };

  const pickSource = async (source: ChangerSource) => {
    setPickerOpen(false);
    const wantsEnable = pendingEnableRef.current;
    pendingEnableRef.current = false;
    const s = stateRef.current;
    if (!s) return;
    if (sameSource(s.source, source)) {
      if (wantsEnable && !s.enabled) await enable(s);
      return;
    }
    setBusy("source");
    let pool: PoolItem[];
    try {
      pool = await fetchPool(source, screen);
    } catch {
      setBusy(null);
      showToast("Couldn't load those wallpapers. Check your connection and try again.", { type: "error", position: "top" });
      return;
    }
    if (pool.length === 0) {
      setBusy(null);
      showToast(`No ${screen === "mobile" ? "phone " : ""}wallpapers in “${source.name}” yet.`, { type: "error", position: "top" });
      return;
    }
    const prev = { source: s.source, pool: s.pool };
    let next: ChangerState;
    try {
      next = await persist({ source, pool, screen, queue: [], lastError: null, lastErrorAt: null });
    } catch {
      setBusy(null);
      showToast("Couldn't save. Try again.", { type: "error", position: "top" });
      return;
    }
    setBusy(null);
    tick();
    if (wantsEnable && !next.enabled) {
      await enable(next);
      return;
    }
    if (next.enabled) {
      if (!(await changeNow({ quiet: true }))) return;
    } else {
      await reload();
    }
    if (prev.source) {
      showToast(`Now using ${source.name}`, {
        type: "success",
        position: "top",
        duration: 5000,
        action: { label: "Undo", onPress: () => void restoreSource(prev) },
      });
    }
  };

  const applyInterval = async (h: number) => {
    const s = stateRef.current;
    if (!s || s.intervalHours === h) return;
    setState({ ...s, intervalHours: h }); // instant highlight
    try {
      const next = await persist({ intervalHours: h });
      if (next.enabled) {
        await scheduleChanger(h);
        await reload(); // picks up the new next-change time
      }
      setSaved((v) => ({ ...v, interval: v.interval + 1 }));
    } catch {
      showToast("Couldn't update the schedule. Try again.", { type: "error", position: "top" });
      void reload();
    }
  };

  const applyTarget = async (t: ChangerTarget) => {
    const s = stateRef.current;
    if (!s || s.target === t) return;
    tick();
    setState({ ...s, target: t });
    try {
      await persist({ target: t });
      setSaved((v) => ({ ...v, target: v.target + 1 }));
    } catch {
      showToast("Couldn't save. Try again.", { type: "error", position: "top" });
      void reload();
    }
  };

  // ─── Background permission ───
  const askBackgroundPermission = async () => {
    try {
      // Aurora's own app-info page; battery usage is one tap from there (Battery › Unrestricted).
      // Google Play doesn't allow a wallpaper app to show the direct "ignore battery optimisation" dialog.
      await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS, { data: `package:${PACKAGE}` });
    } catch {
      try {
        await IntentLauncher.startActivityAsync("android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS");
      } catch {
        showToast("Couldn't open settings. Open Settings › Apps › Aurora › Battery.", { type: "error", position: "top" });
        return;
      }
    }
    const ok = isBatteryUnrestricted();
    setBatteryOk(ok);
    if (ok) {
      setPermissionOpen(false);
      showToast("All set. Aurora can now change your wallpaper in the background.", { type: "success", position: "top" });
    }
  };
  const openAppSettings = () => {
    IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS, { data: `package:${PACKAGE}` }).catch(() =>
      showToast("Couldn't open settings. Open Settings › Apps › Aurora › Battery.", { type: "error", position: "top" })
    );
  };

  const header = <Header title="Wallpaper changer" logo={false} titleFontSize={20} showBackButton />;

  if (loaded && !user) {
    return (
      <View style={styles.container}>
        {header}
        <SignInPrompt
          icon="sync"
          title="Wallpaper changer"
          text="Sign in to have Aurora change your wallpaper automatically, from any category, your likes or your collections."
        />
      </View>
    );
  }

  if (!state || !loaded) {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.content}>
          <View style={[styles.card, { height: 360 }]} />
          <View style={[styles.card, { height: 86 }]} />
        </View>
      </View>
    );
  }

  const picker = (
    <SourcePicker
      visible={pickerOpen}
      onClose={() => {
        pendingEnableRef.current = false;
        setPickerOpen(false);
      }}
      onPick={(src) => void pickSource(src)}
      current={state.source}
      signedIn={!!user}
      collections={collections ?? []}
      categories={categories}
    />
  );

  // ─── First run: nothing chosen yet ───
  if (!state.source && !state.enabled) {
    const covers = (categories ?? []).map((c) => c.coverThumbUrl || c.coverImageUrl).filter((u): u is string => !!u);
    return (
      <View style={styles.container}>
        {header}
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 24 }]} showsVerticalScrollIndicator={false}>
          <FadeIn index={0}>
            <View style={[styles.card, styles.introCard]}>
              <View style={styles.introFrames}>
                <View style={[styles.introSide, { transform: [{ rotate: "-8deg" }] }]}>
                  {covers[0] ? <Image source={covers[0]} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
                </View>
                <View style={styles.introCenter}>
                  <Ionicons name="sync" size={26} color={Colors.accent} />
                </View>
                <View style={[styles.introSide, { transform: [{ rotate: "8deg" }] }]}>
                  {covers[1] ? <Image source={covers[1]} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
                </View>
              </View>
              <Text style={styles.introTitle}>A fresh wallpaper, on its own</Text>
              <Text style={styles.introText}>Aurora swaps your wallpaper on a schedule, from a category or your own collection.</Text>
            </View>
          </FadeIn>
          <FadeIn index={1}>
            <View style={{ gap: 10 }}>
              <Step n={1} active title="Choose your wallpapers" sub="Liked, a collection or a category" onPress={() => {
                pendingEnableRef.current = true;
                setPickerOpen(true);
              }} />
              <Step n={2} title="Pick how often" sub={`${intervalLabel(state.intervalHours)} · change it any time`} />
              <Step n={3} title="It starts right away" sub="Your first new wallpaper is set straight after" />
            </View>
          </FadeIn>
        </ScrollView>
        <View style={[styles.ctaBar, { paddingBottom: Math.max(bottomPadding, 12) + 10 }]}>
          <Pressable
            onPress={() => {
              tick();
              pendingEnableRef.current = true;
              setPickerOpen(true);
            }}
            disabled={busy !== null}
            style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
          >
            {busy ? <ActivityIndicator color="#0A0A0A" /> : <Text style={styles.ctaText}>Choose wallpapers</Text>}
          </Pressable>
        </View>
        {picker}
      </View>
    );
  }

  // ─── Main ───
  const byId = new Map(state.pool.map((p) => [p.id, p]));
  const current = state.lastWallpaperId ? byId.get(state.lastWallpaperId) : undefined;
  const upNextId = state.queue.find((id) => byId.has(id));
  const upNext = upNextId ? byId.get(upNextId) : undefined;
  const intervalMs = state.intervalHours * 3600_000;
  const failedLast = !!state.lastError && (!state.lastChangedAt || (state.lastErrorAt ?? 0) > state.lastChangedAt);

  const status = !state.enabled
    ? { label: "Off", color: Colors.textSecondary, bg: "#1A1A1A" }
    : failedLast
      ? { label: "Last change failed", color: RED, bg: "rgba(228,90,90,0.14)" }
      : !batteryOk
        ? { label: "May be paused", color: AMBER, bg: "rgba(232,176,74,0.14)" }
        : { label: "Running", color: Colors.accent, bg: Colors.accentMuted };

  let progress = 0;
  let nextLabel = "Off";
  let nextSub = "Turn on Auto to start";
  const nextAt = state.enabled ? nextChangeAt(state) : null;
  if (state.enabled) {
    if (nextAt) {
      progress = 1 - (nextAt - now) / intervalMs;
      nextLabel = nextAt <= now ? "Any moment" : `~${clock(nextAt)}`;
      nextSub = nextAt <= now ? "Android picks the moment" : inAbout(nextAt);
    } else {
      nextLabel = "Soon";
      nextSub = `${intervalLabel(state.intervalHours)}`;
    }
  }

  const presetIndex = customOpen ? -1 : PRESET_HOURS.indexOf(state.intervalHours);
  const intervalOptions = [...PRESET_HOURS.map((h) => ({ key: String(h), label: shortLabel(h) })), { key: "custom", label: "Custom" }];
  const selectedInterval = presetIndex >= 0 ? presetIndex : intervalOptions.length - 1;
  const intervalHint = nextAt && nextAt > now
    ? `Next around ${clock(nextAt)} · Android may shift it by a few minutes`
    : "Android may shift each change by a few minutes";

  const sourceKind = state.source?.kind === "liked" ? "Your likes" : state.source?.kind === "collection" ? "Collection" : "Category";
  const mosaic = state.pool.slice(0, 4);

  return (
    <View style={styles.container}>
      {header}
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPadding + 32 }]} showsVerticalScrollIndicator={false}>
        {/* ─── Live preview ─── */}
        <FadeIn index={0}>
          <View style={[styles.card, styles.hero]}>
            <View style={styles.heroRow}>
              <View style={styles.phone}>
                {current ? (
                  <Image source={thumb(current)} style={StyleSheet.absoluteFill} contentFit="cover" transition={350} />
                ) : (
                  <View style={styles.phoneEmpty}>
                    <Ionicons name="image-outline" size={26} color={Colors.textMuted} />
                  </View>
                )}
                <LockClockPreview width={132} />
                <DimOverlay visible={!state.enabled} />
                {current?.title ? (
                  <View style={styles.nowChip}>
                    <Text style={styles.nowChipText} numberOfLines={1}>
                      Now · {current.title}
                    </Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.heroInfo}>
                <View style={[styles.pill, { backgroundColor: status.bg }]}>
                  <View style={[styles.pillDot, { backgroundColor: status.color }]} />
                  <Text style={[styles.pillText, { color: status.color }]}>{status.label}</Text>
                </View>

                <View style={styles.nextRow}>
                  <ProgressRing size={52} thickness={5} progress={progress} color={state.enabled ? Colors.accent : "#3A3A3A"} trackColor="#1E1E1E" />
                  <View style={{ flex: 1, gap: 1 }}>
                    <Text style={styles.kicker}>Next change</Text>
                    <Text style={styles.nextValue} numberOfLines={1}>
                      {nextLabel}
                    </Text>
                    <Text style={styles.nextSub} numberOfLines={1}>
                      {nextSub}
                    </Text>
                  </View>
                </View>

                <View style={styles.upNextRow}>
                  <View style={styles.upNextThumb}>
                    {upNext ? <Image source={thumb(upNext)} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} /> : <Ionicons name="shuffle" size={16} color={Colors.textMuted} />}
                  </View>
                  <View style={{ flex: 1, gap: 1 }}>
                    <Text style={styles.kicker}>Up next</Text>
                    <Text style={styles.upNextTitle} numberOfLines={2}>
                      {upNext ? upNext.title || "Untitled" : "A surprise"}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.heroActions}>
              <Pressable
                onPress={() => void changeNow()}
                disabled={busy !== null || !state.source}
                style={({ pressed }) => [styles.shuffleBtn, (busy !== null || !state.source) && styles.dim, pressed && { transform: [{ scale: 0.98 }] }]}
                accessibilityRole="button"
              >
                {busy === "change" ? (
                  <ActivityIndicator color="#0A0A0A" />
                ) : (
                  <>
                    <Ionicons name="shuffle" size={19} color="#0A0A0A" />
                    <Text style={styles.shuffleText}>Shuffle now</Text>
                  </>
                )}
              </Pressable>
              <Pressable
                onPress={() => void toggle()}
                disabled={busy !== null}
                style={({ pressed }) => [styles.autoBtn, pressed && { opacity: 0.85 }]}
                accessibilityRole="switch"
                accessibilityLabel="Change automatically"
                accessibilityState={{ checked: state.enabled, busy: busy === "toggle" }}
              >
                <Text style={styles.autoText}>Auto</Text>
                {busy === "toggle" ? <ActivityIndicator color={Colors.accent} style={{ width: 46 }} /> : <Switch on={state.enabled} />}
              </Pressable>
            </View>

            {failedLast && state.enabled ? (
              <View style={styles.infoRow}>
                <Ionicons name="alert-circle" size={16} color={RED} />
                <Text style={[styles.infoText, { color: "#F0A3A3" }]} numberOfLines={2}>
                  {state.lastError}
                </Text>
              </View>
            ) : null}

            {state.enabled ? (
              batteryOk ? (
                <View style={styles.infoRow}>
                  <Ionicons name="checkmark" size={16} color={Colors.accent} />
                  <Text style={styles.infoText}>Background activity allowed</Text>
                  <Pressable onPress={openAppSettings} hitSlop={8}>
                    <Text style={styles.link}>Manage</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.warn}>
                  <Ionicons name="battery-half-outline" size={20} color={AMBER} />
                  <Text style={styles.warnText}>Android may stop changes while Aurora is closed.</Text>
                  <Pressable onPress={() => setPermissionOpen(true)} style={({ pressed }) => [styles.warnBtn, pressed && { opacity: 0.85 }]}>
                    <Text style={styles.warnBtnText}>Fix</Text>
                  </Pressable>
                </View>
              )
            ) : null}
          </View>
        </FadeIn>

        {/* ─── Source ─── */}
        <FadeIn index={1}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Wallpapers from</Text>
            <Pressable
              onPress={() => {
                tick();
                setPickerOpen(true);
              }}
              disabled={busy === "source"}
              style={({ pressed }) => [styles.card, styles.sourceCard, pressed && { opacity: 0.85 }]}
              accessibilityRole="button"
              accessibilityLabel={`Wallpapers from ${state.source?.name ?? "nothing yet"}. Change`}
            >
              {busy === "source" ? (
                <>
                  <View style={[styles.mosaic, { backgroundColor: "#1A1A1A" }]} />
                  <View style={{ flex: 1, gap: 8 }}>
                    <View style={[styles.skel, { width: 90, height: 14 }]} />
                    <View style={[styles.skel, { width: 150, height: 11 }]} />
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.mosaic}>
                    {[0, 1, 2, 3].map((i) => (
                      <View key={i} style={styles.mosaicCell}>
                        {mosaic[i] ? <Image source={thumb(mosaic[i]!)} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
                      </View>
                    ))}
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={styles.sourceName} numberOfLines={1}>
                      {state.source?.name ?? "Choose wallpapers"}
                    </Text>
                    <Text style={styles.sourceMeta} numberOfLines={1}>
                      {state.source ? `${sourceKind} · ${state.pool.length} wallpapers` : "Nothing chosen yet"}
                    </Text>
                  </View>
                  <Text style={styles.link}>Change</Text>
                </>
              )}
            </Pressable>
          </View>
        </FadeIn>

        {/* ─── Interval ─── */}
        <FadeIn index={2}>
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>How often</Text>
              <SavedBadge signal={saved.interval} />
            </View>
            <Segmented
              options={intervalOptions}
              selected={selectedInterval}
              onSelect={(i) => {
                tick();
                if (i === intervalOptions.length - 1) {
                  setCustomOpen(true);
                  if (state.intervalHours < MIN_HOURS) void applyInterval(MIN_HOURS);
                  return;
                }
                setCustomOpen(false);
                void applyInterval(PRESET_HOURS[i]!);
              }}
            />
            {customOpen ? <IntervalWheel value={clampHours(state.intervalHours)} onCommit={(h) => void applyInterval(h)} /> : null}
            <Text style={styles.hint}>{intervalHint}</Text>
          </View>
        </FadeIn>

        {/* ─── Target ─── */}
        <FadeIn index={3}>
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>Apply to</Text>
              <SavedBadge signal={saved.target} />
            </View>
            <View style={styles.targets} accessibilityRole="radiogroup">
              {TARGETS.map((t) => {
                const on = state.target === t.value;
                const color = on ? Colors.accent : Colors.textSecondary;
                return (
                  <Pressable
                    key={t.value}
                    onPress={() => void applyTarget(t.value)}
                    style={({ pressed }) => [styles.target, on && styles.targetOn, pressed && { opacity: 0.85 }]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                  >
                    <View style={{ flexDirection: "row", gap: 4 }}>
                      {t.home ? (
                        <View style={[styles.miniPhone, { borderColor: color }]}>
                          <View style={styles.miniGrid}>
                            {[0, 1, 2, 3].map((i) => (
                              <View key={i} style={[styles.miniApp, { backgroundColor: color }]} />
                            ))}
                          </View>
                        </View>
                      ) : null}
                      {t.lock ? (
                        <View style={[styles.miniPhone, { borderColor: color, alignItems: "center", paddingTop: 6 }]}>
                          <Ionicons name="lock-closed" size={11} color={color} />
                        </View>
                      ) : null}
                    </View>
                    <Text style={[styles.targetText, { color: on ? Colors.accent : Colors.textPrimary }]}>{t.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.hint}>
              {state.target === "both" ? "New wallpapers go on your home and lock screen" : state.target === "home" ? "New wallpapers go on your home screen only" : "New wallpapers go on your lock screen only"}
            </Text>
          </View>
        </FadeIn>

        {__DEV__ ? (
          <SettingsSection title="Developer (dev builds only)">
            <SettingsRow
              icon="flask-outline"
              label="Test background change in 1 min"
              onPress={async () => {
                if (!state.enabled) {
                  showToast("Turn the changer on first.", { type: "error", position: "top" });
                  return;
                }
                await scheduleTestRunInOneMinute();
                showToast("Scheduled. Go to your home screen now; the wallpaper should change in about a minute.", { type: "success", position: "top", duration: 6000 });
              }}
            />
          </SettingsSection>
        ) : null}
      </ScrollView>

      {picker}

      <Sheet visible={permissionOpen} onClose={() => setPermissionOpen(false)}>
        <View style={styles.permIcon}>
          <Ionicons name="battery-charging-outline" size={28} color={Colors.accent} />
        </View>
        <Text style={styles.permTitle}>One more step: allow background activity</Text>
        <Text style={styles.permText}>
          To save battery, Android pauses apps that aren&apos;t open, which stops the changer. Allow Aurora to run in the background and your
          wallpaper will change on schedule. Aurora only wakes up briefly, once per change.
        </Text>
        <View style={styles.permSteps}>
          <Text style={styles.permStep}>1. Tap Open settings below.</Text>
          <Text style={styles.permStep}>2. Tap Battery (or App battery usage).</Text>
          <Text style={styles.permStep}>3. Choose Unrestricted, then come back.</Text>
        </View>
        <Pressable onPress={() => void askBackgroundPermission()} style={({ pressed }) => [styles.cta, { marginTop: 20 }, pressed && { opacity: 0.85 }]}>
          <Text style={styles.ctaText}>Open settings</Text>
        </Pressable>
        <Pressable onPress={() => setPermissionOpen(false)} style={styles.permLater} hitSlop={6}>
          <Text style={styles.permLaterText}>Not now</Text>
        </Pressable>
        <Text style={styles.permFoot}>
          On some phones (vivo, Xiaomi, Oppo, Realme) also turn on “Allow background activity” under Battery in{" "}
          <Text style={styles.link} onPress={openAppSettings}>
            Aurora&apos;s app settings
          </Text>
          . You can turn it off there any time.
        </Text>
      </Sheet>
    </View>
  );
};

// ─── Pieces ───

/** Sections fade and rise in one after another when the screen opens. */
function FadeIn({ index, children }: { index: number; children: ReactNode }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 320, delay: index * 60, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [v, index]);
  return (
    <Animated.View style={{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }}>
      {children}
    </Animated.View>
  );
}

/** A small "Saved" check that pops in next to a section title each time `signal` goes up. */
function SavedBadge({ signal }: { signal: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!signal) return;
    v.stopAnimation();
    v.setValue(0);
    Animated.sequence([
      Animated.spring(v, { toValue: 1, useNativeDriver: true, speed: 22, bounciness: 9 }),
      Animated.delay(1600),
      Animated.timing(v, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start();
  }, [v, signal]);
  if (!signal) return null;
  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      accessibilityLabel="Saved"
      style={[styles.savedBadge, { opacity: v, transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }] }]}
    >
      <Ionicons name="checkmark" size={13} color={Colors.accent} />
      <Text style={styles.savedText}>Saved</Text>
    </Animated.View>
  );
}

function DimOverlay({ visible }: { visible: boolean }) {
  const v = useRef(new Animated.Value(visible ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: visible ? 1 : 0, duration: 250, useNativeDriver: true }).start();
  }, [v, visible]);
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.6)", opacity: v, zIndex: 3 }]} />;
}

function Switch({ on }: { on: boolean }) {
  const v = useRef(new Animated.Value(on ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(v, { toValue: on ? 1 : 0, useNativeDriver: false, speed: 18, bounciness: 7 }).start();
  }, [v, on]);
  return (
    <Animated.View style={[styles.track, { backgroundColor: v.interpolate({ inputRange: [0, 1], outputRange: ["#2A2A2A", Colors.accent] }) }]}>
      <Animated.View
        style={[
          styles.knob,
          {
            backgroundColor: v.interpolate({ inputRange: [0, 1], outputRange: ["#8C8984", "#0A0A0A"] }),
            transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, 18] }) }],
          },
        ]}
      />
    </Animated.View>
  );
}

/** Pill row with a highlight that slides to the selected option. */
function Segmented({
  options,
  selected,
  onSelect,
  track = CARD,
  thumbStyle = "accent",
}: {
  options: { key: string; label: string }[];
  selected: number;
  onSelect: (i: number) => void;
  track?: string;
  thumbStyle?: "accent" | "plain";
}) {
  const [width, setWidth] = useState(0);
  const x = useRef(new Animated.Value(0)).current;
  const placed = useRef(false);
  const n = options.length;
  const itemW = width ? (width - SEG_PAD * 2 - SEG_GAP * (n - 1)) / n : 0;
  useEffect(() => {
    if (!itemW || selected < 0) return;
    const to = selected * (itemW + SEG_GAP);
    if (!placed.current) {
      x.setValue(to);
      placed.current = true;
      return;
    }
    Animated.spring(x, { toValue: to, useNativeDriver: true, speed: 22, bounciness: 5 }).start();
  }, [x, itemW, selected]);
  const accent = thumbStyle === "accent";
  return (
    <View style={[styles.seg, { backgroundColor: track }]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} accessibilityRole="radiogroup">
      {itemW > 0 && selected >= 0 ? (
        <Animated.View pointerEvents="none" style={[styles.segThumb, accent ? styles.segThumbAccent : styles.segThumbPlain, { width: itemW, transform: [{ translateX: x }] }]} />
      ) : null}
      {options.map((o, i) => {
        const on = i === selected;
        return (
          <Pressable key={o.key} onPress={() => onSelect(i)} style={styles.segItem} accessibilityRole="radio" accessibilityState={{ selected: on }}>
            <Text style={[styles.segText, on && { color: accent ? Colors.accent : Colors.textPrimary }]} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const WHEEL_ITEM = 52;
const WHEEL_HOURS = Array.from({ length: MAX_HOURS - MIN_HOURS + 1 }, (_, i) => MIN_HOURS + i);

/** Sideways hour picker that snaps to each hour; saves shortly after it stops. */
function IntervalWheel({ value, onCommit }: { value: number; onCommit: (h: number) => void }) {
  const ref = useRef<ScrollView>(null);
  const [width, setWidth] = useState(0);
  const [live, setLive] = useState(value);
  const liveRef = useRef(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appear = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(appear, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [appear]);

  const indexAt = (x: number) => Math.max(0, Math.min(WHEEL_HOURS.length - 1, Math.round(x / WHEEL_ITEM)));
  const commitSoon = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onCommit(liveRef.current), 600);
  };
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const h = WHEEL_HOURS[indexAt(e.nativeEvent.contentOffset.x)]!;
    if (h !== liveRef.current) {
      liveRef.current = h;
      setLive(h);
      tick();
    }
  };
  const scrollToHour = (h: number, animated: boolean) => ref.current?.scrollTo({ x: (h - MIN_HOURS) * WHEEL_ITEM, animated });

  return (
    <Animated.View style={[styles.card, styles.wheelCard, { opacity: appear, transform: [{ translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }) }] }]}>
      <View style={styles.wheelValueRow}>
        <Text style={styles.wheelEvery}>Every</Text>
        <Text style={styles.wheelValue}>{live}</Text>
        <Text style={styles.wheelEvery}>{live === 1 ? "hour" : "hours"}</Text>
      </View>
      <View
        style={styles.wheel}
        onLayout={(e) => {
          setWidth(e.nativeEvent.layout.width);
          setTimeout(() => scrollToHour(value, false), 0);
        }}
      >
        <View pointerEvents="none" style={[styles.wheelHighlight, { left: width / 2 - WHEEL_ITEM / 2 + 2 }]} />
        <ScrollView
          ref={ref}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={WHEEL_ITEM}
          decelerationRate="fast"
          scrollEventThrottle={16}
          onScroll={onScroll}
          onMomentumScrollEnd={commitSoon}
          onScrollEndDrag={commitSoon}
          contentContainerStyle={{ paddingHorizontal: Math.max(0, (width - WHEEL_ITEM) / 2) }}
        >
          {WHEEL_HOURS.map((h) => {
            const d = Math.abs(h - live);
            return (
              <Pressable
                key={h}
                onPress={() => {
                  scrollToHour(h, true);
                  liveRef.current = h;
                  setLive(h);
                  tick();
                  commitSoon();
                }}
                style={styles.wheelItem}
                accessibilityLabel={`Every ${h} ${h === 1 ? "hour" : "hours"}`}
              >
                <Text style={[styles.wheelNum, d === 0 ? styles.wheelNum0 : d === 1 ? styles.wheelNum1 : d === 2 ? styles.wheelNum2 : styles.wheelNum3]}>{h}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      <Text style={[styles.hint, { textAlign: "center" }]}>
        Swipe to pick {MIN_HOURS} – {MAX_HOURS} hours
      </Text>
    </Animated.View>
  );
}

function Step({ n, title, sub, active, onPress }: { n: number; title: string; sub: string; active?: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.card, styles.step, active && styles.stepActive, pressed && { opacity: 0.85 }]}>
      <View style={[styles.stepNum, active && { backgroundColor: Colors.accent }]}>
        <Text style={[styles.stepNumText, active && { color: "#0A0A0A" }]}>{n}</Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.stepTitle, !active && { color: "#C9C5BF" }]}>{title}</Text>
        <Text style={styles.stepSub}>{sub}</Text>
      </View>
      {active ? <Ionicons name="chevron-forward" size={18} color={Colors.accent} /> : null}
    </Pressable>
  );
}

type PickCard = { key: string; source: ChangerSource; name: string; meta: string; cover: string | null; icon: keyof typeof Ionicons.glyphMap };

function SourcePicker({
  visible,
  onClose,
  onPick,
  current,
  signedIn,
  collections,
  categories,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (s: ChangerSource) => void;
  current: ChangerSource | null;
  signedIn: boolean;
  collections: { id: string; title: string; wallpaperCount: number; coverUrl: string | null; coverThumbUrl?: string | null }[];
  categories: Category[] | null;
}) {
  const [tab, setTab] = useState<"library" | "categories">("categories");
  const [query, setQuery] = useState("");
  useEffect(() => {
    if (!visible) return;
    setQuery("");
    setTab(signedIn && current && current.kind !== "category" ? "library" : "categories");
  }, [visible, signedIn, current]);

  const library: PickCard[] = [
    { key: "liked", source: { kind: "liked", name: "Liked" }, name: "Liked", meta: "Your likes", cover: null, icon: "heart" },
    ...collections.map((c) => ({
      key: c.id,
      source: { kind: "collection" as const, id: c.id, name: c.title },
      name: c.title,
      meta: `Collection · ${c.wallpaperCount}`,
      cover: c.coverThumbUrl || c.coverUrl,
      icon: "albums" as const,
    })),
  ];
  const cats: PickCard[] = (categories ?? []).map((c) => ({
    key: c.id,
    source: { kind: "category", slug: c.slug, name: c.name },
    name: c.name,
    meta: c.wallpaperCount ? `${c.wallpaperCount} wallpapers` : "Category",
    cover: c.coverThumbUrl || c.coverImageUrl,
    icon: "grid",
  }));
  const showLibrary = signedIn && tab === "library";
  const q = query.trim().toLowerCase();
  const list = (showLibrary ? library : cats).filter((c) => !q || c.name.toLowerCase().includes(q));
  const loading = !showLibrary && categories === null;

  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={styles.sheetHead}>
        <Text style={styles.sheetTitle}>Wallpapers from</Text>
        <Pressable onPress={onClose} style={styles.closeBtn} accessibilityLabel="Close" hitSlop={6}>
          <Ionicons name="close" size={18} color={Colors.textSecondary} />
        </Pressable>
      </View>
      {signedIn ? (
        <Segmented
          options={[
            { key: "library", label: "Your library" },
            { key: "categories", label: "Categories" },
          ]}
          selected={tab === "library" ? 0 : 1}
          onSelect={(i) => {
            tick();
            setTab(i === 0 ? "library" : "categories");
          }}
          track={Colors.bgPrimary}
          thumbStyle="plain"
        />
      ) : null}
      <View style={styles.search}>
        <Ionicons name="search" size={17} color={Colors.textSecondary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={showLibrary ? "Search your collections" : "Search categories"}
          placeholderTextColor={Colors.textMuted}
          style={styles.searchInput}
          returnKeyType="search"
        />
      </View>
      {!signedIn ? <Text style={[styles.hint, { marginTop: 10 }]}>Sign in to use your Liked wallpapers or collections.</Text> : null}
      <ScrollView style={{ maxHeight: 430, marginTop: 14 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.grid}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={[styles.pickCard, { height: 148 }]} />
            ))}
          </View>
        ) : list.length === 0 ? (
          <Text style={[styles.hint, { textAlign: "center", marginVertical: 24 }]}>{q ? "Nothing matches that." : "Nothing here yet."}</Text>
        ) : (
          <View style={styles.grid}>
            {list.map((c) => {
              const on = sameSource(current, c.source);
              return (
                <Pressable
                  key={c.key}
                  onPress={() => onPick(c.source)}
                  style={({ pressed }) => [styles.pickCard, on && styles.pickCardOn, pressed && { opacity: 0.85 }]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                >
                  <View style={[styles.pickCover, !c.cover && { backgroundColor: c.icon === "heart" ? Colors.accentMuted : "#1A1A1A" }]}>
                    {c.cover ? (
                      <Image source={c.cover} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
                    ) : (
                      <Ionicons name={c.icon} size={26} color={c.icon === "heart" ? Colors.accent : Colors.textMuted} />
                    )}
                    {on ? (
                      <View style={styles.pickCheck}>
                        <Ionicons name="checkmark" size={14} color="#0A0A0A" />
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.pickName} numberOfLines={1}>
                    {c.name}
                  </Text>
                  <Text style={styles.pickMeta} numberOfLines={1}>
                    {c.meta}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </Sheet>
  );
}

const SEG_PAD = 4;
const SEG_GAP = 4;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  content: { paddingHorizontal: 16, paddingTop: 8, gap: 26 },
  card: { backgroundColor: CARD, borderWidth: 1, borderColor: CARD_BORDER, borderRadius: 22 },
  dim: { opacity: 0.45 },
  link: { color: Colors.accent, fontSize: 13, fontWeight: "700" },
  hint: { color: Colors.textSecondary, fontSize: 12.5, marginHorizontal: 4, lineHeight: 17 },
  section: { gap: 10 },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 24 },
  savedBadge: { flexDirection: "row", alignItems: "center", gap: 4, height: 24, paddingHorizontal: 9, borderRadius: 999, backgroundColor: Colors.accentMuted },
  savedText: { color: Colors.accent, fontSize: 12, fontWeight: "700" },
  sectionTitle: { color: Colors.textSecondary, fontSize: 12, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase", marginHorizontal: 4 },
  skel: { backgroundColor: "#1A1A1A", borderRadius: 7 },

  // hero
  hero: { borderRadius: 28, padding: 16, gap: 16 },
  heroRow: { flexDirection: "row", gap: 16 },
  phone: { width: 132, height: 268, borderRadius: 24, overflow: "hidden", borderWidth: 2, borderColor: "#262626", backgroundColor: "#141414" },
  phoneEmpty: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  nowChip: { position: "absolute", left: 8, right: 8, bottom: 10, alignItems: "flex-start", zIndex: 4 },
  nowChipText: { color: Colors.textPrimary, fontSize: 10, fontWeight: "600", backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999, overflow: "hidden" },
  heroInfo: { flex: 1, gap: 16, minWidth: 0 },
  pill: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 7, height: 28, paddingHorizontal: 11, borderRadius: 999 },
  pillDot: { width: 7, height: 7, borderRadius: 4 },
  pillText: { fontSize: 12.5, fontWeight: "700" },
  nextRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  kicker: { color: Colors.textSecondary, fontSize: 10.5, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase" },
  nextValue: { color: Colors.textPrimary, fontSize: 19, fontWeight: "800", letterSpacing: -0.3 },
  nextSub: { color: Colors.textSecondary, fontSize: 12 },
  upNextRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  upNextThumb: { width: 40, height: 70, borderRadius: 9, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)", backgroundColor: "#141414", alignItems: "center", justifyContent: "center" },
  upNextTitle: { color: Colors.textPrimary, fontSize: 13.5, fontWeight: "600" },
  heroActions: { flexDirection: "row", alignItems: "center", gap: 12 },
  shuffleBtn: { flex: 1, height: 50, borderRadius: 16, backgroundColor: Colors.accent, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  shuffleText: { color: "#0A0A0A", fontSize: 15, fontWeight: "800" },
  autoBtn: { height: 50, paddingLeft: 14, paddingRight: 12, borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", backgroundColor: Colors.bgElevated, flexDirection: "row", alignItems: "center", gap: 10 },
  autoText: { color: Colors.textPrimary, fontSize: 13, fontWeight: "600" },
  track: { width: 46, height: 28, borderRadius: 14, padding: 3, justifyContent: "center" },
  knob: { width: 22, height: 22, borderRadius: 11 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 2 },
  infoText: { flex: 1, color: "#A9A59F", fontSize: 12.5 },
  warn: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, paddingLeft: 14, borderRadius: 18, backgroundColor: "rgba(232,176,74,0.09)", borderWidth: 1, borderColor: "rgba(232,176,74,0.35)" },
  warnText: { flex: 1, color: "#EADBC0", fontSize: 13, lineHeight: 18 },
  warnBtn: { height: 36, paddingHorizontal: 14, borderRadius: 12, backgroundColor: AMBER, alignItems: "center", justifyContent: "center" },
  warnBtnText: { color: "#1A1206", fontSize: 13, fontWeight: "800" },

  // source
  sourceCard: { flexDirection: "row", alignItems: "center", gap: 14, padding: 12, paddingRight: 14 },
  mosaic: { width: 60, height: 60, borderRadius: 14, overflow: "hidden", flexDirection: "row", flexWrap: "wrap", gap: 3 },
  mosaicCell: { width: 28.5, height: 28.5, backgroundColor: "#1A1A1A", overflow: "hidden" },
  sourceName: { color: Colors.textPrimary, fontSize: 16, fontWeight: "700" },
  sourceMeta: { color: Colors.textSecondary, fontSize: 13 },

  // segmented
  seg: { flexDirection: "row", padding: SEG_PAD, gap: SEG_GAP, borderRadius: 18, borderWidth: 1, borderColor: CARD_BORDER },
  segThumb: { position: "absolute", top: SEG_PAD, bottom: SEG_PAD, left: SEG_PAD, borderRadius: 14 },
  segThumbAccent: { backgroundColor: "rgba(129,238,78,0.16)", borderWidth: 1, borderColor: "rgba(129,238,78,0.45)" },
  segThumbPlain: { backgroundColor: "#1E1E1E" },
  segItem: { flex: 1, height: 42, alignItems: "center", justifyContent: "center" },
  segText: { color: "#A9A59F", fontSize: 14, fontWeight: "700" },

  // wheel
  wheelCard: { paddingTop: 18, paddingBottom: 14, gap: 12 },
  wheelValueRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "center", gap: 6 },
  wheelEvery: { color: "#A9A59F", fontSize: 15 },
  wheelValue: { color: Colors.accent, fontSize: 34, fontWeight: "800", letterSpacing: -0.8 },
  wheel: { height: 56, justifyContent: "center" },
  wheelHighlight: { position: "absolute", top: 4, bottom: 4, width: WHEEL_ITEM - 4, borderRadius: 14, backgroundColor: "rgba(129,238,78,0.14)", borderWidth: 1, borderColor: "rgba(129,238,78,0.45)" },
  wheelItem: { width: WHEEL_ITEM, height: 56, alignItems: "center", justifyContent: "center" },
  wheelNum: { fontWeight: "700" },
  wheelNum0: { color: Colors.accent, fontSize: 22, fontWeight: "800" },
  wheelNum1: { color: "#A9A59F", fontSize: 18 },
  wheelNum2: { color: "#6F6C68", fontSize: 16 },
  wheelNum3: { color: "#3E3C3A", fontSize: 15 },

  // target
  targets: { flexDirection: "row", gap: 10 },
  target: { flex: 1, height: 104, borderRadius: 20, backgroundColor: CARD, borderWidth: 1, borderColor: CARD_BORDER, alignItems: "center", justifyContent: "center", gap: 10 },
  targetOn: { backgroundColor: "rgba(129,238,78,0.10)", borderWidth: 1.5, borderColor: Colors.accent },
  targetText: { fontSize: 13.5, fontWeight: "700" },
  miniPhone: { width: 26, height: 44, borderRadius: 7, borderWidth: 2 },
  miniGrid: { flexDirection: "row", flexWrap: "wrap", gap: 3, paddingHorizontal: 3, paddingTop: 5 },
  miniApp: { width: 7, height: 5, borderRadius: 2, opacity: 0.6 },

  // first run
  introCard: { borderRadius: 28, alignItems: "center", gap: 10, paddingTop: 26, paddingBottom: 24, paddingHorizontal: 20 },
  introFrames: { flexDirection: "row", alignItems: "flex-end", gap: 10, marginBottom: 10 },
  introSide: { width: 54, height: 108, borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", backgroundColor: "#141414", opacity: 0.6 },
  introCenter: { width: 74, height: 148, borderRadius: 18, borderWidth: 2, borderStyle: "dashed", borderColor: "rgba(129,238,78,0.55)", alignItems: "center", justifyContent: "center" },
  introTitle: { color: Colors.textPrimary, fontSize: 22, fontWeight: "800", letterSpacing: -0.4, textAlign: "center" },
  introText: { color: "#A9A59F", fontSize: 14, lineHeight: 20, textAlign: "center" },
  step: { flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderRadius: 20 },
  stepActive: { borderWidth: 1.5, borderColor: Colors.accent },
  stepNum: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#1A1A1A", alignItems: "center", justifyContent: "center" },
  stepNumText: { color: "#A9A59F", fontSize: 14, fontWeight: "800" },
  stepTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: "700" },
  stepSub: { color: Colors.textSecondary, fontSize: 12.5 },
  ctaBar: { paddingHorizontal: 16, paddingTop: 12 },
  cta: { height: 56, borderRadius: 18, backgroundColor: Colors.accent, alignItems: "center", justifyContent: "center" },
  ctaText: { color: "#0A0A0A", fontSize: 16, fontWeight: "800" },

  // picker
  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  sheetTitle: { color: Colors.textPrimary, fontSize: 20, fontWeight: "800", letterSpacing: -0.3 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#1E1E1E", alignItems: "center", justifyContent: "center" },
  search: { flexDirection: "row", alignItems: "center", gap: 10, height: 46, marginTop: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: Colors.bgPrimary },
  searchInput: { flex: 1, color: Colors.textPrimary, fontSize: 15, paddingVertical: 0 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 12, paddingBottom: 6 },
  pickCard: { width: "48.3%", padding: 6, borderRadius: 20, backgroundColor: Colors.bgPrimary, borderWidth: 1.5, borderColor: "transparent", gap: 6 },
  pickCardOn: { borderColor: Colors.accent, backgroundColor: "rgba(129,238,78,0.08)" },
  pickCover: { height: 96, borderRadius: 14, overflow: "hidden", backgroundColor: "#1A1A1A", alignItems: "center", justifyContent: "center" },
  pickCheck: { position: "absolute", top: 8, right: 8, width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.accent, alignItems: "center", justifyContent: "center" },
  pickName: { color: Colors.textPrimary, fontSize: 14.5, fontWeight: "700", paddingHorizontal: 4 },
  pickMeta: { color: Colors.textSecondary, fontSize: 12, paddingHorizontal: 4, paddingBottom: 2 },

  // permission sheet
  permIcon: { width: 56, height: 56, borderRadius: 18, backgroundColor: Colors.accentMuted, alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: 14 },
  permTitle: { color: Colors.textPrimary, fontSize: 18, fontWeight: "800", textAlign: "center" },
  permText: { color: "#A9A59F", fontSize: 14, lineHeight: 20, textAlign: "center", marginTop: 8 },
  permSteps: { marginTop: 16, gap: 6, padding: 14, borderRadius: 16, backgroundColor: Colors.bgPrimary },
  permStep: { color: Colors.textPrimary, fontSize: 14 },
  permLater: { alignSelf: "center", paddingVertical: 12 },
  permLaterText: { color: Colors.textSecondary, fontSize: 14, fontWeight: "600" },
  permFoot: { color: Colors.textMuted, fontSize: 12, lineHeight: 17, textAlign: "center" },
});

export default WallpaperChanger;
