import { z } from "zod";
import { required, requiredTrimmed } from "./common";

export const CreateCollectionBody = z.object({
  title: requiredTrimmed("Collection title is required"),
  description: z.any().optional(),
  isPublic: z.any().optional(),
});

export const UpdateCollectionBody = z.object({
  title: z.any().optional(),
  description: z.any().optional(),
  isPublic: z.any().optional(),
});

export const AddWallpaperBody = z.object({
  wallpaperId: required("wallpaperId is required"),
});
