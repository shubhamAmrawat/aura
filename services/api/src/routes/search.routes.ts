import { Router } from "express";
import * as search from "../controllers/search.controller";

export const searchRoutes = Router();

searchRoutes.get("/suggestions", search.suggestions);
searchRoutes.get("/autocomplete", search.autocomplete);
searchRoutes.get("/", search.search);
