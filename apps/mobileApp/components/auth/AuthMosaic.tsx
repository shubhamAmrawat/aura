import { useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native'
import { Image } from 'expo-image'
import { useLayoutInfo } from '../../hooks/useLayout'
import { Colors } from '../../constants'

// Bundled 320px tiles (93 KB in total) so the wall is there the moment the screen opens.
const TILES = [
  require('../../assets/images/auth-wall/w1.webp'),
  require('../../assets/images/auth-wall/w2.webp'),
  require('../../assets/images/auth-wall/w3.webp'),
  require('../../assets/images/auth-wall/w4.webp'),
  require('../../assets/images/auth-wall/w5.webp'),
  require('../../assets/images/auth-wall/w6.webp'),
  require('../../assets/images/auth-wall/w7.webp'),
  require('../../assets/images/auth-wall/w8.webp'),
]

// Which tiles each column shows, how far down it starts, and how it drifts.
const COLUMNS = [
  { tiles: [0, 1, 2, 3], offset: 60, duration: 64000, up: true },
  { tiles: [3, 4, 5, 6], offset: 0, duration: 78000, up: false },
  { tiles: [6, 7, 0, 1], offset: 110, duration: 58000, up: true },
  { tiles: [5, 2, 7, 4], offset: 30, duration: 72000, up: false },
]

const GAP = 12

/** Tilted wall of wallpapers behind the sign-in card; columns drift slowly in opposite directions. */
export default function AuthMosaic() {
  const { width } = useLayoutInfo()
  const [still, setStill] = useState(false)

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setStill).catch(() => undefined)
  }, [])

  const wallWidth = Math.min(width * 1.36, 760)
  const columnWidth = (wallWidth - GAP * (COLUMNS.length - 1)) / COLUMNS.length
  const tileHeight = Math.round((columnWidth * 16) / 9)
  const setHeight = 4 * (tileHeight + GAP)

  return (
    <View
      pointerEvents="none"
      style={[styles.wall, { width: wallWidth, left: (width - wallWidth) / 2 - width * 0.02, top: -tileHeight * 0.55 }]}
    >
      {COLUMNS.map((col, i) => (
        <DriftColumn
          key={i}
          tiles={col.tiles}
          width={columnWidth}
          tileHeight={tileHeight}
          setHeight={setHeight}
          offset={col.offset}
          duration={col.duration}
          up={col.up}
          still={still}
        />
      ))}
    </View>
  )
}

function DriftColumn({
  tiles, width, tileHeight, setHeight, offset, duration, up, still,
}: {
  tiles: number[]; width: number; tileHeight: number; setHeight: number
  offset: number; duration: number; up: boolean; still: boolean
}) {
  const progress = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (still) return
    const loop = Animated.loop(
      Animated.timing(progress, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: true })
    )
    loop.start()
    return () => loop.stop()
  }, [progress, duration, still])

  // The tile set is drawn twice, so moving by exactly one set's height loops seamlessly.
  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: up ? [0, -setHeight] : [-setHeight, 0],
  })

  return (
    <Animated.View style={{ width, marginTop: offset, gap: GAP, transform: [{ translateY }] }}>
      {[...tiles, ...tiles].map((t, i) => (
        <Image key={i} source={TILES[t]} style={[styles.tile, { height: tileHeight }]} contentFit="cover" />
      ))}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  wall: {
    position: 'absolute',
    flexDirection: 'row',
    gap: GAP,
    transform: [{ rotate: '-12deg' }],
    opacity: 0.85,
  },
  tile: {
    width: '100%',
    borderRadius: 16,
    backgroundColor: Colors.bgElevated,
  },
})
