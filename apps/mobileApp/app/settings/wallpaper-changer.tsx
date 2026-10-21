import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import * as IntentLauncher from "expo-intent-launcher";
import { useNavigation } from "expo-router";
import ConfirmModal from "../../components/ConfirmModal";
import Header from "../../components/Header";
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

const TARGETS: { value: ChangerTarget; label: string }[] = [
  { value: "home", label: "Home" },
  { value: "lock", label: "Lock" },
  { value: "both", label: "Both" },
];
const PACKAGE = Constants.expoConfig?.android?.package ?? "com.shubhzx09.aurorawalls";

type Draft = { source: ChangerSource | null; pool: PoolItem[]; intervalHours: number; target: ChangerTarget };

const sameSource = (a: ChangerSource | null, b: ChangerSource | null) =>
  a === b ||
  (!!a &&
    !!b &&
    a.kind === b.kind &&
    (a.kind === "liked" ||
      (a.kind === "collection" && b.kind === "collection" && a.id === b.id) ||
      (a.kind === "category" && b.kind === "category" && a.slug === b.slug)));


function ago(ms: number) {
  const m = Math.round((Date.now() - ms) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
}
function inAbout(ms: number) {
  const m = Math.round((ms - Date.now()) / 60000);
  if (m <= 1) return "soon";
  if (m < 60) return `in about ${m} min`;
  return `in about ${Math.round(m / 60)} h`;
}

const isBatteryUnrestricted = () => {
  try {
    return AuroraWallpaper?.isIgnoringBatteryOptimizations() ?? true;
  } catch {
    return true;
  }
};

/**
 * Settings › Wallpaper changer. Shows the saved settings; edits to source / interval / screen
 * are a draft until "Save changes". The on/off switch and "Change now" act immediately.
 */
const WallpaperChanger = () => {
  const { user } = useAuth();
  const { collections } = useCollections();
  const { screen } = useScreenFilter();
  const { showToast } = useToast();
  const { bottomPadding } = useInsets();
  const navigation = useNavigation();

  const [saved, setSaved] = useState<ChangerState | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [custom, setCustom] = useState(false);
  const [busy, setBusy] = useState<"toggle" | "change" | "source" | "save" | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [permissionOpen, setPermissionOpen] = useState(false);
  const [batteryOk, setBatteryOk] = useState(true);
  const [leaveAction, setLeaveAction] = useState<any>(null);
  /** Set when the switch was turned on before a source was chosen: picking one finishes turning it on. */
  const pendingEnableRef = useRef(false);

  const toDraft = (s: ChangerState): Draft => ({ source: s.source, pool: s.pool, intervalHours: s.intervalHours, target: s.target });

  /** Reload saved settings. `resetDraft`: also throw away unsaved edits. */
  const reload = useCallback(async (resetDraft: boolean) => {
    const s = await loadState();
    setSaved(s);
    if (resetDraft) {
      setDraft(toDraft(s));
      setCustom(!PRESET_HOURS.includes(s.intervalHours));
    }
    return s;
  }, []);

  useEffect(() => {
    void reload(true);
    setBatteryOk(isBatteryUnrestricted());
    const sub = AppState.addEventListener("change", (st) => {
      if (st !== "active") return;
      setBatteryOk(isBatteryUnrestricted());
      void reload(false); // a background change may have happened; keep any edits
    });
    return () => sub.remove();
  }, [reload]);

  const dirty =
    !!saved &&
    !!draft &&
    (!sameSource(saved.source, draft.source) || saved.intervalHours !== draft.intervalHours || saved.target !== draft.target);

  // Leaving with unsaved edits asks first.
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  useEffect(
    () =>
      navigation.addListener("beforeRemove", (e: any) => {
        if (!dirtyRef.current) return;
        e.preventDefault();
        setLeaveAction(e.data.action);
      }),
    [navigation]
  );

  // ─── Draft edits ───
  const pickSource = async (source: ChangerSource) => {
    setPickerOpen(false);
    const wantsEnable = pendingEnableRef.current;
    pendingEnableRef.current = false;
    if (!draft) return;
    if (sameSource(draft.source, source)) {
      if (wantsEnable) await enable(draft);
      return;
    }
    setBusy("source");
    let nextDraft: Draft | null = null;
    try {
      const pool = await fetchPool(source, screen);
      if (pool.length === 0) {
        showToast(`No ${screen === "mobile" ? "phone " : ""}wallpapers in “${source.name}” yet.`, { type: "error", position: "top" });
        return;
      }
      nextDraft = { ...draft, source, pool };
      setDraft(nextDraft);
    } catch {
      showToast("Couldn't load those wallpapers. Check your connection and try again.", { type: "error", position: "top" });
    } finally {
      setBusy(null);
    }
    // The switch was turned on before a source existed: finish turning it on now.
    if (nextDraft && wantsEnable) await enable(nextDraft);
  };
  /** Quick picks are stored as-is (15 min included); the custom stepper stays within 2–24 h. */
  const setHours = (h: number, exact = false) => setDraft((d) => (d ? { ...d, intervalHours: exact ? h : clampHours(h) } : d));

  const discard = () => {
    if (!saved) return;
    setDraft(toDraft(saved));
    setCustom(!PRESET_HOURS.includes(saved.intervalHours));
  };

  /**
   * Apply the draft. Returns the new saved state. If the changer is on and the source changed,
   * the wallpaper changes right away to one from the new source.
   */
  const save = async (d: Draft | null = draft, opts: { quiet?: boolean } = {}): Promise<ChangerState | null> => {
    if (!saved || !d) return null;
    const draft = d;
    setBusy("save");
    let result: ChangerState | null = null;
    let sourceChanged = false;
    try {
      sourceChanged = !sameSource(saved.source, draft.source);
      const next: ChangerState = {
        ...saved,
        source: draft.source,
        pool: draft.pool,
        screen,
        intervalHours: draft.intervalHours,
        target: draft.target,
        ...(sourceChanged ? { queue: [], lastError: null, lastErrorAt: null } : {}),
      };
      await saveState(next);
      if (next.enabled && next.intervalHours !== saved.intervalHours) await scheduleChanger(next.intervalHours);
      setSaved(next);
      result = next;
    } catch {
      showToast("Couldn't save. Try again.", { type: "error", position: "top" });
      return null;
    } finally {
      setBusy(null);
    }
    if (result.enabled && sourceChanged) {
      await changeNow(); // its toast says the wallpaper changed
    } else if (!opts.quiet) {
      showToast("Wallpaper changer settings saved.", { type: "success", position: "top" });
    }
    return result;
  };

  // ─── Immediate actions ───
  const changeNow = async () => {
    setBusy("change");
    const res = await runChange();
    await reload(false);
    setBusy(null);
    showToast(res.ok ? (res.title ? `Wallpaper changed: ${res.title}` : "Wallpaper changed.") : res.error, {
      type: res.ok ? "success" : "error",
      position: "top",
    });
  };

  const toggle = async () => {
    if (!saved || !draft) return;
    if (saved.enabled) {
      setBusy("toggle");
      try {
        await unscheduleChanger();
        setSaved(await updateState({ enabled: false }));
        showToast("Wallpaper changer turned off.", { type: "success", position: "top" });
      } catch {
        showToast("Couldn't turn it off. Try again.", { type: "error", position: "top" });
      } finally {
        setBusy(null);
      }
      return;
    }
    if (!draft.source) {
      pendingEnableRef.current = true;
      setPickerOpen(true);
      showToast("First choose where the wallpapers come from.", { type: "info", position: "top" });
      return;
    }
    await enable(draft);
  };

  /** Turn the changer on with this draft (saving it first if it differs from what's saved). */
  const enable = async (d: Draft) => {
    if (!saved || !d.source) return;
    if (!AuroraWallpaper) {
      showToast("Update the app to use the wallpaper changer.", { type: "error", position: "top" });
      return;
    }
    const isDirty = !sameSource(saved.source, d.source) || saved.intervalHours !== d.intervalHours || saved.target !== d.target;
    // Turning on also saves any edits.
    const base = isDirty ? await save(d, { quiet: true }) : saved;
    if (!base) return;
    setBusy("toggle");
    try {
      await scheduleChanger(base.intervalHours);
      setSaved(await updateState({ enabled: true }));
    } catch {
      setBusy(null);
      showToast("Couldn't start the schedule. Try again.", { type: "error", position: "top" });
      return;
    }
    setBusy(null);
    await changeNow(); // first change right away, so it's clear it works
    if (!isBatteryUnrestricted()) setPermissionOpen(true);
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

  if (!saved || !draft) {
    return (
      <View style={styles.container}>
        <Header title="Wallpaper changer" logo={false} titleFontSize={20} showBackButton />
        <ActivityIndicator color={Colors.accent} style={{ marginTop: 40 }} />
      </View>
    );
  }

  const failedLast = saved.lastError && (!saved.lastChangedAt || (saved.lastErrorAt ?? 0) > saved.lastChangedAt);
  const status = !saved.enabled
    ? saved.source
      ? `Off · ${saved.source.name}, ${intervalLabel(saved.intervalHours).toLowerCase()}`
      : "Off"
    : failedLast
      ? `Last try failed: ${saved.lastError}`
      : saved.lastChangedAt
        ? `Changed ${ago(saved.lastChangedAt)} · next ${inAbout(saved.lastChangedAt + saved.intervalHours * 3600_000)}`
        : "On";
  const isPreset = !custom && PRESET_HOURS.includes(draft.intervalHours);
  const changed = {
    source: !sameSource(saved.source, draft.source),
    interval: saved.intervalHours !== draft.intervalHours,
    target: saved.target !== draft.target,
  };

  return (
    <View style={styles.container}>
      <Header title="Wallpaper changer" logo={false} titleFontSize={20} showBackButton />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomPadding + (dirty ? 120 : 32) }]}
        showsVerticalScrollIndicator={false}
      >
        {/* On / off (acts immediately) */}
        <Pressable
          onPress={() => void toggle()}
          disabled={busy !== null}
          style={({ pressed }) => [styles.hero, saved.enabled && styles.heroOn, pressed && { opacity: 0.9 }]}
          accessibilityRole="switch"
          accessibilityState={{ checked: saved.enabled, busy: busy === "toggle" }}
        >
          <View style={styles.heroIcon}>
            <Ionicons name="sync" size={22} color={Colors.accent} />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={styles.heroTitle}>Change my wallpaper automatically</Text>
            <Text style={[styles.heroStatus, failedLast && saved.enabled ? styles.errorText : null]} numberOfLines={2}>
              {status}
            </Text>
          </View>
          {busy === "toggle" ? (
            <ActivityIndicator color={Colors.accent} />
          ) : (
            <View style={[styles.switch, saved.enabled && styles.switchOn]}>
              <View style={[styles.knob, saved.enabled && styles.knobOn]} />
            </View>
          )}
        </Pressable>

        {saved.enabled ? (
          batteryOk ? (
            <View style={styles.okRow}>
              <Ionicons name="checkmark-circle" size={16} color={Colors.accent} />
              <Text style={styles.okText}>Background activity allowed.</Text>
              <Pressable onPress={openAppSettings} hitSlop={6}>
                <Text style={styles.linkSmall}>Change</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={() => setPermissionOpen(true)} style={({ pressed }) => [styles.warnRow, pressed && { opacity: 0.85 }]}>
              <Ionicons name="alert-circle" size={18} color="#E8B04A" />
              <Text style={styles.warnText}>Aurora may be paused in the background. Tap to allow.</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
            </Pressable>
          )
        ) : null}

        <SettingsSection title={changed.source ? "Wallpapers from · edited" : "Wallpapers from"}>
          <SettingsRow
            icon={draft.source?.kind === "liked" ? "heart-outline" : draft.source?.kind === "collection" ? "albums-outline" : "grid-outline"}
            label={busy === "source" ? "Loading…" : draft.source ? draft.source.name : "Choose a source"}
            value={draft.source ? `${draft.pool.length} wallpapers` : undefined}
            onPress={() => setPickerOpen(true)}
          />
        </SettingsSection>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{changed.interval ? "How often · edited" : "How often"}</Text>
          <View style={styles.chips}>
            {PRESET_HOURS.map((h) => {
              const on = isPreset && draft.intervalHours === h;
              return (
                <Pressable
                  key={h}
                  onPress={() => {
                    setCustom(false);
                    setHours(h, true);
                  }}
                  style={[styles.chip, on && styles.chipOn]}
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{intervalLabel(h)}</Text>
                </Pressable>
              );
            })}
            <Pressable
              onPress={() => {
                setCustom(true);
                if (draft.intervalHours < MIN_HOURS) setHours(MIN_HOURS);
              }}
              style={[styles.chip, !isPreset && styles.chipOn]}
              accessibilityState={{ selected: !isPreset }}
            >
              <Text style={[styles.chipText, !isPreset && styles.chipTextOn]}>Custom</Text>
            </Pressable>
          </View>
          {!isPreset ? (
            <View style={styles.stepper}>
              <Pressable
                onPress={() => setHours(draft.intervalHours - 1)}
                disabled={draft.intervalHours <= MIN_HOURS}
                style={[styles.stepBtn, draft.intervalHours <= MIN_HOURS && styles.dim]}
                accessibilityLabel="One hour less"
              >
                <Ionicons name="remove" size={20} color={Colors.textPrimary} />
              </Pressable>
              <Text style={styles.stepValue}>Every {draft.intervalHours} hours</Text>
              <Pressable
                onPress={() => setHours(draft.intervalHours + 1)}
                disabled={draft.intervalHours >= MAX_HOURS}
                style={[styles.stepBtn, draft.intervalHours >= MAX_HOURS && styles.dim]}
                accessibilityLabel="One hour more"
              >
                <Ionicons name="add" size={20} color={Colors.textPrimary} />
              </Pressable>
            </View>
          ) : null}
          <Text style={styles.note}>Android picks the exact moment, so a change can come a little later than set.</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{changed.target ? "Apply to · edited" : "Apply to"}</Text>
          <View style={styles.segment}>
            {TARGETS.map((t) => {
              const on = draft.target === t.value;
              return (
                <Pressable
                  key={t.value}
                  onPress={() => setDraft((d) => (d ? { ...d, target: t.value } : d))}
                  style={[styles.segItem, on && styles.segOn]}
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[styles.segText, on && styles.segTextOn]}>{t.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Pressable
          onPress={() => void changeNow()}
          disabled={!saved.source || dirty || busy !== null}
          style={({ pressed }) => [styles.secondaryBtn, (!saved.source || dirty || busy !== null) && styles.dim, pressed && { opacity: 0.85 }]}
        >
          {busy === "change" ? (
            <ActivityIndicator color={Colors.textPrimary} />
          ) : (
            <>
              <Ionicons name="shuffle" size={18} color={Colors.textPrimary} />
              <Text style={styles.secondaryText}>Change now</Text>
            </>
          )}
        </Pressable>
        {dirty ? <Text style={[styles.note, { textAlign: "center" }]}>Save your changes to use them.</Text> : null}

        {__DEV__ ? (
          <SettingsSection title="Developer (dev builds only)">
            <SettingsRow
              icon="flask-outline"
              label="Test background change in 1 min"
              onPress={async () => {
                if (!saved.enabled) {
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

      {/* Edit mode: appears only when something changed */}
      {dirty ? (
        <View style={[styles.saveBar, { paddingBottom: Math.max(bottomPadding, 12) + 8 }]}>
          <Pressable onPress={discard} disabled={busy === "save"} style={({ pressed }) => [styles.barSecondary, pressed && { opacity: 0.8 }]}>
            <Text style={styles.barSecondaryText}>Discard</Text>
          </Pressable>
          <Pressable onPress={() => void save()} disabled={busy === "save"} style={({ pressed }) => [styles.barPrimary, pressed && { opacity: 0.85 }]}>
            {busy === "save" ? <ActivityIndicator color="#0A0A0A" /> : <Text style={styles.barPrimaryText}>Save changes</Text>}
          </Pressable>
        </View>
      ) : null}

      <SourcePicker
        visible={pickerOpen}
        onClose={() => {
          pendingEnableRef.current = false;
          setPickerOpen(false);
        }}
        onPick={(s) => void pickSource(s)}
        current={draft.source}
        signedIn={!!user}
        collections={collections ?? []}
        screen={screen}
      />

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
        <Pressable onPress={() => void askBackgroundPermission()} style={({ pressed }) => [styles.barPrimary, styles.permBtn, pressed && { opacity: 0.85 }]}>
          <Text style={styles.barPrimaryText}>Open settings</Text>
        </Pressable>
        <Pressable onPress={() => setPermissionOpen(false)} style={styles.permLater} hitSlop={6}>
          <Text style={styles.permLaterText}>Not now</Text>
        </Pressable>
        <Text style={styles.permFoot}>
          On some phones (vivo, Xiaomi, Oppo, Realme) also turn on “Allow background activity” under Battery in{" "}
          <Text style={styles.linkSmall} onPress={openAppSettings}>
            Aurora&apos;s app settings
          </Text>
          . You can turn it off there any time.
        </Text>
      </Sheet>

      <ConfirmModal
        visible={!!leaveAction}
        title="Discard changes?"
        message="Your edits to the wallpaper changer haven't been saved."
        confirmText="Discard"
        onCancel={() => setLeaveAction(null)}
        onConfirm={() => {
          const action = leaveAction;
          setLeaveAction(null);
          dirtyRef.current = false;
          navigation.dispatch(action);
        }}
      />
    </View>
  );
};

function SourcePicker({
  visible,
  onClose,
  onPick,
  current,
  signedIn,
  collections,
  screen,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (s: ChangerSource) => void;
  current: ChangerSource | null;
  signedIn: boolean;
  collections: { id: string; title: string; wallpaperCount: number }[];
  screen: "mobile" | "tablet";
}) {
  const [categories, setCategories] = useState<Category[] | null>(null);
  useEffect(() => {
    if (!visible || categories) return;
    getCategories(screen)
      .then(setCategories)
      .catch(() => setCategories([]));
  }, [visible, categories, screen]);

  const option = (source: ChangerSource, icon: keyof typeof Ionicons.glyphMap, key: string, meta?: string) => {
    const on = sameSource(current, source);
    return (
      <Pressable key={key} onPress={() => onPick(source)} style={({ pressed }) => [styles.option, on && styles.optionOn, pressed && { opacity: 0.85 }]}>
        <Ionicons name={icon} size={18} color={on ? Colors.accent : Colors.textSecondary} />
        <Text style={styles.optionText} numberOfLines={1}>
          {source.name}
        </Text>
        {meta ? <Text style={styles.optionMeta}>{meta}</Text> : null}
        {on ? <Ionicons name="checkmark" size={18} color={Colors.accent} /> : null}
      </Pressable>
    );
  };

  return (
    <Sheet visible={visible} onClose={onClose}>
      <Text style={styles.sheetTitle}>Wallpapers from</Text>
      <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ gap: 6, paddingBottom: 4 }}>
        {signedIn ? (
          <>
            <Text style={styles.groupTitle}>Your library</Text>
            {option({ kind: "liked", name: "Liked" }, "heart-outline", "liked")}
            {collections.map((c) => option({ kind: "collection", id: c.id, name: c.title }, "albums-outline", c.id, String(c.wallpaperCount)))}
          </>
        ) : (
          <Text style={styles.note}>Sign in to use your Liked wallpapers or collections.</Text>
        )}
        <Text style={styles.groupTitle}>Categories</Text>
        {categories === null ? (
          <ActivityIndicator color={Colors.accent} style={{ marginVertical: 12 }} />
        ) : (
          categories.map((c) =>
            option({ kind: "category", slug: c.slug, name: c.name }, "grid-outline", c.id, c.wallpaperCount ? String(c.wallpaperCount) : undefined)
          )
        )}
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  content: { paddingHorizontal: 16, paddingTop: 6, gap: 22 },
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgElevated,
  },
  heroOn: { borderColor: "rgba(129, 238, 78, 0.35)" },
  heroIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: Colors.accentMuted },
  heroTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: "800" },
  heroStatus: { color: Colors.textSecondary, fontSize: 13 },
  errorText: { color: "#F06464" },
  switch: { width: 46, height: 28, borderRadius: 14, backgroundColor: Colors.borderHover, padding: 3, justifyContent: "center" },
  switchOn: { backgroundColor: Colors.accent },
  knob: { width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.textPrimary },
  knobOn: { alignSelf: "flex-end", backgroundColor: "#0A0A0A" },
  okRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: -12, paddingHorizontal: 6 },
  okText: { flex: 1, color: Colors.textSecondary, fontSize: 13 },
  warnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: -10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(232, 176, 74, 0.35)",
    backgroundColor: "rgba(232, 176, 74, 0.07)",
  },
  warnText: { flex: 1, color: Colors.textPrimary, fontSize: 13, fontWeight: "600" },
  section: { gap: 10 },
  sectionTitle: { color: Colors.textMuted, fontSize: 12, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase", paddingHorizontal: 6 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: Colors.borderHover, backgroundColor: Colors.bgElevated },
  chipOn: { borderColor: "rgba(129, 238, 78, 0.5)", backgroundColor: Colors.accentMuted },
  chipText: { color: Colors.textSecondary, fontSize: 14, fontWeight: "700" },
  chipTextOn: { color: Colors.accent },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgElevated,
  },
  stepBtn: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.06)" },
  stepValue: { color: Colors.textPrimary, fontSize: 16, fontWeight: "800" },
  dim: { opacity: 0.35 },
  note: { color: Colors.textMuted, fontSize: 12, lineHeight: 17, paddingHorizontal: 6 },
  segment: { flexDirection: "row", padding: 4, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: Colors.border },
  segItem: { flex: 1, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  segOn: { backgroundColor: "rgba(255,255,255,0.10)", borderWidth: 1, borderColor: Colors.borderHover },
  segText: { color: Colors.textSecondary, fontSize: 14, fontWeight: "700" },
  segTextOn: { color: Colors.textPrimary },
  secondaryBtn: {
    height: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.borderHover,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: { color: Colors.textPrimary, fontSize: 15, fontWeight: "700" },
  saveBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: Colors.bgBar,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  barSecondary: { flex: 1, height: 50, borderRadius: 14, borderWidth: 1, borderColor: Colors.borderHover, alignItems: "center", justifyContent: "center" },
  barSecondaryText: { color: Colors.textPrimary, fontSize: 15, fontWeight: "700" },
  barPrimary: { flex: 1.4, height: 50, borderRadius: 14, backgroundColor: Colors.accent, alignItems: "center", justifyContent: "center" },
  barPrimaryText: { color: "#0A0A0A", fontSize: 15, fontWeight: "800" },
  permIcon: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", backgroundColor: Colors.accentMuted, marginBottom: 12 },
  permTitle: { color: Colors.textPrimary, fontSize: 19, fontWeight: "800", marginBottom: 8 },
  permText: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20 },
  permSteps: { gap: 4, marginTop: 12, marginBottom: 16 },
  permStep: { color: Colors.textPrimary, fontSize: 14, fontWeight: "600" },
  permBtn: { flex: 0, alignSelf: "stretch" },
  permLater: { alignSelf: "center", paddingVertical: 12 },
  permLaterText: { color: Colors.textSecondary, fontSize: 14, fontWeight: "700" },
  permFoot: { color: Colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 4 },
  linkSmall: { color: Colors.accent, fontSize: 13, fontWeight: "700" },
  sheetTitle: { color: Colors.textPrimary, fontSize: 20, fontWeight: "800", marginBottom: 12 },
  groupTitle: { color: Colors.textMuted, fontSize: 12, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase", marginTop: 8, marginBottom: 2 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 48,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: Colors.cardSurface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  optionOn: { borderColor: "rgba(129, 238, 78, 0.45)" },
  optionText: { flex: 1, color: Colors.textPrimary, fontSize: 15, fontWeight: "600" },
  optionMeta: { color: Colors.textMuted, fontSize: 13 },
});

export default WallpaperChanger;
