import { useState } from 'react'
import {
  View, Text, TextInput, Pressable,
  KeyboardAvoidingView,
  ActivityIndicator, StyleSheet
} from 'react-native'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { Colors, Images } from '../../constants'
import { loginWithPassword, sendOtp } from '../../lib/authApi'
import { useLayoutInfo } from '../../hooks/useLayout'
import { useAuth } from '../../lib/AuthContext'
import { useToast } from '../../lib/ToastContext'
import { isValidEmail } from '../../lib/validation'
import PasswordField from '../../components/auth/PasswordField'
import FieldHint from '../../components/auth/FieldHint'

const BLURHASH = "LUH_iU%4u4%fyGkEx^obK+OYwin4"

export default function AuthIndex() {
  const { width, height, deviceType } = useLayoutInfo()
  const isTablet = deviceType === 'tablet'
  const isLandscapeTablet = isTablet && width > height
  const { onLogin } = useAuth()
  const { showToast } = useToast()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [emailTouched, setEmailTouched] = useState(false)
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [sendingCode, setSendingCode] = useState(false)
  const [error, setError] = useState('')

  const emailValid = isValidEmail(email)
  const showEmailError = email.length > 0 && !emailValid && emailTouched
  const busy = loading || sendingCode

  const switchMode = (next: 'login' | 'signup') => {
    setMode(next)
    setError('')
    setPassword('')
  }

  // Sign up, or "sign in with a code instead": email a code → OTP screen
  const handleSendOtp = async (type: 'login' | 'signup') => {
    setEmailTouched(true)
    if (!emailValid) return
    setError('')
    setSendingCode(true)
    try {
      await sendOtp({ email: email.trim(), type })
      router.push({ pathname: '/auth/otp', params: { email: email.trim(), type } })
    } catch (e: any) {
      setError(e.message || 'Failed to send code')
    } finally {
      setSendingCode(false)
    }
  }

  const handlePasswordLogin = async () => {
    setEmailTouched(true)
    if (!emailValid || !password) return
    setError('')
    setLoading(true)
    try {
      const res = await loginWithPassword({ email: email.trim(), password })
      await onLogin(res.token, res.user)
      showToast('Welcome back!', { type: 'success' })
      router.replace('/(tabs)')
    } catch (e: any) {
      setError(e.message || 'Sign in failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      behavior="padding"
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
          <Text style={styles.brandSub}>Wallpaper experiences crafted for you</Text>
        </View>

        <View style={[
          styles.card,
          isTablet && styles.cardTablet,
          isLandscapeTablet && styles.cardTabletLandscape,
        ]}>
          <Text style={styles.cardTitle}>{mode === 'login' ? 'Welcome back' : 'Create your account'}</Text>
          <Text style={styles.cardSubtitle}>
            {mode === 'login' ? 'Sign in with your email and password.' : 'Start with your email. We will verify it instantly.'}
          </Text>

          <View style={styles.segmented}>
            <Pressable
              style={[styles.segBtn, mode === 'login' && styles.segBtnActive]}
              onPress={() => switchMode('login')}
            >
              <Text style={[styles.segText, mode === 'login' && styles.segTextActive]}>
                Sign In
              </Text>
            </Pressable>
            <Pressable
              style={[styles.segBtn, mode === 'signup' && styles.segBtnActive]}
              onPress={() => switchMode('signup')}
            >
              <Text style={[styles.segText, mode === 'signup' && styles.segTextActive]}>
                Sign Up
              </Text>
            </Pressable>
          </View>

          <View style={[styles.inputRow, showEmailError && styles.inputRowError]}>
            <Ionicons name="mail-outline" size={18} color={Colors.textSecondary} />
            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              placeholderTextColor={Colors.textMuted}
              value={email}
              onChangeText={(t) => { setEmail(t.trim()); setError('') }}
              onBlur={() => setEmailTouched(true)}
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType={mode === 'login' ? 'next' : 'go'}
              onSubmitEditing={() => { if (mode === 'signup') handleSendOtp('signup') }}
              underlineColorAndroid="transparent"
            />
          </View>
          <FieldHint text={showEmailError && 'Enter a valid email address'} />

          {mode === 'login' && (
            <PasswordField
              placeholder="Password"
              value={password}
              onChangeText={(t) => { setPassword(t); setError('') }}
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={handlePasswordLogin}
            />
          )}

          {error ? (
            <Text style={styles.error}>{error}</Text>
          ) : null}

          {mode === 'login' ? (
            <Pressable
              style={({ pressed }) => [
                styles.button,
                (!emailValid || !password) && styles.buttonDisabled,
                pressed && { opacity: 0.9 },
              ]}
              onPress={handlePasswordLogin}
              disabled={busy || !emailValid || !password}
            >
              {loading
                ? <ActivityIndicator color={Colors.bgPrimary} size="small" />
                : <Text style={styles.buttonText}>Sign In</Text>
              }
            </Pressable>
          ) : (
            <Pressable
              style={({ pressed }) => [styles.button, !emailValid && styles.buttonDisabled, pressed && { opacity: 0.9 }]}
              onPress={() => handleSendOtp('signup')}
              disabled={busy || !emailValid}
            >
              {sendingCode
                ? <ActivityIndicator color={Colors.bgPrimary} size="small" />
                : <Text style={styles.buttonText}>Continue</Text>
              }
            </Pressable>
          )}

          {mode === 'login' && (
            <View style={styles.linkRow}>
              <Pressable
                hitSlop={8}
                disabled={busy}
                onPress={() => router.push({ pathname: '/auth/forgot', params: { email: emailValid ? email.trim() : '' } })}
              >
                <Text style={styles.linkMuted}>Forgot password?</Text>
              </Pressable>
              <Pressable hitSlop={8} disabled={busy} onPress={() => handleSendOtp('login')}>
                {sendingCode
                  ? <ActivityIndicator color={Colors.accent} size="small" />
                  : <Text style={styles.linkAccent}>Sign in with a code instead</Text>}
              </Pressable>
            </View>
          )}

          <Text style={styles.footerCopy}>By continuing, you agree to Aurora terms and privacy policy.</Text>
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
  cardSubtitle: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: Colors.bgOverlay,
    borderWidth: 1,
    borderColor: Colors.borderHover,
    borderRadius: 16,
    padding: 4,
    gap: 4,
  },
  segBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
  },
  segBtnActive: {
    backgroundColor: Colors.accent,
  },
  segText: {
    color: '#E4E0DA',
    fontSize: 14,
    fontWeight: '700',
  },
  segTextActive: {
    color: Colors.bgPrimary,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.bgOverlay,
    borderWidth: 1,
    borderColor: Colors.borderHover,
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
  inputRowError: {
    borderColor: '#E05252',
  },
  error: {
    color: '#E05252',
    fontSize: 12,
    textAlign: 'center',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  linkMuted: {
    color: Colors.textSecondary,
    fontSize: 13,
  },
  linkAccent: {
    color: Colors.accent,
    fontSize: 13,
    fontWeight: '600',
  },
  button: {
    backgroundColor: Colors.accent,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: Colors.bgPrimary,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  footerCopy: {
    color: Colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
  },
})