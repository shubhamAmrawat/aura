import { Ionicons } from "@expo/vector-icons"
import { BlurView } from "expo-blur"
import { Pressable, StyleSheet, Text } from "react-native"
import { Colors } from "../constants"
import * as MediaLibrary from 'expo-media-library'
import { downloadWallpaper } from "../lib/downloadWallpaper"
import { Wallpaper } from "../lib/api"
import { useToast } from "../lib/ToastContext"
import { useState } from "react"
import { applyWallpaper, WallpaperTarget } from "../lib/applyWallpaper"
import ApplySheet from "./ApplySheet"
import DetailsSheet from "./DetailsSheet"

interface DockProps {
  bottomOffset: number
  screenWidth: number
  wallpaper: Wallpaper
}


const WallpaperDock = ({ bottomOffset, screenWidth, wallpaper }: DockProps) => {
  const [status, requestPermission] = MediaLibrary.usePermissions({
    granularPermissions: ['photo'],
  })
  const [downloading, setDownloading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [showApplySheet, setShowApplySheet] = useState(false)
  const [showDetailsSheet, setShowDetailsSheet] = useState(false)
  const { showToast } = useToast()

  const applySuccessMessages: Record<WallpaperTarget, string> = {
    home: "Your home screen just got better",
    lock: "Lock screen refreshed",
    both: "Both screens upgraded",
  }
  const handleDownload = async () => {
    if (downloading) return
    setDownloading(true)
    try {
      if (status?.status !== 'granted') {
        const result = await requestPermission()
        if (!result.granted) {
          showToast("Gallery permission denied.", { type: "error" , position: "top"})
          return
        }
      }
      const downloadResult = await downloadWallpaper(
        wallpaper.fileUrl,
        wallpaper.title,
        wallpaper.format
      )
      if (!downloadResult.success) {
        showToast(downloadResult.error ?? "Failed to add to Gallery.", { type: "error" , position: "top"})
        return
      }
      showToast("Successfully added to your Gallery", { type: "success", position: "top" })
    } finally {
      setDownloading(false)
    }
  }

  // Opens the apply sheet — actual apply happens in handleApplyTarget
  const handleApply = () => {
    setShowApplySheet(true)
  }

  // Called when user picks Home / Lock / Both in the sheet
  const handleApplyTarget = async (target: WallpaperTarget) => {
    setShowApplySheet(false)
    setApplying(true)
    try {
      const result = await applyWallpaper(wallpaper.fileUrl, wallpaper.title, target)
      if (!result.success) {
        console.log(result.error)
        showToast(result.error ?? "Failed to apply.", { type: "error" , position: "top"})
        return
      }
      if (result.needsUserConfirmation) {
        showToast(applySuccessMessages[target], { type: "success", position: "top" })
        return
      }
      showToast(applySuccessMessages[target], { type: "success", position: "top" })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.log(message)
      showToast(message, { type: "error" , position: "top"})
    } finally {
      setApplying(false)
    }
  }

  return (
    <>
      <BlurView
        intensity={60}
        tint="dark"
        style={[
          styles.wallpaperDock,
          { bottom: bottomOffset, width: screenWidth - 30 }
        ]}
      >
        <Pressable style={styles.dockButtons} onPress={handleDownload} disabled={downloading}>
          <Ionicons
            name={downloading ? "hourglass-outline" : "download-outline"}
            size={24}
            color={downloading ? Colors.textMuted : Colors.textPrimary}
          />
          <Text style={[styles.label, downloading && { color: Colors.textMuted }]}>
            {downloading ? "Saving..." : "Download"}
          </Text>
        </Pressable>

        <Pressable style={styles.dockButtons} onPress={handleApply} disabled={applying}>
          <Ionicons
            name={applying ? "hourglass-outline" : "phone-portrait-outline"}
            size={24}
            color={applying ? Colors.textMuted : Colors.textPrimary}
          />
          <Text style={[styles.label, applying && { color: Colors.textMuted }]}>
            {applying ? "Applying..." : "Apply"}
          </Text>
        </Pressable>

        <Pressable style={styles.dockButtons} onPress={() => setShowDetailsSheet(true)}>
          <Ionicons name="information-circle-outline" size={24} color={Colors.textPrimary} />
          <Text style={styles.label}>Details</Text>
        </Pressable>
      </BlurView>

      {/* Apply sheet renders outside BlurView so it's not clipped */}
      <ApplySheet
        visible={showApplySheet}
        onClose={() => setShowApplySheet(false)}
        onSelect={handleApplyTarget}
        applying={applying}
      />

      <DetailsSheet
        visible={showDetailsSheet}
        onClose={() => setShowDetailsSheet(false)}
        wallpaper={wallpaper}
      />
    </>
  )
}

const styles = StyleSheet.create({
  wallpaperDock: {
    flexDirection: 'row',
    borderRadius: 40,
    position: 'absolute',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    paddingHorizontal: 10,
    paddingVertical: 14,
    alignSelf: 'center',
    justifyContent: 'space-around',
  },
  dockButtons: {
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 16,
  },
  label: {
    color: Colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  }
})

export default WallpaperDock