import { Ionicons } from "@expo/vector-icons"
import { BlurView } from "expo-blur"
import { Pressable, StyleSheet, Text } from "react-native"
import { Colors } from "../constants"
import * as MediaLibrary from 'expo-media-library'
import { downloadWallpaper } from "../lib/downloadWallpaper"
import { Wallpaper } from "../lib/api"
import { useToast } from "../lib/ToastContext"
import { useState } from "react"
interface DockProps {
  bottomOffset: number,
  screenWidth: number
  wallpaper: Wallpaper
}

const WallpaperDock = ({ bottomOffset, screenWidth, wallpaper }: DockProps) => {
  const [status, requestPermission] = MediaLibrary.usePermissions()
  const [downloading, setDownloading] = useState(false)
  const { showToast } = useToast()
  const handleDownload = async () => {
    if (downloading) return
    setDownloading(true)
    try {
      // Step 1 — check/request permission
      if (status?.status !== 'granted') {
        const result = await requestPermission()
        if (!result.granted) {
          showToast("Gallery permission denied.", { type: "error", position: "top" });
          return  // exit early — can't download without permission
        }
      }

      // Step 2 — permission is confirmed granted, now download
      const downloadResult = await downloadWallpaper(
        wallpaper.fileUrl,
        wallpaper.title,
        wallpaper.format
      )

      if (!downloadResult.success) {
        showToast(downloadResult.error ?? "Failed to add to Gallery.", { type: "error", position: "top" });
        return
      }

      showToast("Successfully added to your Gallery", { type: "success", position: "top" });
    } finally {
      setDownloading(false)
    }
  }
  return (
    <BlurView
      intensity={60}
      tint="dark"
      style={[
        styles.wallpaperDock,
        { bottom: bottomOffset, width: screenWidth - 30 }]}>

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

      <Pressable style={styles.dockButtons}>
        <Ionicons name="phone-portrait-outline" size={24} color="white" />
        <Text style={styles.label}>Apply</Text>
      </Pressable>

      <Pressable style={styles.dockButtons}>
        <Ionicons name="information-circle-outline" size={24} color="white" />
        <Text style={styles.label}>Details</Text>
      </Pressable>

    </BlurView>
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