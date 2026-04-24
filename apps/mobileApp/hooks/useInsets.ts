import { useSafeAreaInsets } from "react-native-safe-area-context"

export const useInsets = () => {
  const insets= useSafeAreaInsets(); 
  return {
    topPadding:insets.top,
    bottomPadding:insets.bottom,
    leftPadding:insets.left,
    rightPadding:insets.right,
  }
}