import { useState } from 'react'
import { View, Text, TextInput, Pressable, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Colors } from '../../constants'
import { commonStyles } from '../../styles/common'
import { verifyOtp, login } from '../../lib/authApi'
import { useAuth } from '../../lib/AuthContext'
import { saveToken } from '../../lib/tokenStorage'

export default function OtpScreen() {
  const { email, type } = useLocalSearchParams<{ email: string; type: string }>()
  const { onLogin } = useAuth()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleVerify = async () => {
    if (code.length !== 6) { setError('Enter the 6-digit OTP'); return }
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
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <View style={commonStyles.screenCenter}>
        <View style={commonStyles.card}>

          <Text style={{ color: Colors.accent, fontSize: 24, fontWeight: '900', letterSpacing: 4, textAlign: 'center', marginBottom: 4 }}>
            AURORA
          </Text>
          <Text style={{ color: Colors.textSecondary, fontSize: 13, textAlign: 'center', marginBottom: 8 }}>
            OTP sent to {email}
          </Text>

          <View style={commonStyles.inputRow}>
            <Ionicons name="code-working-outline" size={20} color={Colors.accent} />
            <TextInput
              style={commonStyles.input}
              placeholder="Enter 6-digit OTP"
              placeholderTextColor={Colors.textSecondary}
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={6}
            />
          </View>

          {error ? <Text style={{ color: '#E05252', fontSize: 12, textAlign: 'center' }}>{error}</Text> : null}

          <Pressable
            style={[commonStyles.button, { backgroundColor: Colors.accent }]}
            onPress={handleVerify}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color={Colors.bgPrimary} size="small" />
              : <Text style={[commonStyles.buttonText, { color: Colors.bgPrimary }]}>Verify OTP</Text>
            }
          </Pressable>

          <Pressable onPress={() => router.back()}>
            <Text style={{ color: Colors.textSecondary, fontSize: 12, textAlign: 'center', marginTop: 4 }}>
              Go back
            </Text>
          </Pressable>

        </View>
      </View>
    </KeyboardAvoidingView>
  )
}