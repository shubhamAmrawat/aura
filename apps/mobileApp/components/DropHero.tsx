import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useFonts } from "expo-font";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { Colors } from "../constants";
import { DropInfo, DropPreviewItem, endsInLabel, tint } from "../lib/drops";

const SERIF = "InstrumentSerif";
const src = (w?: DropPreviewItem) => (w ? w.thumbUrl || w.fileUrl : undefined);

/** Top of a drop's page: generated art from its wallpapers, title, and "Auto-change from this drop". */
export default function DropHero({ id, title, description, count, drop }: { id: string; title: string; description: string | null; count: number; drop: DropInfo }) {
  const { width } = useWindowDimensions();
  const [fontsLoaded] = useFonts({ [SERIF]: require("../assets/fonts/InstrumentSerif-Regular.ttf") });
  const serif = fontsLoaded ? { fontFamily: SERIF, fontWeight: "400" as const } : { fontWeight: "700" as const };
  const [first, second, third] = drop.preview;
  const accent = drop.accentColor;
  const ends = drop.status === "live" ? endsInLabel(drop.endsAt) : null;
  const pill = drop.status === "ended" ? "DROP ENDED" : `LIMITED DROP${ends ? ` · ${ends.toUpperCase()}` : ""}`;
  const center = width / 2;
  // Only this device's shape (the API filters it): portrait cards on phones, landscape on tablets.
  const wide = !!first && !first.isMobile;
  const side = wide ? { w: 190, h: 112, top: 70, offset: 300 } : { w: 96, h: 200, top: 34, offset: 140 };
  const mid = wide ? { w: 240, h: 142, top: 52 } : { w: 112, h: 232, top: 16 };

  return (
    <View>
      <View style={styles.art}>
        {first ? <Image source={src(first)} style={styles.backdrop} contentFit="cover" blurRadius={26} /> : null}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.45)" }]} />
        <LinearGradient colors={[tint(accent, 0.28), "transparent"]} start={{ x: 0.5, y: 0.35 }} end={{ x: 0.5, y: 0.9 }} style={StyleSheet.absoluteFill} />
        <LinearGradient colors={["transparent", Colors.bgPrimary]} start={{ x: 0.5, y: 0.55 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />

        {second ? (
          <Image source={src(second)} style={[styles.fan, { left: center - side.offset, top: side.top, width: side.w, height: side.h, transform: [{ rotate: wide ? "-8deg" : "-11deg" }], backgroundColor: second.dominantColor }]} contentFit="cover" />
        ) : null}
        {third ? (
          <Image source={src(third)} style={[styles.fan, { left: center + side.offset - side.w, top: side.top, width: side.w, height: side.h, transform: [{ rotate: wide ? "8deg" : "11deg" }], backgroundColor: third.dominantColor }]} contentFit="cover" />
        ) : null}
        {first ? (
          <Image source={src(first)} style={[styles.fan, { left: center - mid.w / 2, top: mid.top, width: mid.w, height: mid.h, borderRadius: 18, borderColor: tint(accent, 0.6), backgroundColor: first.dominantColor }]} contentFit="cover" />
        ) : null}

        <View style={styles.titleBlock}>
          <View style={[styles.pill, { backgroundColor: tint(accent, 0.18) }]}>
            <View style={[styles.pillDot, { backgroundColor: accent }]} />
            <Text style={[styles.pillText, { color: accent }]}>{pill}</Text>
          </View>
          <Text style={[styles.title, serif]} numberOfLines={2}>
            {title}
          </Text>
          <Text style={styles.meta}>
            Curated by Aurora · {count} {count === 1 ? "wallpaper" : "wallpapers"}
          </Text>
        </View>
      </View>

      <View style={styles.body}>
        {description ? <Text style={styles.description}>{description}</Text> : null}
        {count > 0 ? (
          <Pressable
            onPress={() => {
              void Haptics.selectionAsync().catch(() => undefined);
              router.push({ pathname: "/settings/wallpaper-changer", params: { dropId: id, dropName: title } });
            }}
            style={({ pressed }) => [styles.cta, { backgroundColor: accent }, pressed && { opacity: 0.88 }]}
            accessibilityRole="button"
            accessibilityLabel={`Auto-change your wallpaper from ${title}`}
          >
            <Ionicons name="sync" size={17} color="#140A02" />
            <Text style={styles.ctaText}>Auto-change from this drop</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  art: { height: 380, overflow: "hidden" },
  backdrop: { position: "absolute", top: -40, left: -40, right: -40, bottom: -40 },
  fan: { position: "absolute", borderRadius: 16, borderWidth: 2, borderColor: "rgba(255,255,255,0.18)" },
  titleBlock: { position: "absolute", left: 20, right: 20, bottom: 14, alignItems: "center", gap: 8 },
  pill: { flexDirection: "row", alignItems: "center", gap: 6, height: 24, paddingHorizontal: 10, borderRadius: 12 },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontSize: 10.5, fontWeight: "800", letterSpacing: 1.2 },
  title: { color: "#F5F0EB", fontSize: 46, lineHeight: 48, textAlign: "center" },
  meta: { color: "rgba(245,240,235,0.75)", fontSize: 12.5 },
  body: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 14, gap: 14 },
  description: { color: Colors.textSecondary, fontSize: 14, lineHeight: 21, textAlign: "center" },
  cta: { height: 48, borderRadius: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  ctaText: { color: "#140A02", fontSize: 14.5, fontWeight: "800" },
});
