import { Router } from "express";
import * as avatars from "../controllers/avatar.controller";

export const avatarRoutes = Router();

avatarRoutes.get("/:style/:seed", avatars.preview);
