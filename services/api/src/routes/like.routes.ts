import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import * as likes from "../controllers/like.controller";

export const likeRoutes = Router();

likeRoutes.use(requireAuth);

likeRoutes.post("/:wallpaperId", likes.toggle);
likeRoutes.get("/", likes.list);
likeRoutes.get("/:wallpaperId", likes.check);
