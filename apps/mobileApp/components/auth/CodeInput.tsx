import { useRef } from 'react'
import { View, TextInput, StyleSheet } from 'react-native'
import { Colors } from '../../constants'

export const CODE_LENGTH = 6

/** Six single-digit boxes (same look as the OTP screen). `value` is the code string. */
export default function CodeInput({ value, onChange, onComplete }: {
  value: string
  onChange: (code: string) => void
  onComplete?: (code: string) => void
}) {
  const inputs = useRef<(TextInput | null)[]>([])
  const digits = Array.from({ length: CODE_LENGTH }, (_, i) => value[i] ?? '')

  const setDigit = (index: number, text: string) => {
    let cleaned = text.replace(/[^0-9]/g, '')
    // Typing over an already-filled first box gives 2 chars: keep the new one
    if (cleaned.length === 2 && digits[index]) cleaned = cleaned.slice(-1)
    // Pasted / autofilled full code
    if (cleaned.length > 1) {
      const code = cleaned.slice(0, CODE_LENGTH)
      onChange(code)
      inputs.current[Math.min(code.length, CODE_LENGTH) - 1]?.focus()
      if (code.length === CODE_LENGTH) onComplete?.(code)
      return
    }
    const next = [...digits]
    next[index] = cleaned
    const code = next.join('')
    onChange(code)
    if (cleaned && index < CODE_LENGTH - 1) inputs.current[index + 1]?.focus()
    if (code.length === CODE_LENGTH && next.every(Boolean)) onComplete?.(code)
  }

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !digits[index] && index > 0) {
      const next = [...digits]
      next[index - 1] = ''
      onChange(next.join(''))
      inputs.current[index - 1]?.focus()
    }
  }

  return (
    <View style={styles.row}>
      {digits.map((digit, i) => (
        <TextInput
          key={i}
          ref={(el) => { inputs.current[i] = el }}
          style={[styles.box, digit ? styles.boxFilled : null]}
          value={digit}
          onChangeText={(t) => setDigit(i, t)}
          onKeyPress={(e) => handleKeyPress(e.nativeEvent.key, i)}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete={i === 0 ? 'sms-otp' : 'off'}
          maxLength={i === 0 ? CODE_LENGTH : 1}
          textAlign="center"
          selectionColor={Colors.accent}
          caretHidden
          scrollEnabled={false}
          underlineColorAndroid="transparent"
          autoFocus={i === 0}
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  box: {
    flex: 1,
    minWidth: 0,
    maxWidth: 74,
    aspectRatio: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    color: Colors.textPrimary,
    fontSize: 24,
    lineHeight: 24,
    fontWeight: '700',
    includeFontPadding: false,
    paddingHorizontal: 0,
    paddingVertical: 0,
    textAlignVertical: 'center',
    overflow: 'hidden',
  },
  boxFilled: {
    borderColor: Colors.accent,
    backgroundColor: 'rgba(129,238,78,0.10)',
  },
})
