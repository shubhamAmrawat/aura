import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import Header from '../../components/Header';
import SearchBar from '../../components/searchBar';
import { Colors } from '../../constants';


const Search = () => {
  return (
    <View style={styles.container}>
      <Header title="" logo={false} rightElement={<SearchBar/>}/>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgSecondary,
    
  }
});
export default Search;