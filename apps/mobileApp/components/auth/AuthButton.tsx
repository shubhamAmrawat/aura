import { useEffect, useRef } from 'react'
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { Colors } from '../../constants'

const GOOGLE_G = require('../../assets/images/google-g.png')

type Props = {
  label: string
  onPress: () => void
  /** Primary only: dark glass while false, fades to green once the form can be sent. */
  enabled?: boolean
  loading?: boolean
  variant?: 'primary' | 'google'
}

/** Main action button, or the "Continue with Google" button. */
export default function AuthButton({ label, onPress, enabled = true, loading = false, variant = 'primary' }: Props) {
  const lit = useRef(new Animated.Value(enabled ? 1 : 0)).current
  useEffect(() => {
    Animated.timing(lit, { toValue: enabled ? 1 : 0, duration: 220, useNativeDriver: false }).start()
  }, [enabled, lit])

  if (variant === 'google') {
    return (
      <Pressable
        onPress={onPress}
        disabled={loading}
        accessibilityRole="button"
        style={({ pressed }) => [styles.base, styles.google, pressed && { opacity: 0.88 }]}
      >
        {loading ? (
          <ActivityIndicator color="#1F1F1F" size="small" />
        ) : (
          <View style={styles.googleRow}>
            <Image source={GOOGLE_G} style={styles.googleIcon} />
            <Text style={styles.googleText}>{label}</Text>
          </View>
        )}
      </Pressable>
    )
  }

  const backgroundColor = lit.interpolate({ inputRange: [0, 1], outputRange: ['rgba(255,255,255,0.06)', Colors.accent] })
  const borderColor = lit.interpolate({ inputRange: [0, 1], outputRange: ['rgba(255,255,255,0.12)', Colors.accent] })
  const color = lit.interpolate({ inputRange: [0, 1], outputRange: ['rgba(245,240,235,0.45)', '#0A0A0A'] })

  return (
    <Pressable
      onPress={onPress}
      disabled={!enabled || loading}
      accessibilityRole="button"
      accessibilityState={{ disabled: !enabled || loading, busy: loading }}
    >
      {({ pressed }) => (
        <Animated.View style={[styles.base, { backgroundColor, borderColor, opacity: pressed ? 0.88 : 1 }]}>
          {loading ? (
            <ActivityIndicator color={enabled ? '#0A0A0A' : Colors.accent} size="small" />
          ) : (
            <Animated.Text style={[styles.primaryText, { color }]}>{label}</Animated.Text>
          )}
        </Animated.View>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: {
    height: 54,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  google: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  googleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  googleIcon: {
    width: 20,
    height: 20,
  },
  googleText: {
    color: '#1F1F1F',
    fontSize: 15,
    fontWeight: '700',
  },
})
