import { File, Paths } from "expo-file-system";

/**
 * Ids of creators the signed-in user blocked, saved on the device so code that runs without
 * the React tree (the background wallpaper changer) can skip their wallpapers too.
 */
const file = () => new File(Paths.document, "blocked-creators.json");

export async function loadBlockedIds(): Promise<string[]> {
  try {
    const f = file();
    if (!f.exists) return [];
    const ids = JSON.parse(await f.text());
    return Array.isArray(ids) ? ids.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function saveBlockedIds(ids: string[]) {
  try {
    const f = file();
    if (!f.exists) f.create();
    f.write(JSON.stringify(ids));
  } catch {
    // only a cache; the server list is the source of truth
  }
}
