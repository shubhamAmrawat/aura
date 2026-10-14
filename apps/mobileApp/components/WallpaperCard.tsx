import { Pressable, StyleSheet, View } from "react-native";
import { WallpaperTile } from "../lib/api";
import { Image } from "expo-image";
import { useLayoutInfo } from "../hooks/useLayout";
import { openWallpaper } from "../lib/openWallpaper";

const WallpaperCard = ({ wallpaper }: { wallpaper: WallpaperTile }) => {
  const { cardGap } = useLayoutInfo();

  const aspectRatio =
    wallpaper.width && wallpaper.height ? wallpaper.width / wallpaper.height : 9 / 16;

  return (
    <View style={[styles.wallpaperCard, { marginHorizontal: cardGap / 2, marginBottom: cardGap }]}>
      <Pressable
        onPress={() => openWallpaper(wallpaper)}
        style={({ pressed }) => ({
          borderRadius: 10,
          overflow: "hidden",
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Image
          // small 600px thumbnail in grids; the detail screen loads the full image
          source={wallpaper.thumbUrl || wallpaper.fileUrl}
          recyclingKey={wallpaper.id}
          style={[styles.wallpaperImage, { aspectRatio, backgroundColor: wallpaper.dominantColor || "#1A1A1A" }]}
          placeholder={wallpaper.blurhash ? { blurhash: wallpaper.blurhash } : null}
          contentFit="cover"
          placeholderContentFit="cover"
          transition={200}
        />
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  wallpaperCard: {
    marginBottom: 12,
  },
  wallpaperImage: {
    width: "100%",
  },
});

export default WallpaperCard;
