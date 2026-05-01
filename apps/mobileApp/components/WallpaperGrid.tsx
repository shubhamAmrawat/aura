import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native"
import { Wallpaper } from "../lib/api";
import { FlashList } from "@shopify/flash-list";
import { getWallpapers } from "../lib/wallpaperApi";
import WallpaperCard from "./WallpaperCard";
import { useLayoutInfo } from "../hooks/useLayout";
import { useScreenFilter } from "../lib/ScreenFilterContext";
import { Colors } from "../constants";
interface WallpaperGridProps {
  category?: string | null
}
const WallpaperGrid = ({ category }: WallpaperGridProps) => {
  const [wallpapers, setWallpapers] = useState<Wallpaper[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { numofCols, cardGap, screenPadding } = useLayoutInfo();
  const { screen } = useScreenFilter();
  const offset = useRef(0);
  const isLoadingRef = useRef(false);
  
  const loadMore = async ()=>{
    if(isLoadingRef.current || !hasMore) return;
    isLoadingRef.current = true;
    setIsLoadingMore(true);
    try {
      const res = await getWallpapers({ 
        limit: 24, 
        offset: offset.current, 
        category: category ?? undefined,
        screen: screen
      });
      setWallpapers(prev => [...prev, ...res.data]);
      offset.current += res.data.length;
      setHasMore(res.hasMore);
    } finally {
      setIsLoadingMore(false);
      isLoadingRef.current = false;
    }
  }

  useEffect(() => {
    setWallpapers([])
    offset.current = 0
    setHasMore(true)
    isLoadingRef.current = true
    setIsLoadingMore(true)
    
    getWallpapers({ 
      limit: 24, 
      offset: 0,
      category: category ?? undefined,
      screen: screen
    })
    .then((res) => {
      setWallpapers(res.data);
      // console.log("Wallpapers fetched:", res.data.length, "for category:", category)r;
      // console.log("Wallpapers:", res.data);
      offset.current = res.data.length;
      setHasMore(res.hasMore);
    }) .finally(() => {
      setIsLoadingMore(false)
      isLoadingRef.current = false
    })
  }, [category, screen])

  const onRefresh = async () => {
    if (isLoadingRef.current) return;
    setIsRefreshing(true);
    setWallpapers([]);
    offset.current = 0;
    setHasMore(true);
    isLoadingRef.current = true;
    try {
      const res = await getWallpapers({
        limit: 24,
        offset: 0,
        category: category ?? undefined,
        screen: screen
      });
      setWallpapers(res.data);
      offset.current = res.data.length;
      setHasMore(res.hasMore);
    } finally {
      setIsRefreshing(false);
      isLoadingRef.current = false;
    }
  };

  return (
    <View style={styles.container}>
      {wallpapers.length === 0 && isLoadingMore ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="small" color={Colors.accent} />
        </View>
      ) : null}
      <FlashList
        data={wallpapers}
        masonry
        showsVerticalScrollIndicator={false}
        numColumns={numofCols}
        contentContainerStyle={{
          paddingTop: cardGap,
          paddingHorizontal: screenPadding - cardGap / 2
        }}
        renderItem={({ item }) => <WallpaperCard wallpaper={item} />}
        keyExtractor={(item) => item.id}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        refreshing={isRefreshing}
        onRefresh={onRefresh}
        getItemType={(item) => {
          const ratio = item.width && item.height
            ? item.width / item.height
            : 0;
          if (ratio < 0.8) return 'portrait';
          if (ratio > 1.2) return 'landscape';
          return 'square';
        }}
      />
    </View>
  )
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loaderContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
})
export default WallpaperGrid