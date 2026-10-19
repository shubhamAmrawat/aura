import { Router } from "express";
import { authRoutes } from "./auth.routes";
import { categoryRoutes } from "./category.routes";
import { wallpaperRoutes } from "./wallpaper.routes";
import { searchRoutes } from "./search.routes";
import { likeRoutes } from "./like.routes";
import { collectionRoutes } from "./collection.routes";
import { profileRoutes } from "./profile.routes";
import { adminRoutes } from "./admin.routes";
import { featuredRoutes } from "./featured.routes";
import { creatorRoutes } from "./creator.routes";

/** Everything under /api. */
export const apiRoutes = Router();

apiRoutes.use("/auth", authRoutes);
apiRoutes.use("/categories", categoryRoutes);
apiRoutes.use("/wallpapers", wallpaperRoutes);
apiRoutes.use("/search", searchRoutes);
apiRoutes.use("/likes", likeRoutes);
apiRoutes.use("/collections", collectionRoutes);
apiRoutes.use("/profile", profileRoutes);
apiRoutes.use("/admin", adminRoutes);
apiRoutes.use("/featured", featuredRoutes);
apiRoutes.use("/creator", creatorRoutes);
