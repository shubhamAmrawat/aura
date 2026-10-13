import { ActivityIndicator, Image, StyleSheet, View } from "react-native";
import { Colors } from "../constants/colors";
import { Images } from "../constants";

const SplashScreen = () => {
  return (
    <View style={styles.container}>
      <Image source={Images.LOGO_WORDMARK} style={styles.logo} resizeMode="contain" accessibilityLabel="Aurora" />
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
    width: 208,
    height: 48,
  },
  loader: {
    marginTop: 16,
  },
});

export default SplashScreen;
