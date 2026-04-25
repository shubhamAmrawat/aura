import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";
import { Colors } from "../constants/colors";
import { Images } from "../constants";

const SplashScreen = () => {
  return (
    <View style={styles.container}>
      <Image source={{ uri: Images.SITE_LOGO_URL }} style={styles.logo} resizeMode="contain" />
      <Text style={styles.title}>AURORA</Text>
      <ActivityIndicator size="small" color={Colors.accent} style={styles.loader} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: 96,
    height: 96,
  },
  title: {
    marginTop: 14,
    color: Colors.accent,
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 4,
  },
  loader: {
    marginTop: 16,
  },
});

export default SplashScreen;
