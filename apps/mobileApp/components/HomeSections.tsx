import { useEffect, useRef, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useFonts } from "expo-font";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { Category, WallpaperTile } from "../lib/api";
import {
  DailyWallpaper,
  getCategories,
  getDailyWallpaper,
  getFeaturedWallpapers,
  getTrendingWallpapers,
  isWallpaperLiked,
  ScreenFilter,
  toggleWallpaperLike,
} from "../lib/wallpaperApi";
import { openWallpaper } from "../lib/openWallpaper";
import { useInsets } from "../hooks/useInsets";
import { Colors, Images } from "../constants";
import AvatarButton from "./AvatarButton";
import SkeletonBlock from "./SkeletonBlock";
import { useVisibleWallpapers } from "../lib/BlocksContext";
import { useAuth } from "../lib/AuthContext";
import { useToast } from "../lib/ToastContext";

type Props = { screen: ScreenFilter; refreshToken: number };

const SERIF = "InstrumentSerif";

/** Mood chips open Explore with this search. */
const MOODS: { label: string; q: string; colors: [string, string] }[] = [
  { label: "Dark", q: "dark", colors: ["#0A0A12", "#1C1C26"] },
  { label: "Neon", q: "neon", colors: ["#FF3CC8", "#3CDCFF"] },
  { label: "Pastel", q: "pastel", colors: ["#FAC8AA", "#8C78C8"] },
  { label: "Calm", q: "calm nature", colors: ["#2A5A45", "#8CB09A"] },
  { label: "Minimal", q: "minimal", colors: ["#E8E4DE", "#8C8984"] },
  { label: "Space", q: "space", colors: ["#120C2E", "#6B4BC8"] },
];

const tap = () => void Haptics.selectionAsync().catch(() => undefined);

