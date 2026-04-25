import { StyleSheet, Text, View } from "react-native";
import { Wallpaper } from "../lib/api";
import { Colors } from "../constants/colors";
import { Image } from "expo-image";
import { useLayoutInfo } from "../hooks/useLayout";


const WallpaperCard = ({ wallpaper }: { wallpaper: Wallpaper }) => {
  const { cardGap } = useLayoutInfo();
  const aspectRatio =
    wallpaper.width && wallpaper.height
      ? wallpaper.width / wallpaper.height
      : 9/16;
  return (
    <View style={[styles.wallpaperCard, { marginHorizontal: cardGap / 2, marginBottom: cardGap }]}>
      <Image
        source={{ uri: wallpaper.fileUrl }}
        style={[styles.wallpaperImage, { aspectRatio }]}
        placeholder={
          wallpaper.blurhash
            ? { blurhash: wallpaper.blurhash }
            : wallpaper.dominantColor ?? Colors.bgElevated
        }
        contentFit="cover"
        placeholderContentFit="cover"   
        transition={200}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  wallpaperCard: {
    marginBottom: 12,
  },
  wallpaperTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: Colors.textPrimary,
  },
  wallpaperImage: {
    width: "100%",

    borderRadius: 10,
  },

})

export default WallpaperCard