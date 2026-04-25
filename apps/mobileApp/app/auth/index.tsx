import { useState } from 'react'
import {
  View, Text, TextInput, Pressable,
  KeyboardAvoidingView,
  ActivityIndicator, StyleSheet
} from 'react-native'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { Colors, Images } from '../../constants'
import { sendOtp } from '../../lib/authApi'

const BLURHASH = "LUH_iU%4u4%fyGkEx^obK+OYwin4"

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
      behavior="padding"
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

      <View style={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.brandTitle}>AURORA</Text>
          <Text style={styles.brandSub}>Wallpaper experiences crafted for you</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{mode === 'login' ? 'Welcome back' : 'Create your account'}</Text>
          <Text style={styles.cardSubtitle}>
            {mode === 'login' ? 'Sign in securely with a one-time code.' : 'Start with your email. We will verify it instantly.'}
          </Text>

          <View style={styles.segmented}>
            <Pressable
              style={[styles.segBtn, mode === 'login' && styles.segBtnActive]}
              onPress={() => { setMode('login'); setError('') }}
            >
              <Text style={[styles.segText, mode === 'login' && styles.segTextActive]}>
                Sign In
              </Text>
            </Pressable>
            <Pressable
              style={[styles.segBtn, mode === 'signup' && styles.segBtnActive]}
              onPress={() => { setMode('signup'); setError('') }}
            >
              <Text style={[styles.segText, mode === 'signup' && styles.segTextActive]}>
                Sign Up
              </Text>
            </Pressable>
          </View>

          <View style={styles.inputRow}>
            <Ionicons name="mail-outline" size={18} color={Colors.textSecondary} />
            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              placeholderTextColor={Colors.textMuted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              underlineColorAndroid="transparent"
            />
          </View>

          {error ? (
            <Text style={styles.error}>{error}</Text>
          ) : null}

          <Pressable
            style={({ pressed }) => [styles.button, pressed && { opacity: 0.9 }]}
            onPress={handleSendOtp}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color={Colors.bgPrimary} size="small" />
              : <Text style={styles.buttonText}>Continue</Text>
            }
          </Pressable>

          <Text style={styles.footerCopy}>By continuing, you agree to Aurora terms and privacy policy.</Text>
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
  hero: {
    gap: 8,
    paddingHorizontal: 4,
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
  segmented: {
    flexDirection: 'row',
    backgroundColor: Colors.bgOverlay,
    borderWidth: 1,
    borderColor: Colors.borderHover,
    borderRadius: 16,
    padding: 4,
    gap: 4,
  },
  segBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
  },
  segBtnActive: {
    backgroundColor: Colors.accent,
  },
  segText: {
    color: '#E4E0DA',
    fontSize: 14,
    fontWeight: '700',
  },
  segTextActive: {
    color: Colors.bgPrimary,
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
  footerCopy: {
    color: Colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
  },
})