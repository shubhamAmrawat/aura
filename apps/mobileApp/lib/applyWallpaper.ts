import { File, Paths } from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import ManageWallpaper, { TYPE } from 'react-native-manage-wallpaper';
import type { WallpaperType } from 'react-native-manage-wallpaper';

export type WallpaperTarget = 'home' | 'lock' | 'both';
export type WallpaperCropArea = {
  originX: number;
  originY: number;
  width: number;
  height: number;
  sourceWidth: number;
  sourceHeight: number;
  outputWidth: number;
  outputHeight: number;
};

async function downloadToCache(fileUrl: string, title: string): Promise<File> {
  const safeTitle = title.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
  const file = new File(Paths.cache, `${safeTitle}_apply.jpg`);
  const response = await fetch(fileUrl);
  if (!response.ok) throw new Error('Failed to fetch image');
  const buffer = await response.arrayBuffer();
  await file.write(new Uint8Array(buffer) as unknown as string);
  return file;
}

function getNativeWallpaperType(target: WallpaperTarget): WallpaperType {
  if (target === 'home') return TYPE.HOME;
  if (target === 'lock') return TYPE.LOCK;
  return TYPE.BOTH;
}

async function cropToWallpaperFrame(file: File, crop: WallpaperCropArea): Promise<string> {
  const originX = Math.max(0, Math.floor(crop.originX));
  const originY = Math.max(0, Math.floor(crop.originY));
  const width = Math.max(1, Math.min(Math.floor(crop.width), crop.sourceWidth - originX));
  const height = Math.max(1, Math.min(Math.floor(crop.height), crop.sourceHeight - originY));
  const outputWidth = Math.max(1, Math.round(crop.outputWidth));
  const outputHeight = Math.max(1, Math.round(crop.outputHeight));

  const result = await manipulateAsync(
    file.uri,
    [
      { crop: { originX, originY, width, height } },
      { resize: { width: outputWidth, height: outputHeight } },
    ],
    { compress: 1, format: SaveFormat.JPEG }
  );

  return result.uri;
}

export async function applyWallpaper(
  fileUrl: string,
  title: string,
  target: WallpaperTarget = 'both',
  crop?: WallpaperCropArea
): Promise<{ success: boolean; error?: string; needsUserConfirmation?: boolean }> {
  try {
    const file = await downloadToCache(fileUrl, title);
    const nativeType = getNativeWallpaperType(target);
    const wallpaperUri = crop ? await cropToWallpaperFrame(file, crop) : file.uri;

    // Use WallpaperManager flags so Home, Lock, and Both map exactly to the user's choice.
    return new Promise((resolve) => {
      ManageWallpaper.setWallpaper(
        { uri: wallpaperUri },
        (res: any) => {
          if (res?.status === 'success') {
            resolve({ success: true });
          } else {
            resolve({ success: false, error: res?.msg ?? 'Failed to set wallpaper' });
          }
        },
        nativeType
      );
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
}