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
            {logo ? (
              <Image source={Images.LOGO_WORDMARK} style={styles.logo} resizeMode="contain" accessibilityLabel="Aurora" />
            ) : (
              <Text style={[styles.title, { fontSize: titleFontSize }]}>{title}</Text>
            )}
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
    color: Colors.textPrimary,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  logo: {
    width: 104,
    height: 24,
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