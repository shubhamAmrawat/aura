import { ReactNode, useEffect, useRef, useState } from 'react'
import {
  Animated, Easing, Keyboard, KeyboardAvoidingView, LayoutAnimation, Platform,
  Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { BlurView } from 'expo-blur'
import AuthMosaic from './AuthMosaic'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Colors } from '../../constants'
import { useLayoutInfo } from '../../hooks/useLayout'

const WORDMARK = require('../../assets/images/auth-wordmark.png')

/** Leave the sign-in flow: back to wherever the user came from, or the home tab. */
export const leaveAuth = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))

/** Height of the fade from the wallpaper wall into the dark area behind the logo. */
const FADE = 150

type Props = {
  /** Small line under the logo. */
  tagline: string
  /** Top-left button: ✕ on the entry screen, ‹ on the steps after it. */
  leading: 'close' | 'back'
  onLeadingPress: () => void
  children: ReactNode
  /** Rendered under the card (outside the glass). */
  below?: ReactNode
}

/** Shared frame for every sign-in screen: drifting wall of wallpapers, logo on dark, and a solid card. */
export default function AuthShell({ tagline, leading, onLeadingPress, children, below }: Props) {
  const insets = useSafeAreaInsets()
  const { deviceType } = useLayoutInfo()
  const isTablet = deviceType === 'tablet'
  const [keyboardOpen, setKeyboardOpen] = useState(false)

  // Card rises in once.
  const enter = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start()
  }, [enter])

  // While typing, fold the logo away so the form keeps the space.
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
      setKeyboardOpen(true)
    })
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
      setKeyboardOpen(false)
    })
    return () => {
      show.remove()
      hide.remove()
    }
  }, [])

  return (
    <View style={styles.root}>
      <AuthMosaic />
      {/* light tint at the very top so the status bar and ✕ stay readable */}
      <LinearGradient
        colors={['rgba(7,7,10,0.45)', 'rgba(7,7,10,0)']}
        locations={[0, 0.16]}
        style={StyleSheet.absoluteFill}
      />

      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[
            styles.scroll,
            isTablet && styles.scrollTablet,
            { paddingTop: insets.top + 64, paddingBottom: insets.bottom + 20 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={[styles.column, isTablet && styles.columnTablet]}>
            {/* The wall fades to solid dark just above the logo, wherever the logo ends up
                (the card's height differs per screen), so the logo never sits on a picture. */}
            <View pointerEvents="none" style={styles.backdrop}>
              <LinearGradient colors={['rgba(7,7,10,0)', 'rgba(7,7,10,0.7)', '#07070A']} locations={[0, 0.55, 1]} style={styles.backdropFade} />
              <View style={styles.backdropSolid} />
            </View>
            {!keyboardOpen && (
              <View style={styles.hero}>
                <Image source={WORDMARK} style={styles.wordmark} contentFit="contain" accessibilityLabel="Aurora" />
                <Text style={styles.tagline}>{tagline}</Text>
              </View>
            )}

            <Animated.View
              style={[
                styles.card,
                {
                  opacity: enter,
                  transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) }],
                },
              ]}
            >
              <View style={styles.cardBody}>{children}</View>
            </Animated.View>

            {below}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Pressable
        onPress={onLeadingPress}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={leading === 'close' ? 'Close' : 'Back'}
        style={({ pressed }) => [styles.leading, { top: insets.top + 10, opacity: pressed ? 0.7 : 1 }]}
      >
        <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
        <Ionicons name={leading === 'close' ? 'close' : 'chevron-back'} size={22} color={Colors.textPrimary} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#07070A',
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 18,
  },
  scrollTablet: {
    justifyContent: 'center',
  },
  column: {
    width: '100%',
    gap: 18,
  },
  backdrop: {
    position: 'absolute',
    top: -FADE,
    left: -400,
    right: -400,
    bottom: -400,
  },
  backdropFade: {
    height: FADE,
  },
  backdropSolid: {
    flex: 1,
    // overlap the fade by 2px: where the two meet on a fractional pixel, a hairline gap
    // would otherwise let the wallpaper wall show through as a bright line
    marginTop: -2,
    backgroundColor: '#07070A',
  },
  columnTablet: {
    maxWidth: 460,
    alignSelf: 'center',
  },
  hero: {
    paddingHorizontal: 10,
    gap: 10,
  },
  wordmark: {
    width: 168,
    height: 39,
  },
  tagline: {
    color: 'rgba(245,240,235,0.88)',
    fontSize: 15,
    lineHeight: 21,
    letterSpacing: 0.2,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  card: {
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: '#111115',
  },
  cardBody: {
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 20,
    gap: 14,
  },
  leading: {
    position: 'absolute',
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(10,10,14,0.35)',
  },
})
