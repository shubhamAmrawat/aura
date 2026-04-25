import { Ionicons } from "@expo/vector-icons"
import { router } from "expo-router"
import { Pressable, StyleSheet, View } from "react-native"
import { useAuth } from "../lib/AuthContext";
import { Image } from "expo-image";
import { Colors } from "../constants";


const ProfileButton = () => {
  const { user } = useAuth();
  const handleNavigate = () => {
    if(user){
      router.push('/Profile');
    }else{
      router.push('/auth');
    }
  }
  return (
    <View style={styles.container}>
      <Pressable onPress={handleNavigate}>

        {user?.avatarUrl ? (
          <Image source={{ uri: user.avatarUrl }} style={{ width: 33, height: 33,borderRadius: 100 }} />
        ) : (
          <Ionicons
            name="person-outline"
            size={20}
            color={Colors.accent}
          />
        )}

      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 2,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: Colors.accent ,
  }
})
export default ProfileButton