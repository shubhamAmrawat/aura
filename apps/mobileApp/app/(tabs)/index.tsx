import { StyleSheet, Text, View } from "react-native"
import Header from "../../components/Header";
import ProfileButton from "../../components/ProfileButton";


const Index = () => {
  return (
    <View style={styles.container}>
      <Header title="AURORA" logo={true} titleFontSize={24} rightElement={<ProfileButton/>}/>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111111',

  },
});

export default Index