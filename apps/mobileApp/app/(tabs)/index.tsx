import { FlatList, Pressable, StyleSheet, Text, View } from "react-native"
import Header from "../../components/Header";
import ProfileButton from "../../components/ProfileButton";
import { Colors } from "../../constants";
import { useEffect, useState } from "react";
import { getCategories } from "../../lib/wallpaperApi";
import { Category } from "../../lib/api";
import WallpaperGrid from "../../components/WallpaperGrid";

const Index = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  useEffect(() => {
    getCategories().then(setCategories);
  }, []);

  return (
    <View style={styles.container}>
      <Header title="AURORA" logo={true} titleFontSize={24} rightElement={<ProfileButton />} />
      {/* category bar */}
      <View style={styles.categoryBar}>
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

              <Text style={styles.categoryText}> {item.name}</Text>
            </Pressable>
          } />
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
    paddingVertical: 12,
  }
});

export default Index