import { View, Text, StyleSheet } from "react-native"
import Header from "../components/Header"
import { Colors } from "../constants";

export default function Profile() {
  return (
    <View style={styles.container}>
      <Header title="Profile" logo={false} titleFontSize={20} showBackButton={true} />
      <Text style={styles.text}>Profile</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgSecondary },
  text: { color: Colors.textPrimary, textAlign: 'center', marginTop: 20 },
})