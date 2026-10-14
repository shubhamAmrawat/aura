import { useState } from 'react'
import { Pressable, View, type TextInputProps } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Colors } from '../../constants'
import AuthInput, { AUTH_ERROR } from './AuthInput'

type Status = 'idle' | 'ok' | 'error'

/** Password input with a lock icon, show/hide eye and optional ✓ / ✗ state. */
export default function PasswordField({
  status = 'idle',
  showStatusIcon = false,
  ...inputProps
}: TextInputProps & { status?: Status; showStatusIcon?: boolean }) {
  const [visible, setVisible] = useState(false)

  return (
    <AuthInput
      icon="lock-closed-outline"
      status={status}
      secureTextEntry={!visible}
      autoCapitalize="none"
      autoCorrect={false}
      {...inputProps}
      right={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {showStatusIcon && status === 'ok' && <Ionicons name="checkmark" size={18} color={Colors.accent} />}
          {showStatusIcon && status === 'error' && <Ionicons name="close" size={18} color={AUTH_ERROR} />}
          <Pressable
            onPress={() => setVisible((v) => !v)}
            hitSlop={10}
            accessibilityLabel={visible ? 'Hide password' : 'Show password'}
          >
            <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={18} color="rgba(245,240,235,0.55)" />
          </Pressable>
        </View>
      }
    />
  )
}
