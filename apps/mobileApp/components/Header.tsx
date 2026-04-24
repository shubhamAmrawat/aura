import { Image, StyleSheet, Text, View } from "react-native"
import { useInsets } from "../hooks/useInsets";

interface HeaderProps {
  title?: string;
  logo?: boolean;
  titleFontSize?: number;
  rightElement?: React.ReactNode
}
const SITE_LOGO_URL = "https://res.cloudinary.com/dvzm9b086/image/upload/v1776106005/logo_1266_culdvs.png";


const Header = ({ title = "AURORA", logo = true, titleFontSize = 24, rightElement }: HeaderProps) => {
  const { topPadding } = useInsets();
  return (
    <View style={[styles.container, { paddingTop: topPadding + 10 }]}>
      {/* left side */}

      {
        (logo || title) &&
        (
          <View style={styles.logoContainer}>
            {logo && <Image source={{ uri: SITE_LOGO_URL }} style={styles.logo} />}
            <Text style={[styles.title, { fontSize: titleFontSize }]}>{title}</Text>
          </View>
        )
      }

      {/* right side */}
      <View style={styles.rightContainer}>
        {rightElement}
      </View>
    </View >
  )
}
const styles = StyleSheet.create({
  container: {
    backgroundColor: '#111111',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    borderBottomColor: '#888888',
    paddingBottom: 10,
  },
  title: {
    color: '#81ee4e',
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
});
export default Header