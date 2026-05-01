import { ActivityIndicator, Animated, Easing, FlatList, Pressable, StyleSheet, Text, View } from "react-native"
import Header from "../../components/Header";
import ProfileButton from "../../components/ProfileButton";
import { Colors } from "../../constants";
import { useEffect, useRef, useState } from "react";
import { getCategories } from "../../lib/wallpaperApi";
import { Category } from "../../lib/api";
import WallpaperGrid from "../../components/WallpaperGrid";

const Index = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const skeletonPulse = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(skeletonPulse, {
          toValue: 1,
          duration: 750,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(skeletonPulse, {
          toValue: 0.45,
          duration: 750,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [skeletonPulse]);
  
  const loadCategories = async () => {
    setIsCategoriesLoading(true);
    setCategoriesError(null);
    try {
      const data = await getCategories();
      setCategories(data);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load categories";
      setCategoriesError(message);
    } finally {
      setIsCategoriesLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  return (
    <View style={styles.container}>
      <Header title="AURORA" logo={true} titleFontSize={24} rightElement={<ProfileButton />} />
      {/* category bar */}
      <View style={styles.categoryBar}>
        {isCategoriesLoading ? (
          <View style={styles.categorySkeletonWrap}>
            {Array.from({ length: 5 }, (_, idx) => (
              <Animated.View
                key={`cat-skeleton-${idx}`}
                style={[styles.categorySkeleton, { opacity: skeletonPulse }]}
              />
            ))}
          </View>
        ) : categoriesError ? (
          <View style={styles.categoryErrorWrap}>
            <Text style={styles.categoryErrorText}>Couldn&apos;t load categories</Text>
            <Pressable onPress={loadCategories} style={styles.categoryRetryBtn}>
              <Text style={styles.categoryRetryText}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList data={categories}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryList}
            ListHeaderComponent={
              <Pressable
                style={[styles.categoryPill, selectedCategory === null && styles.categoryPillActive]}
                onPress={() => setSelectedCategory(null)}
              >
                <Text style={styles.categoryText}>All</Text>
              </Pressable>
            }
            renderItem={({ item }) =>
              <Pressable style={[
                styles.categoryPill,
                selectedCategory === item.slug && styles.categoryPillActive
              ]}
                onPress={() => setSelectedCategory(
                  selectedCategory === item.slug ? null : item.slug
                )}>
                <Text style={styles.categoryText}>{item.name}</Text>
              </Pressable>
            } />
        )}
      </View>
      
      
      {/* wallpaper grid */}
      <View style={styles.wallpaperGrid}>
        <WallpaperGrid category={selectedCategory} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgSecondary,

  },
  categoryBar: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    // paddingStart: 5,
    justifyContent: 'center',
    backgroundColor: Colors.bgSecondary, // match container/header
    // borderBottomWidth: 1,
    // borderBottomColor: Colors.border,
  },
  categoryList: {
    paddingHorizontal: 12,
    gap: 10,
    alignItems: 'center',
  },
  categorySkeletonWrap: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  categorySkeleton: {
    width: 72,
    height: 30,
    borderRadius: 6,
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  categoryErrorWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
  },
  categoryErrorText: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  categoryRetryBtn: {
    borderWidth: 1,
    borderColor: Colors.accent,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  categoryRetryText: {
    color: Colors.accent,
    fontSize: 12,
    fontWeight: "700",
  },
  categoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    // borderRadius: 15,
    // borderWidth: 1,
    // borderColor: Colors.borderHover,
    // backgroundColor: Colors.bgPrimary, 
  },
  categoryPillActive: {
    // backgroundColor: Colors.accent,
    borderBottomWidth: 1,
    borderBottomColor: Colors.accent,
    // borderColor: Colors.accent,
  },
  categoryText: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: "bold",
  },
  wallpaperGrid: {
    flex: 1,
    paddingHorizontal: 12,
    // paddingVertical: 12,
  }
});

export default Index