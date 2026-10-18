import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Animated, BackHandler, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { Image } from 'expo-image'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import * as Haptics from 'expo-haptics'
import AuthButton from '../components/auth/AuthButton'
import { Colors } from '../constants'
import { useInsets } from '../hooks/useInsets'
import { Category } from '../lib/api'
import { getInterests, saveInterests } from '../lib/profileApi'
import { useScreenFilter } from '../lib/ScreenFilterContext'
import { useToast } from '../lib/ToastContext'
import { getCategories } from '../lib/wallpaperApi'

/** Most categories a user can pick (the API enforces the same limit). */
const MAX = 4

/** The fan at the top: one card per pick slot, left to right in pick order. */
const FAN = [
  { x: -117, y: 18, r: '-10deg' },
  { x: -39, y: 4, r: '-3.5deg' },
  { x: 39, y: 4, r: '3.5deg' },
  { x: 117, y: 18, r: '10deg' },
]

const imageOf = (c: Category) => c.coverThumbUrl || c.coverImageUrl || null

/**
 * After sign-up (and from Settings with ?mode=edit): pick up to 4 categories for the home feed.
 * Skipping saves nothing; picks can be changed any time in Settings.
 */
export default function Welcome() {
  const { mode } = useLocalSearchParams<{ mode?: string }>()
  const editing = mode === 'edit'
  const { topPadding, bottomPadding } = useInsets()
  const { screen } = useScreenFilter()
  const { showToast } = useToast()
  const { width } = useWindowDimensions()
  // The fan is 372 dp wide at full size; shrink it on narrow phones so no card touches the edge.
  const fanScale = Math.min(1, (width - 24) / 372)

  const [categories, setCategories] = useState<Category[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [picked, setPicked] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    setFailed(false)
    Promise.all([getCategories(screen), getInterests().catch(() => [])])
      .then(([list, mine]) => {
        const usable = list.filter((c) => imageOf(c) && (c.wallpaperCount ?? 1) > 0)
        const known = new Set(usable.map((c) => c.id))
        setCategories(usable)
        setPicked(mine.map((i) => i.id).filter((id) => known.has(id)).slice(0, MAX))
      })
      .catch(() => setFailed(true))
  }, [screen])

  useEffect(load, [load])

  const leave = useCallback(() => {
    if (editing && router.canGoBack()) router.back()
    else router.replace('/(tabs)')
  }, [editing])

  // Android back during sign-up = "Not now" (never back into the finished sign-up form).
  useFocusEffect(
    useCallback(() => {
      if (editing) return
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        leave()
        return true
      })
      return () => sub.remove()
    }, [editing, leave])
  )

  const byId = useMemo(() => new Map((categories ?? []).map((c) => [c.id, c])), [categories])
  const full = picked.length >= MAX

  const toggle = (id: string) => {
    setPicked((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id)
      if (cur.length >= MAX) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined)
        return cur
      }
      return [...cur, id]
    })
    void Haptics.selectionAsync().catch(() => undefined)
  }

  const save = async () => {
    if (!picked.length || saving) return
    setSaving(true)
    try {
      await saveInterests(picked)
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined)
      showToast(editing ? 'Interests updated' : "You're all set — enjoy your feed", { type: 'success' })
      leave()
    } catch (e: any) {
      showToast(e?.message || "Couldn't save your picks. Try again.", { type: 'error', position: 'top' })
      setSaving(false)
    }
  }

  const sub =
    picked.length === 0 ? `Pick up to ${MAX} styles you love` : `${picked.length} of ${MAX} picked · change any time`

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.topBar}>
        {editing ? (
          <Text style={styles.topLabel}>Your interests</Text>
        ) : (
          <View style={styles.progress} accessibilityLabel="Last step of sign-up">
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={styles.progressBar} />
            ))}
          </View>
        )}
      </View>

      <View style={[styles.fan, { height: (CARD_H + 40) * fanScale }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {FAN.map((f, i) => {
          const c = picked[i] ? byId.get(picked[i]!) : undefined
          return (
            <FanCard key={i} n={i + 1} image={c ? imageOf(c) : null} x={f.x * fanScale} y={f.y * fanScale} r={f.r} s={fanScale} />
          )
        })}
      </View>

      <View style={styles.heading}>
        <Text style={styles.title}>{editing ? 'Edit your feed' : 'Build your feed'}</Text>
        <Text style={styles.subtitle} accessibilityLiveRegion="polite">
          {sub}
        </Text>
      </View>

      {categories === null ? (
        <View style={styles.center}>
          {failed ? (
            <Pressable onPress={load} style={({ pressed }) => [styles.retry, pressed && { opacity: 0.8 }]}>
              <Text style={styles.retryText}>Couldn&apos;t load categories. Tap to retry</Text>
            </Pressable>
          ) : (
            <ActivityIndicator color={Colors.accent} />
          )}
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.chips, { paddingBottom: bottomPadding + 160 }]}
          showsVerticalScrollIndicator={false}
        >
          {categories.map((c) => {
            const on = picked.includes(c.id)
            const dim = full && !on
            return (
              <Pressable
                key={c.id}
                onPress={() => toggle(c.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: on, disabled: dim }}
                accessibilityLabel={c.name}
                style={({ pressed }) => [
                  styles.chip,
                  on && styles.chipOn,
                  dim && styles.chipDim,
                  pressed && { transform: [{ scale: 0.96 }] },
                ]}
              >
                <Image source={imageOf(c)} style={styles.chipImg} contentFit="cover" transition={150} />
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{c.name}</Text>
              </Pressable>
            )
          })}
        </ScrollView>
      )}

      <View style={[styles.footer, { paddingBottom: bottomPadding + 12 }]} pointerEvents="box-none">
        <View style={styles.footerFade} pointerEvents="none" />
        <AuthButton
          label={editing ? 'Save interests' : 'Continue'}
          onPress={() => void save()}
          enabled={picked.length > 0}
          loading={saving}
        />
        <Pressable onPress={leave} disabled={saving} hitSlop={8} style={styles.skip} accessibilityRole="button">
          <Text style={styles.skipText}>{editing ? 'Cancel' : 'Not now'}</Text>
        </Pressable>
      </View>
    </View>
  )
}

