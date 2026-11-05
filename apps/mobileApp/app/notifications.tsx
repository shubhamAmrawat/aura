import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, DeviceEventEmitter, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useFonts } from "expo-font";
import Header from "../components/Header";
import { Colors } from "../constants";
import { useInsets } from "../hooks/useInsets";
import { useAuth } from "../lib/AuthContext";
import { useScreenFilter } from "../lib/ScreenFilterContext";
import { getInbox, isEnded, markSeen, timeAgo, typeLabel, type InboxItem } from "../lib/notifications";
import { NOTIFICATIONS_SEEN } from "../lib/notificationEvents";
import { openNotificationUrl } from "../lib/usePushSetup";

const SERIF = "InstrumentSerif";
type Filter = "all" | "drops" | "uploads" | "account";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "drops", label: "Drops" },
  { key: "uploads", label: "Your uploads" },
  { key: "account", label: "Account" },
];
const inFilter = (f: Filter, t: string) =>
  f === "all" ||
  (f === "drops" && (t === "drop" || t === "daily")) ||
  (f === "uploads" && (t === "upload_live" || t === "upload_rejected" || t === "milestone")) ||
  (f === "account" && !["drop", "daily", "upload_live", "upload_rejected", "milestone"].includes(t));

/** Inbox: drops, daily picks and app news for everyone; your uploads and reports when signed in. */
export default function NotificationsScreen() {
  const [fontsLoaded] = useFonts({ [SERIF]: require("../assets/fonts/InstrumentSerif-Regular.ttf") });
  const serif = fontsLoaded ? { fontFamily: SERIF, fontWeight: "400" as const } : { fontWeight: "700" as const };
  const { user } = useAuth();
  const signedIn = !!user;
  const { screen } = useScreenFilter();
  const { bottomPadding } = useInsets();
  const [items, setItems] = useState<InboxItem[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [seenBefore, setSeenBefore] = useState(0);
  const [filter, setFilter] = useState<Filter>("all");
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    try {
      const page = await getInbox(screen, signedIn);
      setItems(page.data);
      setHasMore(page.hasMore);
      setSeenBefore(new Date(page.seenAt).getTime());
      await markSeen(signedIn);
      DeviceEventEmitter.emit(NOTIFICATIONS_SEEN);
    } catch {
      setError(true);
    }
  }, [screen, signedIn]);

  useEffect(() => {
    void load();
  }, [load]);

  const more = async () => {
    const last = items?.[items.length - 1];
    if (!hasMore || !last || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await getInbox(screen, signedIn, last.createdAt);
      setItems((prev) => [...(prev ?? []), ...page.data]);
      setHasMore(page.hasMore);
    } catch {
      /* keep what we have */
    } finally {
      setLoadingMore(false);
    }
  };

  const shown = (items ?? []).filter((n) => inFilter(filter, n.type));

  return (
    <View style={styles.container}>
      <Header title="" logo={false} showBackButton />
      <FlatList
        data={shown}
        keyExtractor={(n) => n.id}
        onEndReached={() => void more()}
        onEndReachedThreshold={0.4}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={Colors.accent} colors={[Colors.accent]} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: bottomPadding + 32, gap: 6 }}
        ListHeaderComponent={
          <View style={{ gap: 12, paddingHorizontal: 4, paddingBottom: 8 }}>
            <Text style={[styles.title, serif]}>Notifications</Text>
            <View style={styles.filters}>
              {FILTERS.map((f) => (
                <Pressable
                  key={f.key}
                  onPress={() => setFilter(f.key)}
                  style={[styles.chip, filter === f.key && styles.chipOn]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: filter === f.key }}
                >
                  <Text style={[styles.chipText, filter === f.key && styles.chipTextOn]}>{f.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        }
        ListEmptyComponent={
          items === null && !error ? (
            <ActivityIndicator color={Colors.accent} style={{ marginTop: 60 }} />
          ) : (
            <View style={styles.empty}>
              <Ionicons name={error ? "cloud-offline-outline" : "notifications-outline"} size={34} color={Colors.textMuted} />
              <Text style={styles.emptyText}>{error ? "Couldn't load notifications. Pull to try again." : "Nothing here yet. New drops and updates show up here."}</Text>
            </View>
          )
        }
        ListFooterComponent={loadingMore ? <ActivityIndicator color={Colors.accent} style={{ marginVertical: 16 }} /> : null}
        renderItem={({ item }) => <Row n={item} unread={new Date(item.createdAt).getTime() > seenBefore} />}
      />
    </View>
  );
}

function Row({ n, unread: isNew }: { n: InboxItem; unread: boolean }) {
  const t = typeLabel(n.type);
  const ended = isEnded(n);
  const unread = isNew && !ended;
  const isDrop = n.type === "drop";
  const accent = isDrop ? "#FF9A3C" : Colors.accent;
  return (
    <Pressable
      onPress={() => openNotificationUrl(n.url)}
      style={({ pressed }) => [
        styles.row,
        unread && (isDrop ? styles.rowDrop : styles.rowUnread),
        ended && { opacity: 0.6 },
        pressed && { opacity: 0.85 },
      ]}
      accessibilityRole="button"
    >
      {n.imageUrl ? (
        <Image source={n.imageUrl} style={[styles.thumb, !unread && { opacity: 0.8 }]} contentFit="cover" transition={150} />
      ) : (
        <View style={[styles.thumb, styles.thumbIcon]}>
          <Ionicons name={n.type === "report_reviewed" ? "shield-checkmark-outline" : "notifications-outline"} size={20} color={Colors.textSecondary} />
        </View>
      )}
      <View style={{ flex: 1, gap: 4 }}>
        <View style={styles.metaRow}>
          <Text style={[styles.kicker, { color: ended ? Colors.textMuted : t.color }]}>{t.label}</Text>
          <Text style={styles.time}>· {timeAgo(n.createdAt)}</Text>
          {ended ? (
            <View style={styles.endedPill}>
              <Text style={styles.endedText}>ENDED</Text>
            </View>
          ) : null}
          {unread ? <View style={[styles.dot, { backgroundColor: accent }]} accessibilityLabel="Unread" /> : null}
        </View>
        <Text style={[styles.rowTitle, !unread && { color: "#DDD9D3", fontWeight: "600" }]}>{n.title}</Text>
        {n.body ? <Text style={styles.rowBody} numberOfLines={3}>{n.body}</Text> : null}
        {n.actions.length && !ended ? (
          <View style={styles.actions}>
            {n.actions.slice(0, 2).map((a, i) => (
              <Pressable
                key={a.id}
                onPress={() => openNotificationUrl(a.url)}
                style={({ pressed }) => [styles.action, i === 0 ? { backgroundColor: accent } : styles.actionGhost, pressed && { opacity: 0.85 }]}
                accessibilityRole="button"
              >
                <Text style={[styles.actionText, i === 0 ? { color: isDrop ? "#1A0E04" : "#0A0A0A" } : { color: Colors.textPrimary }]}>{a.label}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  endedPill: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.08)" },
  endedText: { color: Colors.textSecondary, fontSize: 9.5, fontWeight: "800", letterSpacing: 0.6 },
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  title: { color: Colors.textPrimary, fontSize: 34, lineHeight: 38 },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { height: 34, paddingHorizontal: 14, borderRadius: 17, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", backgroundColor: "#0E0E0E", justifyContent: "center" },
  chipOn: { backgroundColor: Colors.textPrimary, borderColor: Colors.textPrimary },
  chipText: { color: "#C9C5BF", fontSize: 13, fontWeight: "600" },
  chipTextOn: { color: "#0A0A0A", fontWeight: "700" },
  row: { flexDirection: "row", gap: 12, padding: 12, borderRadius: 20, backgroundColor: "#0A0A0A" },
  rowUnread: { backgroundColor: "#0E0E0E", borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" },
  rowDrop: { backgroundColor: "#121010", borderWidth: 1, borderColor: "rgba(255,154,60,0.28)" },
  thumb: { width: 52, height: 68, borderRadius: 10, backgroundColor: Colors.bgElevated },
  thumbIcon: { height: 52, alignItems: "center", justifyContent: "center" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  kicker: { fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  time: { color: Colors.textMuted, fontSize: 11.5 },
  dot: { marginLeft: "auto", width: 8, height: 8, borderRadius: 4 },
  rowTitle: { color: Colors.textPrimary, fontSize: 14.5, fontWeight: "700" },
  rowBody: { color: "#A9A59F", fontSize: 13, lineHeight: 18 },
  actions: { flexDirection: "row", gap: 8, marginTop: 6 },
  action: { height: 32, paddingHorizontal: 14, borderRadius: 16, justifyContent: "center" },
  actionGhost: { backgroundColor: "rgba(255,255,255,0.08)" },
  actionText: { fontSize: 12.5, fontWeight: "800" },
  empty: { alignItems: "center", gap: 10, marginTop: 70, paddingHorizontal: 40 },
  emptyText: { color: Colors.textMuted, fontSize: 13.5, textAlign: "center", lineHeight: 19 },
});
