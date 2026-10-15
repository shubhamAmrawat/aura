import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../constants";
import { Collection } from "../lib/collectionsApi";
import { useCollectionActions } from "../lib/CollectionsContext";

// Same limits as the API (services/api/src/validators/collection.schema.ts).
export const TITLE_MAX = 60;
export const DESCRIPTION_MAX = 300;

type Props =
  | { mode: "create"; onDone: (collection: Collection) => void; onCancel?: () => void }
  | { mode: "edit"; collection: Pick<Collection, "id" | "title" | "description" | "isPublic">; onDone: () => void; onCancel?: () => void };

/** Create a collection (name + privacy) or edit one (name, description, privacy). */
const CollectionForm = (props: Props) => {
  const { createCollection, updateCollection } = useCollectionActions();
  const initial = props.mode === "edit" ? props.collection : null;
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [isPublic, setIsPublic] = useState(initial?.isPublic ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedTitle = title.trim();
  const trimmedDescription = description.trim();
  const changed =
    !initial ||
    trimmedTitle !== initial.title ||
    (trimmedDescription || null) !== (initial.description || null) ||
    isPublic !== initial.isPublic;
  const canSubmit = trimmedTitle.length > 0 && changed && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      if (props.mode === "create") {
        props.onDone(await createCollection({ title: trimmedTitle, isPublic }));
      } else {
        await updateCollection(props.collection.id, {
          title: trimmedTitle !== initial!.title ? trimmedTitle : undefined,
          description: (trimmedDescription || null) !== (initial!.description || null) ? trimmedDescription || null : undefined,
          isPublic: isPublic !== initial!.isPublic ? isPublic : undefined,
        });
        props.onDone();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
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
        maxLength={TITLE_MAX}
        autoFocus={props.mode === "create"}
        returnKeyType={props.mode === "create" ? "done" : "next"}
        onSubmitEditing={props.mode === "create" ? submit : undefined}
        accessibilityLabel="Collection name"
      />
      {props.mode === "edit" ? (
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Description (optional)"
          placeholderTextColor={Colors.textMuted}
          style={[styles.input, styles.multiline]}
          maxLength={DESCRIPTION_MAX}
          multiline
          textAlignVertical="top"
          accessibilityLabel="Description"
        />
      ) : null}
      <Pressable
        onPress={() => setIsPublic((v) => !v)}
        style={styles.toggleRow}
        accessibilityRole="switch"
        accessibilityState={{ checked: isPublic }}
        accessibilityLabel="Public collection"
      >
        <Ionicons name={isPublic ? "globe-outline" : "lock-closed-outline"} size={18} color={Colors.textSecondary} />
        <Text style={styles.toggleText}>{isPublic ? "Public — anyone with the link can see it" : "Private — only you can see it"}</Text>
        <View style={[styles.switch, isPublic && styles.switchOn]}>
          <View style={[styles.knob, isPublic && styles.knobOn]} />
        </View>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.actions}>
        {props.onCancel ? (
          <Pressable onPress={props.onCancel} style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.8 }]}>
            <Text style={styles.secondaryText}>Cancel</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={submit}
          disabled={!canSubmit}
          style={({ pressed }) => [styles.primary, !canSubmit && styles.disabled, pressed && { opacity: 0.85 }]}
        >
          {busy ? (
            <ActivityIndicator color="#0A0A0A" size="small" />
          ) : (
            <Text style={styles.primaryText}>{props.mode === "create" ? "Create" : "Save"}</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  input: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderHover,
    backgroundColor: Colors.bgSecondary,
    paddingHorizontal: 14,
    color: Colors.textPrimary,
    fontSize: 15,
  },
  multiline: { minHeight: 88, maxHeight: 140, paddingTop: 12, paddingBottom: 12 },
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

export default CollectionForm;
