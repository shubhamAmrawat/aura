import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import Header from '../../components/Header';
import SearchBar from '../../components/searchBar';
import { Colors } from '../../constants';
import { Wallpaper } from "../../lib/api";
import {
  getSearchAutocomplete,
  getSearchSuggestions,
  searchWallpapers,
} from "../../lib/wallpaperApi";
import { useScreenFilter } from "../../lib/ScreenFilterContext";
import { FlashList } from "@shopify/flash-list";
import WallpaperCard from "../../components/WallpaperCard";
import { useLayoutInfo } from "../../hooks/useLayout";
import SkeletonBlock from "../../components/SkeletonBlock";

const FALLBACK_PRESEARCHES = [
  "Neon city",
  "AMOLED minimal",
  "Cyberpunk",
  "Dark abstract",
  "Mountain sunset",
  "Anime aesthetic",
  "Nature textures",
  "Space art",
];
const RESULT_SKELETON_ITEMS = Array.from({ length: 8 }, (_, i) => `skeleton-${i}`);

const Search = () => {
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState<string | null>(null);
  const [results, setResults] = useState<Wallpaper[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchMode, setSearchMode] = useState<"semantic" | "keyword" | "hybrid" | "none">("none");
  const [previews, setPreviews] = useState<Record<string, Wallpaper[]>>({});
  const [isPreviewsLoading, setIsPreviewsLoading] = useState(true);
  const [preSearches, setPreSearches] = useState<string[]>(FALLBACK_PRESEARCHES);
  const [liveSuggestions, setLiveSuggestions] = useState<string[]>([]);
  const [isAutocompleteLoading, setIsAutocompleteLoading] = useState(false);
  const { screen } = useScreenFilter();
  const { numofCols, cardGap, screenPadding, width } = useLayoutInfo();
  const offset = useRef(0);
  const hasMoreRef = useRef(true)
  const isFetchInFlight = useRef(false);
  const autocompleteDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sanitizedQuery = useMemo(() => query.trim().toLowerCase(), [query]);
  const discoveryColumns = width >= 720 ? 2 : 1;
  const discoveryCardWidth = useMemo(() => {
    const horizontalPadding = 24; // discoveryContent: 12 + 12
    const gapTotal = (discoveryColumns - 1) * 12;
    return (width - horizontalPadding - gapTotal) / discoveryColumns;
  }, [discoveryColumns, width]);

  const loadPreviews = useCallback(async () => {
    setIsPreviewsLoading(true);
    try {
      const dynamic = await getSearchSuggestions({ limit: 8, screen });
      const terms = dynamic.map((item) => item.term).filter((term) => term.trim().length >= 2);
      const chosenTerms = terms.length > 0 ? terms : FALLBACK_PRESEARCHES;
      setPreSearches(chosenTerms);

      const entries = await Promise.all(
        chosenTerms.map(async (term) => {
          try {
            const res = await searchWallpapers({
              q: term,
              limit: 6,
              offset: 0,
              mode: "semantic",
              screen,
            });
            return [term, res.data] as const;
          } catch {
            return [term, []] as const;
          }
        })
      );
      setPreviews(Object.fromEntries(entries));
    } catch {
      setPreSearches(FALLBACK_PRESEARCHES);
      const entries = await Promise.all(
        FALLBACK_PRESEARCHES.map(async (term) => {
          try {
            const res = await searchWallpapers({
              q: term,
              limit: 6,
              offset: 0,
              mode: "semantic",
              screen,
            });
            return [term, res.data] as const;
          } catch {
            return [term, []] as const;
          }
        })
      );
      setPreviews(Object.fromEntries(entries));
    } finally {
      setIsPreviewsLoading(false);
    }
  }, [screen]);

  useEffect(() => {
    void loadPreviews();
  }, [loadPreviews]);

  useEffect(() => {
    if (autocompleteDebounceRef.current) {
      clearTimeout(autocompleteDebounceRef.current);
      autocompleteDebounceRef.current = null;
    }

    if (sanitizedQuery.length < 2) {
      setLiveSuggestions([]);
      setIsAutocompleteLoading(false);
      return;
    }

    setIsAutocompleteLoading(true);
    autocompleteDebounceRef.current = setTimeout(() => {
      getSearchAutocomplete({ q: sanitizedQuery, limit: 8, screen })
        .then((data) => {
          setLiveSuggestions(data);
        })
        .catch(() => {
          setLiveSuggestions([]);
        })
        .finally(() => {
          setIsAutocompleteLoading(false);
        });
    }, 220);

    return () => {
      if (autocompleteDebounceRef.current) {
        clearTimeout(autocompleteDebounceRef.current);
        autocompleteDebounceRef.current = null;
      }
    };
  }, [sanitizedQuery, screen]);

  const runSearch = useCallback(
    async (term: string, reset = false) => {
      const normalized = term.trim();
      if (normalized.length < 2) {
        setActiveQuery(null);
        setResults([]);
        setHasMore(false);
        setSearchError(null);
        setSearchMode("none");
        offset.current = 0;
        return;
      }
      if (isFetchInFlight.current) return;
      if (!reset && !hasMoreRef.current) return;

      isFetchInFlight.current = true;
      if (reset) {
        setIsSearching(true);
        setSearchError(null);
      } else {
        setIsLoadingMore(true);
      }

      const currentOffset = reset ? 0 : offset.current;

      try {
        const res = await searchWallpapers({
          q: normalized,
          limit: 24,
          offset: currentOffset,
          mode: "semantic",
          screen,
        });

        setSearchMode(res.mode);
        setActiveQuery(normalized);
        setResults((prev) => {
          if (reset) return res.data;
          if (res.data.length === 0) return prev;
          const seen = new Set(prev.map((item) => item.id));
          const fresh = res.data.filter((item) => !seen.has(item.id));
          return fresh.length === 0 ? prev : [...prev, ...fresh];
        });
        offset.current = currentOffset + res.data.length;
        setHasMore(res.hasMore && res.data.length > 0);
        hasMoreRef.current = res.hasMore && res.data.length > 0;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Search failed";
        setSearchError(message);
      } finally {
        isFetchInFlight.current = false;
        setIsSearching(false);
        setIsLoadingMore(false);
      }
    },
    [screen]
  );

  const onSubmit = useCallback(
    (value: string) => {
      offset.current = 0;
      setHasMore(true);
      setLiveSuggestions([]);
      void runSearch(value, true);
    },
    [runSearch]
  );

  const onPressSuggestion = useCallback(
    (term: string) => {
      setQuery(term);
      offset.current = 0;
      setHasMore(true);
      setLiveSuggestions([]);
      void runSearch(term, true);
    },
    [runSearch]
  );

  return (
    <View style={styles.container}>
      <Header
        title=""
        logo={false}
        rightElement={
          <SearchBar
            value={query}
            onChangeText={setQuery}
            onSubmit={onSubmit}
            isActive={Boolean(activeQuery)}
            onClear={() => {
              setQuery("");
              setLiveSuggestions([]);
              setActiveQuery(null);
              setResults([]);
              setSearchError(null);
              setSearchMode("none");
              offset.current = 0;
            }}
          />
        }
      />
      {activeQuery === null && sanitizedQuery.length >= 2 ? (
        <View style={styles.autocompleteWrap}>
          {isAutocompleteLoading ? (
            <View style={styles.autocompleteLoading}>
              <ActivityIndicator size="small" color={Colors.accent} />
            </View>
          ) : liveSuggestions.length > 0 ? (
            <FlatList
              data={liveSuggestions}
              style={styles.autocompleteListSurface}
              scrollEnabled
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.autocompleteList}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <Pressable
                  style={({ pressed }) => [
                    styles.autocompleteRow,
                    pressed ? styles.autocompleteRowPressed : null,
                  ]}
                  android_ripple={{ color: "rgba(255,255,255,0.06)" }}
                  onPress={() => {
                    setQuery(item);
                    setLiveSuggestions([]);
                    onSubmit(item);
                  }}
                >
                  <Ionicons name="search-outline" size={16} color={Colors.textSecondary} />
                  <Text style={styles.autocompleteRowText}>{item}</Text>
                </Pressable>
              )}
            />
          ) : (
            <View style={styles.autocompleteListSurface}>
              <Text style={styles.autocompleteEmpty}>No similar suggestions</Text>
            </View>
          )}
        </View>
      ) : null}

      {activeQuery ? (
        <View style={styles.resultsWrap}>
          <View style={styles.resultsHeader}>
            <Text style={styles.resultsTitle}>Results for “{activeQuery}”</Text>
            {/* <Text style={styles.resultsMeta}>
              {searchMode === "semantic"
                  ? "Semantic search"
                  : searchMode === "keyword"
                    ? "Keyword fallback"
                    : "Semantic search"}
            </Text> */}
          </View>

          {isSearching ? (
            <FlashList
              data={RESULT_SKELETON_ITEMS}
              masonry
              numColumns={numofCols}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                paddingTop: cardGap,
                paddingHorizontal: screenPadding - cardGap / 2,
                paddingBottom: cardGap * 2,
              }}
              keyExtractor={(item) => item}
              renderItem={({ index }) => (
                <SkeletonBlock
                  style={[
                    styles.resultSkeletonCard,
                    {
                      marginHorizontal: cardGap / 2,
                      marginBottom: cardGap,
                      aspectRatio: index % 3 === 0 ? 9 / 16 : index % 3 === 1 ? 3 / 4 : 1,
                    },
                  ]}
                />
              )}
              getItemType={(_, index) => {
                if (index % 3 === 0) return "portrait";
                if (index % 3 === 1) return "mid";
                return "square";
              }}
            />
          ) : (
            <FlashList
              data={results}
              masonry
              numColumns={numofCols}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                paddingTop: cardGap,
                paddingHorizontal: screenPadding - cardGap / 2,
                paddingBottom: cardGap * 2,
              }}
              renderItem={({ item }) => <WallpaperCard wallpaper={item} />}
              keyExtractor={(item) => item.id}
              onEndReached={() => {
                if (!isLoadingMore) void runSearch(activeQuery, false);
              }}
              onEndReachedThreshold={0.5}
              getItemType={(item) => {
                const ratio = item.width && item.height ? item.width / item.height : 0;
                if (ratio < 0.8) return "portrait";
                if (ratio > 1.2) return "landscape";
                return "square";
              }}
              ListEmptyComponent={
                <View style={styles.centerState}>
                  <Text style={styles.stateText}>No results found for this search.</Text>
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
        </View>
      ) : (
        <ScrollView
          style={styles.discoveryWrap}
          contentContainerStyle={styles.discoveryContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.discoveryTitle}>Curated Walls</Text>
          <Text style={styles.discoverySubtitle}>
          Fresh aesthetics to redefine your digital space.
          </Text>

          {isPreviewsLoading ? (
            <View style={styles.discoveryGrid}>
              {Array.from({ length: 3 }, (_, idx) => (
                <View
                  key={`idea-skeleton-${idx}`}
                  style={[styles.ideaCard, { width: discoveryCardWidth }]}
                >
                  <SkeletonBlock style={styles.ideaSkeletonTitle} />
                  <View style={styles.ideaCollage}>
                    <SkeletonBlock style={[styles.ideaLeadImageWrap, styles.ideaSkeletonBlock]} />
                    <View style={styles.ideaSideImagesWrap}>
                      <SkeletonBlock style={[styles.ideaSideImage, styles.ideaSkeletonBlock]} />
                      <SkeletonBlock style={[styles.ideaSideImage, styles.ideaSkeletonBlock]} />
                    </View>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.discoveryGrid}>
              {preSearches.map((term) => {
                const items = previews[term] ?? [];
                const isCardLoading = !previews[term];
                const lead = items[0];
                const sideTop = items[1];
                const sideBottom = items[2];

                return (
                  <Pressable
                    key={`idea-card-${term}`}
                    style={[styles.ideaCard, { width: discoveryCardWidth }]}
                    onPress={() => onPressSuggestion(term)}
                  >
                    <View style={styles.ideaCardTop}>
                      <Text style={styles.ideaCardTitle} numberOfLines={1}>
                        {term}
                      </Text>
                      <Ionicons name="arrow-forward" size={14} color={Colors.accent} />
                    </View>
                    <View style={styles.ideaCollage}>
                      <View style={styles.ideaLeadImageWrap}>
                        {isCardLoading ? (
                          <SkeletonBlock style={[styles.ideaLeadImage, styles.ideaSkeletonBlock]} />
                        ) : lead ? (
                          <Image
                            source={lead.fileUrl}
                            style={styles.ideaLeadImage}
                            placeholder={lead.blurhash ? { blurhash: lead.blurhash } : null}
                            contentFit="cover"
                          />
                        ) : (
                          <View style={styles.ideaImageFallback} />
                        )}
                      </View>
                      <View style={styles.ideaSideImagesWrap}>
                        {isCardLoading ? (
                          <>
                            <SkeletonBlock style={[styles.ideaSideImage, styles.ideaSkeletonBlock]} />
                            <SkeletonBlock style={[styles.ideaSideImage, styles.ideaSkeletonBlock]} />
                          </>
                        ) : (
                          <>
                            {sideTop ? (
                              <Image
                                source={sideTop.fileUrl}
                                style={styles.ideaSideImage}
                                placeholder={sideTop.blurhash ? { blurhash: sideTop.blurhash } : null}
                                contentFit="cover"
                              />
                            ) : (
                              <View style={styles.ideaImageFallback} />
                            )}
                            {sideBottom ? (
                              <Image
                                source={sideBottom.fileUrl}
                                style={styles.ideaSideImage}
                                placeholder={sideBottom.blurhash ? { blurhash: sideBottom.blurhash } : null}
                                contentFit="cover"
                              />
                            ) : (
                              <View style={styles.ideaImageFallback} />
                            )}
                          </>
                        )}
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}

      {searchError ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{searchError}</Text>
          <Pressable
            onPress={() => {
              if (activeQuery) {
                offset.current = 0;
                setHasMore(true);
                void runSearch(activeQuery, true);
              } else {
                void loadPreviews();
              }
            }}
            style={styles.retryButton}
          >
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgSecondary,
  },
  discoveryWrap: {
    flex: 1,
  },
  autocompleteWrap: {
    paddingHorizontal: 12,
    paddingTop: 8,
    justifyContent: "center",
  },
  autocompleteLoading: {
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  autocompleteListSurface: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    backgroundColor: Colors.bgElevated,
    maxHeight: 220,
  },
  autocompleteList: {
    paddingVertical: 4,
  },
  autocompleteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  autocompleteRowPressed: {
    backgroundColor: Colors.bgSecondary,
    opacity: 0.85,
  },
  autocompleteRowText: {
    color: Colors.textPrimary,
    fontSize: 14,
  },
  autocompleteEmpty: {
    color: Colors.textMuted,
    fontSize: 13,
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  discoveryContent: {
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 20,
  },
  discoveryTitle: {
    color: Colors.textPrimary,
    fontSize: 22,
    fontWeight: "700",
  },
  discoverySubtitle: {
    color: Colors.textSecondary,
    marginTop: 4,
    marginBottom: 14,
    fontSize: 13,
  },
  discoveryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  ideaCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgElevated,
    padding: 10,
  },
  ideaCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  ideaCardTitle: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: "700",
  },
  ideaCollage: {
    flexDirection: "row",
    gap: 8,
  },
  ideaLeadImageWrap: {
    flex: 1.2,
    height: 174,
    borderRadius: 10,
    overflow: "hidden",
  },
  ideaLeadImage: {
    width: "100%",
    height: "100%",
  },
  ideaSideImagesWrap: {
    flex: 1,
    gap: 8,
  },
  ideaSideImage: {
    width: "100%",
    height: 83,
    borderRadius: 10,
  },
  ideaImageFallback: {
    width: "100%",
    height: "100%",
    borderRadius: 10,
    backgroundColor: Colors.bgSecondary,
  },
  ideaSkeletonTitle: {
    width: "45%",
    height: 16,
    borderRadius: 8,
    marginBottom: 10,
  },
  ideaSkeletonBlock: {
    borderColor: "transparent",
    backgroundColor: Colors.bgSecondary,
  },
  sectionLoading: {
    height: 170,
    alignItems: "center",
    justifyContent: "center",
  },
  resultsWrap: {
    flex: 1,
    
  },
  resultsHeader: {
    paddingHorizontal: 12,
    paddingTop: 10,
    marginBottom: 8,
  },
  resultsTitle: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: "700",
  },
  resultsMeta: {
    color: Colors.textSecondary,
    marginTop: 2,
    fontSize: 12,
  },
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  stateText: {
    color: Colors.textSecondary,
    fontSize: 13,
  },
  resultSkeletonCard: {
    borderRadius: 12,
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    width: "100%",
  },
  footerLoader: {
    paddingVertical: 12,
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
export default Search;