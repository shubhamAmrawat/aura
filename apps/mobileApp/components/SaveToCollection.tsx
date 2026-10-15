import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Colors } from "../constants";
import {
  addToCollection,
  CollectionCheck,
  getCollectionsForWallpaper,
  removeFromCollection,
} from "../lib/collectionsApi";
import NewCollectionForm from "./NewCollectionForm";

type Props = {
  wallpaperId: string;
  /** Shows a back arrow when the view sits inside another sheet. */
  onBack?: () => void;
  /** Called whenever "is this wallpaper in any of my collections?" changes. */
  onSavedChange?: (saved: boolean) => void;
  /** Called shortly after a successful save, so the sheet can close itself. */
  onDone?: () => void;
};

/** Tick the collections this wallpaper belongs in, or make a new one. */
const SaveToCollection = ({ wallpaperId, onBack, onSavedChange, onDone }: Props) => {
  // After a save, close the sheet ~1.5 s later; any further tap in the sheet cancels that.
  const doneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelDone = () => {
    if (doneTimer.current) clearTimeout(doneTimer.current);
    doneTimer.current = null;
  };
  const scheduleDone = () => {
    cancelDone();
    if (onDone) doneTimer.current = setTimeout(onDone, 1500);
  };
  useEffect(() => cancelDone, []);

  // Feedback shows inside the sheet: a Modal sits above the app's toast layer, so toasts would be hidden.
  const [status, setStatus] = useState<{ text: string; error?: boolean } | null>(null);
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const say = (text: string, error = false) => {
    if (statusTimer.current) clearTimeout(statusTimer.current);
    setStatus({ text, error });
    statusTimer.current = setTimeout(() => setStatus(null), 2200);
  };
  useEffect(() => () => {
    if (statusTimer.current) clearTimeout(statusTimer.current);
  }, []);
  const [rows, setRows] = useState<CollectionCheck[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [creating, setCreating] = useState(false);
  const [pending, setPending] = useState<Set<string>>(new Set());

  const load = useCallback(() => {
    setFailed(false);
    setRows(null);
    getCollectionsForWallpaper(wallpaperId)
      .then((r) => {
        setRows(r);
        if (r.length === 0) setCreating(true);
      })
      .catch(() => setFailed(true));
  }, [wallpaperId]);

  useEffect(load, [load]);

  const savedNow = rows ? rows.some((r) => r.hasWallpaper) : null;
  const onSavedChangeRef = useRef(onSavedChange);
  onSavedChangeRef.current = onSavedChange;
  useEffect(() => {
    if (savedNow !== null) onSavedChangeRef.current?.(savedNow);
  }, [savedNow]);

  const setBusy = (id: string, on: boolean) =>
    setPending((s) => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });

  const toggle = async (row: CollectionCheck) => {
    if (pending.has(row.id)) return;
    cancelDone();
    const next = !row.hasWallpaper;
    setBusy(row.id, true);
    setRows((rs) => rs?.map((r) => (r.id === row.id ? { ...r, hasWallpaper: next } : r)) ?? rs);
    void Haptics.selectionAsync().catch(() => undefined);
    try {
      if (next) await addToCollection(row.id, wallpaperId);
      else await removeFromCollection(row.id, wallpaperId);
      say(next ? `Saved to ${row.title}` : `Removed from ${row.title}`);
      if (next) scheduleDone();
    } catch {
      setRows((rs) => rs?.map((r) => (r.id === row.id ? { ...r, hasWallpaper: !next } : r)) ?? rs);
      say("Couldn't update the collection. Try again.", true);
    } finally {
      setBusy(row.id, false);
    }
  };

  const onCreated = async (c: { id: string; title: string; isPublic: boolean }) => {
    setCreating(false);
    setRows((rs) => [{ id: c.id, title: c.title, isPublic: c.isPublic, hasWallpaper: true }, ...(rs ?? [])]);
    setBusy(c.id, true);
    try {
      await addToCollection(c.id, wallpaperId);
      say(`Saved to ${c.title}`);
      scheduleDone();
    } catch {
      setRows((rs) => rs?.map((r) => (r.id === c.id ? { ...r, hasWallpaper: false } : r)) ?? rs);
      say("Collection created, but saving failed. Tap it to try again.", true);
    } finally {
      setBusy(c.id, false);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.titleRow}>
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={10} accessibilityLabel="Back" style={styles.back}>
            <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
          </Pressable>
        ) : null}
        <Text style={styles.title}>Save to collection</Text>
      </View>

      {status ? (
        <View style={[styles.status, status.error && styles.statusError]} accessibilityLiveRegion="polite">
          <Ionicons
            name={status.error ? "alert-circle" : "checkmark-circle"}
            size={16}
            color={status.error ? "#E45A5A" : Colors.accent}
          />
          <Text style={styles.statusText} numberOfLines={1}>
            {status.text}
          </Text>
        </View>
      ) : null}

      {failed ? (
        <Pressable onPress={load} style={styles.center}>
          <Text style={styles.muted}>Couldn't load your collections. Tap to retry.</Text>
        </Pressable>
      ) : rows === null ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.accent} />
        </View>
      ) : (
        <ScrollView style={styles.list} contentContainerStyle={{ gap: 8 }} keyboardShouldPersistTaps="handled">
          {creating ? (
            <View style={styles.formCard}>
              <NewCollectionForm onCreated={onCreated} onCancel={rows.length ? () => setCreating(false) : undefined} />
            </View>
          ) : (
            <Pressable onPress={() => { cancelDone(); setCreating(true); }} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
              <View style={[styles.box, styles.newBox]}>
                <Ionicons name="add" size={20} color={Colors.accent} />
              </View>
              <Text style={[styles.rowTitle, { color: Colors.accent }]}>New collection</Text>
            </Pressable>
          )}
          {rows.map((r) => (
            <Pressable
              key={r.id}
              onPress={() => toggle(r)}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: r.hasWallpaper, busy: pending.has(r.id) }}
            >
              <View style={[styles.box, r.hasWallpaper && styles.boxOn]}>
                {r.hasWallpaper ? <Ionicons name="checkmark" size={18} color="#0A0A0A" /> : null}
              </View>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {r.title}
              </Text>
              <Ionicons
                name={r.isPublic ? "globe-outline" : "lock-closed-outline"}
                size={16}
                color={Colors.textMuted}
                accessibilityLabel={r.isPublic ? "Public" : "Private"}
              />
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  back: { padding: 2 },
  title: { color: Colors.textPrimary, fontSize: 20, fontWeight: "800" },
  status: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: Colors.accentMuted,
    borderWidth: 1,
    borderColor: "rgba(129, 238, 78, 0.3)",
  },
  statusError: { backgroundColor: "rgba(228, 90, 90, 0.12)", borderColor: "rgba(228, 90, 90, 0.35)" },
  statusText: { flex: 1, color: Colors.textPrimary, fontSize: 13, fontWeight: "600" },
  center: { paddingVertical: 32, alignItems: "center" },
  muted: { color: Colors.textSecondary, fontSize: 14 },
  list: { maxHeight: 380 },
  formCard: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    backgroundColor: Colors.cardSurface,
    padding: 14,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.cardSurface,
  },
  pressed: { opacity: 0.8 },
  box: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: Colors.borderHover,
    alignItems: "center",
    justifyContent: "center",
  },
  boxOn: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  newBox: { borderColor: "rgba(129, 238, 78, 0.45)", borderStyle: "dashed" },
  rowTitle: { flex: 1, color: Colors.textPrimary, fontSize: 15, fontWeight: "600" },
});

export default SaveToCollection;
