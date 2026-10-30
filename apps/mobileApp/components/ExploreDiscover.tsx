import { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Category, WallpaperTile } from "../lib/api";
import { getCategories, getSearchSuggestions, ScreenFilter, searchWallpapers } from "../lib/wallpaperApi";
import { openWallpaper } from "../lib/openWallpaper";
import { useLayoutInfo } from "../hooks/useLayout";
import { Colors } from "../constants";
import SectionTitle from "./SectionTitle";
import SkeletonBlock from "./SkeletonBlock";
import { useVisibleWallpapers } from "../lib/BlocksContext";
import { useTabBarSpace } from "../lib/TabBarSpace";

const NO_ITEMS: WallpaperTile[] = [];

const FALLBACK_TERMS = ["Neon city", "AMOLED minimal", "Cyberpunk", "Dark abstract", "Mountain sunset", "Space art"];

/** Category slug → Explore group; anything not listed goes under "More". */
const GROUPS: Array<{ title: string; slugs: string[] }> = [
  { title: "Places & nature", slugs: ["nature", "mountains", "forest", "ocean", "sunset", "floral", "space", "city", "architecture"] },
  { title: "Art & style", slugs: ["abstract", "minimal", "dark", "neon", "gradient", "geometric", "cyberpunk", "sci-fi"] },
  { title: "Interests", slugs: ["cars", "cats", "hinduism", "anime", "games", "games-franchises"] },
];

type Row =
  | { type: "terms" }
  | { type: "group"; title: string; items: Category[] }
  | { type: "previewsTitle" }
  | { type: "preview"; term: string };

type Props = { screen: ScreenFilter; onSearch: (term: string) => void };

