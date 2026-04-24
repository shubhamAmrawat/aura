import { Stack } from 'expo-router'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { AuthProvider } from '../lib/AuthContext'
import * as SystemUI from 'expo-system-ui'
import { Colors } from '../constants/colors';
SystemUI.setBackgroundColorAsync(Colors.bgSecondary)
const RootLayout = () => {
  return (
    <SafeAreaProvider>
      <AuthProvider>
      <Stack screenOptions={{ headerShown: false ,animation: 'fade_from_bottom', contentStyle: { backgroundColor: Colors.bgSecondary } }} />
      </AuthProvider>
    </SafeAreaProvider>
  )
}

export default RootLayout