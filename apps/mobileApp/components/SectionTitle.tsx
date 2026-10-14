import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../constants";

type Props = { title: string; onSeeAll?: () => void };

/** Section heading with an optional "See all" link. */
const SectionTitle = ({ title, onSeeAll }: Props) => (
  <View style={styles.row}>
    <Text style={styles.title}>{title}</Text>
    {onSeeAll ? (
      <Pressable onPress={onSeeAll} hitSlop={10} style={styles.link}>
        <Text style={styles.linkText}>See all</Text>
        <Ionicons name="chevron-forward" size={14} color={Colors.accent} />
      </Pressable>
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  link: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  linkText: {
    color: Colors.accent,
    fontSize: 13,
    fontWeight: "700",
  },
});

export default SectionTitle;