/** Explore when nothing is searched: popular searches, grouped category tiles, then search previews (loaded as they scroll in). */
const ExploreDiscover = ({ screen, onSearch }: Props) => {
  const { width } = useLayoutInfo();
  const tabBarSpace = useTabBarSpace();
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [terms, setTerms] = useState<string[]>([]);

  useEffect(() => {
    let alive = true;
    getCategories(screen)
      .then((c) => alive && setCategories(c))
      .catch(() => alive && setCategories([]));
    getSearchSuggestions({ limit: 8, screen })
      .then((s) => {
        const t = s.map((x) => x.term).filter((x) => x.trim().length >= 2);
        if (alive) setTerms(t.length ? t : FALLBACK_TERMS);
      })
      .catch(() => alive && setTerms(FALLBACK_TERMS));
    return () => {
      alive = false;
    };
  }, [screen]);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    if (terms.length) out.push({ type: "terms" });
    if (categories) {
      const used = new Set<string>();
      for (const g of GROUPS) {
        const items = g.slugs.map((s) => categories.find((c) => c.slug === s)).filter((c): c is Category => Boolean(c));
        items.forEach((c) => used.add(c.slug));
        if (items.length) out.push({ type: "group", title: g.title, items });
      }
      const rest = categories.filter((c) => !used.has(c.slug));
      if (rest.length) out.push({ type: "group", title: "More", items: rest });
    }
    if (terms.length) {
      out.push({ type: "previewsTitle" });
      terms.slice(0, 6).forEach((term) => out.push({ type: "preview", term }));
    }
    return out;
  }, [categories, terms]);

  const gap = 10;
  const tileW = (width - 32 - gap) / 2;
  const tileH = Math.round(tileW * 0.62);

  if (categories === null) {
    return (
      <View style={styles.loading}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ flexDirection: "row", gap }}>
            <SkeletonBlock style={{ width: tileW, height: tileH, borderRadius: 14 }} />
            <SkeletonBlock style={{ width: tileW, height: tileH, borderRadius: 14 }} />
          </View>
        ))}
      </View>
    );
  }

  return (
    <FlatList
      data={rows}
      keyExtractor={(r, i) => (r.type === "group" ? `g-${r.title}` : r.type === "preview" ? `p-${r.term}` : `${r.type}-${i}`)}
      initialNumToRender={4}
      windowSize={5}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingTop: 12, paddingBottom: 32 + tabBarSpace }}
      renderItem={({ item }) => {
        if (item.type === "terms") {
          return (
            <View style={styles.section}>
              <SectionTitle title="Popular searches" />
              <View style={styles.chips}>
                {terms.map((t) => (
                  <Pressable key={t} onPress={() => onSearch(t)} style={({ pressed }) => [styles.chip, pressed && { opacity: 0.75 }]}>
                    <Text style={styles.chipText}>{t}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          );
        }
        if (item.type === "group") {
          return (
            <View style={styles.section}>
              <SectionTitle title={item.title} />
              <View style={[styles.grid, { gap }]}>
                {item.items.map((c) => (
                  <Pressable
                    key={c.id}
                    onPress={() => router.push({ pathname: "/category/[slug]", params: { slug: c.slug, name: c.name } })}
                    style={({ pressed }) => [styles.tile, { width: tileW, height: tileH, opacity: pressed ? 0.85 : 1 }]}
                  >
                    <Image source={c.coverThumbUrl || c.coverImageUrl} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
                    <LinearGradient colors={["rgba(0,0,0,0.05)", "rgba(0,0,0,0.7)"]} style={StyleSheet.absoluteFill} />
                    <Text style={styles.tileName} numberOfLines={1}>
                      {c.name}
                    </Text>
                    {c.wallpaperCount ? <Text style={styles.tileCount}>{c.wallpaperCount} wallpapers</Text> : null}
                  </Pressable>
                ))}
              </View>
            </View>
          );
        }
        if (item.type === "previewsTitle") {
          return <SectionTitle title="Trending searches" />;
        }
        return <SearchPreviewRow term={item.term} screen={screen} onSeeAll={() => onSearch(item.term)} />;
      }}
    />
  );
};

/** One search term with a row of its top results; fetches only once it is rendered (i.e. scrolled near). */
const SearchPreviewRow = ({ term, screen, onSeeAll }: { term: string; screen: ScreenFilter; onSeeAll: () => void }) => {
  const { width } = useLayoutInfo();
  const [allItems, setItems] = useState<WallpaperTile[] | null>(null);
  const visibleItems = useVisibleWallpapers(allItems ?? NO_ITEMS);
  const items = allItems === null ? null : visibleItems;
  const w = Math.min(Math.round(width * 0.26), 140);
  const h = Math.round((w * 16) / 9);

  useEffect(() => {
    let alive = true;
    searchWallpapers({ q: term, limit: 8, offset: 0, mode: "semantic", screen })
      .then((r) => alive && setItems(r.data))
      .catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
  }, [term, screen]);

  if (items !== null && items.length === 0) return null;

  return (
    <View style={styles.preview}>
      <View style={styles.previewHead}>
        <Text style={styles.previewTerm}>{term}</Text>
        <Pressable onPress={onSeeAll} hitSlop={10}>
          <Text style={styles.previewLink}>See all</Text>
        </Pressable>
      </View>
      <FlatList
        data={items ?? []}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
        keyExtractor={(x) => x.id}
        ListEmptyComponent={
          <View style={{ flexDirection: "row", gap: 8 }}>
            {[0, 1, 2, 3].map((i) => (
              <SkeletonBlock key={i} style={{ width: w, height: h, borderRadius: 10 }} />
            ))}
          </View>
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => openWallpaper(item)} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
            <Image
              source={item.thumbUrl || item.fileUrl}
              recyclingKey={item.id}
              style={{ width: w, height: h, borderRadius: 10, backgroundColor: item.dominantColor || Colors.bgElevated }}
              placeholder={item.blurhash ? { blurhash: item.blurhash } : null}
              contentFit="cover"
              transition={200}
            />
          </Pressable>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  loading: {
    padding: 16,
    gap: 10,
  },
  section: {
    marginBottom: 24,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.borderHover,
  },
  chipText: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: "600",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
  },
  tile: {
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: Colors.bgElevated,
    justifyContent: "flex-end",
    padding: 12,
  },
  tileName: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  tileCount: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 11,
    marginTop: 2,
  },
  preview: {
    marginBottom: 20,
  },
  previewHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  previewTerm: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: "700",
  },
  previewLink: {
    color: Colors.accent,
    fontSize: 13,
    fontWeight: "700",
  },
});

export default ExploreDiscover;