/** One card of the fan: the picked category's image, or a dashed numbered placeholder. Pops in when filled. */
function FanCard({ n, image, x, y, r, s }: { n: number; image: string | null; x: number; y: number; r: string; s: number }) {
  const w = CARD_W * s
  const h = CARD_H * s
  const pop = useRef(new Animated.Value(image ? 1 : 0)).current
  useEffect(() => {
    if (!image) {
      pop.setValue(0)
      return
    }
    pop.setValue(0.6)
    Animated.spring(pop, { toValue: 1, friction: 6, tension: 120, useNativeDriver: false }).start()
  }, [image, pop])
  const scale = pop.interpolate({ inputRange: [0, 0.6, 1], outputRange: [1, 0.9, 1] })

  return (
    <Animated.View
      style={[
        styles.card,
        image ? styles.cardFilled : styles.cardEmpty,
        { width: w, height: h, zIndex: n, transform: [{ translateX: x }, { translateY: y }, { rotate: r }, { scale }] },
      ]}
    >
      {image ? (
        // Explicit size: on Android an absolutely-filled expo-image inside a rotated card can render nothing.
        <Image source={{ uri: image }} style={{ position: 'absolute', top: 0, left: 0, width: w, height: h }} contentFit="cover" />
      ) : (
        <Text style={styles.cardNum}>{n}</Text>
      )}
    </Animated.View>
  )
}

const CARD_W = 104
const CARD_H = 186

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  topBar: { height: 44, paddingHorizontal: 20, justifyContent: 'center', alignItems: 'center' },
  topLabel: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  progress: { flexDirection: 'row', gap: 5, width: 120 },
  progressBar: { flex: 1, height: 3, borderRadius: 3, backgroundColor: Colors.accent },
  fan: { height: CARD_H + 40, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 4 },
  card: {
    position: 'absolute',
    top: 4,
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardFilled: { backgroundColor: '#161616', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  cardEmpty: { backgroundColor: '#141414', borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.14)' },
  cardNum: { color: '#3a3a3a', fontSize: 22, fontWeight: '700' },
  heading: { paddingHorizontal: 20, paddingTop: 8, alignItems: 'center', gap: 6 },
  title: { color: Colors.textPrimary, fontSize: 30, fontWeight: '800', letterSpacing: -0.4 },
  subtitle: { color: 'rgba(245,240,235,0.62)', fontSize: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  retry: { paddingHorizontal: 16, paddingVertical: 12 },
  retryText: { color: Colors.textSecondary, fontSize: 14 },
  scroll: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 18 },
  chip: {
    height: 44,
    paddingLeft: 4,
    paddingRight: 14,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  chipOn: { backgroundColor: 'rgba(129,238,78,0.14)', borderColor: Colors.accent },
  chipDim: { opacity: 0.4 },
  chipImg: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#222' },
  chipText: { color: '#d4d4d4', fontSize: 14, fontWeight: '600' },
  chipTextOn: { color: Colors.textPrimary },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 28, gap: 4 },
  footerFade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(10,10,10,0.94)', borderTopWidth: 1, borderTopColor: Colors.border },
  skip: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  skipText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600' },
})
