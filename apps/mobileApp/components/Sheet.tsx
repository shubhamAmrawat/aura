import { ReactNode } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from "react-native";
import { Colors } from "../constants";
import { useInsets } from "../hooks/useInsets";

type Props = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
};

/** Bottom sheet shell shared by the app's sheets: scrim, handle, keyboard-aware. */
const Sheet = ({ visible, onClose, children }: Props) => {
  const { bottomPadding } = useInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable style={styles.overlay} onPress={onClose} accessibilityLabel="Close" />
        <View style={[styles.sheet, { paddingBottom: Math.max(bottomPadding, 12) + 18 }]}>
          <View style={styles.handle} />
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

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

export default Sheet;
