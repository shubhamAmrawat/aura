import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../constants";
import { Collection, createCollection } from "../lib/collectionsApi";

type Props = {
  onCreated: (collection: Collection) => void;
  onCancel?: () => void;
};

/** Name + public/private toggle + Create. Private by default, like the website. */
const NewCollectionForm = ({ onCreated, onCancel }: Props) => {
  const [title, setTitle] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canCreate = title.trim().length > 0 && !busy;

  const submit = async () => {
    if (!canCreate) return;
    setBusy(true);
    setError(null);
    try {
      onCreated(await createCollection({ title: title.trim(), isPublic }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create the collection.");
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="Collection name"
        placeholderTextColor={Colors.textMuted}
        style={styles.input}
        maxLength={60}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={submit}
      />
      <Pressable
        onPress={() => setIsPublic((v) => !v)}
        style={styles.toggleRow}
        accessibilityRole="switch"
        accessibilityState={{ checked: isPublic }}
      >
        <Ionicons name={isPublic ? "globe-outline" : "lock-closed-outline"} size={18} color={Colors.textSecondary} />
        <Text style={styles.toggleText}>{isPublic ? "Public — anyone with the link can see it" : "Private — only you can see it"}</Text>
        <View style={[styles.switch, isPublic && styles.switchOn]}>
          <View style={[styles.knob, isPublic && styles.knobOn]} />
        </View>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.actions}>
        {onCancel ? (
          <Pressable onPress={onCancel} style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.8 }]}>
            <Text style={styles.secondaryText}>Cancel</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={submit}
          disabled={!canCreate}
          style={({ pressed }) => [styles.primary, !canCreate && styles.disabled, pressed && { opacity: 0.85 }]}
        >
          {busy ? <ActivityIndicator color="#0A0A0A" size="small" /> : <Text style={styles.primaryText}>Create</Text>}
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  input: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderHover,
    backgroundColor: Colors.bgSecondary,
    paddingHorizontal: 14,
    color: Colors.textPrimary,
    fontSize: 15,
  },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 },
  toggleText: { flex: 1, color: Colors.textSecondary, fontSize: 13 },
  switch: {
    width: 40,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.borderHover,
    padding: 3,
    justifyContent: "center",
  },
  switchOn: { backgroundColor: Colors.accent },
  knob: { width: 18, height: 18, borderRadius: 9, backgroundColor: Colors.textPrimary },
  knobOn: { alignSelf: "flex-end", backgroundColor: "#0A0A0A" },
  error: { color: "#E45A5A", fontSize: 13 },
  actions: { flexDirection: "row", gap: 10 },
  primary: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { color: "#0A0A0A", fontSize: 15, fontWeight: "800" },
  disabled: { opacity: 0.4 },
  secondary: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderHover,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: { color: Colors.textPrimary, fontSize: 15, fontWeight: "700" },
});

export default NewCollectionForm;
