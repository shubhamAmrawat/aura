import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import Sheet from "./Sheet";
import { Colors } from "../constants";
import { FALLBACK_PACKS, getAvatarPacks, packAvatarPreview, setPackAvatar, type AvatarPack, type AvatarStyle } from "../lib/profileApi";
const COUNT = 12;
const randomSeeds = () => Array.from({ length: COUNT }, () => Math.floor(Math.random() * 0xffffffff));

/** Profile › choose an avatar from Aurora's packs (the list comes from the API). */
export default function AvatarPackSheet({ visible, onClose, onSaved }: { visible: boolean; onClose: () => void; onSaved: (avatarUrl: string) => void }) {
  const [packs, setPacks] = useState<AvatarPack[]>(FALLBACK_PACKS);
  const [style, setStyle] = useState<AvatarStyle>(FALLBACK_PACKS[0]!.key);
  const [seeds, setSeeds] = useState<number[]>(randomSeeds);
  const [picked, setPicked] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const shown = picked ?? seeds[0]!;

  useEffect(() => {
    if (visible) getAvatarPacks().then(setPacks).catch(() => undefined);
  }, [visible]);

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      onSaved(await setPackAvatar(style, shown));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save your avatar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={() => !saving && onClose()}>
      <Text style={styles.title}>Choose your avatar</Text>
      <View style={styles.top}>
        <Image source={{ uri: packAvatarPreview(style, shown, 256) }} style={styles.preview} contentFit="cover" transition={150} />
        <Pressable
          onPress={() => {
            setSeeds(randomSeeds());
            setPicked(null);
          }}
          style={({ pressed }) => [styles.shuffle, pressed && { opacity: 0.8 }]}
          accessibilityRole="button"
        >
          <Ionicons name="shuffle" size={16} color={Colors.textPrimary} />
          <Text style={styles.shuffleText}>Shuffle</Text>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs} style={styles.tabsScroll} accessibilityRole="tablist">
        {packs.map((p) => (
          <Pressable
            key={p.key}
            onPress={() => {
              setStyle(p.key);
              setPicked(null);
            }}
            style={[styles.tab, style === p.key && styles.tabOn]}
            accessibilityRole="tab"
            accessibilityState={{ selected: style === p.key }}
          >
            <Text style={[styles.tabText, style === p.key && styles.tabTextOn]}>{p.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.grid}>
        {seeds.map((seed) => {
          const on = seed === shown;
          return (
            <Pressable key={`${style}-${seed}`} onPress={() => setPicked(seed)} style={[styles.option, on && styles.optionOn]} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel="Avatar option">
              <Image source={{ uri: packAvatarPreview(style, seed, 160) }} style={styles.optionImg} contentFit="cover" transition={150} />
            </Pressable>
          );
        })}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable onPress={() => void save()} disabled={saving} style={({ pressed }) => [styles.save, (pressed || saving) && { opacity: 0.85 }]} accessibilityRole="button">
        {saving ? <ActivityIndicator color="#0A0A0A" /> : <Text style={styles.saveText}>Use this avatar</Text>}
      </Pressable>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  title: { color: Colors.textPrimary, fontSize: 20, fontWeight: "800", marginBottom: 14 },
  top: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 16 },
  preview: { width: 96, height: 96, borderRadius: 48, backgroundColor: Colors.bgSecondary },
  tabsScroll: { marginHorizontal: -20, marginBottom: 16, flexGrow: 0 },
  tabs: { gap: 8, paddingHorizontal: 20 },
  tab: { height: 34, paddingHorizontal: 14, borderRadius: 17, justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  tabOn: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  tabText: { color: Colors.textSecondary, fontSize: 12.5, fontWeight: "700" },
  tabTextOn: { color: "#0A0A0A" },
  shuffle: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.08)" },
  shuffleText: { color: Colors.textPrimary, fontSize: 13, fontWeight: "700" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 },
  option: { width: "22%", aspectRatio: 1, borderRadius: 999, padding: 3 },
  optionOn: { backgroundColor: Colors.accent },
  optionImg: { width: "100%", height: "100%", borderRadius: 999, backgroundColor: Colors.bgSecondary },
  error: { color: "#F87171", fontSize: 13, marginBottom: 10 },
  save: { height: 50, borderRadius: 25, backgroundColor: Colors.accent, alignItems: "center", justifyContent: "center" },
  saveText: { color: "#0A0A0A", fontSize: 15, fontWeight: "800" },
});
