import { route } from "../utils/asyncRoute";
import { authUserId, param } from "../utils/request";
import { parseOrThrow } from "../utils/validate";
import { AddWallpaperBody, CreateCollectionBody, UpdateCollectionBody } from "../validators/collection.schema";
import * as collectionService from "../services/collection.service";

export const listPublic = route("Failed to fetch public collections", async (_req, res) => {
  res.json({ data: await collectionService.listPublicCollections() });
});

export const savedIds = route("Failed to fetch saved wallpaper IDs", async (req, res) => {
  res.json({ data: await collectionService.listSavedWallpaperIds(authUserId(req)) });
});

/** Public collections: anyone. Private: owner only (via optionalAuth). */
export const getOne = route("Failed to fetch collection", async (req, res) => {
  res.json(await collectionService.getCollection(param(req, "id"), req.userId));
});

export const listMine = route("Failed to fetch collections", async (req, res) => {
  res.json({ data: await collectionService.listUserCollections(authUserId(req)) });
});

export const create = route("Failed to create collection", async (req, res) => {
  const input = parseOrThrow(CreateCollectionBody, req.body);
  res.json({ collection: await collectionService.createCollection(authUserId(req), input) });
});

export const update = route("Failed to update collection", async (req, res) => {
  const input = parseOrThrow(UpdateCollectionBody, req.body);
  res.json({ collection: await collectionService.updateCollection(authUserId(req), param(req, "id"), input) });
});

export const remove = route("Failed to delete collection", async (req, res) => {
  await collectionService.deleteCollection(authUserId(req), param(req, "id"));
  res.json({ message: "Collection deleted successfully" });
});

export const addWallpaper = route("Failed to add wallpaper to collection", async (req, res) => {
  const { wallpaperId } = parseOrThrow(AddWallpaperBody, req.body);
  await collectionService.addWallpaper(authUserId(req), param(req, "id"), wallpaperId);
  res.json({ message: "Wallpaper added to collection" });
});

export const removeWallpaper = route("Failed to remove wallpaper from collection", async (req, res) => {
  await collectionService.removeWallpaper(authUserId(req), param(req, "id"), param(req, "wallpaperId"));
  res.json({ message: "Wallpaper removed from collection" });
});

export const check = route("Failed to check collections", async (req, res) => {
  res.json({ data: await collectionService.checkWallpaperInCollections(authUserId(req), param(req, "wallpaperId")) });
});
