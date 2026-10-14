import { useEffect, useRef } from 'react'
import { Animated, StyleSheet, Text } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { AUTH_ERROR } from './AuthInput'

/** Form-level error with a short shake each time a new message appears. */
export default function AuthError({ message }: { message?: string }) {
  const shake = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (!message) return
    shake.setValue(0)
    Animated.sequence(
      [8, -8, 6, -6, 3, 0].map((toValue) => Animated.timing(shake, { toValue, duration: 45, useNativeDriver: true }))
    ).start()
  }, [message, shake])

  if (!message) return null
  return (
    <Animated.View style={[styles.box, { transform: [{ translateX: shake }] }]} accessibilityLiveRegion="polite">
      <Ionicons name="alert-circle" size={16} color={AUTH_ERROR} />
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(240,100,100,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(240,100,100,0.28)',
  },
  text: {
    flex: 1,
    color: '#F7B2B2',
    fontSize: 13,
    lineHeight: 18,
  },
})
