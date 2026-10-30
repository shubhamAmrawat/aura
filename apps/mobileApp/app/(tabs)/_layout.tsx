import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { Colors } from "../../constants";
import { useInsets } from "../../hooks/useInsets";
import { TabBarSpaceContext } from "../../lib/TabBarSpace";

type IconName = keyof typeof Ionicons.glyphMap;

const icon =
  (on: IconName, off: IconName) =>
  ({ focused, color }: { focused: boolean; color: string }) => <Ionicons name={focused ? on : off} size={23} color={color} />;

const BAR_HEIGHT = 64;
const BAR_GAP = 10; // space between the bar and the bottom of the screen (above the gesture area)

/** Tabs with a floating tab bar; lists add useTabBarSpace() at their bottom. */
const TabLayout = () => {
  const { bottomPadding } = useInsets();
  const bottom = bottomPadding + BAR_GAP;
  return (
    <TabBarSpaceContext.Provider value={bottom + BAR_HEIGHT + 12}>
      <Tabs
        safeAreaInsets={{ bottom: 0 }}
        screenOptions={{
          headerShown: false,
          tabBarHideOnKeyboard: true,
          tabBarStyle: {
            position: "absolute",
            bottom,
            marginHorizontal: 16,
            height: BAR_HEIGHT,
            paddingTop: 8,
            paddingBottom: 8,
            borderRadius: 60,
            borderTopWidth: 1,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.08)",
            borderTopColor: "rgba(255,255,255,0.08)",
            // Nearly opaque so labels stay readable over bright wallpapers. No elevation/shadow:
            // on Android the shadow is drawn as a dark rectangle that shows through a translucent bar.
            backgroundColor: "rgba(16,16,16,0.94)",
            elevation: 0,
            shadowOpacity: 0,
          },
          tabBarLabelStyle: { fontSize: 11, fontWeight: "700" },
          tabBarActiveTintColor: Colors.accent,
          tabBarInactiveTintColor: Colors.textSecondary,
        }}
      >
        <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: icon("home", "home-outline") }} />
        <Tabs.Screen name="explore" options={{ title: "Explore", tabBarIcon: icon("compass", "compass-outline") }} />
        <Tabs.Screen name="library" options={{ title: "Library", tabBarIcon: icon("albums", "albums-outline") }} />
      </Tabs>
    </TabBarSpaceContext.Provider>
  );
};

export default TabLayout;
