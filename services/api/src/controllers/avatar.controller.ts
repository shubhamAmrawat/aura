import { z } from "zod";
import { route } from "../utils/asyncRoute";
import { parseOrThrow } from "../utils/validate";
import { AVATAR_PACKS, AVATAR_STYLES, MAX_SEED } from "../utils/avatarPack";
import { avatarPng } from "../services/avatarPack.service";

const PreviewParams = z.object({
  style: z.enum(AVATAR_STYLES, { message: "Unknown avatar style" }),
  seed: z.coerce.number().int().min(0).max(MAX_SEED),
});
const PreviewQuery = z.object({ size: z.coerce.number().int().min(32).max(512).default(160) });

/** GET /api/avatars/packs — the packs the pickers show, in order (so new packs need no app update). */
export const packs = route("Failed to load avatar packs", async (_req, res) => {
  res.set("Cache-Control", "public, max-age=300");
  res.json({ data: AVATAR_PACKS });
});

/** GET /api/avatars/:style/:seed.png?size= — a pack avatar (pickers' previews). Same input, same image: cached for a year. */
export const preview = route("Failed to draw the avatar", async (req, res) => {
  const { style, seed } = parseOrThrow(PreviewParams, { style: req.params.style, seed: String(req.params.seed).replace(/\.png$/, "") });
  const { size } = parseOrThrow(PreviewQuery, req.query);
  const png = await avatarPng(style, seed, size);
  res.set({ "Content-Type": "image/png", "Cache-Control": "public, max-age=31536000, immutable", "Cross-Origin-Resource-Policy": "cross-origin" });
  res.send(png);
});
