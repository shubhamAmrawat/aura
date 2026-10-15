import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { Image } from "expo-image";
import { Colors } from "../../constants";
import { useAuth } from "../../lib/AuthContext";

type IconName = keyof typeof Ionicons.glyphMap;

const icon =
  (on: IconName, off: IconName) =>
  ({ focused, color }: { focused: boolean; color: string }) => <Ionicons name={focused ? on : off} size={24} color={color} />;

const TabLayout = () => {
  const { user } = useAuth();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.bgSecondary,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: Colors.accent,
        tabBarInactiveTintColor: Colors.textSecondary,
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: icon("home", "home-outline") }} />
      <Tabs.Screen name="explore" options={{ title: "Explore", tabBarIcon: icon("compass", "compass-outline") }} />
      <Tabs.Screen name="library" options={{ title: "Library", tabBarIcon: icon("albums", "albums-outline") }} />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ focused, color }) =>
            user?.avatarUrl ? (
              <Image
                source={user.avatarUrl}
                style={{ width: 26, height: 26, borderRadius: 13, borderWidth: focused ? 2 : 0, borderColor: Colors.accent }}
              />
            ) : (
              <Ionicons name={focused ? "person" : "person-outline"} size={24} color={color} />
            ),
        }}
      />
    </Tabs>
  );
};

export default TabLayout;
