// Sentry first, so errors during startup are reported too.
import { navigationIntegration, Sentry } from "../lib/sentry";
import { syncChangerOnLaunch } from "../lib/wallpaperChanger/task";
import { Stack, useNavigationContainerRef, type ErrorBoundaryProps } from "expo-router";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "../lib/AuthContext";
import { ToastProvider, useToast } from "../lib/ToastContext";
import { CollectionsProvider } from "../lib/CollectionsContext";
import { BlocksProvider } from "../lib/BlocksContext";
import SaveSheetHost from "../components/SaveSheet";
import { ScreenFilterProvider, useScreenFilter } from "../lib/ScreenFilterContext";
import * as SystemUI from "expo-system-ui";
import * as SecureStore from "expo-secure-store";
import { Colors } from "../constants/colors";
import SplashScreen from "../components/SplashScreen";
import ErrorScreen from "../components/ErrorScreen";

SystemUI.setBackgroundColorAsync(Colors.bgSecondary);

/** A screen that crashes while rendering shows this instead of a blank screen. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return <ErrorScreen error={error} retry={retry} />;
}

const RootLayout = () => {
  const navigationRef = useNavigationContainerRef();
  useEffect(() => {
    if (navigationRef) navigationIntegration.registerNavigationContainer(navigationRef);
  }, [navigationRef]);

  return (
    <SafeAreaProvider>
      <ScreenFilterProvider>
        <AuthProvider>
          <ToastProvider>
            <BlocksProvider>
              <CollectionsProvider>
                <AppGate />
                <SaveSheetHost />
              </CollectionsProvider>
            </BlocksProvider>
          </ToastProvider>
        </AuthProvider>
      </ScreenFilterProvider>
    </SafeAreaProvider>
  );
};

function AppGate() {
  const { loaded } = useAuth();

  // Wallpaper changer: refresh its cached wallpaper list (the background job can't call the API).
  useEffect(() => {
    if (loaded) syncChangerOnLaunch().catch(() => undefined);
  }, [loaded]);
  const { showToast } = useToast();
  const { deviceType, screen } = useScreenFilter();

  useEffect(() => {
    let isMounted = true;
    // Phones only ever see phone wallpapers, which needs no explaining; tablets get a one-time note.
    if (deviceType !== "tablet") return;

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

export default Sentry.wrap(RootLayout);