import { StyleSheet, View } from "react-native"
import Header from "../../components/Header"
import { Colors } from "../../constants";


const Latest = () => {
  return ( 
    <View style={styles.container}>
      <Header title="Latest" titleFontSize={20} logo={false}/>
    </View>    
    
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgSecondary,
  },
});
export default Latest