import { Router } from "express";
import * as auth from "../controllers/auth.controller";

export const authRoutes = Router();

authRoutes.post("/send-otp", auth.sendOtp);
authRoutes.post("/verify-otp", auth.verifyOtp);
authRoutes.post("/signup", auth.signup);
authRoutes.post("/login", auth.login);
authRoutes.post("/login/password", auth.loginWithPassword);
authRoutes.post("/google", auth.loginWithGoogle);
authRoutes.post("/forgot-password", auth.forgotPassword);
authRoutes.post("/forgot-password/verify", auth.verifyResetCode);
authRoutes.post("/reset-password", auth.resetPassword);
authRoutes.get("/me", auth.me);
authRoutes.post("/logout", auth.logout);
authRoutes.put("/become-creator", auth.becomeCreator);
