import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import Header from "../../components/Header";
import MasonryFeed from "../../components/MasonryFeed";
import CollectionForm from "../../components/CollectionForm";
import Sheet from "../../components/Sheet";
import SignInPrompt from "../../components/SignInPrompt";
import { Colors } from "../../constants";
import { useAuth } from "../../lib/AuthContext";
import { useCollectionActions, useCollections } from "../../lib/CollectionsContext";
import { getLikedWallpapers } from "../../lib/wallpaperApi";
import { useFeed } from "../../lib/useFeed";

type Section = "liked" | "collections";
const GAP = 12;
const INSET = 16;

/** Library tab: wallpapers you liked, and your collections (same collections as the website). */
const Library = () => {
  const { user } = useAuth();
  const [section, setSection] = useState<Section>("liked");
  const { width } = useWindowDimensions();
  const cardW = (width - INSET * 2 - GAP) / 2;

  const fetchLiked = useCallback(
    async () => (user ? { data: await getLikedWallpapers(), hasMore: false } : { data: [], hasMore: false }),
    [user]
  );
  const feed = useFeed(fetchLiked, user?.id ?? "guest", 1000);

  // Collections come from the shared store, which every screen keeps up to date.
  const { collections, status } = useCollections();
  const { refresh: refreshCollections } = useCollectionActions();
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  // Likes change on the wallpaper screen, so reload them whenever the tab comes back into view.
  const firstFocus = useRef(true);
  const { reload } = feed;
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      if (user) void reload();
    }, [user, reload])
  );

  const onRefreshCollections = async () => {
    setRefreshing(true);
    await refreshCollections();
    setRefreshing(false);
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <Header title="Library" logo={false} titleFontSize={20} />
        <SignInPrompt
          icon="albums-outline"
          title="Your wallpapers, in one place"
          text="Sign in to keep the wallpapers you like and organise them into collections, on any device."
        />
      </View>
    );
  }

  const newCard = (
    <Pressable onPress={() => setShowCreate(true)} style={({ pressed }) => [styles.card, { width: cardW }, pressed && styles.pressed]}>
      <View style={[styles.cover, styles.newCover]}>
        <Ionicons name="add" size={30} color={Colors.accent} />
      </View>
      <Text style={[styles.cardTitle, { color: Colors.accent }]}>New collection</Text>
      <Text style={styles.cardMeta}> </Text>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <Header title="Library" logo={false} titleFontSize={20} />

      <View style={styles.segment} accessibilityRole="tablist">
        {(["liked", "collections"] as const).map((s) => {
          const on = section === s;
          return (
            <Pressable
              key={s}
              onPress={() => setSection(s)}
              style={[styles.segmentItem, on && styles.segmentOn]}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
            >
              <Ionicons
                name={s === "liked" ? (on ? "heart" : "heart-outline") : on ? "albums" : "albums-outline"}
                size={16}
                color={on ? Colors.textPrimary : Colors.textSecondary}
              />
              <Text style={[styles.segmentText, on && styles.segmentTextOn]}>{s === "liked" ? "Liked" : "Collections"}</Text>
            </Pressable>
          );
        })}
      </View>

      {section === "liked" ? (
        <MasonryFeed feed={feed} emptyIcon="heart-outline" emptyText="Tap the heart on any wallpaper and it shows up here." />
      ) : status === "error" && !collections ? (
        <Pressable onPress={() => void refreshCollections()} style={styles.center}>
          <Text style={styles.muted}>Couldn&apos;t load your collections. Tap to retry.</Text>
        </Pressable>
      ) : !collections ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.accent} />
        </View>
      ) : (
        <FlatList
          data={collections}
          keyExtractor={(c) => c.id}
          numColumns={2}
          columnWrapperStyle={{ gap: GAP }}
          contentContainerStyle={styles.grid}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefreshCollections} tintColor={Colors.accent} colors={[Colors.accent]} />}
          ListHeaderComponent={
            collections.length === 0 ? (
              <Text style={styles.hint}>
                Collections are your own folders of wallpapers. Make one here, or open a wallpaper and go to Details › Save to collection.
              </Text>
            ) : null
          }
          ListFooterComponent={
            <View style={styles.footerRow}>{collections.length % 2 === 0 ? newCard : null}</View>
          }
          renderItem={({ item, index }) => {
            const cover = item.coverThumbUrl ?? item.coverUrl;
            const card = (
              <Pressable
                onPress={() => router.push({ pathname: "/collection/[id]", params: { id: item.id, title: item.title } })}
                style={({ pressed }) => [styles.card, { width: cardW }, pressed && styles.pressed]}
              >
                <View style={styles.cover}>
                  {cover ? (
                    <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
                  ) : (
                    <Ionicons name="images-outline" size={28} color={Colors.textMuted} />
                  )}
                </View>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <View style={styles.metaRow}>
                  <Ionicons name={item.isPublic ? "globe-outline" : "lock-closed-outline"} size={12} color={Colors.textMuted} />
                  <Text style={styles.cardMeta}>
                    {item.wallpaperCount} {item.wallpaperCount === 1 ? "wallpaper" : "wallpapers"}
                  </Text>
                </View>
              </Pressable>
            );
            // Odd count: the "New collection" card fills the empty slot beside the last one.
            const isLastOdd = collections.length % 2 === 1 && index === collections.length - 1;
            return isLastOdd ? (
              <>
                {card}
                {newCard}
              </>
            ) : (
              card
            );
          }}
        />
      )}

      <Sheet visible={showCreate} onClose={() => setShowCreate(false)}>
        <Text style={styles.sheetTitle}>New collection</Text>
        <CollectionForm mode="create" onCancel={() => setShowCreate(false)} onDone={() => setShowCreate(false)} />
      </Sheet>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgSecondary },
  segment: {
    flexDirection: "row",
    marginHorizontal: INSET,
    marginBottom: 12,
    padding: 4,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  segmentItem: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  segmentOn: { backgroundColor: "rgba(255,255,255,0.10)", borderWidth: 1, borderColor: Colors.borderHover },
  segmentText: { color: Colors.textSecondary, fontSize: 14, fontWeight: "700" },
  segmentTextOn: { color: Colors.textPrimary },
  grid: { paddingHorizontal: INSET, paddingBottom: 32, gap: 18 },
  hint: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: 4 },
  footerRow: { flexDirection: "row", gap: GAP },
  card: { gap: 6 },
  pressed: { opacity: 0.8 },
  cover: {
    aspectRatio: 4 / 5,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  newCover: { borderStyle: "dashed", borderColor: "rgba(129, 238, 78, 0.45)", backgroundColor: "transparent" },
  cardTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: "700", paddingHorizontal: 2 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 2 },
  cardMeta: { color: Colors.textMuted, fontSize: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  muted: { color: Colors.textSecondary, fontSize: 14, textAlign: "center" },
  sheetTitle: { color: Colors.textPrimary, fontSize: 20, fontWeight: "800", marginBottom: 14 },
});

export default Library;
