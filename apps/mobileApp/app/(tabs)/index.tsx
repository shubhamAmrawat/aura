import { StyleSheet, Text, View } from "react-native"
import Header from "../../components/Header";
import ProfileButton from "../../components/ProfileButton";
import { Colors } from "../../constants";


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
    backgroundColor: Colors.bgSecondary,

  },
});

export default Index