import { router, useLocalSearchParams } from "expo-router";
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
  // ─── Route params ────────────────────────────────────────────────────────────
  // We receive basic wallpaper data as URL params from WallpaperCard.
  // This lets us render the gradient, title, and blurhash placeholder instantly
  // without waiting for the full API call to complete — zero settling feeling.
  const {
    id,
    dominantColor: paramColor,
    blurhash: paramBlurhash,
    title: paramTitle,
    w, h,
  } = useLocalSearchParams<{
    id: string;
    dominantColor: string;
    blurhash: string;
    title: string;
    w: string;
    h: string;
  }>();

  // ─── State ───────────────────────────────────────────────────────────────────
  // wallpaper starts null — we show param data while the full fetch is in flight
  const [wallpaper, setWallpaper] = useState<Wallpaper | null>(null);
  const [similarWallpapers, setSimilarWallpapers] = useState<Wallpaper[]>([]);

  // ─── Layout ──────────────────────────────────────────────────────────────────
  const { width, height } = useLayoutInfo();
  const { topPadding } = useInsets();
  const horizontalPadding = width >= 768 ? 32 : 20;

  // ─── Derived display values ───────────────────────────────────────────────────
  // Use wallpaper API data when available, fall back to params immediately.
  // This means the UI is never empty — params fill the gap while API loads.
  const dominantColor = wallpaper?.dominantColor 
  ?? (paramColor ? `#${paramColor}` : '#0A0A0A');
  const displayTitle    = wallpaper?.title    ?? paramTitle    ?? '';
  const previewUrl      = wallpaper?.fileUrl  ?? '';
  const previewBlurhash = wallpaper?.blurhash ?? paramBlurhash ?? '';
  const previewWidth    = wallpaper?.width    ?? Number(w)     ?? 0;
  const previewHeight   = wallpaper?.height   ?? Number(h)     ?? 0;

  // Contrast color ensures header text/icons are readable against the gradient
  const contrastColor = getContrastColor(dominantColor);

  // ─── Image sizing ─────────────────────────────────────────────────────────────
  // We constrain the image to a maximum height so tall portraits don't overflow,
  // and landscape walls get a full-height frame. Blurred backdrop fills any gaps.
  const aspectRatio = previewWidth && previewHeight
    ? previewWidth / previewHeight
    : 9 / 16;

  const safeAspectRatio   = Math.max(0.35, Math.min(aspectRatio, 3.2));
  const imageWidth        = Math.min(width - horizontalPadding * 2, 520);
  const maxImageHeight    = Math.min(height * 0.72, height - topPadding - 116);
  const minImageHeight    = Math.min(maxImageHeight, Math.max(240, height * 0.34));
  const naturalImageHeight = imageWidth / safeAspectRatio;
  const imageHeight = Math.max(minImageHeight, Math.min(naturalImageHeight, maxImageHeight));

  // Calculate the actual rendered image dimensions inside the frame
  const displayedAspectRatio = Math.max(0.1, aspectRatio);
  const frameAspectRatio     = imageWidth / imageHeight;
  const displayedImageWidth  = frameAspectRatio > displayedAspectRatio
    ? imageHeight * displayedAspectRatio
    : imageWidth;
  const displayedImageHeight = displayedImageWidth / displayedAspectRatio;

  // ─── Data fetching ────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchWallpaper();
    fetchSimilarWallpapers();
  }, [id]);

  const fetchWallpaper = async () => {
    const res = await getWallpaperById(id);
    setWallpaper(res);
  };

  const fetchSimilarWallpapers = async () => {
    const res = await getSimilarWallpapers(id);
    setSimilarWallpapers(res);
  };

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A0A' }}>

      {/* Dynamic gradient — tinted by the wallpaper's dominant color.
          Fades from the dominant color at the top to pure dark at the bottom.
          Available instantly because dominantColor comes from params. */}
      <LinearGradient
        colors={[
          hexToRgba(dominantColor, 0.86),
          hexToRgba('#0A0A0A', 0.72),
          '#0A0A0A',
        ]}
        locations={[0, 0.48, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* ── Header ─────────────────────────────────────────────────────────────
          Back button | Wallpaper title | Like button
          paddingTop accounts for status bar / notch safe area */}
      <View style={[styles.headerContainer, { paddingTop: topPadding + 10 }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
        >
          <Ionicons name="chevron-back-circle-outline" size={28} color={contrastColor} />
        </Pressable>

        <Text
          style={[styles.title, { color: contrastColor }]}
          numberOfLines={1}
        >
          {displayTitle}
        </Text>

        <Pressable hitSlop={12}>
          <Ionicons name="heart-outline" size={24} color={contrastColor} />
        </Pressable>
      </View>

      {/* ── Wallpaper frame ────────────────────────────────────────────────────
          Two-layer approach:
          Layer 1 (backdrop) — same image blurred, fills the frame.
                               Eliminates pillarboxing for portrait images.
          Layer 2 (main image) — sharp image rendered at its natural aspect ratio. */}
      <View style={[styles.wallpaperContainer, { paddingHorizontal: horizontalPadding }]}>
        <View style={[styles.wallpaperFrame, { width: imageWidth, height: imageHeight }]}>

          {/* Blurred backdrop — only shown once the real URL is available */}
          {previewUrl ? (
            <Image
              source={previewUrl}
              style={styles.wallpaperBackdrop}
              contentFit="cover"
              blurRadius={28}
              transition={300}
            />
          ) : null}

          {/* Sharp main image — shows blurhash placeholder instantly while API loads */}
          <Image
            source={previewUrl || null}
            style={{ width: displayedImageWidth, height: displayedImageHeight, zIndex: 1 }}
            contentFit="cover"
            placeholder={previewBlurhash ? { blurhash: previewBlurhash } : null}
            placeholderContentFit="cover"
            transition={400}
          />
        </View>
      </View>

      {/* ── Bottom dock placeholder ─────────────────────────────────────────────
          Download · Apply · Details buttons go here (built next) */}

    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 54,
    paddingHorizontal: 20,
    zIndex: 1,
  },
  title: {
    flex: 1,
    marginHorizontal: 14,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  wallpaperContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 18,
  },
  wallpaperFrame: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: 28,
    borderColor: Colors.cardBorder,
    borderWidth: 1,
    backgroundColor: Colors.bgElevated,
    // Shadow gives the frame a lifted, floating feel
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.34,
    shadowRadius: 32,
    elevation: 18,
  },
  wallpaperBackdrop: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.58,
    transform: [{ scale: 1.08 }],
  },
});