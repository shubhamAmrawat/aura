import { Ionicons } from "@expo/vector-icons"
import { router } from "expo-router"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { Colors } from "../constants";

const FilterBar = () => {
  return (
    <View style={styles.container}>
      <Pressable>
        <Ionicons
          name="filter-outline"
          size={20}
          color={Colors.accent}
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