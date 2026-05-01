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
import { useLayoutInfo } from '../../hooks/useLayout'

const BLURHASH = "LUH_iU%4u4%fyGkEx^obK+OYwin4"

export default function SignupScreen() {
  const { width, height, deviceType } = useLayoutInfo()
  const isTablet = deviceType === 'tablet'
  const isLandscapeTablet = isTablet && width > height
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
        colors={['rgba(5,5,5,0.18)', 'rgba(7,7,7,0.50)', 'rgba(8,8,8,0.85)']}
        locations={[0, 0.35, 1]}
        style={StyleSheet.absoluteFillObject}
      />
      <LinearGradient
        colors={['rgba(0,0,0,0)', Colors.bgScrim]}
        locations={[0.38, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={{ flex: 1 }}>
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
            <Text style={styles.brandSub}>Create your account</Text>
          </View>

          <View style={[
            styles.card,
            isTablet && styles.cardTablet,
            isLandscapeTablet && styles.cardTabletLandscape,
          ]}>
            <Text style={styles.cardTitle}>Almost there</Text>
            <Text style={styles.cardSubtitle}>Complete your profile and secure your account.</Text>

            <View style={styles.inputRow}>
              <Ionicons name="mail-outline" size={18} color={Colors.textSecondary} />
              <TextInput
                style={[styles.input, styles.inputDisabled]}
                value={email}
                editable={false}
              />
            </View>

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
              style={({ pressed }) => [styles.button, pressed && { opacity: 0.9 }]}
              onPress={handleSignup}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color={Colors.bgPrimary} size="small" />
                : <Text style={styles.buttonText}>Create Account</Text>
              }
            </Pressable>

            <Pressable onPress={() => router.back()} style={styles.backBtn}>
              <Text style={styles.backText}>Go back</Text>
            </Pressable>
          </View>
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
  inputDisabled: {
    color: Colors.textSecondary,
  },
  error: {
    color: '#E05252',
    fontSize: 12,
    textAlign: 'center',
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
  backBtn: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  backText: {
    color: Colors.textSecondary,
    fontSize: 13,
    textDecorationLine: 'underline',
  },
})