import { useEffect, useState } from "react"
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { router } from "expo-router"
import { Category, Wallpaper } from "../lib/api"
import { getCategoryMap } from "../lib/categoryNames"
import { Colors } from "../constants"


interface DetailsSheetProps {
  visible: boolean
  onClose: () => void
  wallpaper: Wallpaper
}

const DetailsSheet = ({ visible, onClose, wallpaper }: DetailsSheetProps) => {
  const [categories, setCategories] = useState<Category[]>([])
  const categoryKey = [wallpaper.categoryId, ...(wallpaper.extraCategoryIds ?? [])].filter(Boolean).join(",")
  useEffect(() => {
    if (!visible || !categoryKey) {
      setCategories([])
      return
    }
    let alive = true
    getCategoryMap()
      .then((map) => {
        if (!alive) return
        setCategories(categoryKey.split(",").map((id) => map.get(id)).filter((c): c is Category => Boolean(c)))
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [visible, categoryKey])

  const openCategory = (c: Category) => {
    onClose()
    router.push({ pathname: "/category/[slug]", params: { slug: c.slug, name: c.name } })
  }
  const openTag = (tag: string) => {
    onClose()
    router.push({ pathname: "/feed/[kind]", params: { kind: "tag", q: tag } })
  }

  const resolution = `${wallpaper.width} x ${wallpaper.height}`
  const fileSizeMB = wallpaper.fileSizeBytes
  ? `${(wallpaper.fileSizeBytes / (1024 * 1024)).toFixed(1)} MB`
  : 'Unknown'

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <Pressable style={styles.overlay} onPress={onClose} />
        <View style={styles.sheetWrapper}>
          <View style={styles.sheet}>
            {/* handle bar */}
            <View style={styles.handle} />

            {!!wallpaper.title && <Text style={styles.sheetTitle}>{wallpaper.title}</Text>}
            {!!wallpaper.description && (
              <Text style={styles.description}>{wallpaper.description}</Text>
            )}

            <View style={styles.metaGrid}>
              <View style={styles.metaCard}>
                <Text style={styles.metaLabel}>Resolution</Text>
                <Text style={styles.metaValue}>{resolution}</Text>
              </View>
              <View style={styles.metaCard}>
                <Text style={styles.metaLabel}>Size</Text>
                <Text style={styles.metaValue}>{fileSizeMB}</Text>
              </View>
              <View style={styles.metaCard}>
                <Text style={styles.metaLabel}>Downloads</Text>
                <Text style={styles.metaValue}>{wallpaper.downloadCount.toLocaleString()}</Text>
              </View>
              <View style={styles.metaCard}>
                <Text style={styles.metaLabel}>Likes</Text>
                <Text style={styles.metaValue}>{wallpaper.likeCount.toLocaleString()}</Text>
              </View>
            </View>

            {wallpaper.palette.length > 0 && (
              <View style={styles.paletteSection}>
                <Text style={styles.sectionTitle}>Palette</Text>
                <View style={styles.paletteRow}>
                  {wallpaper.palette.slice(0, 8).map((color) => (
                    <View key={color} style={styles.paletteItem}>
                      <View style={[styles.swatch, { backgroundColor: color }]} />
                      <Text style={styles.swatchLabel} numberOfLines={1}>
                        {color}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {categories.length > 0 && (
              <View style={styles.tagsSection}>
                <Text style={styles.sectionTitle}>Categories</Text>
                <View style={styles.categoryRow}>
                  {categories.map((c) => (
                    <Pressable key={c.id} onPress={() => openCategory(c)} style={({ pressed }) => [styles.categoryChip, pressed && { opacity: 0.75 }]}>
                      <Text style={styles.categoryText}>{c.name}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
            {wallpaper.tags.length > 0 && (
              <View style={styles.tagsSection}>
                <Text style={styles.sectionTitle}>Tags</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.tagsRow}
                >
                  {wallpaper.tags.map((tag) => (
                    <Pressable key={tag} onPress={() => openTag(tag)} style={({ pressed }) => [styles.tagChip, pressed && { opacity: 0.75 }]}>
                      <Text style={styles.tagText}>#{tag}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}
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
    paddingTop: 10,
    paddingHorizontal: 20,
    paddingBottom: 30,
    gap: 14,
  },
  handle: {
    width: 52,
    height: 5,
    borderRadius: 999,
    backgroundColor: Colors.borderHover,
    alignSelf: "center",
    marginBottom: 8,
  },
  sheetTitle: {
    color: Colors.textPrimary,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "800",
  },
  description: {
    color: Colors.textSecondary,
    fontSize: 17,
    lineHeight: 26,
    fontWeight: "600",
  },
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metaCard: {
    flex:1,
    minWidth: "45%",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    backgroundColor: Colors.cardSurface,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  metaLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  metaValue: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: "600",
  },
  paletteSection: {
    gap: 10,
  },
  paletteRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  paletteItem: {
    width: "23%",
    gap: 6,
  },
  swatch: {
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.borderHover,
  },
  swatchLabel: {
    color: Colors.textMuted,
    fontSize: 10,
  },
  tagsSection: {
    gap: 8,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: "700",
  },
  tagsRow: {
    gap: 8,
    paddingRight: 8,
  },
  categoryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  categoryChip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: Colors.accentMuted,
    borderWidth: 1,
    borderColor: "rgba(129, 238, 78, 0.35)",
  },
  categoryText: {
    color: Colors.accent,
    fontSize: 13,
    fontWeight: "700",
  },
  tagChip: {
    borderWidth: 1,
    borderColor: Colors.borderHover,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: Colors.bgSecondary,
  },
  tagText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
  },
})
export default DetailsSheet