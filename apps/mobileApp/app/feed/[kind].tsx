import { useCallback } from "react";
import { StyleSheet, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import Header from "../../components/Header";
import MasonryFeed from "../../components/MasonryFeed";
import { Colors } from "../../constants";
import { getTrendingWallpapers, getWallpapers, searchWallpapers } from "../../lib/wallpaperApi";
import { useScreenFilter } from "../../lib/ScreenFilterContext";
import { useFeed } from "../../lib/useFeed";

type Kind = "trending" | "latest" | "tag";

/** Full-screen grid for "See all" links and tag chips: /feed/trending, /feed/latest, /feed/tag?q=… */
const FeedScreen = () => {
  const params = useLocalSearchParams<{ kind: Kind; q?: string }>();
  const kind: Kind = params.kind === "tag" || params.kind === "latest" ? params.kind : "trending";
  const q = (params.q ?? "").trim();
  const { screen } = useScreenFilter();

  const fetchPage = useCallback(
    (offset: number, limit: number) => {
      if (kind === "tag") return searchWallpapers({ q, limit, offset, mode: "semantic", screen });
      if (kind === "latest") return getWallpapers({ limit, offset, screen });
      return getTrendingWallpapers({ limit, offset, screen });
    },
    [kind, q, screen]
  );
  const feed = useFeed(fetchPage, `${kind}|${q}|${screen}`);

  const title = kind === "tag" ? `#${q}` : kind === "latest" ? "Latest" : "Trending";

  return (
    <View style={styles.container}>
      <Header title={title} logo={false} titleFontSize={20} showBackButton />
      <MasonryFeed feed={feed} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgSecondary,
  },
});

export default FeedScreen;
