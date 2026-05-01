import { File, Paths } from 'expo-file-system';
import ManageWallpaper, { TYPE } from 'react-native-manage-wallpaper';
import * as IntentLauncher from 'expo-intent-launcher';
import { Dimensions } from 'react-native';

export type WallpaperTarget = 'home' | 'lock' | 'both';

const { width } = Dimensions.get('window');
const isTablet = width >= 768;

async function downloadToCache(fileUrl: string, title: string): Promise<File> {
  const safeTitle = title.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
  const file = new File(Paths.cache, `${safeTitle}_apply.jpg`);
  const response = await fetch(fileUrl);
  if (!response.ok) throw new Error('Failed to fetch image');
  const buffer = await response.arrayBuffer();
  await file.write(new Uint8Array(buffer) as unknown as string);
  return file;
}
async function openSystemWallpaperCrop(contentUri: string): Promise<void> {
  try {
    await IntentLauncher.startActivityAsync(
      'android.service.wallpaper.CROP_AND_SET_WALLPAPER',
      {
        data: contentUri,
        type: 'image/jpeg',
        flags: 1,
      }
    );
    return;
  } catch {
    // Fallback for OEMs that don't expose CROP_AND_SET_WALLPAPER.
  }

  await IntentLauncher.startActivityAsync(
    'android.intent.action.ATTACH_DATA',
    {
      data: contentUri,
      type: 'image/jpeg',
      extra: { mimeType: 'image/jpeg' },
      flags: 1,
    }
  );
}

export async function applyWallpaper(
  fileUrl: string,
  title: string,
  target: WallpaperTarget = 'both'
): Promise<{ success: boolean; error?: string; needsUserConfirmation?: boolean }> {
  try {
    const file = await downloadToCache(fileUrl, title);
    const contentUri = (file as any).contentUri ?? file.uri;

    if (isTablet) {
      await openSystemWallpaperCrop(contentUri);
      return { success: true, needsUserConfirmation: true };
    }

    // For phone home/both: use system crop/apply flow like wallpaper apps.
    // OEM launcher decides exact fit; this avoids custom crop mismatch.
    if (target === 'home' || target === 'both') {
      await openSystemWallpaperCrop(contentUri);
      return { success: true, needsUserConfirmation: true };
    }

    // For lock-only: direct apply is usually consistent and does not need launcher crop behavior.
    return new Promise((resolve) => {
      ManageWallpaper.setWallpaper(
        { uri: file.uri },
        (res: any) => {
          if (res?.status === 'success') {
            resolve({ success: true });
          } else {
            resolve({ success: false, error: res?.msg ?? 'Failed to set wallpaper' });
          }
        },
        TYPE.LOCK
      );
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
}