import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, BackHandler, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import ActionSheet, { SheetAction } from "../../components/ActionSheet";
import CollectionForm from "../../components/CollectionForm";
import ConfirmModal from "../../components/ConfirmModal";
import Header from "../../components/Header";
import MasonryFeed from "../../components/MasonryFeed";
import Sheet from "../../components/Sheet";
import { Colors } from "../../constants";
import { useInsets } from "../../hooks/useInsets";
import { ApiError, WallpaperTile } from "../../lib/api";
import { useAuth } from "../../lib/AuthContext";
import { CollectionDetails, getCollection } from "../../lib/collectionsApi";
import { useCollectionActions, useCollections } from "../../lib/CollectionsContext";
import { useToast } from "../../lib/ToastContext";
import { useFeed } from "../../lib/useFeed";

const UNDO_WINDOW = 4000;

/**
 * One collection's wallpapers. The owner gets a ⋯ menu (edit, select, delete) and can
 * long-press to select wallpapers and remove them, with Undo.
 */
const CollectionScreen = () => {
  const { id, title } = useLocalSearchParams<{ id: string; title?: string }>();
  const { user } = useAuth();
  const { showToast, hideToast } = useToast();
  const { bottomPadding } = useInsets();
  const { collections, revisions } = useCollections();
  const { deleteCollection, removeFromCollection } = useCollectionActions();

  const [fetched, setFetched] = useState<CollectionDetails["collection"] | null>(null);
  /** Opened from a link to a collection that's private (someone else's) or was deleted. */
  const [unavailable, setUnavailable] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [selected, setSelected] = useState<Set<string> | null>(null); // null = not selecting
  const [hidden, setHidden] = useState<Set<string>>(new Set()); // removed, waiting out the Undo window

  // Reload when this collection changed elsewhere (e.g. saved from a wallpaper opened from here).
  const revisionRef = useRef(revisions[id] ?? 0);
  revisionRef.current = revisions[id] ?? 0;
  const loadedRevision = useRef(revisionRef.current);
  const fetchPage = useCallback(async () => {
    loadedRevision.current = revisionRef.current;
    try {
      const res = await getCollection(id);
      setFetched(res.collection);
      setUnavailable(false);
      return { data: res.wallpapers, hasMore: false };
    } catch (e) {
      if (e instanceof ApiError && [400, 401, 403, 404].includes(e.status)) {
        setUnavailable(true);
        return { data: [], hasMore: false };
      }
      throw e;
    }
  }, [id]);
  const feed = useFeed(fetchPage, id, 1000);
  const { reload } = feed;
  useFocusEffect(
    useCallback(() => {
      if (revisionRef.current !== loadedRevision.current) void reload();
    }, [reload])
  );

  // Name, privacy and description come from the shared store when it has this collection,
  // so edits show up immediately.
  const stored = collections?.find((c) => c.id === id);
  const info = fetched ? { ...fetched, ...(stored ? { title: stored.title, description: stored.description, isPublic: stored.isPublic } : {}) } : null;
  const isOwner = !!user && !!fetched && fetched.userId === user.id;

  const items = useMemo(() => (hidden.size ? feed.items.filter((w) => !hidden.has(w.id)) : feed.items), [feed.items, hidden]);
  const visibleFeed = useMemo(() => ({ ...feed, items }), [feed, items]);

  // ─── Removal with Undo: hide now, commit after the Undo window (or when leaving). ───
  const pending = useRef<{ ids: string[]; timer: ReturnType<typeof setTimeout> } | null>(null);

  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    []
  );
  const unhide = useCallback(
    (ids: string[]) =>
      setHidden((h) => {
        const n = new Set(h);
        ids.forEach((x) => n.delete(x));
        return n;
      }),
    []
  );

  const commitPending = useCallback(() => {
    const p = pending.current;
    if (!p) return;
    clearTimeout(p.timer);
    pending.current = null;
    removeFromCollection(id, p.ids)
      // Reload so the list matches the server, then stop hiding (they're gone now).
      .then(() => (mounted.current ? reload().then(() => unhide(p.ids)) : undefined))
      .catch(() => {
        if (!mounted.current) return;
        void reload().then(() => unhide(p.ids));
        showToast("Couldn't remove some wallpapers. Try again.", { type: "error", position: "top" });
      });
  }, [id, removeFromCollection, reload, unhide, showToast]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s !== "active") commitPending();
    });
    return () => {
      sub.remove();
      // Leaving the screen: finish the removal now; its Undo can no longer apply.
      if (pending.current) hideToast();
      commitPending();
    };
  }, [commitPending, hideToast]);

  const removeSelected = () => {
    if (!selected?.size) return;
    commitPending(); // finish any earlier removal first
    const ids = [...selected];
    setHidden((h) => new Set([...h, ...ids]));
    setSelected(null);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    pending.current = { ids, timer: setTimeout(commitPending, UNDO_WINDOW) };
    showToast(ids.length === 1 ? "Removed from collection" : `Removed ${ids.length} wallpapers`, {
      type: "success",
      duration: UNDO_WINDOW,
      action: {
        label: "Undo",
        onPress: () => {
          const p = pending.current;
          if (!p) return;
          clearTimeout(p.timer);
          pending.current = null;
          unhide(p.ids);
        },
      },
    });
  };

  // ─── Selection mode ───
  const startSelecting = useCallback((w?: WallpaperTile) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    setSelected(new Set(w ? [w.id] : []));
  }, []);
  const toggleSelected = useCallback((w: WallpaperTile) => {
    void Haptics.selectionAsync().catch(() => undefined);
    setSelected((s) => {
      const n = new Set(s ?? []);
      if (n.has(w.id)) n.delete(w.id);
      else n.add(w.id);
      return n;
    });
  }, []);

  // Android back leaves selection mode instead of the screen.
  useFocusEffect(
    useCallback(() => {
      if (!selected) return;
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        setSelected(null);
        return true;
      });
      return () => sub.remove();
    }, [selected])
  );

  const onDelete = async () => {
    setConfirmDelete(false);
    try {
      await deleteCollection(id);
      showToast("Collection deleted", { type: "success", position: "top" });
      router.back();
    } catch {
      showToast("Couldn't delete the collection. Try again.", { type: "error", position: "top" });
    }
  };

  const count = Math.max(0, (info?.wallpaperCount ?? items.length) - hidden.size);
  const menu: SheetAction[] = [
    { key: "edit", label: "Edit details", icon: "create-outline", onPress: () => setEditOpen(true) },
    ...(items.length
      ? [{ key: "select", label: "Select wallpapers", icon: "checkmark-circle-outline" as const, onPress: () => startSelecting() }]
      : []),
    { key: "delete", label: "Delete collection", icon: "trash-outline", destructive: true, onPress: () => setConfirmDelete(true) },
  ];

  const header = info ? (
    <View style={styles.about}>
      <View style={styles.metaRow}>
        <Ionicons name={info.isPublic ? "globe-outline" : "lock-closed-outline"} size={13} color={Colors.textMuted} />
        <Text style={styles.meta}>
          {info.isPublic ? "Public" : "Private"} · {count} {count === 1 ? "wallpaper" : "wallpapers"}
        </Text>
      </View>
      {info.description ? <Text style={styles.description}>{info.description}</Text> : null}
      {isOwner && items.length > 0 && !selected ? <Text style={styles.tip}>Long-press a wallpaper to select and remove.</Text> : null}
    </View>
  ) : null;

  return (
    <View style={styles.container}>
      {selected ? (
        <Header
          title={selected.size ? `${selected.size} selected` : "Select wallpapers"}
          logo={false}
          titleFontSize={20}
          rightElement={
            <Pressable onPress={() => setSelected(null)} hitSlop={10} style={styles.textBtn} accessibilityLabel="Cancel selection">
              <Text style={styles.textBtnLabel}>Cancel</Text>
            </Pressable>
          }
        />
      ) : (
        <Header
          title={info?.title ?? title ?? ""}
          logo={false}
          titleFontSize={20}
          showBackButton
          rightElement={
            isOwner ? (
              <Pressable onPress={() => setMenuOpen(true)} hitSlop={10} accessibilityLabel="Collection options" style={styles.iconBtn}>
                <Ionicons name="ellipsis-horizontal" size={24} color={Colors.textPrimary} />
              </Pressable>
            ) : null
          }
        />
      )}

      <MasonryFeed
        feed={visibleFeed}
        header={header}
        emptyIcon={unavailable ? "lock-closed-outline" : "albums-outline"}
        emptyText={
          unavailable
            ? "This collection is private or no longer exists."
            : "Nothing here yet. Open a wallpaper and tap the bookmark, or long-press any wallpaper in a grid."
        }
        selectedIds={selected}
        onItemPress={selected ? toggleSelected : undefined}
        onItemLongPress={isOwner ? (selected ? toggleSelected : startSelecting) : undefined}
      />

      {selected ? (
        <View style={[styles.selectBar, { paddingBottom: Math.max(bottomPadding, 12) + 8 }]}>
          <Pressable
            onPress={() => setSelected(selected.size === items.length ? new Set() : new Set(items.map((w) => w.id)))}
            style={({ pressed }) => [styles.barSecondary, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.barSecondaryText}>{selected.size === items.length ? "Clear" : "Select all"}</Text>
          </Pressable>
          <Pressable
            onPress={removeSelected}
            disabled={!selected.size}
            style={({ pressed }) => [styles.barDanger, !selected.size && { opacity: 0.4 }, pressed && { opacity: 0.85 }]}
            accessibilityLabel={`Remove ${selected.size} from collection`}
          >
            <Ionicons name="remove-circle-outline" size={18} color="#fff" />
            <Text style={styles.barDangerText}>Remove{selected.size ? ` (${selected.size})` : ""}</Text>
          </Pressable>
        </View>
      ) : null}

      <ActionSheet visible={menuOpen} onClose={() => setMenuOpen(false)} title={info?.title} actions={menu} />

      <Sheet visible={editOpen} onClose={() => setEditOpen(false)}>
        <Text style={styles.sheetTitle}>Edit collection</Text>
        {info ? (
          <CollectionForm
            mode="edit"
            collection={info}
            onCancel={() => setEditOpen(false)}
            onDone={() => {
              setEditOpen(false);
              showToast("Collection updated", { type: "success", position: "top" });
            }}
          />
        ) : null}
      </Sheet>

      <ConfirmModal
        visible={confirmDelete}
        title="Delete this collection?"
        message="The collection is removed. The wallpapers in it stay on Aurora."
        confirmText="Delete"
        onConfirm={onDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  about: { paddingHorizontal: 16, paddingTop: 2, gap: 6 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  meta: { color: Colors.textMuted, fontSize: 13 },
  description: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20 },
  tip: { color: Colors.textMuted, fontSize: 12 },
  iconBtn: { padding: 4 },
  textBtn: { paddingHorizontal: 4, paddingVertical: 4 },
  textBtnLabel: { color: Colors.accent, fontSize: 15, fontWeight: "700" },
  selectBar: {
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
  barSecondary: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderHover,
    alignItems: "center",
    justifyContent: "center",
  },
  barSecondaryText: { color: Colors.textPrimary, fontSize: 15, fontWeight: "700" },
  barDanger: {
    flex: 1.4,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#D94848",
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  barDangerText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  sheetTitle: { color: Colors.textPrimary, fontSize: 20, fontWeight: "800", marginBottom: 14 },
});

export default CollectionScreen;
