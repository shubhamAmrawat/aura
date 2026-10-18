import { Router } from "express";
import * as auth from "../controllers/auth.controller";
import { timingLog } from "../utils/timing";

export const authRoutes = Router();

// One "[timing]" log line per sign-in / sign-up request (POSTs only, so /me on every page load stays quiet).
authRoutes.use((req, res, next) => (req.method === "POST" ? timingLog(req, res, next) : next()));

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
