import { View, Text, StyleSheet } from "react-native"
import Header from "../../components/Header";
import FilterBar from "../../components/FilterBar";

const Trending = () => {
  return (
    <View style={styles.container}>
        <Header title="Trending" titleFontSize={20} logo={false} rightElement={<FilterBar/>}/>
    </View>
  )
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111111',
  }
});
export default Trending;