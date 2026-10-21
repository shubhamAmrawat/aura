import { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { WallpaperTile } from "../lib/api";
import { Image } from "expo-image";
import { useLayoutInfo } from "../hooks/useLayout";
import { openWallpaper } from "../lib/openWallpaper";
import { Colors } from "../constants";

type Props = {
  wallpaper: WallpaperTile;
  /** Defaults to opening the wallpaper. */
  onPress?: (w: WallpaperTile) => void;
  onLongPress?: (w: WallpaperTile) => void;
  /** Selection mode: show a check circle; `selected` fills it. */
  selecting?: boolean;
  selected?: boolean;
};

const WallpaperCard = ({ wallpaper, onPress, onLongPress, selecting = false, selected = false }: Props) => {
  const { cardGap } = useLayoutInfo();

  const aspectRatio =
    wallpaper.width && wallpaper.height ? wallpaper.width / wallpaper.height : 9 / 16;

  return (
    <View style={[styles.wallpaperCard, { marginHorizontal: cardGap / 2, marginBottom: cardGap }]}>
      <Pressable
        onPress={() => (onPress ? onPress(wallpaper) : openWallpaper(wallpaper))}
        onLongPress={onLongPress ? () => onLongPress(wallpaper) : undefined}
        delayLongPress={350}
        accessibilityState={selecting ? { selected } : undefined}
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
          style={[styles.wallpaperImage, { aspectRatio, backgroundColor: wallpaper.dominantColor || Colors.bgElevated }]}
          placeholder={wallpaper.blurhash ? { blurhash: wallpaper.blurhash } : null}
          contentFit="cover"
          placeholderContentFit="cover"
          transition={200}
        />
        {selecting ? (
          <>
            {selected ? <View style={styles.selectedFrame} pointerEvents="none" /> : null}
            <View style={[styles.check, selected && styles.checkOn]} pointerEvents="none">
              {selected ? <Ionicons name="checkmark" size={16} color="#0A0A0A" /> : null}
            </View>
          </>
        ) : null}
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
  selectedFrame: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 10,
    borderWidth: 3,
    borderColor: Colors.accent,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  check: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.9)",
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  checkOn: { backgroundColor: Colors.accent, borderColor: Colors.accent },
});

export default memo(WallpaperCard);
