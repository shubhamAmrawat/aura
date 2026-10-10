import { useState } from 'react'
import { View, TextInput, Pressable, StyleSheet, type TextInputProps } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Colors } from '../../constants'

type Status = 'idle' | 'ok' | 'error'

/** Password input with a lock icon, show/hide eye and optional ✓ / ✗ state. */
export default function PasswordField({
  status = 'idle',
  showStatusIcon = false,
  ...inputProps
}: TextInputProps & { status?: Status; showStatusIcon?: boolean }) {
  const [visible, setVisible] = useState(false)
  const borderColor =
    status === 'ok' ? Colors.accent : status === 'error' ? ERROR : Colors.borderHover

  return (
    <View style={[styles.row, { borderColor }]}>
      <Ionicons name="lock-closed-outline" size={18} color={Colors.textSecondary} />
      <TextInput
        style={styles.input}
        placeholderTextColor={Colors.textMuted}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        underlineColorAndroid="transparent"
        {...inputProps}
      />
      {showStatusIcon && status === 'ok' && <Ionicons name="checkmark" size={18} color={Colors.accent} />}
      {showStatusIcon && status === 'error' && <Ionicons name="close" size={18} color={ERROR} />}
      <Pressable
        onPress={() => setVisible((v) => !v)}
        hitSlop={10}
        accessibilityLabel={visible ? 'Hide password' : 'Show password'}
      >
        <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.textSecondary} />
      </Pressable>
    </View>
  )
}

const ERROR = '#E05252'

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.bgOverlay,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  input: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 15,
    paddingVertical: 12,
  },
})
