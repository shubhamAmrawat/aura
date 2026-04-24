import { View, Text, StyleSheet } from "react-native"
import Header from "./Header";


const Profile = () => {
  return (
    <View style={styles.container} >
      <Header/>
      <Text style={styles.title}>Profile</Text>
    </View>
  )
};    

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111111',
    
  },
  title: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 20,
  }
});

export default Profile;