import { Image, Pressable, StyleSheet, Text, View } from "react-native"
import { useInsets } from "../hooks/useInsets";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Colors } from "../constants";
import { Images } from "../constants";

interface HeaderProps {
  title?: string;
  logo?: boolean;
  titleFontSize?: number;
  showBackButton?: boolean;
  rightElement?: React.ReactNode
}


const Header = ({ title = "AURORA", logo = true, titleFontSize = 24, showBackButton = false, rightElement }: HeaderProps) => {
  const { topPadding } = useInsets();
  return (
    <View style={[styles.container, { paddingTop: topPadding + 10 }]}>
      {/* left side */}

      <View style={styles.leftContainer}>
        {showBackButton && (
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={Colors.accent} />
          </Pressable>
        )}
        {(logo || title) && (
          <View style={styles.logoContainer}>
            {logo && <Image source={{ uri: Images.SITE_LOGO_URL }} style={styles.logo} />}
            <Text style={[styles.title, { fontSize: titleFontSize }]}>{title}</Text>
          </View>
        )}
      </View>

      {/* right side */}
      <View style={styles.rightContainer}>
        {rightElement}
      </View>
    </View >
  )
}
const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.bgSecondary,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    borderBottomColor: Colors.textSecondary,
    paddingBottom: 10,
  },
  title: {
    color: Colors.accent,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 3,
  },
  logo: {
    width: 26,
    height: 26,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  leftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backButton: {
    padding: 4,
  },
});
export default Header