import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Header from "../../components/Header";
import FilterBar from "../../components/FilterBar";
import { Colors } from "../../constants";
import { Wallpaper } from "../../lib/api";
import { getTrendingWallpapers } from "../../lib/wallpaperApi";
import { FlashList } from "@shopify/flash-list";
import WallpaperCard from "../../components/WallpaperCard";
import { useLayoutInfo } from "../../hooks/useLayout";
import { useScreenFilter } from "../../lib/ScreenFilterContext";
import ProfileButton from "../../components/ProfileButton";

const Trending = () => {
  const [wallpapers, setWallpapers] = useState<Wallpaper[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const offset = useRef(0);
  const isFetchingRef = useRef(false);
  const hasMoreRef = useRef(true);
  const { numofCols, cardGap, screenPadding } = useLayoutInfo();
  const { screen } = useScreenFilter();

  const fetchTrending = useCallback(
    async (options: { reset?: boolean } = {}) => {
      const shouldReset = options.reset ?? false;
      if (isFetchingRef.current) return;
      if (!shouldReset && !hasMoreRef.current) return;

      isFetchingRef.current = true;
      if (shouldReset) {
        setIsLoadingInitial(true);
        setError(null);
      } else {
        setIsLoadingMore(true);
      }

      try {
        const nextOffset = shouldReset ? 0 : offset.current;
        const res = await getTrendingWallpapers({
          limit: 24,
          offset: nextOffset,
          screen,
        });

        setWallpapers((prev) => (shouldReset ? res.data : [...prev, ...res.data]));
        offset.current = nextOffset + res.data.length;
        setHasMore(res.hasMore);
        hasMoreRef.current = res.hasMore;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load trending wallpapers";
        setError(message);
      } finally {
        isFetchingRef.current = false;
        setIsLoadingInitial(false);
        setIsLoadingMore(false);
      }
    },
    [screen]
  );

  useEffect(() => {
    offset.current = 0;
    setWallpapers([]);
    setHasMore(true);
    fetchTrending({ reset: true });
  }, [screen, fetchTrending]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    offset.current = 0;
    setHasMore(true);
    await fetchTrending({ reset: true });
    setIsRefreshing(false);
  }, [fetchTrending]);

  return (
    <View style={styles.container}>
      <Header title="Trending" titleFontSize={20} logo={false} rightElement={<ProfileButton />} />

      {isLoadingInitial ? (
        <View style={styles.stateContainer}>
          <ActivityIndicator size="small" color={Colors.accent} />
          <Text style={styles.stateText}>Loading trending wallpapers...</Text>
        </View>
      ) : (
        <FlashList
          data={wallpapers}
          masonry
          showsVerticalScrollIndicator={false}
          numColumns={numofCols}
          contentContainerStyle={{
            paddingTop: cardGap,
            paddingHorizontal: screenPadding - cardGap / 2,
            paddingBottom: cardGap * 2,
          }}
          renderItem={({ item }) => <WallpaperCard wallpaper={item} />}
          keyExtractor={(item) => item.id}
          onEndReached={() => {
            if (!isLoadingMore) fetchTrending();
          }}
          onEndReachedThreshold={0.5}
          refreshing={isRefreshing}
          onRefresh={onRefresh}
          getItemType={(item) => {
            const ratio = item.width && item.height ? item.width / item.height : 0;
            if (ratio < 0.8) return "portrait";
            if (ratio > 1.2) return "landscape";
            return "square";
          }}
          ListEmptyComponent={
            <View style={styles.stateContainer}>
              <Text style={styles.stateText}>No trending wallpapers right now.</Text>
            </View>
          }
          ListFooterComponent={
            isLoadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={Colors.accent} />
              </View>
            ) : null
          }
        />
      )}

      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => fetchTrending({ reset: true })} style={styles.retryButton}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgSecondary,
  },
  stateContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  stateText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  footerLoader: {
    paddingVertical: 12,
    alignItems: "center"
  },
  errorContainer: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    backgroundColor: Colors.bgElevated,
    borderColor: Colors.borderHover,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  errorText: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 12,
    marginRight: 8,
  },
  retryButton: {
    borderColor: Colors.accent,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  retryText: {
    color: Colors.accent,
    fontWeight: "700",
    fontSize: 12,
  },
});
export default Trending;