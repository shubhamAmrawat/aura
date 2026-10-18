import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { singleImage } from "../middleware/upload";
import * as profile from "../controllers/profile.controller";

export const profileRoutes = Router();

profileRoutes.use(requireAuth);

// Hard cap for multipart bodies; the per-image limits (5MB / 10MB) are checked in the controller.
const HARD_CAP = 25 * 1024 * 1024;

profileRoutes.get("/", profile.getProfile);
profileRoutes.put("/", profile.updateProfile);
profileRoutes.delete("/", profile.deleteAccount);
profileRoutes.post("/delete/otp", profile.sendDeleteAccountOtp);

profileRoutes.post("/avatar/upload-url", profile.imageUploadUrl("avatar"));
profileRoutes.put("/avatar", profile.confirmImage("avatar"));
profileRoutes.post("/avatar/direct", singleImage("avatar", HARD_CAP, "Avatar must be smaller than 5MB."), profile.uploadImageDirect("avatar"));

profileRoutes.post("/cover/upload-url", profile.imageUploadUrl("cover"));
profileRoutes.put("/cover", profile.confirmImage("cover"));
profileRoutes.post("/cover/direct", singleImage("cover", HARD_CAP, "Cover must be smaller than 10MB."), profile.uploadImageDirect("cover"));

profileRoutes.post("/change-password/verify", profile.startPasswordChange);
profileRoutes.post("/change-password/confirm", profile.confirmPasswordChange);

profileRoutes.get("/interests", profile.getInterests);
profileRoutes.put("/interests", profile.setInterests);

profileRoutes.get("/uploads", profile.listUploads);
profileRoutes.put("/uploads/:id", profile.updateUpload);
profileRoutes.delete("/uploads/:id", profile.deleteUpload);
