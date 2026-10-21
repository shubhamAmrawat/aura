import { Platform, View, ViewProps } from "react-native";
import { BlurView } from "expo-blur";

type Props = ViewProps & { intensity?: number; tint?: "dark" };

/**
 * expo-blur's BlurView on iOS; a plain tinted View on Android.
 *
 * On Android expo-blur doesn't blur unless its experimental mode is on: it only paints a dark
 * tint. But on Android 11 and older it still sets up RenderScript underneath, which crashes
 * ("RSInvalidStateException: Calling RS with no Context active") when the screen is detached and
 * re-attached. So on Android we paint the exact same tint ourselves: same look, no RenderScript.
 * Colour = expo-blur's Android "dark" tint: rgb(25,25,25) at alpha 0.69 × intensity / 100.
 */
export default function FrostedView({ intensity = 50, tint = "dark", style, ...rest }: Props) {
  if (Platform.OS === "android") {
    const alpha = Math.max(0, Math.min(1, (intensity / 100) * 0.69));
    return <View style={[{ backgroundColor: `rgba(25,25,25,${alpha.toFixed(3)})` }, style]} {...rest} />;
  }
  return <BlurView intensity={intensity} tint={tint} style={style} {...rest} />;
}
