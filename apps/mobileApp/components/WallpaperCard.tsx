import { Pressable, StyleSheet, View } from "react-native";
import { Wallpaper } from "../lib/api";
import { Image } from "expo-image";
import { useLayoutInfo } from "../hooks/useLayout";
import { router } from "expo-router";


const WallpaperCard = ({ wallpaper }: { wallpaper: Wallpaper }) => {
  const { cardGap } = useLayoutInfo();
  const aspectRatio =
    wallpaper.width && wallpaper.height
      ? wallpaper.width / wallpaper.height
      : 9 / 16;
  return (
    <View style={[styles.wallpaperCard, { marginHorizontal: cardGap / 2, marginBottom: cardGap }]}>
      <Pressable 
      onPress={() => router.push({
        pathname: `/wallpaper/${wallpaper.id}`,
        params: {
          dominantColor: wallpaper.dominantColor?.replace('#', '') ?? '',
          blurhash: wallpaper.blurhash ?? '',
          title: wallpaper.title ?? '',
          w: String(wallpaper.width ?? 0),
          h: String(wallpaper.height ?? 0),
        }
      })}
      style={({ pressed }) => ({
        borderRadius: 10,
        overflow: 'hidden',
        opacity: pressed ? 0.85 : 1,
      })}
      >
        <Image
          source={wallpaper.fileUrl}
          style={[styles.wallpaperImage, { aspectRatio }]}
          placeholder={wallpaper.blurhash ? { blurhash: wallpaper.blurhash } : null}
          contentFit="cover"
          placeholderContentFit="cover"
          transition={200}
        />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  wallpaperCard: {
    marginBottom: 12,
  },
  wallpaperImage: {
    width: "100%",
  },
})

export default WallpaperCard