/** "2026-10-30" → "FRI · 30 OCT" */
function dayLabel(day: string) {
  const d = new Date(`${day}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "TODAY";
  const wd = d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
  const mo = d.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
  return `${wd} · ${d.getDate()} ${mo}`;
}

/**
 * Home header (above the "Made for you" grid): full-bleed featured carousel, mood chips,
 * wallpaper of the day and categories — all for this device's screen shape.
 */
const HomeSections = ({ screen, refreshToken }: Props) => {
  const { width, height: windowH } = useWindowDimensions();
  const { topPadding } = useInsets();
  const [fontsLoaded] = useFonts({ [SERIF]: require("../assets/fonts/InstrumentSerif-Regular.ttf") });
  const serif = fontsLoaded ? { fontFamily: SERIF, fontWeight: "400" as const } : { fontWeight: "700" as const };

  const [loading, setLoading] = useState(true);
  const [featuredAll, setFeatured] = useState<WallpaperTile[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [daily, setDaily] = useState<{ day: string; wallpaper: DailyWallpaper } | null>(null);
  const featured = useVisibleWallpapers(featuredAll);
  const dailyVisible = useVisibleWallpapers(daily ? [daily.wallpaper] : []);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let alive = true;
    Promise.allSettled([
      getFeaturedWallpapers(screen),
      getTrendingWallpapers({ limit: 6, screen }),
      getCategories(screen),
      getDailyWallpaper(screen),
    ]).then(([f, t, c, d]) => {
      if (!alive) return;
      const feat = f.status === "fulfilled" ? f.value : [];
      const trend = t.status === "fulfilled" ? t.value.data : [];
      // The app's own featured list (admin › Featured › Mobile app); top trending only while it is empty.
      setFeatured(feat.length > 0 ? feat : trend.slice(0, 5));
      if (c.status === "fulfilled") setCategories(c.value);
      setDaily(d.status === "fulfilled" && d.value.wallpaper ? { day: d.value.day, wallpaper: d.value.wallpaper } : null);
      setIndex(0);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [screen, refreshToken]);

  const heroH = Math.round(Math.min(width * 1.45, windowH * 0.72));
  const catCols = width >= 700 ? 6 : 3;
  const catW = (width - 40 - 10 * (catCols - 1)) / catCols;

  const topBar = (
    <View style={[styles.topBar, { paddingTop: topPadding + 8 }]} pointerEvents="box-none">
      <Image source={Images.LOGO_WORDMARK} style={styles.logo} contentFit="contain" accessibilityLabel="Aurora" />
      <View style={styles.topActions}>
        <Pressable
          onPress={() => router.navigate("/explore")}
          style={({ pressed }) => [styles.roundBtn, pressed && { opacity: 0.8 }]}
          accessibilityRole="button"
          accessibilityLabel="Search"
          hitSlop={6}
        >
          <Ionicons name="search" size={18} color={Colors.textPrimary} />
        </Pressable>
        <AvatarButton />
      </View>
    </View>
  );

  if (loading) {
    return (
      <View>
        <SkeletonBlock style={{ width, height: heroH, borderRadius: 0 }} />
        {topBar}
        <View style={[styles.rowPad, { marginTop: 22 }]}>
          {[0, 1, 2, 3].map((i) => (
            <SkeletonBlock key={i} style={{ width: 84, height: 40, borderRadius: 20 }} />
          ))}
        </View>
        <View style={{ paddingHorizontal: 20, marginTop: 30 }}>
          <SkeletonBlock style={{ height: 210, borderRadius: 24 }} />
        </View>
      </View>
    );
  }

  return (
    <View>
      {/* ─── Featured ─── */}
      {featured.length > 0 ? (
        <View style={{ height: heroH }}>
          <FlatList
            data={featured}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(w) => w.id}
            onMomentumScrollEnd={(e) => {
              const i = Math.round(e.nativeEvent.contentOffset.x / width);
              if (i !== index) {
                setIndex(i);
                tap();
              }
            }}
            renderItem={({ item, index: i }) => (
              <HeroPage item={item} width={width} height={heroH} position={i + 1} total={featured.length} serif={serif} />
            )}
          />
          {featured.length > 1 ? (
            <View style={styles.dots} pointerEvents="none">
              {featured.map((w, i) => (
                <View key={w.id} style={[styles.dot, i === index && styles.dotOn]} />
              ))}
            </View>
          ) : null}
          {topBar}
        </View>
      ) : (
        <View style={{ height: topPadding + 64 }}>{topBar}</View>
      )}

      {/* ─── Browse by mood ─── */}
      <Text style={styles.kickerTitle}>BROWSE BY MOOD</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rowPad}>
        {MOODS.map((m) => (
          <Pressable
            key={m.label}
            onPress={() => {
              tap();
              router.navigate({ pathname: "/explore", params: { q: m.q } });
            }}
            style={({ pressed }) => [styles.mood, pressed && { opacity: 0.8 }]}
            accessibilityRole="button"
            accessibilityLabel={`${m.label} wallpapers`}
          >
            <LinearGradient colors={m.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.moodSwatch} />
            <Text style={styles.moodText}>{m.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* ─── Wallpaper of the day ─── */}
      {daily && dailyVisible.length > 0 ? (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, serif, styles.padX]}>Wallpaper of the day</Text>
          <Pressable
            onPress={() => openWallpaper(daily.wallpaper)}
            style={({ pressed }) => [styles.dailyCard, pressed && { opacity: 0.9 }]}
            accessibilityRole="button"
            accessibilityLabel={`Wallpaper of the day: ${daily.wallpaper.title}`}
          >
            <Image
              source={daily.wallpaper.thumbUrl || daily.wallpaper.fileUrl}
              placeholder={daily.wallpaper.blurhash ? { blurhash: daily.wallpaper.blurhash } : null}
              style={[styles.dailyImage, { backgroundColor: daily.wallpaper.dominantColor || Colors.bgElevated }]}
              contentFit="cover"
              transition={200}
            />
            <View style={styles.dailyInfo}>
              <Text style={styles.dailyKicker}>{dayLabel(daily.day)}</Text>
              <Text style={[styles.dailyTitle, serif]} numberOfLines={2}>
                {daily.wallpaper.title || "Untitled"}
              </Text>
              <Text style={styles.dailyMeta} numberOfLines={1}>
                {[daily.wallpaper.creatorUsername ? `by @${daily.wallpaper.creatorUsername}` : null, daily.wallpaper.categoryName]
                  .filter(Boolean)
                  .join(" · ") || "Picked for today"}
              </Text>
              <Text style={styles.dailyNote}>A new pick every day.</Text>
              <Pressable
                onPress={() => openWallpaper(daily.wallpaper, { apply: true })}
                style={({ pressed }) => [styles.smallCta, pressed && { opacity: 0.85 }]}
                accessibilityRole="button"
              >
                <Text style={styles.smallCtaText}>Set today&apos;s</Text>
              </Pressable>
            </View>
          </Pressable>
        </View>
      ) : null}

      {/* ─── Categories ─── */}
      {categories.length > 0 ? (
        <View style={styles.section}>
          <View style={[styles.sectionHead, styles.padX]}>
            <Text style={[styles.sectionTitle, serif]}>Categories</Text>
            <Pressable onPress={() => router.navigate("/explore")} hitSlop={8}>
              <Text style={styles.seeAll}>See all</Text>
            </Pressable>
          </View>
          <View style={[styles.catGrid, styles.padX]}>
            {categories.slice(0, catCols * 2).map((c) => (
              <Pressable
                key={c.id}
                onPress={() => router.push({ pathname: "/category/[slug]", params: { slug: c.slug, name: c.name } })}
                style={({ pressed }) => [styles.catTile, { width: catW }, pressed && { opacity: 0.85 }]}
                accessibilityRole="button"
                accessibilityLabel={c.name}
              >
                <Image source={c.coverThumbUrl || c.coverImageUrl} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
                <LinearGradient colors={["transparent", "rgba(0,0,0,0.75)"]} style={styles.catShade} />
                <Text style={styles.catLabel} numberOfLines={1}>
                  {c.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {/* ─── Made for you (the grid below) ─── */}
      <Text style={[styles.sectionTitle, serif, styles.padX, { marginTop: 34, marginBottom: 14 }]}>Made for you</Text>
    </View>
  );
};

/** One full-bleed featured wallpaper with its title, creator and actions. */
function HeroPage({
  item,
  width,
  height,
  position,
  total,
  serif,
}: {
  item: WallpaperTile;
  width: number;
  height: number;
  position: number;
  total: number;
  serif: object;
}) {
  return (
    <Pressable onPress={() => openWallpaper(item)} style={{ width, height }} accessibilityLabel={`Featured: ${item.title}`}>
      <Image
        source={item.thumbUrl || item.fileUrl}
        recyclingKey={item.id}
        placeholder={item.blurhash ? { blurhash: item.blurhash } : null}
        style={[StyleSheet.absoluteFill, { backgroundColor: item.dominantColor || Colors.bgElevated }]}
        contentFit="cover"
        transition={250}
      />
      <LinearGradient colors={["rgba(0,0,0,0.55)", "rgba(0,0,0,0)"]} style={styles.heroTopShade} />
      <LinearGradient colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.85)", Colors.bgPrimary]} locations={[0, 0.7, 1]} style={styles.heroBottomShade} />
      <View style={styles.heroInfo}>
        <Text style={styles.heroKicker}>
          FEATURED · {position} / {total}
        </Text>
        <Text style={[styles.heroTitle, serif]} numberOfLines={2}>
          {item.title || "Untitled"}
        </Text>
        {item.creatorUsername ? <Text style={styles.heroBy}>by @{item.creatorUsername}</Text> : null}
        <View style={styles.heroActions}>
          <Pressable
            onPress={() => openWallpaper(item, { apply: true })}
            style={({ pressed }) => [styles.heroPrimary, pressed && { opacity: 0.85 }]}
            accessibilityRole="button"
          >
            <Text style={styles.heroPrimaryText}>Set wallpaper</Text>
          </Pressable>
          <Pressable
            onPress={() => openWallpaper(item)}
            style={({ pressed }) => [styles.heroGhost, pressed && { opacity: 0.8 }]}
            accessibilityRole="button"
          >
            <Text style={styles.heroGhostText}>View</Text>
          </Pressable>
          <LikeCircle wallpaperId={item.id} />
        </View>
      </View>
    </Pressable>
  );
}

/** ♡ on a featured wallpaper: loads whether it's liked (signed in), toggles optimistically. */
function LikeCircle({ wallpaperId }: { wallpaperId: string }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [liked, setLiked] = useState(false);
  const busy = useRef(false);

  useEffect(() => {
    if (!user) {
      setLiked(false);
      return;
    }
    let alive = true;
    isWallpaperLiked(wallpaperId)
      .then((v) => alive && setLiked(v))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [user, wallpaperId]);

  const toggle = async () => {
    if (!user) {
      router.push("/auth");
      return;
    }
    if (busy.current) return;
    busy.current = true;
    const next = !liked;
    setLiked(next);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    try {
      const res = await toggleWallpaperLike(wallpaperId);
      setLiked(res.liked);
    } catch {
      setLiked(!next);
      showToast("Couldn't update your like. Try again.", { type: "error", position: "top" });
    } finally {
      busy.current = false;
    }
  };

  return (
    <Pressable
      onPress={() => void toggle()}
      style={({ pressed }) => [styles.heroCircle, pressed && { opacity: 0.8 }]}
      accessibilityRole="button"
      accessibilityLabel={liked ? "Unlike" : "Like"}
      accessibilityState={{ selected: liked }}
    >
      <Ionicons name={liked ? "heart" : "heart-outline"} size={21} color={liked ? "#FF5A7A" : Colors.textPrimary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  padX: { marginHorizontal: 20 },
  rowPad: { flexDirection: "row", gap: 8, paddingHorizontal: 20 },

  // top bar (over the hero)
  topBar: { position: "absolute", left: 0, right: 0, top: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18 },
  logo: { width: 104, height: 24 },
  topActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  roundBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(0,0,0,0.38)", alignItems: "center", justifyContent: "center" },

  // hero
  heroTopShade: { position: "absolute", left: 0, right: 0, top: 0, height: "24%" },
  heroBottomShade: { position: "absolute", left: 0, right: 0, bottom: 0, height: "58%" },
  heroInfo: { position: "absolute", left: 20, right: 20, bottom: 44, gap: 8 },
  heroKicker: { color: Colors.accent, fontSize: 11, fontWeight: "700", letterSpacing: 1.6 },
  heroTitle: { color: Colors.textPrimary, fontSize: 42, lineHeight: 44, letterSpacing: -0.5 },
  heroBy: { color: "rgba(245,240,235,0.78)", fontSize: 13 },
  heroActions: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6 },
  heroPrimary: { height: 48, paddingHorizontal: 22, borderRadius: 24, backgroundColor: Colors.accent, alignItems: "center", justifyContent: "center" },
  heroPrimaryText: { color: "#0A0A0A", fontSize: 15, fontWeight: "800" },
  heroGhost: { height: 48, paddingHorizontal: 18, borderRadius: 24, borderWidth: 1, borderColor: "rgba(255,255,255,0.3)", backgroundColor: "rgba(0,0,0,0.35)", alignItems: "center", justifyContent: "center" },
  heroGhostText: { color: Colors.textPrimary, fontSize: 15, fontWeight: "700" },
  heroCircle: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: "rgba(255,255,255,0.3)", backgroundColor: "rgba(0,0,0,0.35)", alignItems: "center", justifyContent: "center" },
  dots: { position: "absolute", left: 20, bottom: 22, flexDirection: "row", gap: 6 },
  dot: { width: 10, height: 4, borderRadius: 2, backgroundColor: "rgba(245,240,235,0.35)" },
  dotOn: { width: 28, backgroundColor: Colors.textPrimary },

  // moods
  kickerTitle: { color: Colors.textSecondary, fontSize: 13, fontWeight: "700", letterSpacing: 1.4, marginHorizontal: 20, marginTop: 22, marginBottom: 12 },
  mood: { flexDirection: "row", alignItems: "center", gap: 8, height: 40, paddingLeft: 6, paddingRight: 14, borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", backgroundColor: "#0E0E0E" },
  moodSwatch: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  moodText: { color: Colors.textPrimary, fontSize: 13.5, fontWeight: "600" },

  // sections
  section: { marginTop: 32 },
  sectionHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 },
  sectionTitle: { color: Colors.textPrimary, fontSize: 30, lineHeight: 34, marginBottom: 0 },
  seeAll: { color: Colors.accent, fontSize: 13, fontWeight: "700" },

  // wallpaper of the day
  dailyCard: { flexDirection: "row", gap: 14, marginHorizontal: 20, marginTop: 14, padding: 12, borderRadius: 24, backgroundColor: "#0E0E0E", borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" },
  dailyImage: { width: 100, height: 186, borderRadius: 16 },
  dailyInfo: { flex: 1, justifyContent: "center", gap: 6 },
  dailyKicker: { color: Colors.accent, fontSize: 11, fontWeight: "700", letterSpacing: 1.4 },
  dailyTitle: { color: Colors.textPrimary, fontSize: 30, lineHeight: 32 },
  dailyMeta: { color: "#A9A59F", fontSize: 12.5 },
  dailyNote: { color: Colors.textMuted, fontSize: 12 },
  smallCta: { alignSelf: "flex-start", marginTop: 6, height: 36, paddingHorizontal: 16, borderRadius: 18, backgroundColor: Colors.accent, alignItems: "center", justifyContent: "center" },
  smallCtaText: { color: "#0A0A0A", fontSize: 13, fontWeight: "800" },

  // categories
  catGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  catTile: { height: 128, borderRadius: 18, overflow: "hidden", backgroundColor: Colors.bgElevated, justifyContent: "flex-end" },
  catShade: { ...StyleSheet.absoluteFillObject, top: "40%" },
  catLabel: { color: "#FFFFFF", fontSize: 13.5, fontWeight: "700", margin: 10 },
});

export default HomeSections;
