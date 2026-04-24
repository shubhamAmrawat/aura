import { Ionicons } from "@expo/vector-icons"
import { Tabs } from "expo-router"
import { useInsets } from "../../hooks/useInsets";
import { Colors } from "../../constants";


const TabLayout = () => {
  const { bottomPadding } = useInsets();
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
      <Tabs.Screen name="index" options={{
        title: "Home", tabBarIcon: ({ focused, color }) => (
          <Ionicons
            name={focused ? "home" : "home-outline"}
            size={24}
            color={color}
          />
        )
      }} />

      <Tabs.Screen name="search" options={{
        title: "Search", tabBarIcon: ({ focused, color }) => (
          <Ionicons
            name={focused ? "search" : "search-outline"}
            size={24}
            color={color}
          />
        )
      }} />

      <Tabs.Screen name="trending" options={{
        title: "Trending", tabBarIcon: ({ focused, color }) => (
          <Ionicons
            name={focused ? "trending-up" : "trending-up-outline"}
            size={24}
            color={color}
          />
        )
      }} />

      <Tabs.Screen
        name="Latest"
        options={{
          title: "Latest",
          tabBarIcon: ({ focused, color }) => (
            <Ionicons
            name={focused ? "time" : "time-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  )
}

export default TabLayout