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

export async function applyWallpaper(
  fileUrl: string,
  title: string,
  target: WallpaperTarget = 'both'
): Promise<{ success: boolean; error?: string }> {
  try {
    const file = await downloadToCache(fileUrl, title);

    if (isTablet) {
      // On tablets, ManageWallpaper triggers a navigation reset via Android intent.
      // Use system wallpaper picker instead — opens separate app, no nav conflict.
      const contentUri = (file as any).contentUri ?? file.uri;
      await IntentLauncher.startActivityAsync(
        'android.intent.action.ATTACH_DATA',
        {
          data: contentUri,
          type: 'image/jpeg',
          extra: { mimeType: 'image/jpeg' },
          flags: 1,
        }
      );
      return { success: true };
    }

    // Phone — use ManageWallpaper for seamless in-app apply
    return new Promise((resolve) => {
      const wallpaperType =
        target === 'home' ? TYPE.HOME :
        target === 'lock' ? TYPE.LOCK :
        TYPE.BOTH;

      ManageWallpaper.setWallpaper(
        { uri: file.uri },
        (res: any) => {
          if (res?.status === 'success') {
            resolve({ success: true });
          } else {
            resolve({ success: false, error: res?.msg ?? 'Failed to set wallpaper' });
          }
        },
        wallpaperType
      );
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
}