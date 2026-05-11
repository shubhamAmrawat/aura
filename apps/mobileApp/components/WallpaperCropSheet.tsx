import { Ionicons } from "@expo/vector-icons"
import { Image } from "expo-image"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  Modal,
  PanResponder,
  PixelRatio,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native"
import { Colors } from "../constants"
import { Wallpaper } from "../lib/api"
import { WallpaperCropArea, WallpaperTarget } from "../lib/applyWallpaper"

interface WallpaperCropSheetProps {
  visible: boolean
  wallpaper: Wallpaper
  target: WallpaperTarget | null
  applying: boolean
  onClose: () => void
  onApply: (crop: WallpaperCropArea) => void
}

type Point = {
  x: number
  y: number
}

const MIN_SCALE = 1
const MAX_SCALE = 4

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function getDistance(touches: Array<{ pageX: number; pageY: number }>) {
  const dx = touches[0].pageX - touches[1].pageX
  const dy = touches[0].pageY - touches[1].pageY
  return Math.sqrt(dx * dx + dy * dy)
}

export default function WallpaperCropSheet({
  visible,
  wallpaper,
  target,
  applying,
  onClose,
  onApply,
}: WallpaperCropSheetProps) {
  const window = useWindowDimensions()
  const isTablet = window.width >= 768
  const sourceWidth = Math.max(1, wallpaper.width || 1)
  const sourceHeight = Math.max(1, wallpaper.height || 1)

  const frame = useMemo(() => {
    const screenAspect = window.width / window.height
    const maxWidth = isTablet ? Math.min(window.width - 128, 640) : window.width - 48
    const maxHeight = window.height * (isTablet ? 0.64 : 0.56)
    const widthFromHeight = maxHeight * screenAspect

    if (widthFromHeight <= maxWidth) {
      return { width: Math.round(widthFromHeight), height: Math.round(maxHeight) }
    }

    return { width: Math.round(maxWidth), height: Math.round(maxWidth / screenAspect) }
  }, [isTablet, window.height, window.width])

  const baseScale = Math.max(frame.width / sourceWidth, frame.height / sourceHeight)
  const [scale, setScale] = useState(1)
  const [translate, setTranslate] = useState<Point>({ x: 0, y: 0 })
  const scaleRef = useRef(scale)
  const translateRef = useRef(translate)
  const panStartTouch = useRef<Point | null>(null)
  const panStartTranslate = useRef<Point>({ x: 0, y: 0 })
  const pinchStartDistance = useRef<number | null>(null)
  const pinchStartScale = useRef(1)

  const displayedWidth = sourceWidth * baseScale * scale
  const displayedHeight = sourceHeight * baseScale * scale
  const targetLabel = target === "home" ? "Home Screen" : target === "lock" ? "Lock Screen" : "Both Screens"

  const boundTransform = (nextScale: number, nextTranslate: Point) => {
    const nextWidth = sourceWidth * baseScale * nextScale
    const nextHeight = sourceHeight * baseScale * nextScale
    const maxX = Math.max(0, (nextWidth - frame.width) / 2)
    const maxY = Math.max(0, (nextHeight - frame.height) / 2)

    return {
      scale: nextScale,
      translate: {
        x: clamp(nextTranslate.x, -maxX, maxX),
        y: clamp(nextTranslate.y, -maxY, maxY),
      },
    }
  }

  const setTransform = (nextScale: number, nextTranslate: Point) => {
    const bounded = boundTransform(nextScale, nextTranslate)
    scaleRef.current = bounded.scale
    translateRef.current = bounded.translate
    setScale(bounded.scale)
    setTranslate(bounded.translate)
  }

  useEffect(() => {
    if (!visible) return
    setTransform(1, { x: 0, y: 0 })
  }, [frame.height, frame.width, sourceHeight, sourceWidth, visible])

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          const touch = event.nativeEvent.touches[0]
          panStartTouch.current = { x: touch.pageX, y: touch.pageY }
          panStartTranslate.current = translateRef.current
        },
        onPanResponderMove: (event) => {
          const touches = event.nativeEvent.touches

          if (touches.length >= 2) {
            const distance = getDistance(touches)
            if (!pinchStartDistance.current) {
              pinchStartDistance.current = distance
              pinchStartScale.current = scaleRef.current
            }

            const nextScale = clamp(
              pinchStartScale.current * (distance / pinchStartDistance.current),
              MIN_SCALE,
              MAX_SCALE
            )
            setTransform(nextScale, translateRef.current)
            return
          }

          const touch = touches[0]
          if (!touch || !panStartTouch.current) return

          const nextTranslate = {
            x: panStartTranslate.current.x + touch.pageX - panStartTouch.current.x,
            y: panStartTranslate.current.y + touch.pageY - panStartTouch.current.y,
          }
          setTransform(scaleRef.current, nextTranslate)
        },
        onPanResponderRelease: () => {
          panStartTouch.current = null
          pinchStartDistance.current = null
        },
        onPanResponderTerminate: () => {
          panStartTouch.current = null
          pinchStartDistance.current = null
        },
      }),
    [baseScale, frame.height, frame.width, sourceHeight, sourceWidth]
  )

  const handleApply = () => {
    if (!target || applying) return

    const displayScale = baseScale * scaleRef.current
    const currentWidth = sourceWidth * displayScale
    const currentHeight = sourceHeight * displayScale
    const imageLeft = (frame.width - currentWidth) / 2 + translateRef.current.x
    const imageTop = (frame.height - currentHeight) / 2 + translateRef.current.y
    const cropWidth = frame.width / displayScale
    const cropHeight = frame.height / displayScale
    const originX = clamp(-imageLeft / displayScale, 0, sourceWidth - cropWidth)
    const originY = clamp(-imageTop / displayScale, 0, sourceHeight - cropHeight)
    const outputWidth = PixelRatio.getPixelSizeForLayoutSize(window.width)
    const outputHeight = PixelRatio.getPixelSizeForLayoutSize(window.height)

    onApply({
      originX,
      originY,
      width: cropWidth,
      height: cropHeight,
      sourceWidth,
      sourceHeight,
      outputWidth,
      outputHeight,
    })
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <Pressable style={styles.overlay} onPress={applying ? undefined : onClose} />

        <View style={styles.sheetWrapper}>
          <View style={styles.sheet}>
            <View style={styles.header}>
              <View>
                <Text style={styles.title}>Preview & Crop</Text>
                <Text style={styles.subtitle}>Pinch and drag for {targetLabel}</Text>
              </View>
              <Pressable style={styles.closeButton} onPress={onClose} disabled={applying}>
                <Ionicons name="close" size={20} color={Colors.textSecondary} />
              </Pressable>
            </View>

            <View
              style={[styles.previewFrame, { width: frame.width, height: frame.height }]}
              {...panResponder.panHandlers}
            >
              <Image
                source={{ uri: wallpaper.fileUrl }}
                style={[
                  styles.previewImage,
                  {
                    width: displayedWidth,
                    height: displayedHeight,
                    left: (frame.width - displayedWidth) / 2 + translate.x,
                    top: (frame.height - displayedHeight) / 2 + translate.y,
                  },
                ]}
                contentFit="fill"
                transition={180}
              />
              <View pointerEvents="none" style={styles.centerGuide} />
            </View>

            <Text style={styles.helpText}>
              This preview uses your current device shape, so phone and tablet crops apply consistently.
            </Text>

            <View style={styles.actions}>
              <Pressable style={styles.secondaryButton} onPress={onClose} disabled={applying}>
                <Text style={styles.secondaryText}>Back</Text>
              </Pressable>
              <Pressable
                style={[styles.primaryButton, applying && styles.disabledButton]}
                onPress={handleApply}
                disabled={applying}
              >
                <Text style={styles.primaryText}>{applying ? "Applying..." : "Apply"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "flex-end",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.bgScrim,
  },
  sheetWrapper: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: Colors.border,
    overflow: "hidden",
    backgroundColor: Colors.bgElevated,
  },
  sheet: {
    backgroundColor: Colors.bgElevated,
    paddingTop: 18,
    paddingHorizontal: 20,
    paddingBottom: 28,
    gap: 16,
    alignItems: "center",
  },
  header: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: "700",
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  previewFrame: {
    overflow: "hidden",
    borderRadius: 28,
    backgroundColor: Colors.bgPrimary,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  previewImage: {
    position: "absolute",
  },
  centerGuide: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    borderRadius: 28,
  },
  helpText: {
    color: Colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
  },
  actions: {
    width: "100%",
    flexDirection: "row",
    gap: 10,
  },
  secondaryButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  primaryButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Colors.accent,
  },
  disabledButton: {
    opacity: 0.55,
  },
  secondaryText: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontWeight: "700",
  },
  primaryText: {
    color: Colors.bgPrimary,
    fontSize: 15,
    fontWeight: "800",
  },
})
