import { forwardRef, ReactNode, useState } from 'react'
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Colors } from '../../constants'

export const AUTH_ERROR = '#F06464'

type Props = TextInputProps & {
  icon: keyof typeof Ionicons.glyphMap
  /** Border state: red for a problem, green once a value is confirmed good. */
  status?: 'idle' | 'ok' | 'error'
  /** Anything on the right edge (e.g. show-password eye). */
  right?: ReactNode
}

/** Glass text field with a leading icon; lights up green while focused. */
const AuthInput = forwardRef<TextInput, Props>(({ icon, status = 'idle', right, style, onFocus, onBlur, editable = true, ...rest }, ref) => {
  const [focused, setFocused] = useState(false)
  const borderColor =
    status === 'error' ? AUTH_ERROR : focused || status === 'ok' ? Colors.accent : 'rgba(255,255,255,0.12)'

  return (
    <View style={[styles.row, { borderColor }, focused && styles.rowFocused, !editable && styles.rowLocked]}>
      <Ionicons name={icon} size={18} color={focused ? Colors.accent : 'rgba(245,240,235,0.55)'} />
      <TextInput
        ref={ref}
        style={[styles.input, !editable && styles.inputLocked, style]}
        placeholderTextColor="rgba(245,240,235,0.42)"
        selectionColor={Colors.accent}
        cursorColor={Colors.accent}
        underlineColorAndroid="transparent"
        editable={editable}
        onFocus={(e) => {
          setFocused(true)
          onFocus?.(e)
        }}
        onBlur={(e) => {
          setFocused(false)
          onBlur?.(e)
        }}
        {...rest}
      />
      {right}
    </View>
  )
})
AuthInput.displayName = 'AuthInput'

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 54,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  rowFocused: {
    backgroundColor: 'rgba(129,238,78,0.06)',
  },
  rowLocked: {
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  input: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 15,
    paddingVertical: 14,
  },
  inputLocked: {
    color: 'rgba(245,240,235,0.6)',
  },
})

export default AuthInput
