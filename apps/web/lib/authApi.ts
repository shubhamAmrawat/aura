const API_URL = process.env.NEXT_PUBLIC_API_URL;

export interface SendOtpParams {
  email: string;
  type: "signup" | "login";
}

export interface VerifyOtpParams {
  email: string;
  code: string;
  type: "signup" | "login";
}

export interface SignupParams {
  email: string;
  username: string;
  displayName: string;
  password: string;
}

export interface LoginParams {
  email: string;
}

export async function sendOtp({ email, type }: SendOtpParams) {
  const response = await fetch(`${API_URL}/api/auth/send-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, type }),
    credentials: "include",
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Failed to send OTP");
  return data;
}

export async function verifyOtp({ email, code, type }: VerifyOtpParams) {
  const response = await fetch(`${API_URL}/api/auth/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code, type }),
    credentials: "include",
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Failed to verify OTP");
  return data;
}

export async function signup({ email, username, displayName, password }: SignupParams) {
  const response = await fetch(`${API_URL}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, username, displayName, password }),
    credentials: "include",
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Failed to signup");
  return data;
}

export async function login({ email }: LoginParams) {
  const response = await fetch(`${authFetchBase()}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
    credentials: "include",
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Failed to login");
  return data;
}

export async function me() {
  const response = await fetch(`${API_URL}/api/auth/me`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Failed to get user");
  return data;
}
export async function logout() {
  const response = await fetch(`${API_URL}/api/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Failed to logout");
  return data;
}
