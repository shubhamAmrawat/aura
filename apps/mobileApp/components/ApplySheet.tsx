import { Ionicons } from "@expo/vector-icons"
import { Modal, Pressable, StyleSheet, Text, View } from "react-native"
import { Colors } from "../constants"
import { WallpaperTarget } from "../lib/applyWallpaper"

interface ApplySheetProps {
  visible: boolean
  onClose: () => void
  onSelect: (target: WallpaperTarget) => void
  applying: boolean
}

export default function ApplySheet({ visible, onClose, onSelect, applying }: ApplySheetProps) {
  const options: { label: string; sub: string; icon: any; target: WallpaperTarget }[] = [
    {
      label: 'Home Screen',
      sub: 'Set as your home screen wallpaper',
      icon: 'home-outline',
      target: 'home',
    },
    {
      label: 'Lock Screen',
      sub: 'Set as your lock screen wallpaper',
      icon: 'lock-closed-outline',
      target: 'lock',
    },
    {
      label: 'Both Screens',
      sub: 'Apply to both screens at once',
      icon: 'phone-portrait-outline',
      target: 'both',
    },
  ]

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Tap outside to dismiss */}
        <Pressable style={styles.overlay} onPress={onClose} />

        <View style={styles.sheetWrapper}>
          <View style={styles.sheet}>
            {/* Handle bar */}
            <View style={styles.handle} />

            <Text style={styles.title}>Apply Wallpaper</Text>
            <Text style={styles.subtitle}>Choose where to apply this wallpaper</Text>

            <View style={styles.options}>
              {options.map((opt) => (
                <Pressable
                  key={opt.target}
                  style={({ pressed }) => [
                    styles.option,
                    pressed && { opacity: 0.7 },
                    applying && { opacity: 0.4 },
                  ]}
                  onPress={() => onSelect(opt.target)}
                  disabled={applying}
                >
                  <View style={styles.optionIcon}>
                    <Ionicons name={opt.icon} size={20} color={Colors.accent} />
                  </View>
                  <View style={styles.optionText}>
                    <Text style={styles.optionLabel}>{opt.label}</Text>
                    {/* <Text style={styles.optionSub}>{opt.sub}</Text> */}
                  </View>
                  {/* <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} /> */}
                </Pressable>
              ))}
            </View>

            <Pressable style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheetWrapper: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: Colors.border,
    overflow: 'hidden',
    backgroundColor: Colors.bgElevated,
  },
  sheet: {
    backgroundColor: Colors.bgElevated,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 36,
    gap: 16,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: 4,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: 13,
    marginTop: -8,
  },
  options: {
    width: '100%',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  option: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    backgroundColor: Colors.bgSecondary,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.bgPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  optionText: {
    // flex: 1,
    // gap: 2,
  },
  optionLabel: {
    color: Colors.textPrimary,
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  optionSub: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelText: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
})