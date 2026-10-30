import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useInsets } from "../../hooks/useInsets";
import SearchBar from "../../components/searchBar";
import AvatarButton from "../../components/AvatarButton";
import MasonryFeed from "../../components/MasonryFeed";
import ExploreDiscover from "../../components/ExploreDiscover";
import { Colors } from "../../constants";
import { getSearchAutocomplete, searchWallpapers } from "../../lib/wallpaperApi";
import { useScreenFilter } from "../../lib/ScreenFilterContext";
import { useFeed } from "../../lib/useFeed";

const Explore = () => {
  const { screen } = useScreenFilter();
  const { topPadding } = useInsets();
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typed = useMemo(() => query.trim().toLowerCase(), [query]);

  const fetchResults = useCallback(
    (offset: number, limit: number) =>
      activeQuery
        ? searchWallpapers({ q: activeQuery, limit, offset, mode: "semantic", screen })
        : Promise.resolve({ data: [], hasMore: false }),
    [activeQuery, screen]
  );
  const results = useFeed(fetchResults, `${activeQuery ?? ""}|${screen}`);

  // Autocomplete while typing (not once a search is shown).
  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (activeQuery !== null || typed.length < 2) {
      setSuggestions([]);
      setSuggestLoading(false);
      return;
    }
    setSuggestLoading(true);
    debounce.current = setTimeout(() => {
      getSearchAutocomplete({ q: typed, limit: 8, screen })
        .then(setSuggestions)
        .catch(() => setSuggestions([]))
        .finally(() => setSuggestLoading(false));
    }, 220);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [typed, screen, activeQuery]);

  const runSearch = useCallback((term: string) => {
    const t = term.trim();
    if (t.length < 2) return;
    setQuery(t);
    setSuggestions([]);
    setActiveQuery(t);
  }, []);

  // Opened with a search already chosen (home's mood chips): run it, then clear the param so
  // tapping the same mood again later searches again.
  const { q: qParam } = useLocalSearchParams<{ q?: string }>();
  useEffect(() => {
    if (!qParam) return;
    runSearch(qParam);
    router.setParams({ q: undefined });
  }, [qParam, runSearch]);

  const clear = useCallback(() => {
    setQuery("");
    setSuggestions([]);
    setActiveQuery(null);
  }, []);

  // Android back closes the results before leaving the tab.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        if (activeQuery === null && query === "") return false;
        clear();
        return true;
      });
      return () => sub.remove();
    }, [activeQuery, query, clear])
  );

  const showSuggestions = activeQuery === null && typed.length >= 2;

  return (
    <View style={styles.container}>
      <View style={[styles.searchHeader, styles.searchRow, { paddingTop: topPadding + 10 }]}>
        <View style={styles.searchFlex}>
        <SearchBar
          value={query}
          onChangeText={(v) => {
            setQuery(v);
            if (activeQuery !== null && v.trim() !== activeQuery) setActiveQuery(null);
          }}
          onSubmit={runSearch}
          isActive={Boolean(activeQuery)}
          onClear={clear}
        />
        </View>
        <AvatarButton />
      </View>

      {showSuggestions ? (
        <View style={styles.suggestWrap}>
          {suggestLoading ? (
            <View style={styles.suggestLoading}>
              <ActivityIndicator size="small" color={Colors.accent} />
            </View>
          ) : suggestions.length > 0 ? (
            <FlatList
              data={suggestions}
              style={styles.suggestSurface}
              keyboardShouldPersistTaps="handled"
              keyExtractor={(s) => s}
              renderItem={({ item }) => (
                <Pressable
                  style={({ pressed }) => [styles.suggestRow, pressed && styles.suggestRowPressed]}
                  android_ripple={{ color: "rgba(255,255,255,0.06)" }}
                  onPress={() => runSearch(item)}
                >
                  <Ionicons name="search-outline" size={16} color={Colors.textSecondary} />
                  <Text style={styles.suggestText}>{item}</Text>
                </Pressable>
              )}
            />
          ) : (
            <Pressable style={styles.suggestSurface} onPress={() => runSearch(query)}>
              <Text style={styles.suggestEmpty}>Search for “{query.trim()}”</Text>
            </Pressable>
          )}
        </View>
      ) : null}

      {activeQuery ? (
        <MasonryFeed
          feed={results}
          header={<Text style={styles.resultsTitle}>Results for “{activeQuery}”</Text>}
          emptyIcon="search-outline"
          emptyText={`No wallpapers match “${activeQuery}”. Try another word.`}
        />
      ) : showSuggestions ? null : (
        <ExploreDiscover screen={screen} onSearch={runSearch} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  searchRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  // Row, so the search bar's flex: 1 fills the width. In a column it collapsed to zero height and clipped the text.
  searchFlex: { flex: 1, flexDirection: "row" },
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  searchHeader: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  suggestWrap: {
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  suggestLoading: {
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  suggestSurface: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    backgroundColor: Colors.bgElevated,
    maxHeight: 320,
  },
  suggestRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  suggestRowPressed: {
    backgroundColor: Colors.bgElevated,
    opacity: 0.85,
  },
  suggestText: {
    color: Colors.textPrimary,
    fontSize: 14,
  },
  suggestEmpty: {
    color: Colors.textSecondary,
    fontSize: 13,
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  resultsTitle: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: "700",
    paddingHorizontal: 16,
    paddingTop: 10,
  },
});

export default Explore;
