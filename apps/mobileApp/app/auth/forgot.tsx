import { useEffect, useState } from 'react'
import {
  View, Text, TextInput, Pressable,
  KeyboardAvoidingView, ActivityIndicator, StyleSheet, BackHandler,
} from 'react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Colors, Images } from '../../constants'
import { forgotPassword, loginWithPassword, resetPassword, verifyResetCode } from '../../lib/authApi'
import { useAuth } from '../../lib/AuthContext'
import { useToast } from '../../lib/ToastContext'
import { useLayoutInfo } from '../../hooks/useLayout'
import { isValidEmail, MIN_PASSWORD_LENGTH } from '../../lib/validation'
import PasswordField from '../../components/auth/PasswordField'
import FieldHint from '../../components/auth/FieldHint'
import CodeInput, { CODE_LENGTH } from '../../components/auth/CodeInput'

const BLURHASH = "LUH_iU%4u4%fyGkEx^obK+OYwin4"
const RESEND_COOLDOWN_SECONDS = 60

type Step = 'email' | 'code' | 'password'

/** Forgot password: email → code → new password, then signs the user in. */
export default function ForgotPasswordScreen() {
  const { width, height, deviceType } = useLayoutInfo()
  const isTablet = deviceType === 'tablet'
  const isLandscapeTablet = isTablet && width > height
  const params = useLocalSearchParams<{ email?: string }>()
  const { onLogin } = useAuth()
  const { showToast } = useToast()

  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState(params.email ?? '')
  const [emailTouched, setEmailTouched] = useState(false)
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [confirmTouched, setConfirmTouched] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const emailValid = isValidEmail(email)
  const showEmailError = email.length > 0 && !emailValid && emailTouched
  const tooShort = newPassword.length > 0 && newPassword.length < MIN_PASSWORD_LENGTH
  const passwordsMatch = newPassword.length >= MIN_PASSWORD_LENGTH && newPassword === confirmPassword
  const showMismatch =
    confirmPassword.length > 0 && !passwordsMatch &&
    (confirmTouched || confirmPassword.length >= newPassword.length)

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setInterval(() => setCooldown((s) => (s > 0 ? s - 1 : 0)), 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  // Android back goes to the previous step instead of leaving the screen
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step === 'email') return false
      goTo(step === 'password' ? 'code' : 'email')
      return true
    })
    return () => sub.remove()
  }, [step])

  const goTo = (next: Step) => {
    setError('')
    setStep(next)
  }

  const handleSendCode = async () => {
    setEmailTouched(true)
    if (!emailValid || loading) return
    setError('')
    setLoading(true)
    try {
      await forgotPassword(email.trim())
      setCode('')
      setCooldown(RESEND_COOLDOWN_SECONDS)
      if (step !== 'code') setStep('code')
      else showToast('If an account exists, a new code was sent.', { type: 'success' })
    } catch (e: any) {
      setError(e.message || 'Failed to send code')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyCode = async (value = code) => {
    if (value.length !== CODE_LENGTH || loading) return
    setError('')
    setLoading(true)
    try {
      await verifyResetCode({ email: email.trim(), otp: value })
      setNewPassword('')
      setConfirmPassword('')
      setConfirmTouched(false)
      setStep('password')
    } catch (e: any) {
      setError(e.message || 'Invalid code')
      setCode('')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = async () => {
    if (!passwordsMatch || loading) return
    setError('')
    setLoading(true)
    try {
      await resetPassword({ email: email.trim(), newPassword })
      const res = await loginWithPassword({ email: email.trim(), password: newPassword })
      await onLogin(res.token, res.user)
      showToast('Password updated. Welcome back!', { type: 'success' })
      router.replace('/(tabs)')
    } catch (e: any) {
      setError(e.message || 'Failed to reset password')
      setLoading(false)
    }
  }

  const title =
    step === 'email' ? 'Reset your password' : step === 'code' ? 'Check your inbox' : 'Choose a new password'

  return (
    <KeyboardAvoidingView behavior="padding" style={styles.root}>
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
        <View style={[styles.hero, isLandscapeTablet && styles.heroTabletLandscape]}>
          <Text style={styles.brandTitle}>AURORA</Text>
          <Text style={styles.brandSub}>Account recovery</Text>
        </View>

        <View style={[
          styles.card,
          isTablet && styles.cardTablet,
          isLandscapeTablet && styles.cardTabletLandscape,
        ]}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardSubtitle}>
            {step === 'email' && "Enter your email and we'll send you a 6-digit code."}
            {step === 'code' && <>Enter the code sent to{'\n'}<Text style={styles.emailValue}>{email.trim()}</Text></>}
            {step === 'password' && <>Set a new password for{'\n'}<Text style={styles.emailValue}>{email.trim()}</Text></>}
          </Text>

          {/* Step 1: email */}
          {step === 'email' && (
            <>
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
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="go"
                  onSubmitEditing={handleSendCode}
                  autoFocus={!params.email}
                  underlineColorAndroid="transparent"
                />
              </View>
              <FieldHint text={showEmailError && 'Enter a valid email address'} />
            </>
          )}

          {/* Step 2: code */}
          {step === 'code' && (
            <CodeInput value={code} onChange={(c) => { setCode(c); setError('') }} onComplete={handleVerifyCode} />
          )}

          {/* Step 3: new password */}
          {step === 'password' && (
            <>
              <PasswordField
                placeholder={`New password (min ${MIN_PASSWORD_LENGTH} characters)`}
                value={newPassword}
                onChangeText={(t) => { setNewPassword(t); setError('') }}
                status={tooShort ? 'error' : 'idle'}
                autoComplete="new-password"
                textContentType="newPassword"
                autoFocus
              />
              <FieldHint text={tooShort && `At least ${MIN_PASSWORD_LENGTH} characters (${MIN_PASSWORD_LENGTH - newPassword.length} more)`} />
              <PasswordField
                placeholder="Repeat new password"
                value={confirmPassword}
                onChangeText={(t) => { setConfirmPassword(t); setError('') }}
                onBlur={() => setConfirmTouched(true)}
                status={!confirmPassword ? 'idle' : passwordsMatch ? 'ok' : showMismatch ? 'error' : 'idle'}
                showStatusIcon
                autoComplete="new-password"
                textContentType="newPassword"
                returnKeyType="go"
                onSubmitEditing={handleReset}
              />
              <FieldHint text={showMismatch && 'Passwords do not match'} />
            </>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {(() => {
            const cfg =
              step === 'email'
                ? { label: 'Send reset code', onPress: handleSendCode, enabled: emailValid }
                : step === 'code'
                  ? { label: 'Verify code', onPress: () => handleVerifyCode(), enabled: code.length === CODE_LENGTH }
                  : { label: 'Set new password', onPress: handleReset, enabled: passwordsMatch }
            return (
              <Pressable
                style={({ pressed }) => [styles.button, !cfg.enabled && styles.buttonDisabled, pressed && cfg.enabled && { opacity: 0.9 }]}
                onPress={cfg.onPress}
                disabled={loading || !cfg.enabled}
              >
                {loading
                  ? <ActivityIndicator color={Colors.bgPrimary} size="small" />
                  : <Text style={styles.buttonText}>{cfg.label}</Text>}
              </Pressable>
            )
          })()}

          <View style={styles.linkRow}>
            {step === 'email' && (
              <Pressable hitSlop={8} onPress={() => router.back()}>
                <Text style={styles.linkMuted}>← Back to sign in</Text>
              </Pressable>
            )}
            {step === 'code' && (
              <>
                <Pressable hitSlop={8} disabled={loading} onPress={() => goTo('email')}>
                  <Text style={styles.linkMuted}>← Change email</Text>
                </Pressable>
                <Pressable hitSlop={8} disabled={loading || cooldown > 0} onPress={handleSendCode}>
                  <Text style={[styles.linkAccent, cooldown > 0 && styles.linkDisabled]}>
                    {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                  </Text>
                </Pressable>
              </>
            )}
            {step === 'password' && (
              <Pressable hitSlop={8} disabled={loading} onPress={() => { setCode(''); goTo('email') }}>
                <Text style={styles.linkMuted}>← Start over</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgPrimary },
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
  contentTabletLandscape: { paddingTop: 28, paddingBottom: 20, gap: 16 },
  hero: { gap: 8, paddingHorizontal: 4 },
  heroTabletLandscape: { width: '100%', maxWidth: 760, alignSelf: 'center' },
  card: {
    backgroundColor: Colors.cardSurface,
    borderColor: Colors.cardBorder,
    borderWidth: 1,
    borderRadius: 26,
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 14,
  },
  cardTablet: { width: '100%', maxWidth: 920, paddingHorizontal: 24, paddingVertical: 22, borderRadius: 28 },
  cardTabletLandscape: { maxWidth: 760, paddingVertical: 18 },
  brandTitle: { color: Colors.textPrimary, fontSize: 38, fontWeight: '900', letterSpacing: 5 },
  brandSub: { color: '#D0CFCF', fontSize: 14, letterSpacing: 0.6, lineHeight: 20 },
  cardTitle: { color: Colors.textPrimary, fontSize: 22, fontWeight: '700' },
  cardSubtitle: { color: Colors.textSecondary, fontSize: 13, lineHeight: 20 },
  emailValue: { color: Colors.textPrimary, fontWeight: '700' },
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
  inputRowError: { borderColor: '#E05252' },
  input: { flex: 1, color: Colors.textPrimary, fontSize: 15, paddingVertical: 12 },
  error: { color: '#E05252', fontSize: 12, textAlign: 'center' },
  button: {
    backgroundColor: Colors.accent,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { color: Colors.bgPrimary, fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
  linkRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  linkMuted: { color: Colors.textSecondary, fontSize: 13 },
  linkAccent: { color: Colors.accent, fontSize: 13, fontWeight: '600' },
  linkDisabled: { opacity: 0.5 },
})
