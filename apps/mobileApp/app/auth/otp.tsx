import { useEffect, useRef, useState } from 'react'
import {
  View, Text, TextInput, Pressable,
  KeyboardAvoidingView, Platform,
  ActivityIndicator, StyleSheet
} from 'react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { router, useLocalSearchParams } from 'expo-router'
import { Colors, Images } from '../../constants'
import { verifyOtp, login, sendOtp } from '../../lib/authApi'
import { useAuth } from '../../lib/AuthContext'
import { useToast } from '../../lib/ToastContext'
import { useLayoutInfo } from '../../hooks/useLayout'


const BLURHASH = "LUH_iU%4u4%fyGkEx^obK+OYwin4"
const OTP_LENGTH = 6
const RESEND_COOLDOWN_SECONDS = 30

export default function OtpScreen() {
  const { width, height, deviceType } = useLayoutInfo()
  const isTablet = deviceType === 'tablet'
  const isLandscapeTablet = isTablet && width > height
  const { email, type } = useLocalSearchParams<{ email: string; type: string }>()
  const { onLogin } = useAuth()
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''))
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS)
  const [error, setError] = useState('')
  const inputs = useRef<(TextInput | null)[]>([])
  const { showToast } = useToast();

  useEffect(() => {
    if (cooldown <= 0) return

    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)

    return () => clearInterval(timer)
  }, [cooldown])
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
        showToast("Login successful.", { type: "success" });
        router.replace('/(tabs)')
      } else {
        router.push({ pathname: '/auth/signup', params: { email } })
        showToast("Signup successful.", { type: "success" });
      }
    } catch (e: any) {
      setError(e.message || 'Invalid OTP')
      setDigits(Array(OTP_LENGTH).fill(''))
      inputs.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }

  const handleResendOtp = async () => {
    if (cooldown > 0 || resending) return

    setError('')
    setResending(true)
    try {
      await sendOtp({ email, type })
      setDigits(Array(OTP_LENGTH).fill(''))
      setCooldown(RESEND_COOLDOWN_SECONDS)
      showToast('A new OTP was sent to your email.', { type: 'success' })
      inputs.current[0]?.focus()
    } catch (e: any) {
      setError(e.message || 'Failed to resend OTP')
    } finally {
      setResending(false)
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
        colors={['rgba(5,5,5,0.18)', 'rgba(7,7,7,0.50)', 'rgba(8,8,8,0.85)']}
        locations={[0, 0.35, 1]}
        style={StyleSheet.absoluteFillObject}
      />
      <LinearGradient
        colors={['rgba(0,0,0,0)', Colors.bgScrim]}
        locations={[0.38, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={[
        styles.content,
        isTablet && styles.contentTablet,
        isLandscapeTablet && styles.contentTabletLandscape,
      ]}>
        <View style={[
          styles.hero,
          isLandscapeTablet && styles.heroTabletLandscape,
        ]}>
          <Text style={styles.brandTitle}>AURORA</Text>
          <Text style={styles.brandSub}>Secure verification</Text>
        </View>

        <View style={[
          styles.card,
          isTablet && styles.cardTablet,
          isLandscapeTablet && styles.cardTabletLandscape,
        ]}>
          <Text style={styles.cardTitle}>Enter verification code</Text>
          <Text style={styles.emailLabel}>
            We sent a 6-digit code to{'\n'}
            <Text style={styles.emailValue}>{email}</Text>
          </Text>

          <View style={[
            styles.otpRow,
            isTablet && styles.otpRowTablet,
            isLandscapeTablet && styles.otpRowTabletLandscape,
          ]}>
            {digits.map((digit, i) => (
              <TextInput
                key={i}
                ref={el => { inputs.current[i] = el }}
                style={[
                  styles.otpBox,
                  isTablet && styles.otpBoxTablet,
                  isLandscapeTablet && styles.otpBoxTabletLandscape,
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
              scrollEnabled={false}
                underlineColorAndroid="transparent"
              />
            ))}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            style={({ pressed }) => [
              styles.button,
              !isFilled && styles.buttonDisabled,
              pressed && isFilled && { opacity: 0.9 }
            ]}
            onPress={handleVerify}
            disabled={loading || !isFilled}
          >
            {loading
              ? <ActivityIndicator color={Colors.bgPrimary} size="small" />
              : <Text style={styles.buttonText}>Verify Code</Text>
            }
          </Pressable>

          <View style={styles.resendRow}>
            <Text style={styles.resendHint}>Didn&apos;t get the code?</Text>
            <Pressable
              onPress={handleResendOtp}
              disabled={resending || cooldown > 0}
            >
              <Text
                style={[
                  styles.resendLink,
                  (resending || cooldown > 0) && styles.resendLinkDisabled,
                ]}
              >
                {resending
                  ? 'Sending...'
                  : cooldown > 0
                    ? `Resend in ${cooldown}s`
                    : 'Resend code'}
              </Text>
            </Pressable>
          </View>

          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>Use a different email</Text>
          </Pressable>
        </View>
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
    paddingBottom: 34,
    paddingTop: 88,
    gap: 16,
  },
  contentTablet: {
    justifyContent: 'center',
    paddingTop: 42,
    paddingBottom: 28,
    alignItems: 'center',
    gap: 20,
  },
  contentTabletLandscape: {
    paddingTop: 28,
    paddingBottom: 20,
    gap: 16,
  },
  hero: {
    gap: 8,
    paddingHorizontal: 4,
  },
  heroTabletLandscape: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
  },
  card: {
    backgroundColor: Colors.cardSurface,
    borderColor: Colors.cardBorder,
    borderWidth: 1,
    borderRadius: 26,
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 14,
  },
  cardTablet: {
    width: '100%',
    maxWidth: 920,
    paddingHorizontal: 24,
    paddingVertical: 22,
    borderRadius: 28,
  },
  cardTabletLandscape: {
    maxWidth: 760,
    paddingVertical: 18,
  },
  brandTitle: {
    color: Colors.textPrimary,
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: 5,
  },
  brandSub: {
    color: '#D0CFCF',
    fontSize: 14,
    letterSpacing: 0.6,
    lineHeight: 20,
  },
  cardTitle: {
    color: Colors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
  },
  emailLabel: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
  },
  emailValue: {
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  otpRow: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  otpRowTablet: {
    gap: 12,
  },
  otpRowTabletLandscape: {
    justifyContent: 'center',
    gap: 10,
  },
  otpBox: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.borderHover,
    backgroundColor: Colors.bgOverlay,
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
  otpBoxTablet: {
    maxWidth: 124,
  },
  otpBoxTabletLandscape: {
    flex: 0,
    width: 74,
    borderRadius: 12,
    fontSize: 22,
    lineHeight: 22,
  },
  otpBoxFilled: {
    borderColor: Colors.accent,
    backgroundColor: 'rgba(129,238,78,0.14)',
  },
  error: {
    color: '#E05252',
    fontSize: 12,
    textAlign: 'center',
  },
  button: {
    backgroundColor: Colors.accent,
    borderRadius: 14,
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
  resendRow: {
    alignItems: 'center',
    gap: 4,
    paddingTop: 2,
  },
  resendHint: {
    color: Colors.textMuted,
    fontSize: 12,
  },
  resendLink: {
    color: Colors.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  resendLinkDisabled: {
    color: Colors.textSecondary,
  },
  backBtn: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  backText: {
    color: Colors.textSecondary,
    fontSize: 13,
    textDecorationLine: 'underline',
  },
})