import { useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Category, WallpaperTile } from "../lib/api";
import { getCategories, getFeaturedWallpapers, getTrendingWallpapers, ScreenFilter } from "../lib/wallpaperApi";
import { openWallpaper } from "../lib/openWallpaper";
import { useLayoutInfo } from "../hooks/useLayout";
import { Colors } from "../constants";
import SectionTitle from "./SectionTitle";
import SkeletonBlock from "./SkeletonBlock";
import { useVisibleWallpapers } from "../lib/BlocksContext";

type Props = { screen: ScreenFilter; refreshToken: number };

/** Home header: featured row, category circles, trending row (all for this device's screen shape). */
const HomeSections = ({ screen, refreshToken }: Props) => {
  const { width } = useLayoutInfo();
  const [loading, setLoading] = useState(true);
  const [featuredAll, setFeatured] = useState<WallpaperTile[]>([]);
  const [trendingAll, setTrending] = useState<WallpaperTile[]>([]);
  const featured = useVisibleWallpapers(featuredAll);
  const trending = useVisibleWallpapers(trendingAll);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    let alive = true;
    Promise.allSettled([
      getFeaturedWallpapers(screen),
      getTrendingWallpapers({ limit: 18, screen }),
      getCategories(screen),
    ]).then(([f, t, c]) => {
      if (!alive) return;
      const feat = f.status === "fulfilled" ? f.value : [];
      const trend = t.status === "fulfilled" ? t.value.data : [];
      // The app's own featured list (admin › Featured › Mobile app); top trending only while it is empty.
      const lead = feat.length > 0 ? feat : trend.slice(0, 6);
      const leadIds = new Set(lead.map((w) => w.id));
      setFeatured(lead);
      setTrending(trend.filter((w) => !leadIds.has(w.id)).slice(0, 12));
      if (c.status === "fulfilled") setCategories(c.value);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [screen, refreshToken]);

  const heroW = Math.min(Math.round(width * 0.4), 220);
  const heroH = Math.round((heroW * 16) / 9);
  const tileW = Math.min(Math.round(width * 0.28), 150);
  const tileH = Math.round((tileW * 16) / 9);

  if (loading) {
    return (
      <View style={styles.wrap}>
        <View style={styles.rowPad}>
          {[0, 1, 2].map((i) => (
            <SkeletonBlock key={i} style={{ width: heroW, height: heroH, borderRadius: 18 }} />
          ))}
        </View>
        <View style={[styles.rowPad, { marginTop: 24 }]}>
          {[0, 1, 2, 3, 4].map((i) => (
            <SkeletonBlock key={i} style={styles.circleSkeleton} />
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      {featured.length > 0 ? (
        <View style={styles.section}>
          <SectionTitle title="Featured" />
          <FlatList
            data={featured}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={heroW + 12}
            decelerationRate="fast"
            contentContainerStyle={styles.rowList}
            keyExtractor={(w) => w.id}
            renderItem={({ item }) => (
              <Pressable onPress={() => openWallpaper(item)} style={({ pressed }) => [styles.hero, { width: heroW, height: heroH, opacity: pressed ? 0.88 : 1 }]}>
                <Image
                  source={item.thumbUrl || item.fileUrl}
                  recyclingKey={item.id}
                  style={StyleSheet.absoluteFill}
                  placeholder={item.blurhash ? { blurhash: item.blurhash } : null}
                  contentFit="cover"
                  transition={200}
                />
                <LinearGradient colors={["transparent", "rgba(0,0,0,0.75)"]} style={styles.heroShade} />
                <Text style={styles.heroTitle} numberOfLines={2}>
                  {item.title}
                </Text>
              </Pressable>
            )}
          />
        </View>
      ) : null}

      {categories.length > 0 ? (
        <View style={styles.section}>
          <SectionTitle title="Categories" onSeeAll={() => router.navigate("/explore")} />
          <FlatList
            data={categories}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.rowList, { gap: 14 }]}
            keyExtractor={(c) => c.id}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => router.push({ pathname: "/category/[slug]", params: { slug: item.slug, name: item.name } })}
                style={({ pressed }) => [styles.circleItem, { opacity: pressed ? 0.8 : 1 }]}
              >
                <Image source={item.coverThumbUrl || item.coverImageUrl} style={styles.circle} contentFit="cover" transition={150} />
                <Text style={styles.circleLabel} numberOfLines={1}>
                  {item.name}
                </Text>
              </Pressable>
            )}
          />
        </View>
      ) : null}

      {trending.length > 0 ? (
        <View style={styles.section}>
          <SectionTitle title="Trending now" onSeeAll={() => router.push({ pathname: "/feed/[kind]", params: { kind: "trending" } })} />
          <FlatList
            data={trending}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.rowList, { gap: 10 }]}
            keyExtractor={(w) => w.id}
            renderItem={({ item }) => (
              <Pressable onPress={() => openWallpaper(item)} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
                <Image
                  source={item.thumbUrl || item.fileUrl}
                  recyclingKey={item.id}
                  style={{ width: tileW, height: tileH, borderRadius: 10, backgroundColor: item.dominantColor || Colors.bgElevated }}
                  placeholder={item.blurhash ? { blurhash: item.blurhash } : null}
                  contentFit="cover"
                  transition={200}
                />
              </Pressable>
            )}
          />
        </View>
      ) : null}

      <SectionTitle title="Latest" />
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    paddingTop: 8,
  },
  section: {
    marginBottom: 26,
  },
  rowPad: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    overflow: "hidden",
  },
  rowList: {
    paddingHorizontal: 16,
    gap: 12,
  },
  hero: {
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: "flex-end",
  },
  heroShade: {
    ...StyleSheet.absoluteFillObject,
    top: "55%",
  },
  heroTitle: {
    color: Colors.textPrimary,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "700",
    padding: 10,
  },
  circleItem: {
    width: 70,
    alignItems: "center",
    gap: 6,
  },
  circle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.borderHover,
  },
  circleSkeleton: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  circleLabel: {
    color: Colors.textPrimary,
    fontSize: 12,
    fontWeight: "600",
  },
});

export default HomeSections;
