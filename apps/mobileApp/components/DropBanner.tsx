import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { DropPreviewItem, DropSpotlight, endsAtLabel, tint } from "../lib/drops";

type Serif = { fontFamily?: string; fontWeight: "400" | "700" };

const src = (w?: DropPreviewItem) => (w ? w.thumbUrl || w.fileUrl : undefined);

/**
 * Home banner for the live drop (between the hero and Browse by mood). Everything is made from
 * the drop's own wallpapers: a blurred backdrop of the first, a fan of three, the picked accent.
 */
export default function DropBanner({ drop, serif, onOpen }: { drop: DropSpotlight; serif: Serif; onOpen?: () => void }) {
  const [first, second, third] = drop.preview;
  const accent = drop.accentColor;
  const ends = endsAtLabel(drop.endsAt);
  const words = drop.title.split(" ");
  const titleText = words.length === 2 ? `${words[0]}\n${words[1]}` : drop.title;
  // The art is only this device's shape (the API filters it): portrait cards on phones, landscape on tablets.
  const wide = !!first && !first.isMobile;
  const fan = wide ? wideFan : tallFan;

  return (
    <Pressable
      onPress={() => {
        onOpen?.();
        router.push({ pathname: "/collection/[id]", params: { id: drop.id, title: drop.title } });
      }}
      style={({ pressed }) => [styles.card, { borderColor: tint(accent, 0.35) }, pressed && { opacity: 0.92 }]}
      accessibilityRole="button"
      accessibilityLabel={`${drop.title}, ${drop.wallpaperCount} wallpapers${ends ? `, ${ends}` : ""}. Explore.`}
    >
      {first ? <Image source={src(first)} style={styles.backdrop} contentFit="cover" blurRadius={22} /> : null}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.45)" }]} />
      <LinearGradient colors={["transparent", tint(accent, 0.32)]} start={{ x: 0.35, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={["rgba(0,0,0,0.6)", "transparent"]} start={{ x: 0, y: 0.5 }} end={{ x: 0.7, y: 0.5 }} style={StyleSheet.absoluteFill} />

      {/* fanned cards */}
      {second ? <Image source={src(second)} style={[styles.fan, fan.left, { backgroundColor: second.dominantColor }]} contentFit="cover" transition={150} /> : null}
      {third ? <Image source={src(third)} style={[styles.fan, fan.right, { backgroundColor: third.dominantColor }]} contentFit="cover" transition={150} /> : null}
      {first ? (
        <Image source={src(first)} style={[styles.fan, fan.center, { backgroundColor: first.dominantColor, borderColor: tint(accent, 0.6) }]} contentFit="cover" transition={150} />
      ) : null}

      <View style={styles.info}>
        <View style={{ gap: 8 }}>
          {ends ? (
            <View style={styles.ends}>
              <Ionicons name="time-outline" size={14} color={accent} />
              <Text style={styles.endsText}>{ends}</Text>
            </View>
          ) : null}
          <Text style={[styles.title, serif]} numberOfLines={3}>
            {titleText}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {drop.wallpaperCount} wallpapers
          </Text>
        </View>
        <View style={[styles.cta, { backgroundColor: accent }]}>
          <Text style={styles.ctaText}>Explore</Text>
          <Ionicons name="arrow-forward" size={14} color="#140A02" />
        </View>
      </View>
    </Pressable>
  );
}

const CARD_H = 236;

/** Phone wallpapers: three portrait cards. */
const tallFan = StyleSheet.create({
  left: { right: 108, top: 40, width: 78, height: 164, transform: [{ rotate: "-10deg" }] },
  right: { right: 18, top: 40, width: 78, height: 164, transform: [{ rotate: "10deg" }] },
  center: { right: 60, top: 26, width: 88, height: 186, borderRadius: 16 },
});

/** Desktop wallpapers (tablets): three landscape cards. */
const wideFan = StyleSheet.create({
  left: { right: 250, top: 72, width: 170, height: 100, transform: [{ rotate: "-8deg" }] },
  right: { right: 24, top: 72, width: 170, height: 100, transform: [{ rotate: "8deg" }] },
  center: { right: 110, top: 54, width: 208, height: 124, borderRadius: 16 },
});

const styles = StyleSheet.create({
  card: { height: CARD_H, marginHorizontal: 16, marginTop: 6, borderRadius: 26, overflow: "hidden", borderWidth: 1, backgroundColor: "#0A0A0A" },
  backdrop: { position: "absolute", top: -30, left: -30, right: -30, bottom: -30, opacity: 0.9 },
  fan: { position: "absolute", borderRadius: 14, borderWidth: 2, borderColor: "rgba(255,255,255,0.18)" },
  info: { position: "absolute", left: 18, top: 20, bottom: 18, width: 170, justifyContent: "space-between" },
  ends: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 5 },
  endsText: { color: "rgba(245,240,235,0.85)", fontSize: 12, fontWeight: "600" },
  title: { color: "#F5F0EB", fontSize: 38, lineHeight: 38 },
  meta: { color: "rgba(245,240,235,0.8)", fontSize: 12 },
  cta: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, height: 38, paddingHorizontal: 16, borderRadius: 19 },
  ctaText: { color: "#140A02", fontSize: 13.5, fontWeight: "800" },
});
