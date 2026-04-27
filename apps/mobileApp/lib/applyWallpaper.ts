import { File, Paths } from 'expo-file-system';
import ManageWallpaper, { TYPE } from 'react-native-manage-wallpaper';

export type WallpaperTarget = 'home' | 'lock' | 'both';

export async function applyWallpaper(
  fileUrl: string,
  title: string,
  target: WallpaperTarget = 'both'
): Promise<{ success: boolean; error?: string }> {
  return new Promise(async (resolve) => {
    try {
      // Download image to local cache first
      const safeTitle = title.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
      const file = new File(Paths.cache, `${safeTitle}_apply.jpg`);

      const response = await fetch(fileUrl);
      if (!response.ok) {
        resolve({ success: false, error: 'Failed to fetch image' });
        return;
      }

      const buffer = await response.arrayBuffer();
      await file.write(new Uint8Array(buffer) as unknown as string);

      // Map our target to ManageWallpaper TYPE
      const wallpaperType =
        target === 'home' ? TYPE.HOME :
        target === 'lock' ? TYPE.LOCK :
        TYPE.BOTH;

      // ManageWallpaper uses a callback pattern, not promises
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
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      resolve({ success: false, error: message });
    }
  });
}