declare module 'react-native-manage-wallpaper' {
  export type WallpaperType = 'home' | 'lock' | 'both';

  export interface WallpaperSource {
    uri: string;
  }

  export interface SetWallpaperResponse {
    status: 'success' | 'error';
    msg?: string;
    url?: string;
  }

  export interface WallpaperTypeMap {
    HOME: 'home';
    LOCK: 'lock';
    BOTH: 'both';
  }

  export const TYPE: WallpaperTypeMap;

  export interface ManageWallpaperModule {
    setWallpaper(
      source: WallpaperSource | number,
      callback?: (response: SetWallpaperResponse) => void,
      type?: WallpaperType
    ): void;
  }

  const ManageWallpaper: ManageWallpaperModule;
  export default ManageWallpaper;
}
