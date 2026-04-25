import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native"
import { Wallpaper } from "../lib/api";
import { FlashList } from "@shopify/flash-list";
import { getWallpapers } from "../lib/wallpaperApi";
import { Colors } from "../constants/colors";
import WallpaperCard from "./WallpaperCard";
import { useLayoutInfo } from "../hooks/useLayout";

interface WallpaperGridProps {
  category?: string | null
}
const WallpaperGrid = ({ category }: WallpaperGridProps) => {
  const [wallpapers, setWallpapers] = useState<Wallpaper[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const { numofCols, cardGap, screenPadding } = useLayoutInfo();
  const offset = useRef(0);
  const isLoadingRef = useRef(false);
  
  const loadMore = async ()=>{
    if(isLoadingRef.current || !hasMore) return;
    isLoadingRef.current = true;
    setIsLoadingMore(true);
    try {
      const res = await getWallpapers({ limit: 24, offset: offset.current, category: category ?? undefined });
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
    
    getWallpapers({ limit: 24, offset: 0,category: category ?? undefined })
    .then((res) => {
      setWallpapers(res.data);
      offset.current = res.data.length;
      setHasMore(res.hasMore);
    }) .finally(() => {
      setIsLoadingMore(false)
      isLoadingRef.current = false
    })
  }, [category])

  return (
    <View style={styles.container}>
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
  wallpaperTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: Colors.textPrimary,
  },
})
export default WallpaperGrid