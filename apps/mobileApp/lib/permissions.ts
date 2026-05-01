import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";

export async function ensureCameraPermission(): Promise<boolean> {
  const current = await ImagePicker.getCameraPermissionsAsync();
  if (current.granted) return true;
  const requested = await ImagePicker.requestCameraPermissionsAsync();
  return requested.granted;
}

export async function ensureMediaLibraryPermission(): Promise<boolean> {
  const current = await MediaLibrary.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await MediaLibrary.requestPermissionsAsync(false, ["photo"]);
  return requested.granted;
}
