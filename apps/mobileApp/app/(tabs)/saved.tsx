import { useCallback, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { useFocusEffect } from "expo-router";
import Header from "../../components/Header";
import MasonryFeed from "../../components/MasonryFeed";
import SignInPrompt from "../../components/SignInPrompt";
import { Colors } from "../../constants";
import { useAuth } from "../../lib/AuthContext";
import { getLikedWallpapers } from "../../lib/wallpaperApi";
import { useFeed } from "../../lib/useFeed";

const Saved = () => {
  const { user } = useAuth();
  const fetchLiked = useCallback(
    async () => (user ? { data: await getLikedWallpapers(), hasMore: false } : { data: [], hasMore: false }),
    [user]
  );
  const feed = useFeed(fetchLiked, user?.id ?? "guest", 1000);

  // Likes change on the detail screen, so reload whenever the tab comes back into view.
  const firstFocus = useRef(true);
  const { refresh } = feed;
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      if (user) void refresh();
    }, [user, refresh])
  );

  return (
    <View style={styles.container}>
      <Header title="Saved" logo={false} titleFontSize={20} />
      {user ? (
        <MasonryFeed feed={feed} emptyIcon="heart-outline" emptyText="Tap the heart on any wallpaper to save it here." />
      ) : (
        <SignInPrompt icon="heart-outline" title="Keep the ones you love" text="Sign in to save wallpapers and find them here on any device." />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgSecondary,
  },
});

export default Saved;
