import { StyleSheet, View } from "react-native"
import Header from "../../components/Header"


const latest = () => {
  return (
    <View style={styles.container}>
      <Header title="Latest" titleFontSize={20} logo={false}/>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111111',
  },
});
export default latest