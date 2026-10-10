import { Router } from "express";
import * as auth from "../controllers/auth.controller";

export const authRoutes = Router();

authRoutes.post("/send-otp", auth.sendOtp);
authRoutes.post("/verify-otp", auth.verifyOtp);
authRoutes.post("/signup", auth.signup);
authRoutes.post("/login", auth.login);
authRoutes.get("/me", auth.me);
authRoutes.post("/logout", auth.logout);
authRoutes.put("/become-creator", auth.becomeCreator);
