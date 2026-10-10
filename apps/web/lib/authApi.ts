export async function sendOtp(payload: { email: string; type: string }) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/send-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to send OTP");
  return data;
}

export async function verifyOtp(payload: { email: string; code: string; type: string }) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to verify OTP");
  return data;
}

export async function signup(payload: {
  email: string;
  username: string;
  displayName: string;
  password: string;
}) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to signup");
  return data;
}

export async function login(payload: { email: string }) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to login");
  return data;
}

export async function me() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/me`, {
    credentials: "include",
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Unauthorized");
  return data;
}

export async function logout() {
  await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
}

async function postJson(path: string, payload: unknown, fallbackError: string) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || fallbackError);
  return data;
}

/** Email + password login. */
export function loginWithPassword(payload: { email: string; password: string }) {
  return postJson("/api/auth/login/password", payload, "Failed to login");
}

/** Google Identity Services credential (ID token) → Aurora session. */
export function loginWithGoogle(credential: string): Promise<{ isNewUser: boolean }> {
  return postJson("/api/auth/google", { credential }, "Google sign-in failed.");
}

/** Sends a reset code if the account exists (always the same answer). */
export function forgotPassword(email: string) {
  return postJson("/api/auth/forgot-password", { email }, "Failed to send code");
}

/** Forgot step 2: check the emailed code (marks it verified for 15 min). */
export function verifyResetCode(payload: { email: string; otp: string }) {
  return postJson("/api/auth/forgot-password/verify", payload, "Failed to verify code");
}

/** Set a new password — pass otp, or omit it after verifyResetCode. */
export function resetPassword(payload: { email: string; otp?: string; newPassword: string }) {
  return postJson("/api/auth/reset-password", payload, "Failed to reset password");
}
