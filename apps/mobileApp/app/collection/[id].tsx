import { useCallback, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import ConfirmModal from "../../components/ConfirmModal";
import Header from "../../components/Header";
import MasonryFeed from "../../components/MasonryFeed";
import { Colors } from "../../constants";
import { useAuth } from "../../lib/AuthContext";
import { CollectionDetails, deleteCollection, getCollection } from "../../lib/collectionsApi";
import { useToast } from "../../lib/ToastContext";
import { useFeed } from "../../lib/useFeed";

/** One collection's wallpapers. The owner can delete it; wallpapers are removed via Details › Save to collection. */
const CollectionScreen = () => {
  const { id, title } = useLocalSearchParams<{ id: string; title?: string }>();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [info, setInfo] = useState<CollectionDetails["collection"] | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const fetchPage = useCallback(async () => {
    const res = await getCollection(id);
    setInfo(res.collection);
    return { data: res.wallpapers, hasMore: false };
  }, [id]);
  const feed = useFeed(fetchPage, id, 1000);

  // Coming back from a wallpaper may have changed what's in here.
  const { refresh } = feed;
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      void refresh();
    }, [refresh])
  );

  const isOwner = !!user && !!info && info.userId === user.id;

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

  const header = info ? (
    <View style={styles.about}>
      <View style={styles.metaRow}>
        <Ionicons name={info.isPublic ? "globe-outline" : "lock-closed-outline"} size={13} color={Colors.textMuted} />
        <Text style={styles.meta}>
          {info.isPublic ? "Public" : "Private"} · {info.wallpaperCount} {info.wallpaperCount === 1 ? "wallpaper" : "wallpapers"}
        </Text>
      </View>
      {info.description ? <Text style={styles.description}>{info.description}</Text> : null}
    </View>
  ) : null;

  return (
    <View style={styles.container}>
      <Header
        title={info?.title ?? title ?? ""}
        logo={false}
        titleFontSize={20}
        showBackButton
        rightElement={
          isOwner ? (
            <Pressable onPress={() => setConfirmDelete(true)} hitSlop={10} accessibilityLabel="Delete collection" style={styles.iconBtn}>
              <Ionicons name="trash-outline" size={22} color={Colors.textSecondary} />
            </Pressable>
          ) : null
        }
      />
      <MasonryFeed
        feed={feed}
        header={header}
        emptyIcon="albums-outline"
        emptyText="Nothing here yet. Open a wallpaper and go to Details › Save to collection."
      />
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
  container: { flex: 1, backgroundColor: Colors.bgSecondary },
  about: { paddingHorizontal: 16, paddingTop: 2, gap: 6 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  meta: { color: Colors.textMuted, fontSize: 13 },
  description: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20 },
  iconBtn: { padding: 4 },
});

export default CollectionScreen;
