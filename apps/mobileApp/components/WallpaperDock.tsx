import { Ionicons } from "@expo/vector-icons"
import FrostedView from "./FrostedView"
import { Pressable, StyleSheet, Text } from "react-native"
import { Colors } from "../constants"
import { downloadWallpaper } from "../lib/downloadWallpaper"
import { trackWallpaperDownload } from "../lib/wallpaperApi"
import { Wallpaper } from "../lib/api"
import { useToast } from "../lib/ToastContext"
import { ReactNode, useState } from "react"
import { applyWallpaper, WallpaperCropArea, WallpaperTarget } from "../lib/applyWallpaper"
import ApplySheet from "./ApplySheet"
import DetailsSheet from "./DetailsSheet"
import WallpaperCropSheet from "./WallpaperCropSheet"
import { ensureMediaLibraryPermission } from "../lib/permissions"

interface DockProps {
  bottomOffset: number
  screenWidth: number
  wallpaper: Wallpaper
  /** Extra buttons shown before Download (the detail screen's Like and lock-screen Preview). */
  leadingActions?: ReactNode
}


const WallpaperDock = ({ bottomOffset, screenWidth, wallpaper, leadingActions }: DockProps) => {
  const [downloading, setDownloading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [showApplySheet, setShowApplySheet] = useState(false)
  const [cropTarget, setCropTarget] = useState<WallpaperTarget | null>(null)
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
      const granted = await ensureMediaLibraryPermission()
      if (!granted) {
        showToast("Gallery permission denied.", { type: "error" , position: "top"})
        return
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
      void trackWallpaperDownload(wallpaper.id)
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
  const handleApplyTarget = (target: WallpaperTarget) => {
    setShowApplySheet(false)
    setCropTarget(target)
  }

  const handleApplyCrop = async (crop: WallpaperCropArea) => {
    if (!cropTarget) return
    setApplying(true)
    try {
      const result = await applyWallpaper(wallpaper.fileUrl, wallpaper.title, cropTarget, crop)
      if (!result.success) {
        console.log(result.error)
        showToast(result.error ?? "Failed to apply.", { type: "error" , position: "top"})
        return
      }
      showToast(applySuccessMessages[cropTarget], { type: "success", position: "top" })
      setCropTarget(null)
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
      <FrostedView
        intensity={60}
        tint="dark"
        style={[
          styles.wallpaperDock,
          { bottom: bottomOffset, width: screenWidth - 30 }
        ]}
      >
        {leadingActions}

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
      </FrostedView>

      {/* Apply sheet renders outside the dock so it's not clipped */}
      <ApplySheet
        visible={showApplySheet}
        onClose={() => setShowApplySheet(false)}
        onSelect={handleApplyTarget}
        applying={applying}
      />

      <WallpaperCropSheet
        visible={!!cropTarget}
        wallpaper={wallpaper}
        target={cropTarget}
        applying={applying}
        onClose={() => setCropTarget(null)}
        onApply={handleApplyCrop}
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
    paddingHorizontal: 6,
    paddingVertical: 14,
    alignSelf: 'center',
    justifyContent: 'space-around',
  },
  dockButtons: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
  },
  label: {
    color: Colors.textPrimary,
    fontSize: 11,
    fontWeight: '600',
  }
})

export default WallpaperDock