import { File, Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';

export async function downloadWallpaper(
  fileUrl: string,
  title: string,
  format?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const safeTitle = title.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
    
    // Use original format for jpeg/png, fall back to jpg for others
    const ext = (format === 'png') ? 'png' 
               : (format === 'jpeg' || format === 'jpg') ? 'jpg' 
               : 'jpg'; // webp/avif → jpg for compatibility

    const file = new File(Paths.cache, `${safeTitle}.${ext}`);

    const response = await fetch(fileUrl);
    if (!response.ok) {
      return { success: false, error: 'Failed to fetch wallpaper' };
    }

    const buffer = await response.arrayBuffer();
    const uint8 = new Uint8Array(buffer);
    await file.write(uint8 as unknown as string);

    await MediaLibrary.saveToLibraryAsync(file.uri);
    return { success: true };

  } catch (e: any) {
    return { success: false, error: e.message };
  }
}