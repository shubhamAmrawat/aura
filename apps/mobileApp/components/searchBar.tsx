import { Ionicons } from "@expo/vector-icons"
import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native"
import { Colors } from "../constants";


type SearchBarProps = {
  value?: string;
  onChangeText?: (value: string) => void;
  onSubmit?: (value: string) => void;
  onClear?: () => void;
  placeholder?: string;
  isActive?: boolean;
};

const SearchBar = ({
  value,
  onChangeText,
  onSubmit,
  onClear,
  placeholder = "Search wallpapers...",
  isActive = false,
}: SearchBarProps) => {
  const [internalSearch, setInternalSearch] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const search = value ?? internalSearch;

  const handleChange = (text: string) => {
    if (onChangeText) {
      onChangeText(text);
      return;
    }
    setInternalSearch(text);
  };

  const handleSearch = () => {
    onSubmit?.(search);
  };

  const handleClear = () => {
    if (onChangeText) {
      onChangeText("");
    } else {
      setInternalSearch("");
    }
    onClear?.();
  }
  return (
    <View style={[styles.container, (isFocused || isActive) ? styles.containerFocused : null]}>
      <Ionicons
        name="search-outline"
        size={22}
        color={(isFocused || isActive) ? Colors.accent : Colors.textSecondary}
      />
      <TextInput
        placeholder={placeholder}
        placeholderTextColor={Colors.textSecondary}
        style={styles.input}
        value={search}
        onChangeText={handleChange}
        onSubmitEditing={handleSearch}
        returnKeyType="search"
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
      />
      {search.trim().length > 0 ? (
        <Pressable onPress={handleClear} hitSlop={8}>
          <Ionicons name="close" size={18} color={Colors.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 50,
    backgroundColor: Colors.bgElevated,
  },
  containerFocused: {
    borderColor: Colors.accent,
  },
  input: {
    flex: 1,
    backgroundColor: "transparent",
    color: Colors.textPrimary,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 10,
  }
})
export default SearchBar