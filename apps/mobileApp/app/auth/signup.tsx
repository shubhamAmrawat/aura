import { useState } from 'react'
import { router, useLocalSearchParams } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { signup } from '../../lib/authApi'
import { useAuth } from '../../lib/AuthContext'
import { MIN_PASSWORD_LENGTH } from '../../lib/validation'
import AuthShell from '../../components/auth/AuthShell'
import AuthInput from '../../components/auth/AuthInput'
import AuthButton from '../../components/auth/AuthButton'
import AuthError from '../../components/auth/AuthError'
import PasswordField from '../../components/auth/PasswordField'
import FieldHint from '../../components/auth/FieldHint'
import { CardHeading, LegalNote } from '../../components/auth/AuthText'

export default function SignupScreen() {
  const { email } = useLocalSearchParams<{ email: string }>()
  const { onLogin } = useAuth()
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [confirmTouched, setConfirmTouched] = useState(false)
  const tooShort = password.length > 0 && password.length < MIN_PASSWORD_LENGTH
  const passwordsMatch = password.length >= MIN_PASSWORD_LENGTH && password === confirmPassword
  const showMismatch =
    confirmPassword.length > 0 && !passwordsMatch &&
    (confirmTouched || confirmPassword.length >= password.length)
  const canSubmit = !!username.trim() && !!displayName.trim() && passwordsMatch
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSignup = async () => {
    if (!username.trim() || !displayName.trim() || !password.trim()) {
      setError('All fields are required'); return
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`); return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match'); return
    }
    setError('')
    setLoading(true)
    try {
      const res = await signup({
        email,
        username: username.trim(),
        displayName: displayName.trim(),
        password
      })
      await onLogin(res.token, res.user)
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined)
      router.replace('/(tabs)')
    } catch (e: any) {
      setError(e.message || 'Signup failed')
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell tagline="Email verified. One last step." leading="back" onLeadingPress={() => router.back()}>
      <CardHeading title="Almost there" subtitle="Pick a username and secure your account." />

      <AuthInput icon="mail-outline" value={email} editable={false} />

      <AuthInput
        icon="at-outline"
        placeholder="Username"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username-new"
        returnKeyType="next"
      />

      <AuthInput
        icon="person-outline"
        placeholder="Display name"
        value={displayName}
        onChangeText={setDisplayName}
        autoComplete="name"
        returnKeyType="next"
      />

      <PasswordField
        placeholder={`Password (min ${MIN_PASSWORD_LENGTH} characters)`}
        value={password}
        onChangeText={(t) => { setPassword(t); setError('') }}
        status={tooShort ? 'error' : 'idle'}
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <FieldHint text={tooShort && `At least ${MIN_PASSWORD_LENGTH} characters (${MIN_PASSWORD_LENGTH - password.length} more)`} />

      <PasswordField
        placeholder="Repeat password"
        value={confirmPassword}
        onChangeText={(t) => { setConfirmPassword(t); setError('') }}
        onBlur={() => setConfirmTouched(true)}
        status={!confirmPassword ? 'idle' : passwordsMatch ? 'ok' : showMismatch ? 'error' : 'idle'}
        showStatusIcon
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={handleSignup}
      />
      <FieldHint text={showMismatch && 'Passwords do not match'} />

      <AuthError message={error} />

      <AuthButton label="Create account" onPress={handleSignup} enabled={canSubmit} loading={loading} />

      <LegalNote />
    </AuthShell>
  )
}
