import { Ionicons } from "@expo/vector-icons"
import { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native"


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
        color="#81ee4e"
      />
      <TextInput
        placeholder="Search wallpapers..."
        placeholderTextColor="#888888"
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
    borderColor: '#81ee4e',
    borderWidth: 1,
    borderRadius: 50,
  },
  input: {
    flex: 1,
    backgroundColor: '#111111',
    color: 'white',
    borderRadius: 10,
    padding: 10,
  }
})
export default SearchBar