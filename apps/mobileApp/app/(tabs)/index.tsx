import { useCallback, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import Header from "../../components/Header";
import HomeSections from "../../components/HomeSections";
import MasonryFeed from "../../components/MasonryFeed";
import { Colors } from "../../constants";
import { getWallpapers } from "../../lib/wallpaperApi";
import { useScreenFilter } from "../../lib/ScreenFilterContext";
import { useFeed } from "../../lib/useFeed";

const Home = () => {
  const { screen } = useScreenFilter();
  const [refreshToken, setRefreshToken] = useState(0);
  const fetchLatest = useCallback(
    (offset: number, limit: number) => getWallpapers({ limit, offset, screen }),
    [screen]
  );
  const feed = useFeed(fetchLatest, screen);

  return (
    <View style={styles.container}>
      <Header
        logo
        rightElement={
          <Pressable onPress={() => router.navigate("/explore")} hitSlop={10} style={styles.searchBtn} accessibilityLabel="Search">
            <Ionicons name="search" size={20} color={Colors.textPrimary} />
          </Pressable>
        }
      />
      <MasonryFeed
        feed={feed}
        header={<HomeSections screen={screen} refreshToken={refreshToken} />}
        onRefresh={() => setRefreshToken((n) => n + 1)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgSecondary,
  },
  searchBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.bgElevated,
  },
});

export default Home;
