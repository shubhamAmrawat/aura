  import { router, useLocalSearchParams } from "expo-router";
  import { useCallback, useEffect, useMemo, useRef, useState } from "react";
  import { Animated, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
  import { getSimilarWallpapers, getWallpaperById, isWallpaperLiked, toggleWallpaperLike, trackWallpaperView } from "../../lib/wallpaperApi";
  import { Wallpaper } from "../../lib/api";
  import { LinearGradient } from "expo-linear-gradient";
  import { getContrastColor, hexToRgba } from "../../utils/color";
  import { Image } from "expo-image";
  import { useLayoutInfo } from "../../hooks/useLayout";
  import { Ionicons } from "@expo/vector-icons";
  import { Colors } from "../../constants";
  import { useInsets } from "../../hooks/useInsets";
  import { useScreenFilter } from "../../lib/ScreenFilterContext";
  import { useToast } from "../../lib/ToastContext";
  import { useAuth } from "../../lib/AuthContext";
  import WallpaperDock from "../../components/WallpaperDock";
  import LockClockPreview from "../../components/LockClockPreview";
  import DockAction from "../../components/DockAction";
  import SaveSheet from "../../components/SaveSheet";
  import { getSavedWallpaperIds } from "../../lib/collectionsApi";
  import * as Haptics from "expo-haptics";

  export default function WallpaperDetail() {
    // ─── Route params ────────────────────────────────────────────────────────────
    // We receive basic wallpaper data as URL params from WallpaperCard.
    // This lets us render the gradient, title, and blurhash placeholder instantly
    // without waiting for the full API call to complete — zero settling feeling.
    const {
      id,
      dominantColor: paramColor,
      blurhash: paramBlurhash,
      fileUrl: paramFileUrl,
      thumbUrl: paramThumbUrl,
      title: paramTitle,
      w, h,
    } = useLocalSearchParams<{
      id: string;
      dominantColor: string;
      blurhash: string;
      fileUrl?: string;
      thumbUrl?: string;
      title: string;
      w: string;
      h: string;
      screen?: "mobile" | "tablet";
    }>();
    const { screen } = useScreenFilter();
    const { showToast } = useToast();
    const { user } = useAuth();
    const seedWallpaper = useMemo<Wallpaper>(
      () => ({
        id,
        title: paramTitle ?? "",
        description: null,
        fileUrl: paramFileUrl ?? "",
        thumbUrl: paramThumbUrl || null,
        blurhash: paramBlurhash ?? "",
        dominantColor: paramColor ? `#${paramColor}` : "#0A0A0A",
        palette: [],
        width: Number(w) || 0,
        height: Number(h) || 0,
        fileSizeBytes: 0,
        format: "jpeg",
        downloadCount: 0,
        likeCount: 0,
        isMobile: false,
        viewCount: 0,
        trendingScore: 0,
        isFeatured: false,
        isPremium: false,
        isAiGenerated: false,
        tags: [],
        categoryId: null,
        status: "approved",
        createdAt: "",
      }),
      [id, paramTitle, paramFileUrl, paramThumbUrl, paramBlurhash, paramColor, w, h]
    );

    // ─── State ───────────────────────────────────────────────────────────────────
    // Start from route params so detail screen renders instantly.
    const [wallpaper, setWallpaper] = useState<Wallpaper | null>(seedWallpaper);
    const [similarWallpapers, setSimilarWallpapers] = useState<Wallpaper[]>([]);
    const [activeIndex, setActiveIndex] = useState(0);
    const [isLiked, setIsLiked] = useState(false);
    const [likeLoading, setLikeLoading] = useState(false);
    const [showClock, setShowClock] = useState(false);
    // Bookmark: filled when the wallpaper is in any of the user's collections.
    const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
    const [showSaveSheet, setShowSaveSheet] = useState(false);
    const likeScale = useRef(new Animated.Value(1)).current;

    // ─── Layout ──────────────────────────────────────────────────────────────────
    const { width, height } = useLayoutInfo();
    const { topPadding, bottomPadding } = useInsets();
    const isTablet = width >= 768;
    const isLandscape = width > height;
    const horizontalPadding = isTablet ? 32 : 20;
  const PEEK = 32;
  const itemWidth = width - PEEK * 2;

    const carouselData = useMemo(
      () => (wallpaper ? [wallpaper, ...similarWallpapers] : []),
      [wallpaper, similarWallpapers]
    );
    const activeWallpaper = carouselData[activeIndex] ?? wallpaper;
    const activeWallpaperId = activeWallpaper?.id ?? id;
    const isSaved = savedIds.has(activeWallpaperId);

    // ─── Derived display values ───────────────────────────────────────────────────
    // Use wallpaper API data when available, fall back to params immediately.
    // This means the UI is never empty — params fill the gap while API loads.
    const dominantColor =
      activeWallpaper?.dominantColor ?? (paramColor ? `#${paramColor}` : "#0A0A0A");
    const displayTitle = activeWallpaper?.title ?? paramTitle ?? "";
    const previewUrl = activeWallpaper?.fileUrl ?? "";
    const previewBlurhash = activeWallpaper?.blurhash ?? paramBlurhash ?? "";
    const previewWidth = activeWallpaper?.width ?? Number(w) ?? 0;
    const previewHeight = activeWallpaper?.height ?? Number(h) ?? 0;

    // Contrast color ensures header text/icons are readable against the gradient
    const contrastColor = getContrastColor(dominantColor);

    const animateLikePress = () => {
      Animated.sequence([
        Animated.spring(likeScale, {
          toValue: 1.2,
          friction: 5,
          useNativeDriver: true,
        }),
        Animated.spring(likeScale, {
          toValue: 1,
          friction: 5,
          useNativeDriver: true,
        }),
      ]).start();
    };

    const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
      if (viewableItems.length > 0) {
        setActiveIndex(viewableItems[0].index ?? 0);
      }
    }).current;

    const viewabilityConfig = useRef({
      itemVisiblePercentThreshold: 50,
    }).current;

    const dockWallpaper = activeWallpaper
      ? {
        ...activeWallpaper,
        downloadCount: activeWallpaper.downloadCount ?? 0,
        likeCount: activeWallpaper.likeCount ?? 0,
        fileSizeBytes: activeWallpaper.fileSizeBytes ?? 0,
        palette: activeWallpaper.palette ?? [],
        tags: activeWallpaper.tags ?? [],
      }
      : null;

    // ─── Data fetching ────────────────────────────────────────────────────────────
    useEffect(() => {
      setActiveIndex(0);
      setWallpaper(seedWallpaper);
      setSimilarWallpapers([]);
      fetchWallpaper();
      fetchSimilarWallpapers();
    }, [id, screen, seedWallpaper]);

    // Count one view per wallpaper shown in this screen (including carousel swipes).
    const viewedIds = useRef(new Set<string>());
    useEffect(() => {
      if (!activeWallpaperId || viewedIds.current.has(activeWallpaperId)) return;
      viewedIds.current.add(activeWallpaperId);
      void trackWallpaperView(activeWallpaperId);
    }, [activeWallpaperId]);

    useEffect(() => {
      if (!user || !activeWallpaperId) {
        setIsLiked(false);
        return;
      }
      let cancelled = false;
      (async () => {
        try {
          const liked = await isWallpaperLiked(activeWallpaperId);
          if (!cancelled) setIsLiked(liked);
        } catch {
          if (!cancelled) setIsLiked(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [activeWallpaperId, user]);

    const fetchWallpaper = async () => {
      const res = await getWallpaperById(id);
      // the detail endpoint has no thumbUrl; keep the one from the tile so the placeholder doesn't flicker
      setWallpaper((prev) => ({ ...res, thumbUrl: res.thumbUrl ?? prev?.thumbUrl ?? null }));
    };

    const fetchSimilarWallpapers = async () => {
      const res = await getSimilarWallpapers(id, screen);
      setSimilarWallpapers(res);
    };

    useEffect(() => {
      if (!user) {
        setSavedIds(new Set());
        return;
      }
      let alive = true;
      getSavedWallpaperIds()
        .then((ids) => alive && setSavedIds(new Set(ids)))
        .catch(() => undefined);
      return () => {
        alive = false;
      };
    }, [user]);

    const openSave = () => {
      if (!user) {
        showToast("Please login to save wallpapers.", { type: "info", position: "top" });
        return;
      }
      void Haptics.selectionAsync().catch(() => undefined);
      setShowSaveSheet(true);
    };

    const onSavedChange = useCallback(
      (saved: boolean) =>
        setSavedIds((prev) => {
          if (prev.has(activeWallpaperId) === saved) return prev;
          const next = new Set(prev);
          if (saved) next.add(activeWallpaperId);
          else next.delete(activeWallpaperId);
          return next;
        }),
      [activeWallpaperId]
    );

    const handleToggleLike = async () => {
      if (!activeWallpaperId || likeLoading) return;
      if (!user) {
        showToast("Please login to like wallpapers.", { type: "info", position: "top" });
        return;
      }

      const previousLiked = isLiked;
      setLikeLoading(true);
      setIsLiked(!previousLiked);
      animateLikePress();
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);

      try {
        const res = await toggleWallpaperLike(activeWallpaperId);
        const nextLiked = res.liked;
        setIsLiked(nextLiked);

        const delta = (nextLiked ? 1 : 0) - (previousLiked ? 1 : 0);
        if (delta !== 0) {
          setWallpaper((prev) =>
            prev && prev.id === activeWallpaperId
              ? { ...prev, likeCount: Math.max(0, (prev.likeCount ?? 0) + delta) }
              : prev
          );
          setSimilarWallpapers((prev) =>
            prev.map((item) =>
              item.id === activeWallpaperId
                ? { ...item, likeCount: Math.max(0, (item.likeCount ?? 0) + delta) }
                : item
            )
          );
        }
      } catch (error) {
        setIsLiked(previousLiked);
        const message = error instanceof Error ? error.message : "Unable to update like";
        showToast(message, { type: "error", position: "top" });
      } finally {
        setLikeLoading(false);
      }
    };

    const renderWallpaperItem = ({ item, index }: { item: Wallpaper; index: number }) => {
      const itemPreviewUrl = item.fileUrl ?? "";
      const itemThumbUrl = item.thumbUrl || "";
      const itemPreviewBlurhash = item.blurhash ?? "";
      const itemPreviewWidth = item.width ?? 0;
      const itemPreviewHeight = item.height ?? 0;
      const aspectRatio =
        itemPreviewWidth && itemPreviewHeight
          ? itemPreviewWidth / itemPreviewHeight
          : 9 / 16;
      const safeAspectRatio = Math.max(0.35, Math.min(aspectRatio, 3.2));
      // Mobile keeps the current compact behavior.
      // Tablet gets a much larger hero frame for both portrait and landscape.
      const mobileImageWidth = Math.min(itemWidth - horizontalPadding * 2, 520);
      const tabletWidthRatio = isLandscape ? 0.62 : 0.78;
      const tabletImageWidth = Math.min(
        itemWidth - horizontalPadding * 2,
        Math.max(640, Math.min(width * tabletWidthRatio, 980))
      );
      const imageWidth = isTablet ? tabletImageWidth : mobileImageWidth;

      const mobileMaxImageHeight = Math.min(height * 0.72, height - topPadding - 116);
      const tabletMaxImageHeight = Math.min(
        isLandscape ? height * 0.8 : height * 0.74,
        height - topPadding - 140
      );
      const maxImageHeight = isTablet ? tabletMaxImageHeight : mobileMaxImageHeight;

      const mobileMinImageHeight = Math.min(maxImageHeight, Math.max(240, height * 0.34));
      const tabletMinImageHeight = Math.min(
        maxImageHeight,
        Math.max(isLandscape ? 360 : 420, height * (isLandscape ? 0.48 : 0.52))
      );
      const minImageHeight = isTablet ? tabletMinImageHeight : mobileMinImageHeight;
      const naturalImageHeight = imageWidth / safeAspectRatio;
      const imageHeight = Math.max(
        minImageHeight,
        Math.min(naturalImageHeight, maxImageHeight)
      );
      const displayedAspectRatio = Math.max(0.1, aspectRatio);
      const frameAspectRatio = imageWidth / imageHeight;
      const displayedImageWidth =
        frameAspectRatio > displayedAspectRatio
          ? imageHeight * displayedAspectRatio
          : imageWidth;
      const displayedImageHeight = displayedImageWidth / displayedAspectRatio;
      const isActive = index === activeIndex
      return (
        <View style={{ width: itemWidth, paddingHorizontal: horizontalPadding, paddingBottom: 100, flex: 1, justifyContent: "center", alignItems: "center", opacity: isActive ? 1 : 0.45 }}>
          <View style={[styles.wallpaperFrame, { width: imageWidth, height: imageHeight }]}>
            {itemPreviewUrl ? (
              <Image
                source={itemThumbUrl || itemPreviewUrl}
                style={styles.wallpaperBackdrop}
                contentFit="cover"
                blurRadius={28}
                transition={300}
              />
            ) : null}
            <Image
              source={itemPreviewUrl || null}
              style={{ width: displayedImageWidth, height: displayedImageHeight, zIndex: 1 }}
              contentFit="cover"
              // the grid's thumbnail is already cached, so show it sharp while the full image loads
              placeholder={itemThumbUrl ? { uri: itemThumbUrl } : itemPreviewBlurhash ? { blurhash: itemPreviewBlurhash } : null}
              placeholderContentFit="cover"
              transition={400}
            />
            {showClock && isActive ? <LockClockPreview width={displayedImageWidth} /> : null}
          </View>
        </View>
      );
    };

    // ─── Render ───────────────────────────────────────────────────────────────────
    return (
      <View style={{ flex: 1, backgroundColor: "#0A0A0A" }}>

        {/* Dynamic gradient — tinted by the wallpaper's dominant color.
            Fades from the dominant color at the top to pure dark at the bottom.
            Available instantly because dominantColor comes from params. */}
        <LinearGradient
          colors={[
            hexToRgba(dominantColor, 0.86),
            hexToRgba("#0A0A0A", 0.72),
            "#0A0A0A",
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
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.85}
          >
            {displayTitle}
          </Text>

          {/* same width as the back button so the title stays centred */}
          <Pressable
            onPress={openSave}
            hitSlop={12}
            style={styles.headerSpacer}
            accessibilityLabel={isSaved ? "Saved to a collection. Change collections" : "Save to collection"}
          >
            <Ionicons name={isSaved ? "bookmark" : "bookmark-outline"} size={26} color={isSaved ? Colors.accent : contrastColor} />
          </Pressable>
        </View>

        <FlatList
          data={carouselData}
          horizontal
          pagingEnabled={false}
          snapToInterval={itemWidth}
          snapToAlignment="start"          // ← center instead of start
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: PEEK }}  // ← symmetric
          keyExtractor={(item) => item.id}
          renderItem={renderWallpaperItem}
          extraData={`${activeIndex}-${showClock}`}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          style={{ flex: 1 }}
        />

        {/* ── Bottom dock placeholder ─────────────────────────────────────────────
            Download · Apply · Details buttons go here (built next) */}

        
        <SaveSheet
          visible={showSaveSheet}
          onClose={() => setShowSaveSheet(false)}
          wallpaperId={activeWallpaperId}
          onSavedChange={onSavedChange}
        />
        {dockWallpaper ? (
          <WallpaperDock
            bottomOffset={bottomPadding + 16}
            screenWidth={width}
            wallpaper={dockWallpaper}
            leadingActions={
              <>
                <DockAction
                  label={isLiked ? "Liked" : "Like"}
                  active={isLiked}
                  activeColor="#FF4D8D"
                  disabled={likeLoading}
                  onPress={handleToggleLike}
                  icon={
                    <Animated.View style={{ transform: [{ scale: likeScale }] }}>
                      <Ionicons name={isLiked ? "heart" : "heart-outline"} size={24} color={isLiked ? "#FF4D8D" : Colors.textPrimary} />
                    </Animated.View>
                  }
                />
                <DockAction
                  label="Preview"
                  active={showClock}
                  accessibilityLabel={showClock ? "Hide lock screen preview" : "Show lock screen preview"}
                  onPress={() => {
                    setShowClock((v) => !v);
                    void Haptics.selectionAsync().catch(() => undefined);
                  }}
                  icon={<Ionicons name={showClock ? "lock-closed" : "lock-closed-outline"} size={24} color={showClock ? Colors.accent : Colors.textPrimary} />}
                />
              </>
            }
          />
        ) : null}

      </View>
    );
  }

  const styles = StyleSheet.create({
    headerContainer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      minHeight: 54,
      paddingHorizontal: 20,
      zIndex: 1,
    },
    headerSpacer: {
      width: 28,
    },
    title: {
      flex: 1,
      marginHorizontal: 12,
      textAlign: "center",
      fontSize: 15,
      lineHeight: 19,
      fontWeight: "700",
      letterSpacing: 0.2,
    },
    wallpaperFrame: {
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      borderRadius: 28,
      borderColor: Colors.cardBorder,
      borderWidth: 1,
      backgroundColor: Colors.bgElevated,
      // Shadow gives the frame a lifted, floating feel
      shadowColor: "#000",
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