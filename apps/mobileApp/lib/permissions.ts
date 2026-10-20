import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";

export async function ensureCameraPermission(): Promise<boolean> {
  const current = await ImagePicker.getCameraPermissionsAsync();
  if (current.granted) return true;
  const requested = await ImagePicker.requestCameraPermissionsAsync();
  return requested.granted;
}

/**
 * Permission to SAVE wallpapers to the gallery (write-only). Aurora never reads the user's photos:
 * on Android 13+ saving needs no permission at all; on Android 9 and older it asks for storage.
 */
export async function ensureMediaLibraryPermission(): Promise<boolean> {
  const current = await MediaLibrary.getPermissionsAsync(true);
  if (current.granted) return true;
  const requested = await MediaLibrary.requestPermissionsAsync(true);
  return requested.granted;
}
