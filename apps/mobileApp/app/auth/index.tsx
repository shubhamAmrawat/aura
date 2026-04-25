import { useState } from 'react'
import { View, Text, TextInput, Pressable, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Colors } from '../../constants'
import { commonStyles } from '../../styles/common'
import { sendOtp } from '../../lib/authApi'

export default function AuthIndex() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSendOtp = async () => {
    if (!email.trim()) { setError('Please enter your email'); return }
    setError('')
    setLoading(true)
    try {
      await sendOtp({ email: email.trim(), type: mode })
      router.push({ pathname: '/auth/otp', params: { email: email.trim(), type: mode } })
    } catch (e: any) {
      setError(e.message || 'Failed to send OTP')
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

          {/* Logo */}
          <Text style={{ color: Colors.accent, fontSize: 24, fontWeight: '900', letterSpacing: 4, textAlign: 'center', marginBottom: 8 }}>
            AURORA
          </Text>

          {/* Mode toggle */}
          <View style={commonStyles.segmentedContainer}>
            <Pressable
              style={[commonStyles.segmentedButton, mode === 'login' && { backgroundColor: Colors.accent }]}
              onPress={() => { setMode('login'); setError('') }}
            >
              <Text style={[commonStyles.segmentedButtonText, mode === 'login' && { color: Colors.bgPrimary }]}>
                Login
              </Text>
            </Pressable>
            <Pressable
              style={[commonStyles.segmentedButton, mode === 'signup' && { backgroundColor: Colors.accent }]}
              onPress={() => { setMode('signup'); setError('') }}
            >
              <Text style={[commonStyles.segmentedButtonText, mode === 'signup' && { color: Colors.bgPrimary }]}>
                Sign Up
              </Text>
            </Pressable>
          </View>

          {/* Email input */}
          <View style={commonStyles.inputRow}>
            <Ionicons name="mail-outline" size={20} color={Colors.accent} />
            <TextInput
              style={commonStyles.input}
              placeholder="Enter your email"
              placeholderTextColor={Colors.textSecondary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Error */}
          {error ? <Text style={{ color: '#E05252', fontSize: 12, textAlign: 'center' }}>{error}</Text> : null}

          {/* Button */}
          <Pressable
            style={[commonStyles.button, { backgroundColor: Colors.accent }]}
            onPress={handleSendOtp}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color={Colors.bgPrimary} size="small" />
              : <Text style={[commonStyles.buttonText, { color: Colors.bgPrimary }]}>Send OTP</Text>
            }
          </Pressable>

        </View>
      </View>
    </KeyboardAvoidingView>
  )
}