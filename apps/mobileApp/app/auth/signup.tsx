import { useState } from 'react'
import {
  View, Text, TextInput, Pressable,
  KeyboardAvoidingView, Platform,
  ActivityIndicator, StyleSheet
} from 'react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Colors, Images } from '../../constants'
import { signup } from '../../lib/authApi'
import { useAuth } from '../../lib/AuthContext'

const BLURHASH = "LUH_iU%4u4%fyGkEx^obK+OYwin4"

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
      const res = await signup({
        email,
        username: username.trim(),
        displayName: displayName.trim(),
        password
      })
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
        colors={['transparent', 'rgba(10,10,10,0.5)', '#0A0A0A', '#0A0A0A']}
        locations={[0, 0.45, 0.75, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={{ flex: 1 }}>
        <View style={styles.content}>
          <Text style={styles.brandTitle}>AURORA</Text>
          <Text style={styles.brandSub}>Create your account</Text>

          <View style={styles.spacer} />

          <View style={styles.inputRow}>
            <Ionicons name="at-outline" size={18} color={Colors.textSecondary} />
            <TextInput
              style={styles.input}
              placeholder="Username"
              placeholderTextColor={Colors.textMuted}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              underlineColorAndroid="transparent"
            />
          </View>

          <View style={styles.inputRow}>
            <Ionicons name="person-outline" size={18} color={Colors.textSecondary} />
            <TextInput
              style={styles.input}
              placeholder="Display Name"
              placeholderTextColor={Colors.textMuted}
              value={displayName}
              onChangeText={setDisplayName}
              underlineColorAndroid="transparent"
            />
          </View>

          <View style={styles.inputRow}>
            <Ionicons name="lock-closed-outline" size={18} color={Colors.textSecondary} />
            <TextInput
              style={styles.input}
              placeholder="Password (min 8 characters)"
              placeholderTextColor={Colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              underlineColorAndroid="transparent"
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            style={({ pressed }) => [styles.button, pressed && { opacity: 0.85 }]}
            onPress={handleSignup}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color={Colors.bgPrimary} size="small" />
              : <Text style={styles.buttonText}>Create Account</Text>
            }
          </Pressable>

          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>← Go back</Text>
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
    paddingBottom: 60,
    paddingTop: 120,
    gap: 12,
  },
  brandTitle: {
    color: Colors.textPrimary,
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 6,
  },
  brandSub: {
    color: Colors.textSecondary,
    fontSize: 13,
    letterSpacing: 1,
  },
  spacer: { height: 8 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
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
  error: {
    color: '#E05252',
    fontSize: 12,
    textAlign: 'center',
  },
  button: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
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
  backBtn: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  backText: {
    color: Colors.textSecondary,
    fontSize: 13,
  },
})