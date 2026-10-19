import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import * as creator from "../controllers/creator.controller";

/** Applying to become a creator — /api/creator */
export const creatorRoutes = Router();

creatorRoutes.use(requireAuth);

creatorRoutes.get("/application", creator.status);
creatorRoutes.post("/application", creator.submit);
creatorRoutes.post("/samples/upload-url", creator.sampleUploadUrl);
creatorRoutes.post("/samples", creator.addSample);
creatorRoutes.delete("/samples/:id", creator.removeSample);
