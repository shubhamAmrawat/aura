import { useEffect, useState } from 'react'
import { View, Text, Pressable, BackHandler } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { forgotPassword, loginWithPassword, resetPassword, verifyResetCode } from '../../lib/authApi'
import { useAuth } from '../../lib/AuthContext'
import { useToast } from '../../lib/ToastContext'
import { isValidEmail, MIN_PASSWORD_LENGTH } from '../../lib/validation'
import PasswordField from '../../components/auth/PasswordField'
import FieldHint from '../../components/auth/FieldHint'
import CodeInput, { CODE_LENGTH } from '../../components/auth/CodeInput'
import AuthShell from '../../components/auth/AuthShell'
import AuthInput from '../../components/auth/AuthInput'
import AuthButton from '../../components/auth/AuthButton'
import AuthError from '../../components/auth/AuthError'
import { authText, CardHeading } from '../../components/auth/AuthText'

const RESEND_COOLDOWN_SECONDS = 60

type Step = 'email' | 'code' | 'password'

/** Forgot password: email → code → new password, then signs the user in. */
export default function ForgotPasswordScreen() {
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
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined)
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
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined)
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
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined)
      showToast('Password updated. Welcome back!', { type: 'success' })
      router.replace('/(tabs)')
    } catch (e: any) {
      setError(e.message || 'Failed to reset password')
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined)
      setLoading(false)
    }
  }

  const title =
    step === 'email' ? 'Reset your password' : step === 'code' ? 'Check your inbox' : 'Choose a new password'

  const cfg =
    step === 'email'
      ? { label: 'Send reset code', onPress: handleSendCode, enabled: emailValid }
      : step === 'code'
        ? { label: 'Verify code', onPress: () => handleVerifyCode(), enabled: code.length === CODE_LENGTH }
        : { label: 'Set new password', onPress: handleReset, enabled: passwordsMatch }

  return (
    <AuthShell
      tagline="Account recovery"
      leading="back"
      onLeadingPress={() => (step === 'email' ? router.back() : goTo(step === 'password' ? 'code' : 'email'))}
    >
      <CardHeading
        title={title}
        subtitle={
          <>
            {step === 'email' && "Enter your email and we'll send you a 6-digit code."}
            {step === 'code' && <>Enter the code sent to{'\n'}<Text style={authText.emphasis}>{email.trim()}</Text></>}
            {step === 'password' && <>Set a new password for{'\n'}<Text style={authText.emphasis}>{email.trim()}</Text></>}
          </>
        }
      />

      {/* Step 1: email */}
      {step === 'email' && (
        <>
          <AuthInput
            icon="mail-outline"
            status={showEmailError ? 'error' : 'idle'}
            placeholder="Email address"
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
          />
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

      <AuthError message={error} />

      <AuthButton label={cfg.label} onPress={cfg.onPress} enabled={cfg.enabled} loading={loading} />

      <View style={authText.linkRow}>
        {step === 'email' && (
          <Pressable hitSlop={8} onPress={() => router.back()}>
            <Text style={authText.linkMuted}>Back to sign in</Text>
          </Pressable>
        )}
        {step === 'code' && (
          <>
            <Pressable hitSlop={8} disabled={loading} onPress={() => goTo('email')}>
              <Text style={authText.linkMuted}>Change email</Text>
            </Pressable>
            <Pressable hitSlop={8} disabled={loading || cooldown > 0} onPress={handleSendCode}>
              <Text style={[authText.linkAccent, cooldown > 0 && authText.linkDisabled]}>
                {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
              </Text>
            </Pressable>
          </>
        )}
        {step === 'password' && (
          <Pressable hitSlop={8} disabled={loading} onPress={() => { setCode(''); goTo('email') }}>
            <Text style={authText.linkMuted}>Start over</Text>
          </Pressable>
        )}
      </View>
    </AuthShell>
  )
}
