import { Stack } from "expo-router";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "../lib/AuthContext";
import { ToastProvider, useToast } from "../lib/ToastContext";
import { ScreenFilterProvider, useScreenFilter } from "../lib/ScreenFilterContext";
import * as SystemUI from "expo-system-ui";
import { Colors } from "../constants/colors";
import SplashScreen from "../components/SplashScreen";

SystemUI.setBackgroundColorAsync(Colors.bgSecondary);

const RootLayout = () => {
  return (
    <SafeAreaProvider>
      <ScreenFilterProvider>
        <AuthProvider>
          <ToastProvider>
            <AppGate />
          </ToastProvider>
        </AuthProvider>
      </ScreenFilterProvider>
    </SafeAreaProvider>
  );
};

function AppGate() {
  const { loaded } = useAuth();
  const { showToast } = useToast();
  const { deviceType, screen } = useScreenFilter();

  useEffect(() => {
    showToast(
      `${deviceType.toUpperCase()} detected: filtering ${screen === "tablet" ? "wide" : "portrait"} wallpapers`,
      { type: "info", position: "top" }
    );
    console.log(`[screen-filter] deviceType=${deviceType} screen=${screen}`);
  }, []);

  if (!loaded) return <SplashScreen />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "fade_from_bottom",
        contentStyle: { backgroundColor: Colors.bgSecondary },
      }}
    />
  );
}

export default RootLayout;