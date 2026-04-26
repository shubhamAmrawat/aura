import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { getSimilarWallpapers, getWallpaperById } from "../../lib/wallpaperApi";
import { Wallpaper } from "../../lib/api";
import { LinearGradient } from "expo-linear-gradient";
import { getContrastColor, hexToRgba } from "../../utils/color";
import { Image } from "expo-image";
import { useLayoutInfo } from "../../hooks/useLayout";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../constants";
import { useInsets } from "../../hooks/useInsets";


export default function WallpaperDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [wallpaper, setWallpaper] = useState<Wallpaper | null>(null);
  const [similarWallpapers, setSimilarWallpapers] = useState<Wallpaper[]>([]);

  const { width, height } = useLayoutInfo();
  const { topPadding } = useInsets();
  const dominantColor = wallpaper?.dominantColor ?? '#0A0A0A';
  const contrastColor = getContrastColor(dominantColor);
  const aspectRatio =
    wallpaper?.width && wallpaper?.height
      ? wallpaper.width / wallpaper.height
      : 9 / 16;
  const imageWidth = Math.min(width - 32, 480);
  const isLandscape = (wallpaper?.width ?? 0) > (wallpaper?.height ?? 1);
  const maxImageHeight = height * 0.65; // never taller than 65% of screen
  const imageHeight = isLandscape
    ? maxImageHeight                        // give landscape full height
    : Math.min(imageWidth / aspectRatio, maxImageHeight); // normal portrait logic
  useEffect(() => {
    fetchWallpaper();
    fetchSimilarWallpapers();
  }, [id]);

  const fetchWallpaper = async () => {
    const res = await getWallpaperById(id);
    setWallpaper(res);
  }

  const fetchSimilarWallpapers = async () => {
    const res = await getSimilarWallpapers(id);
    setSimilarWallpapers(res);
  }


  const cleanTitle = wallpaper?.title && wallpaper?.title?.length > 20 ? wallpaper?.title.slice(0, 20) + '...' : wallpaper?.title;
  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A0A' }}>
      <LinearGradient
        colors={[
          hexToRgba(wallpaper?.dominantColor || '#0A0A0A', 1),
          '#0A0A0A',
        ]}
        locations={[0, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* HEADER SECTION  */}

      <View style={[styles.headerContainer, { paddingTop: topPadding + 10 }]}>

        <Pressable>
          <Ionicons name="chevron-back-circle-outline" size={24} color={contrastColor} />
        </Pressable>
        <Text style={[styles.title, { color: contrastColor }]} numberOfLines={1} >{cleanTitle}</Text>

        <Pressable>
          <Ionicons name="heart-outline" size={20} color={contrastColor} />
        </Pressable>
      </View>
      {/* wallpaper section  */}
      <View style={styles.wallpaperContainer}>
        <View style={{ width: imageWidth, height: imageHeight, borderRadius: 15, overflow: 'hidden', borderColor: Colors.cardBorder, borderWidth: 0.7 }}>

          {/* Blurred background — only for portrait to fill pillar gaps */}
  {!isLandscape && (
    <Image
      source={{ uri: wallpaper?.fileUrl }}
      style={StyleSheet.absoluteFillObject}
      contentFit="cover"
      blurRadius={20}
    />
  )}

          {/* Layer 2 — sharp image contained on top */}
          <Image
            source={{ uri: wallpaper?.fileUrl }}
            style={{ width: '100%', height: '100%' }}
            contentFit={isLandscape ? 'cover' : 'contain'}
            transition={400}
            placeholder={{ blurhash: wallpaper?.blurhash }}
          />
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wallpaperContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 26,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,

  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 3,
  }
});