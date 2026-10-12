import { Router } from "express";
import { getCategories, redirects, resolveSlug } from "../controllers/category.controller";

export const categoryRoutes = Router();

categoryRoutes.get("/", getCategories);
categoryRoutes.get("/redirects", redirects);
categoryRoutes.get("/resolve/:slug", resolveSlug);
