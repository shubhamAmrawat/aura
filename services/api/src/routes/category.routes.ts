import { Router } from "express";
import { getCategories } from "../controllers/category.controller";

export const categoryRoutes = Router();

categoryRoutes.get("/", getCategories);
