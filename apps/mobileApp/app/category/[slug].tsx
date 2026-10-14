import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import Header from "../../components/Header";
import MasonryFeed from "../../components/MasonryFeed";
import { Colors } from "../../constants";
import { CategoryDetails } from "../../lib/api";
import { getCategoryDetails, getWallpapers } from "../../lib/wallpaperApi";
import { useScreenFilter } from "../../lib/ScreenFilterContext";
import { useFeed } from "../../lib/useFeed";

/** One category: its description and intro, then its wallpapers (this device's shape only). */
const CategoryScreen = () => {
  const { slug, name } = useLocalSearchParams<{ slug: string; name?: string }>();
  const { screen } = useScreenFilter();
  const [details, setDetails] = useState<CategoryDetails | null>(null);
  const [showIntro, setShowIntro] = useState(false);

  useEffect(() => {
    let alive = true;
    setDetails(null);
    setShowIntro(false);
    getCategoryDetails(slug)
      .then((d) => alive && setDetails(d))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [slug]);

  const fetchPage = useCallback(
    (offset: number, limit: number) => getWallpapers({ limit, offset, category: details?.slug ?? slug, screen }),
    [slug, details?.slug, screen]
  );
  const feed = useFeed(fetchPage, `${details?.slug ?? slug}|${screen}`);

  const intro = details?.intro?.trim();
  const header =
    details?.description || intro ? (
      <View style={styles.about}>
        {details?.description ? <Text style={styles.description}>{details.description}</Text> : null}
        {intro ? (
          <>
            {showIntro ? <Text style={styles.intro}>{intro}</Text> : null}
            <Pressable onPress={() => setShowIntro((v) => !v)} hitSlop={8}>
              <Text style={styles.more}>{showIntro ? "Show less" : "Read more"}</Text>
            </Pressable>
          </>
        ) : null}
      </View>
    ) : null;

  return (
    <View style={styles.container}>
      <Header title={details?.name ?? name ?? ""} logo={false} titleFontSize={20} showBackButton />
      <MasonryFeed feed={feed} header={header} emptyText="No wallpapers for your screen in this category yet." />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgSecondary,
  },
  about: {
    paddingHorizontal: 16,
    paddingTop: 4,
    gap: 8,
  },
  description: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  intro: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  more: {
    color: Colors.accent,
    fontSize: 13,
    fontWeight: "700",
  },
});

export default CategoryScreen;
