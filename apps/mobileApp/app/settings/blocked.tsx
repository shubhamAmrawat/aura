import { useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import Header from "../../components/Header";
import { Colors } from "../../constants";
import { useInsets } from "../../hooks/useInsets";
import { useBlocks } from "../../lib/BlocksContext";
import { useToast } from "../../lib/ToastContext";
import type { BlockedCreator } from "../../lib/moderationApi";

/** Settings › Blocked creators: everyone the user blocked, with Unblock. */
const BlockedCreators = () => {
  const { blocked, unblock } = useBlocks();
  const { showToast } = useToast();
  const { bottomPadding } = useInsets();
  const [busyId, setBusyId] = useState<string | null>(null);

  const onUnblock = async (c: BlockedCreator) => {
    setBusyId(c.id);
    try {
      await unblock(c.id);
      showToast(`Unblocked @${c.username}.`, { type: "success", position: "top" });
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Couldn't unblock. Try again.", { type: "error", position: "top" });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View style={styles.container}>
      <Header title="Blocked creators" logo={false} titleFontSize={20} showBackButton />
      {blocked === null ? (
        <ActivityIndicator color={Colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={blocked}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ padding: 20, paddingBottom: bottomPadding + 24, flexGrow: 1 }}
          ListHeaderComponent={
            blocked.length ? <Text style={styles.note}>You don&apos;t see wallpapers from these creators. They aren&apos;t told when you block them.</Text> : null
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="ban-outline" size={30} color={Colors.textSecondary} />
              <Text style={styles.emptyText}>You haven&apos;t blocked anyone. To block a creator, open one of their wallpapers and tap ⋮.</Text>
            </View>
          }
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          renderItem={({ item }) => (
            <View style={styles.row}>
              {item.avatarUrl ? (
                <Image source={item.avatarUrl} style={styles.avatar} contentFit="cover" />
              ) : (
                <View style={[styles.avatar, styles.avatarEmpty]}>
                  <Text style={styles.initial}>{(item.displayName || item.username).slice(0, 1).toUpperCase()}</Text>
                </View>
              )}
              <View style={styles.names}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.displayName}
                </Text>
                <Text style={styles.handle} numberOfLines={1}>
                  @{item.username}
                </Text>
              </View>
              <Pressable
                onPress={() => void onUnblock(item)}
                disabled={busyId === item.id}
                style={({ pressed }) => [styles.unblock, pressed && { opacity: 0.8 }]}
                accessibilityLabel={`Unblock @${item.username}`}
              >
                {busyId === item.id ? <ActivityIndicator size="small" color={Colors.textPrimary} /> : <Text style={styles.unblockText}>Unblock</Text>}
              </Pressable>
            </View>
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  note: { color: Colors.textSecondary, fontSize: 13, marginBottom: 16, lineHeight: 18 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 24 },
  emptyText: { color: Colors.textSecondary, fontSize: 14, textAlign: "center", lineHeight: 20 },
  sep: { height: 1, backgroundColor: Colors.border },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarEmpty: { backgroundColor: Colors.bgElevated, alignItems: "center", justifyContent: "center" },
  initial: { color: Colors.textPrimary, fontSize: 17, fontWeight: "700" },
  names: { flex: 1, minWidth: 0 },
  name: { color: Colors.textPrimary, fontSize: 15, fontWeight: "600" },
  handle: { color: Colors.textSecondary, fontSize: 13, marginTop: 2 },
  unblock: { height: 36, minWidth: 88, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: Colors.borderHover, alignItems: "center", justifyContent: "center" },
  unblockText: { color: Colors.textPrimary, fontSize: 14, fontWeight: "600" },
});

export default BlockedCreators;
