import { route } from "../utils/asyncRoute";
import { authUserId, param } from "../utils/request";
import * as likeService from "../services/like.service";

export const toggle = route("Failed to toggle like", async (req, res) => {
  const liked = await likeService.toggleLike(authUserId(req), param(req, "wallpaperId"));
  res.json(liked ? { liked: true, message: "Liked successfully" } : { liked: false, message: "Unliked successfully" });
});

export const list = route("Failed to fetch liked wallpapers", async (req, res) => {
  res.json({ data: await likeService.listLikedWallpapers(authUserId(req)) });
});

export const check = route("Failed to check like", async (req, res) => {
  res.json({ liked: await likeService.isLiked(authUserId(req), param(req, "wallpaperId")) });
});
