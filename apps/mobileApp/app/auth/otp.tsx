import { useRef, useState } from 'react'
import {
  View, Text, TextInput, Pressable,
  KeyboardAvoidingView, Platform,
  ActivityIndicator, StyleSheet
} from 'react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { router, useLocalSearchParams } from 'expo-router'
import { Colors, Images } from '../../constants'
import { verifyOtp, login } from '../../lib/authApi'
import { useAuth } from '../../lib/AuthContext'


const BLURHASH = "LUH_iU%4u4%fyGkEx^obK+OYwin4"
const OTP_LENGTH = 6

export default function OtpScreen() {
  const { email, type } = useLocalSearchParams<{ email: string; type: string }>()
  const { onLogin } = useAuth()
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const inputs = useRef<(TextInput | null)[]>([])

  const handleChange = (text: string, index: number) => {
    const cleaned = text.replace(/[^0-9]/g, '').slice(-1)
    const next = [...digits]
    next[index] = cleaned
    setDigits(next)
    setError('')
    if (cleaned && index < OTP_LENGTH - 1) {
      inputs.current[index + 1]?.focus()
    }
  }

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus()
      const next = [...digits]
      next[index - 1] = ''
      setDigits(next)
    }
  }

  const handleVerify = async () => {
    const code = digits.join('')
    if (code.length !== OTP_LENGTH) { setError('Enter all 6 digits'); return }
    setError('')
    setLoading(true)
    try {
      await verifyOtp({ email, code, type })
      if (type === 'login') {
        const res = await login({ email })
        await onLogin(res.token, res.user)
        router.replace('/(tabs)')
      } else {
        router.push({ pathname: '/auth/signup', params: { email } })
      }
    } catch (e: any) {
      setError(e.message || 'Invalid OTP')
      setDigits(Array(OTP_LENGTH).fill(''))
      inputs.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }

  const isFilled = digits.every(d => d !== '')

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
      style={styles.root}
    >
      <Image
        source={{ uri: Images.AUTH_WALLPAPER_URL }}
        placeholder={{ blurhash: BLURHASH }}
        contentFit="cover"
        style={StyleSheet.absoluteFillObject}
        transition={400}
      />
      <LinearGradient
        colors={['transparent', 'rgba(10,10,10,0.5)', '#0A0A0A', '#0A0A0A']}
        locations={[0, 0.45, 0.75, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={styles.content}>
        <Text style={styles.brandTitle}>AURORA</Text>
        <Text style={styles.brandSub}>Check your email</Text>
        <Text style={styles.emailLabel}>
          We sent a 6-digit code to{'\n'}
          <Text style={{ color: Colors.textPrimary, fontWeight: '600' }}>{email}</Text>
        </Text>

        <View style={styles.spacer} />

        {/* OTP boxes */}
        <View style={styles.otpRow}>
          {digits.map((digit, i) => (
            <TextInput
              key={i}
              ref={el => { inputs.current[i] = el }}
              style={[
                styles.otpBox,
                digit ? styles.otpBoxFilled : null,
              ]}
              value={digit}
              onChangeText={text => handleChange(text, i)}
              onKeyPress={e => handleKeyPress(e, i)}
              keyboardType="number-pad"
              maxLength={1}
              textAlign="center"
              selectionColor={Colors.accent}
              caretHidden
              underlineColorAndroid="transparent"
            />
          ))}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={({ pressed }) => [
            styles.button,
            !isFilled && styles.buttonDisabled,
            pressed && isFilled && { opacity: 0.85 }
          ]}
          onPress={handleVerify}
          disabled={loading || !isFilled}
        >
          {loading
            ? <ActivityIndicator color={Colors.bgPrimary} size="small" />
            : <Text style={styles.buttonText}>Verify Code</Text>
          }
        </Pressable>

        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Use a different email</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  content: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 24,
    paddingBottom: 60,
    paddingTop: 120,
    gap: 12,
  },
  brandTitle: {
    color: Colors.textPrimary,
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 6,
  },
  brandSub: {
    color: Colors.textSecondary,
    fontSize: 13,
    letterSpacing: 1,
  },
  emailLabel: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
  },
  spacer: { height: 8 },
  otpRow: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  otpBox: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: 'rgba(255,255,255,0.06)',
    color: Colors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
    textAlignVertical: 'center',
  },
  otpBoxFilled: {
    borderColor: Colors.accent,
    backgroundColor: 'rgba(129,238,78,0.10)',
  },
  error: {
    color: '#E05252',
    fontSize: 12,
    textAlign: 'center',
  },
  button: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonText: {
    color: Colors.bgPrimary,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  backBtn: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  backText: {
    color: Colors.textSecondary,
    fontSize: 13,
  },
})