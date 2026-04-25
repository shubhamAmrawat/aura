import { Stack } from 'expo-router'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { AuthProvider } from '../lib/AuthContext'
import { ToastProvider } from '../lib/ToastContext'
import * as SystemUI from 'expo-system-ui'
import { Colors } from '../constants/colors';
SystemUI.setBackgroundColorAsync(Colors.bgSecondary)
const RootLayout = () => {
  return (
    <SafeAreaProvider>
      <ToastProvider>
        <AuthProvider>
          <Stack screenOptions={{ headerShown: false ,animation: 'fade_from_bottom', contentStyle: { backgroundColor: Colors.bgSecondary } }} />
        </AuthProvider>
      </ToastProvider>
    </SafeAreaProvider>
  )
}

export default RootLayout