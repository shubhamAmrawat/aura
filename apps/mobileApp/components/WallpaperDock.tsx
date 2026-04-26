import { Ionicons } from "@expo/vector-icons"
import { BlurView } from "expo-blur"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { Colors } from "../constants"
interface DockProps {
  bottomOffset: number, 
  screenWidth: number
}

const WallpaperDock = ({ bottomOffset, screenWidth }: DockProps) => {
  return (
    <BlurView 
     intensity={60} 
     tint="dark" 
     style={[
      styles.wallpaperDock, 
      { bottom: bottomOffset, width: screenWidth- 30 }]}>
      
      <Pressable style={styles.dockButtons}>
        <Ionicons name="download-outline" size={24} color="white" />
        <Text style={styles.label}>Download</Text>
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
    flexDirection:'row',
    borderRadius:40,
    position: 'absolute',
    overflow:'hidden',
    borderWidth:1,
    borderColor:Colors.cardBorder,
    paddingHorizontal:10,
    paddingVertical:14,
    alignSelf:'center',
    justifyContent:'space-around',
  },
  dockButtons: {
    alignItems:'center',
    gap:5, 
    paddingHorizontal:16, 
  }, 
  label:{
    color:Colors.textPrimary,
    fontSize:12,
    fontWeight:'600',
  }
})

export default WallpaperDock