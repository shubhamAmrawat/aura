import { useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { verifyOtp, login, sendOtp } from '../../lib/authApi'
import { useAuth } from '../../lib/AuthContext'
import { useToast } from '../../lib/ToastContext'
import AuthShell from '../../components/auth/AuthShell'
import AuthButton from '../../components/auth/AuthButton'
import AuthError from '../../components/auth/AuthError'
import CodeInput, { CODE_LENGTH } from '../../components/auth/CodeInput'
import { authText, CardHeading } from '../../components/auth/AuthText'

const RESEND_COOLDOWN_SECONDS = 30

export default function OtpScreen() {
  const { email, type } = useLocalSearchParams<{ email: string; type: string }>()
  const { onLogin } = useAuth()
  const { showToast } = useToast()
  const [code, setCode] = useState('')
  // bumping this remounts the boxes, which clears them and refocuses the first one
  const [attempt, setAttempt] = useState(0)
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS)
  const [error, setError] = useState('')

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  const handleVerify = async (value = code) => {
    if (loading) return
    if (value.length !== CODE_LENGTH) { setError('Enter all 6 digits'); return }
    setError('')
    setLoading(true)
    try {
      await verifyOtp({ email, code: value, type })
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined)
      if (type === 'login') {
        const res = await login({ email })
        await onLogin(res.token, res.user)
        showToast('Login successful.', { type: 'success' })
        router.replace('/(tabs)')
      } else {
        router.push({ pathname: '/auth/signup', params: { email } })
        showToast('Email verified.', { type: 'success' })
      }
    } catch (e: any) {
      setError(e.message || 'Invalid OTP')
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined)
      setCode('')
      setAttempt((n) => n + 1)
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
      setCode('')
      setAttempt((n) => n + 1)
      setCooldown(RESEND_COOLDOWN_SECONDS)
      showToast('A new code was sent to your email.', { type: 'success' })
    } catch (e: any) {
      setError(e.message || 'Failed to resend OTP')
    } finally {
      setResending(false)
    }
  }

  return (
    <AuthShell
      tagline={type === 'login' ? 'Sign in with a one-time code.' : 'Verify your email.'}
      leading="back"
      onLeadingPress={() => router.back()}
    >
      <CardHeading
        title="Check your inbox"
        subtitle={<>We sent a 6-digit code to{'\n'}<Text style={authText.emphasis}>{email}</Text></>}
      />

      <CodeInput
        key={attempt}
        value={code}
        onChange={(c) => { setCode(c); setError('') }}
        onComplete={(c) => handleVerify(c)}
      />

      <AuthError message={error} />

      <AuthButton label="Verify code" onPress={() => handleVerify()} enabled={code.length === CODE_LENGTH} loading={loading} />

      <View style={authText.linkRow}>
        <Pressable hitSlop={8} onPress={() => router.back()}>
          <Text style={authText.linkMuted}>Use a different email</Text>
        </Pressable>
        <Pressable hitSlop={8} onPress={handleResendOtp} disabled={resending || cooldown > 0}>
          <Text style={[authText.linkAccent, (resending || cooldown > 0) && authText.linkDisabled]}>
            {resending ? 'Sending...' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
          </Text>
        </Pressable>
      </View>
    </AuthShell>
  )
}
