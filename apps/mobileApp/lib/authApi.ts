import { request, User } from "./api";

export async function getMe():Promise<{user:User}>{
  return  await request<{user:User}>("/api/auth/me");
}

export async function sendOtp(payload: {email: string, type: string}):Promise<{message: string}>{
  return await request<{message: string}>("/api/auth/send-otp", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function verifyOtp(payload: {email: string, code: string, type: string}):Promise<{message: string, verified: boolean}>{
  return await request<{message: string, verified: boolean}>("/api/auth/verify-otp", { 
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function login(
  payload: {email: string}):Promise<{message: string,token: string, user: User}>{
  return await request<{message: string,token: string, user: User}>(
    "/api/auth/login", 
  {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function signup(
  payload: {
    email: string, 
    username: string, 
    displayName: string, 
    password: string
  }):Promise<{message: string, token: string, user: User}>{
  return await request<{message: string, token: string, user: User}>("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

type LoginResponse = { message: string, token: string, user: User }

/** Email + password sign-in. */
export async function loginWithPassword(payload: { email: string, password: string }): Promise<LoginResponse> {
  return await request<LoginResponse>("/api/auth/login/password", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Sign in or sign up with a Google ID token (from lib/googleAuth). New accounts get isNewUser: true. */
export async function loginWithGoogle(credential: string): Promise<LoginResponse & { isNewUser: boolean }> {
  return await request<LoginResponse & { isNewUser: boolean }>("/api/auth/google", {
    method: "POST",
    body: JSON.stringify({ credential }),
  });
}

/** Forgot step 1: always answers the same (never reveals if the email exists). */
export async function forgotPassword(email: string): Promise<{ message: string }> {
  return await request<{ message: string }>("/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

/** Forgot step 2: check the emailed code (stays valid for 15 minutes). */
export async function verifyResetCode(payload: { email: string, otp: string }): Promise<{ message: string, verified: boolean }> {
  return await request<{ message: string, verified: boolean }>("/api/auth/forgot-password/verify", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Forgot step 3: set the new password (code already verified). */
export async function resetPassword(payload: { email: string, newPassword: string }): Promise<{ message: string }> {
  return await request<{ message: string }>("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
