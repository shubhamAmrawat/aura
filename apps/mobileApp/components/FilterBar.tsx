import { Ionicons } from "@expo/vector-icons"
import { router } from "expo-router"
import { Pressable, StyleSheet, Text, View } from "react-native"

const FilterBar = () => {
  return (
    <View style={styles.container}>
      <Pressable>
        <Ionicons
          name="filter-outline"
          size={20}
          color="#81ee4e"
        />
      </Pressable>
    </View>
  )
}
const styles = StyleSheet.create({
  container: {
    padding: 5,
  }
})
export default FilterBar