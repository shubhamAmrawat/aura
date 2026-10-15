import { useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { Colors } from '../../constants'
import { loginWithGoogle, loginWithPassword, sendOtp } from '../../lib/authApi'
import { getGoogleIdToken } from '../../lib/googleAuth'
import { useAuth } from '../../lib/AuthContext'
import { useToast } from '../../lib/ToastContext'
import { isValidEmail } from '../../lib/validation'
import { GOOGLE_SIGN_IN_ENABLED } from '../../lib/authConfig'
import AuthShell, { leaveAuth } from '../../components/auth/AuthShell'
import AuthInput from '../../components/auth/AuthInput'
import AuthButton from '../../components/auth/AuthButton'
import AuthSwitch from '../../components/auth/AuthSwitch'
import AuthError from '../../components/auth/AuthError'
import PasswordField from '../../components/auth/PasswordField'
import FieldHint from '../../components/auth/FieldHint'
import { authText, CardHeading, LegalNote } from '../../components/auth/AuthText'

const buzz = (type: Haptics.NotificationFeedbackType) => void Haptics.notificationAsync(type).catch(() => undefined)

export default function AuthIndex() {
  const { onLogin } = useAuth()
  const { showToast } = useToast()
  // With Google on, the card opens on a choice (Google / email); otherwise straight on the email form.
  const [showEmailForm, setShowEmailForm] = useState(!GOOGLE_SIGN_IN_ENABLED)
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [emailTouched, setEmailTouched] = useState(false)
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [sendingCode, setSendingCode] = useState(false)
  const [googleBusy, setGoogleBusy] = useState(false)
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
      buzz(Haptics.NotificationFeedbackType.Error)
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
      buzz(Haptics.NotificationFeedbackType.Success)
      showToast('Welcome back!', { type: 'success' })
      router.replace('/(tabs)')
    } catch (e: any) {
      setError(e.message || 'Sign in failed')
      buzz(Haptics.NotificationFeedbackType.Error)
    } finally {
      setLoading(false)
    }
  }

  // Google account picker → ID token → our API (same endpoint as the website); signs up new users too.
  const handleGoogle = async () => {
    if (googleBusy) return
    setGoogleBusy(true)
    try {
      const google = await getGoogleIdToken()
      if (google.status === 'cancelled') return
      if (google.status === 'error') {
        showToast(google.message, { type: 'error', position: 'top' })
        buzz(Haptics.NotificationFeedbackType.Error)
        return
      }
      const res = await loginWithGoogle(google.idToken)
      await onLogin(res.token, res.user)
      buzz(Haptics.NotificationFeedbackType.Success)
      showToast(res.isNewUser ? 'Welcome to Aurora!' : 'Welcome back!', { type: 'success' })
      router.replace('/(tabs)')
    } catch (e: any) {
      showToast(e?.message || 'Google sign-in failed. Please try again.', { type: 'error', position: 'top' })
      buzz(Haptics.NotificationFeedbackType.Error)
    } finally {
      setGoogleBusy(false)
    }
  }

  const isLogin = mode === 'login'

  return (
    <AuthShell
      tagline="Wallpapers made for your phone."
      leading={showEmailForm && GOOGLE_SIGN_IN_ENABLED ? 'back' : 'close'}
      onLeadingPress={() => (showEmailForm && GOOGLE_SIGN_IN_ENABLED ? setShowEmailForm(false) : leaveAuth())}
      below={
        <Pressable onPress={leaveAuth} hitSlop={8} style={styles.skip}>
          <Text style={styles.skipText}>Explore without an account</Text>
        </Pressable>
      }
    >
      {!showEmailForm ? (
        <>
          <CardHeading title="Welcome" subtitle="Sign in or create an account to save your likes." />
          <AuthButton variant="google" label="Continue with Google" onPress={handleGoogle} loading={googleBusy} />
          <Pressable
            onPress={() => setShowEmailForm(true)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.emailChoice, pressed && { opacity: 0.85 }]}
          >
            <Ionicons name="mail-outline" size={18} color={Colors.textPrimary} />
            <Text style={styles.emailChoiceText}>Continue with email</Text>
          </Pressable>
          <LegalNote />
        </>
      ) : (
      <>
      <CardHeading
        title={isLogin ? 'Welcome back' : 'Create your account'}
        subtitle={isLogin ? 'Sign in to sync your likes and downloads.' : "Start with your email. We'll send a code to verify it."}
      />

      <AuthSwitch
        options={[
          { value: 'login', label: 'Sign In' },
          { value: 'signup', label: 'Sign Up' },
        ]}
        value={mode}
        onChange={switchMode}
      />

      <AuthInput
        icon="mail-outline"
        status={showEmailError ? 'error' : 'idle'}
        placeholder="Email address"
        value={email}
        onChangeText={(t) => { setEmail(t.trim()); setError('') }}
        onBlur={() => setEmailTouched(true)}
        keyboardType="email-address"
        autoComplete="email"
        textContentType="emailAddress"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType={isLogin ? 'next' : 'go'}
        onSubmitEditing={() => { if (!isLogin) handleSendOtp('signup') }}
      />
      <FieldHint text={showEmailError && 'Enter a valid email address'} />

      {isLogin && (
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

      <AuthError message={error} />

      {isLogin ? (
        <AuthButton label="Sign In" onPress={handlePasswordLogin} enabled={emailValid && !!password && !sendingCode} loading={loading} />
      ) : (
        <AuthButton label="Continue" onPress={() => handleSendOtp('signup')} enabled={emailValid} loading={sendingCode} />
      )}

      {isLogin && (
        <View style={authText.linkRow}>
          <Pressable
            hitSlop={8}
            disabled={busy}
            onPress={() => router.push({ pathname: '/auth/forgot', params: { email: emailValid ? email.trim() : '' } })}
          >
            <Text style={authText.linkMuted}>Forgot password?</Text>
          </Pressable>
          <Pressable hitSlop={8} disabled={busy} onPress={() => handleSendOtp('login')}>
            {sendingCode
              ? <ActivityIndicator color={Colors.accent} size="small" />
              : <Text style={authText.linkAccent}>Email me a code</Text>}
          </Pressable>
        </View>
      )}

      <LegalNote />
      </>
      )}
    </AuthShell>
  )
}

const styles = StyleSheet.create({
  emailChoice: {
    height: 54,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  emailChoiceText: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  skip: {
    alignSelf: 'center',
    paddingVertical: 4,
  },
  skipText: {
    color: 'rgba(245,240,235,0.62)',
    fontSize: 13,
    fontWeight: '600',
  },
})
