import { Stack } from 'expo-router'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { AuthProvider, useAuth } from '../lib/AuthContext'
import { ToastProvider } from '../lib/ToastContext'
import * as SystemUI from 'expo-system-ui'
import { Colors } from '../constants/colors';
import SplashScreen from '../components/SplashScreen'
SystemUI.setBackgroundColorAsync(Colors.bgSecondary)
const RootLayout = () => {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ToastProvider>
          <AppGate />
        </ToastProvider>
      </AuthProvider>
    </SafeAreaProvider>
  )
}
function AppGate() {
  const { loaded } = useAuth()

  if (!loaded) return <SplashScreen />

  return (
    <Stack screenOptions={{
      headerShown: false,
      animation: 'fade_from_bottom',
      contentStyle: { backgroundColor: Colors.bgSecondary }
    }} />
  )
}
export default RootLayout