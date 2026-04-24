import { Ionicons } from "@expo/vector-icons"
import { router } from "expo-router"
import { Pressable, StyleSheet, View } from "react-native"
import { useAuth } from "../lib/AuthContext";
import { Image } from "expo-image";


const ProfileButton = () => {
  const { user } = useAuth();
  return (
    <View style={styles.container}>
      <Pressable onPress={() => router.push('/(tabs)/profile')}>

        {user?.avatarUrl ? (
          <Image source={{ uri: user.avatarUrl }} style={{ width: 30, height: 30, borderRadius: 15 }} />
        ) : (
          <Ionicons
            name="person-outline"
            size={20}
            color="#81ee4e"
          />
        )}

      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 5,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: '#81ee4e',
  }
})
export default ProfileButton