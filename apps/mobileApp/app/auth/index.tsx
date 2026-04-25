import { useState } from 'react'
import {
  View, Text, TextInput, Pressable,
  KeyboardAvoidingView, Platform,
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
      {/* Full screen wallpaper using expo-image for blurhash + caching */}
      <Image
        source={{ uri: Images.AUTH_WALLPAPER_URL }}
        placeholder={{ blurhash: BLURHASH }}
        contentFit="cover"
        style={StyleSheet.absoluteFillObject}
        transition={400}
      />

      {/* Gradient — transparent top, solid dark at bottom */}
      <LinearGradient
        colors={['transparent', 'rgba(10,10,10,0.5)', '#0A0A0A', '#0A0A0A']}
        locations={[0, 0.45, 0.75, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* All content in one view pushed to bottom */}
      <View style={styles.content}>

        {/* Branding */}
        <Text style={styles.brandTitle}>AURORA</Text>
        <Text style={styles.brandSub}>Premium Wallpaper Discovery</Text>

        <View style={styles.spacer} />

        {/* Mode toggle */}
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

        {/* Email input */}
        <View style={styles.inputRow}>
          <Ionicons name="mail-outline" size={18} color={Colors.textPrimary} />
          <TextInput
            style={styles.input}
            placeholder="Enter your email"
            placeholderTextColor={Colors.textPrimary}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            underlineColorAndroid="transparent"
          />
        </View>

        {/* Error */}
        {error ? (
          <Text style={styles.error}>{error}</Text>
        ) : null}

        {/* CTA Button */}
        <Pressable
          style={({ pressed }) => [styles.button, pressed && { opacity: 0.85 }]}
          onPress={handleSendOtp}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color={Colors.bgPrimary} size="small" />
            : <Text style={styles.buttonText}>Continue</Text>
          }
        </Pressable>

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
  spacer: {
    height: 24,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
    padding: 4,
    gap: 4,
  },
  segBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9,
    alignItems: 'center',
  },
  segBtnActive: {
    backgroundColor: Colors.accent,
  },
  segText: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  segTextActive: {
    color: Colors.bgPrimary,
  },
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
})