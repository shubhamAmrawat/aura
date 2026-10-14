import { useEffect, useRef, useState } from 'react'
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native'
import { Colors } from '../../constants'

type Props<T extends string> = {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}

/** Two-way switch (Sign In / Sign Up) with a glass pill that slides to the selected side. */
export default function AuthSwitch<T extends string>({ options, value, onChange }: Props<T>) {
  const [width, setWidth] = useState(0)
  const index = Math.max(0, options.findIndex((o) => o.value === value))
  const pos = useRef(new Animated.Value(index)).current

  useEffect(() => {
    Animated.timing(pos, { toValue: index, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start()
  }, [index, pos])

  const segment = width > 0 ? (width - 8) / options.length : 0

  return (
    <View style={styles.track} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {segment > 0 ? (
        <Animated.View
          style={[
            styles.pill,
            { width: segment, transform: [{ translateX: pos.interpolate({ inputRange: [0, 1], outputRange: [0, segment] }) }] },
          ]}
        />
      ) : null}
      {options.map((o) => {
        const active = o.value === value
        return (
          <Pressable
            key={o.value}
            style={styles.segment}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{o.label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  pill: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  segment: {
    flex: 1,
    paddingVertical: 11,
    alignItems: 'center',
  },
  label: {
    color: 'rgba(245,240,235,0.55)',
    fontSize: 14,
    fontWeight: '700',
  },
  labelActive: {
    color: Colors.textPrimary,
  },
})
