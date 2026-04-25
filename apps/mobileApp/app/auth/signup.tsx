import { useState } from 'react'
import { View, Text, TextInput, Pressable, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Colors } from '../../constants'
import { commonStyles } from '../../styles/common'
import { signup } from '../../lib/authApi'
import { useAuth } from '../../lib/AuthContext'

export default function SignupScreen() {
  const { email } = useLocalSearchParams<{ email: string }>()
  const { onLogin } = useAuth()
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSignup = async () => {
    if (!username.trim() || !displayName.trim() || !password.trim()) {
      setError('All fields are required'); return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters'); return
    }
    setError('')
    setLoading(true)
    try {
      const res = await signup({ email, username: username.trim(), displayName: displayName.trim(), password })
      await onLogin(res.token, res.user)
      router.replace('/(tabs)')
    } catch (e: any) {
      setError(e.message || 'Signup failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View style={commonStyles.screenCenter}>
          <View style={commonStyles.card}>

            <Text style={{ color: Colors.accent, fontSize: 24, fontWeight: '900', letterSpacing: 4, textAlign: 'center', marginBottom: 4 }}>
              AURORA
            </Text>
            <Text style={{ color: Colors.textSecondary, fontSize: 13, textAlign: 'center', marginBottom: 8 }}>
              Create your account
            </Text>

            <View style={commonStyles.inputRow}>
              <Ionicons name="at-outline" size={20} color={Colors.accent} />
              <TextInput
                style={commonStyles.input}
                placeholder="Username"
                placeholderTextColor={Colors.textSecondary}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={commonStyles.inputRow}>
              <Ionicons name="person-outline" size={20} color={Colors.accent} />
              <TextInput
                style={commonStyles.input}
                placeholder="Display Name"
                placeholderTextColor={Colors.textSecondary}
                value={displayName}
                onChangeText={setDisplayName}
              />
            </View>

            <View style={commonStyles.inputRow}>
              <Ionicons name="lock-closed-outline" size={20} color={Colors.accent} />
              <TextInput
                style={commonStyles.input}
                placeholder="Password (min 8 characters)"
                placeholderTextColor={Colors.textSecondary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            {error ? <Text style={{ color: '#E05252', fontSize: 12, textAlign: 'center' }}>{error}</Text> : null}

            <Pressable
              style={[commonStyles.button, { backgroundColor: Colors.accent }]}
              onPress={handleSignup}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color={Colors.bgPrimary} size="small" />
                : <Text style={[commonStyles.buttonText, { color: Colors.bgPrimary }]}>Create Account</Text>
              }
            </Pressable>

          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}