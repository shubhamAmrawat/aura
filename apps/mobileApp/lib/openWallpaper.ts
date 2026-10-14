import { router } from "expo-router";
import { WallpaperTile } from "./api";

/** Open the detail screen, passing what the tile already has so it renders instantly. */
export function openWallpaper(w: WallpaperTile) {
  router.push({
    pathname: "/wallpaper/[id]",
    params: {
      id: w.id,
      dominantColor: w.dominantColor?.replace("#", "") ?? "",
      blurhash: w.blurhash ?? "",
      fileUrl: w.fileUrl ?? "",
      thumbUrl: w.thumbUrl ?? "",
      title: w.title ?? "",
      w: String(w.width ?? 0),
      h: String(w.height ?? 0),
    },
  });
}
