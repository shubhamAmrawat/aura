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

export async function login(payload: {email: string}):Promise<{message: string, user: User}>{
  return await request<{message: string, user: User}>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function signup(payload: {email: string, username: string, displayName: string, password: string}):Promise<{message: string, user: User}>{
  return await request<{message: string, user: User}>("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}