import { ReactElement } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Ionicons } from "@expo/vector-icons";
import WallpaperCard from "./WallpaperCard";
import { WallpaperTile } from "../lib/api";
import { useLayoutInfo } from "../hooks/useLayout";
import { Colors } from "../constants";
import type { FeedStatus } from "../lib/useFeed";

type FeedLike = {
  items: WallpaperTile[];
  status: FeedStatus;
  loadingMore: boolean;
  refreshing: boolean;
  loadMore: () => void;
  refresh: () => Promise<void>;
  retry: () => void;
};

type Props = {
  feed: FeedLike;
  /** Rendered above the grid, edge to edge (no grid padding). */
  header?: ReactElement | null;
  emptyIcon?: keyof typeof Ionicons.glyphMap;
  emptyText?: string;
  /** Extra refresh work (e.g. reloading header sections) run with pull-to-refresh. */
  onRefresh?: () => void;
};

/** Masonry wallpaper grid with paging, pull-to-refresh, and loading/error/empty states. */
const MasonryFeed = ({ feed, header, emptyIcon = "images-outline", emptyText = "No wallpapers here yet.", onRefresh }: Props) => {
  const { numofCols, cardGap, screenPadding } = useLayoutInfo();
  const inset = screenPadding - cardGap / 2;

  const empty =
    feed.status === "loading" ? (
      <View style={styles.state}>
        <ActivityIndicator size="small" color={Colors.accent} />
      </View>
    ) : feed.status === "error" ? (
      <View style={styles.state}>
        <Ionicons name="cloud-offline-outline" size={30} color={Colors.textSecondary} />
        <Text style={styles.stateText}>Couldn&apos;t load wallpapers.</Text>
        <Pressable onPress={feed.retry} style={styles.retry}>
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </View>
    ) : (
      <View style={styles.state}>
        <Ionicons name={emptyIcon} size={30} color={Colors.textSecondary} />
        <Text style={styles.stateText}>{emptyText}</Text>
      </View>
    );

  return (
    <FlashList
      data={feed.items}
      masonry
      numColumns={numofCols}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: inset, paddingBottom: cardGap * 2 }}
      ListHeaderComponent={
        <View style={{ marginHorizontal: -inset, paddingBottom: cardGap }}>{header ?? null}</View>
      }
      ListEmptyComponent={empty}
      ListFooterComponent={
        feed.loadingMore ? (
          <View style={styles.footer}>
            <ActivityIndicator size="small" color={Colors.accent} />
          </View>
        ) : null
      }
      renderItem={({ item }) => <WallpaperCard wallpaper={item} />}
      keyExtractor={(item) => item.id}
      onEndReached={feed.loadMore}
      onEndReachedThreshold={0.6}
      refreshing={feed.refreshing}
      onRefresh={() => {
        onRefresh?.();
        void feed.refresh();
      }}
      getItemType={(item) => {
        const ratio = item.width && item.height ? item.width / item.height : 0;
        if (ratio < 0.8) return "portrait";
        if (ratio > 1.2) return "landscape";
        return "square";
      }}
    />
  );
};

const styles = StyleSheet.create({
  state: {
    paddingVertical: 64,
    alignItems: "center",
    gap: 10,
  },
  stateText: {
    color: Colors.textSecondary,
    fontSize: 14,
    textAlign: "center",
    paddingHorizontal: 32,
  },
  retry: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: Colors.accent,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  retryText: {
    color: Colors.accent,
    fontSize: 13,
    fontWeight: "700",
  },
  footer: {
    paddingVertical: 20,
    alignItems: "center",
  },
});

export default MasonryFeed;
