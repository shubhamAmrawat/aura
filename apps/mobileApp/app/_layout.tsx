import { Stack } from "expo-router";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "../lib/AuthContext";
import { ToastProvider, useToast } from "../lib/ToastContext";
import { ScreenFilterProvider, useScreenFilter } from "../lib/ScreenFilterContext";
import * as SystemUI from "expo-system-ui";
import * as SecureStore from "expo-secure-store";
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
    let isMounted = true;

    const maybeShowFilterToast = async () => {
      try {
        const key = "screen_filter_toast_seen_v1";
        const alreadySeen = await SecureStore.getItemAsync(key);
        if (!isMounted || alreadySeen === "1") return;

        showToast(
          `${deviceType.toUpperCase()} detected: filtering ${screen === "tablet" ? "wide" : "portrait"} wallpapers`,
          { type: "info", position: "top" }
        );
        await SecureStore.setItemAsync(key, "1");
        console.log(`[screen-filter] first-run toast shown: deviceType=${deviceType} screen=${screen}`);
      } catch (error) {
        // If persistence fails, avoid blocking startup and show once for this session.
        if (!isMounted) return;
        showToast(
          `${deviceType.toUpperCase()} detected: filtering ${screen === "tablet" ? "wide" : "portrait"} wallpapers`,
          { type: "info", position: "top" }
        );
        console.warn("[screen-filter] failed to persist first-run toast flag", error);
      }
    };

    maybeShowFilterToast();

    return () => {
      isMounted = false;
    };
  }, [deviceType, screen, showToast]);

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