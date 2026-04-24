import { Ionicons } from "@expo/vector-icons"
import { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native"
import { Colors } from "../constants";


const SearchBar = () => {
  const [search, setSearch] = useState('');
  const handleSearch = () => {
    console.log(search);
  }
  return (
    <View style={styles.container}>
      <Ionicons
        name="search-outline"
        size={24}
        color={Colors.accent}
      />
      <TextInput
        placeholder="Search wallpapers..."
        placeholderTextColor={Colors.textSecondary}
        style={styles.input}
        value={search}
        onChangeText={setSearch}
        onSubmitEditing={handleSearch}
        returnKeyType="search"
      />

    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flex: 1,
    paddingHorizontal: 10,

    paddingVertical: 5,
    alignItems: 'center',
    borderColor: Colors.accent,
    borderWidth: 1,
    borderRadius: 50,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.bgSecondary,
    color: Colors.textPrimary,
    borderRadius: 10,
    padding: 10,
  }
})
export default SearchBar