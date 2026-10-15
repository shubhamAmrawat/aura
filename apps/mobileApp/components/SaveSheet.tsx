import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from "react-native";
import { Colors } from "../constants";
import SaveToCollection from "./SaveToCollection";

type Props = {
  visible: boolean;
  onClose: () => void;
  wallpaperId: string;
  onSavedChange?: (saved: boolean) => void;
};

/** Bottom sheet opened by the bookmark on the wallpaper screen. */
const SaveSheet = ({ visible, onClose, wallpaperId, onSavedChange }: Props) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Pressable style={styles.overlay} onPress={onClose} accessibilityLabel="Close" />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        {visible ? <SaveToCollection wallpaperId={wallpaperId} onSavedChange={onSavedChange} onDone={onClose} /> : null}
      </View>
    </KeyboardAvoidingView>
  </Modal>
);

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "flex-end" },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: Colors.bgScrim },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: Colors.border,
    backgroundColor: Colors.bgElevated,
    paddingTop: 10,
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  handle: {
    width: 52,
    height: 5,
    borderRadius: 999,
    backgroundColor: Colors.borderHover,
    alignSelf: "center",
    marginBottom: 18,
  },
});

export default SaveSheet;
