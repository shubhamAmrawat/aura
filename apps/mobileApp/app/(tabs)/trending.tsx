import { View, Text, StyleSheet } from "react-native"
import Header from "../../components/Header";
import FilterBar from "../../components/FilterBar";
import { Colors } from "../../constants";

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
    backgroundColor: Colors.bgSecondary,
  }
});
export default Trending;