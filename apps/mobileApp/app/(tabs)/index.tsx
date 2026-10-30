import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
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
    backgroundColor: Colors.bgPrimary,
  },
});

export default Home;
