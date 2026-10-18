import { request, User } from "./api";
import { getToken } from "./tokenStorage";

export type UpdateProfilePayload = {
  displayName?: string;
  username?: string;
  bio?: string;
  contactNo?: string;
};

type UploadUrlResponse = {
  uploadUrl: string;
  fileUrl: string;
  key: string;
};

const API_URL = process.env.EXPO_PUBLIC_API_URL;

function getApiUrl(): string {
  if (!API_URL) {
    throw new Error("EXPO_PUBLIC_API_URL is not configured");
  }
  return API_URL;
}

async function authFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await getToken();
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(`${getApiUrl()}${path}`, { ...options, headers });
}

async function parseJson<T>(response: Response): Promise<T> {
  const data = (await response.json()) as { error?: string };
  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data as T;
}

export async function updateProfile(
  payload: UpdateProfilePayload
): Promise<{ message: string; user: User }> {
  return await request<{ message: string; user: User }>("/api/profile", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function getAvatarUploadUrl(fileType: string): Promise<UploadUrlResponse> {
  const response = await request<UploadUrlResponse>("/api/profile/avatar/upload-url", {
    method: "POST",
    body: JSON.stringify({ fileType }),
  });
  return response;
}

export async function confirmAvatarUpload(fileUrl: string, key: string): Promise<string> {
  const response = await request<{ message: string; avatarUrl: string }>("/api/profile/avatar", {
    method: "PUT",
    body: JSON.stringify({ fileUrl, key }),
  });
  return response.avatarUrl;
}

export async function uploadAvatarToSignedUrl(uploadUrl: string, fileUri: string, mimeType: string): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": mimeType,
    },
    body: {
      uri: fileUri,
      type: mimeType,
      name: "avatar-upload",
    } as unknown as BodyInit,
  });
  if (!response.ok) {
    throw new Error("Failed to upload avatar");
  }
}

export async function uploadAvatarDirect(fileUri: string, mimeType: string): Promise<string> {
  const formData = new FormData();
  formData.append("avatar", {
    uri: fileUri,
    type: mimeType,
    name: "avatar.jpg",
  } as unknown as Blob);

  const response = await authFetch("/api/profile/avatar/direct", {
    method: "POST",
    body: formData,
  });
  const data = await parseJson<{ avatarUrl: string }>(response);
  return data.avatarUrl;
}

export async function getCoverUploadUrl(fileType: string): Promise<UploadUrlResponse> {
  const response = await request<UploadUrlResponse>("/api/profile/cover/upload-url", {
    method: "POST",
    body: JSON.stringify({ fileType }),
  });
  return response;
}

export async function confirmCoverUpload(fileUrl: string, key: string): Promise<string> {
  const response = await request<{ message: string; coverUrl: string }>("/api/profile/cover", {
    method: "PUT",
    body: JSON.stringify({ fileUrl, key }),
  });
  return response.coverUrl;
}

export async function uploadCoverToSignedUrl(uploadUrl: string, fileUri: string, mimeType: string): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": mimeType,
    },
    body: {
      uri: fileUri,
      type: mimeType,
      name: "cover-upload",
    } as unknown as BodyInit,
  });
  if (!response.ok) {
    throw new Error("Failed to upload cover");
  }
}

export async function uploadCoverDirect(fileUri: string, mimeType: string): Promise<string> {
  const formData = new FormData();
  formData.append("cover", {
    uri: fileUri,
    type: mimeType,
    name: "cover.jpg",
  } as unknown as Blob);

  const response = await authFetch("/api/profile/cover/direct", {
    method: "POST",
    body: formData,
  });
  const data = await parseJson<{ coverUrl: string }>(response);
  return data.coverUrl;
}

// ─── Password & account ──────────────────────────────────────────

/** Step 1 of changing the password: checks the current one, then emails a code. */
export function startPasswordChange(currentPassword: string): Promise<{ message: string }> {
  return request("/api/profile/change-password/verify", {
    method: "POST",
    body: JSON.stringify({ currentPassword }),
  });
}

/** Step 2: the emailed code + the new password (8+ characters). */
export function confirmPasswordChange(otp: string, newPassword: string): Promise<{ message: string }> {
  return request("/api/profile/change-password/confirm", {
    method: "POST",
    body: JSON.stringify({ otp, newPassword }),
  });
}

/** Every account confirms deletion with a code sent to its email (at most one a minute). */
export function sendDeleteAccountCode(): Promise<{ message: string }> {
  return request("/api/profile/delete/otp", { method: "POST" });
}

/** Permanently deletes the account and everything it owns. Proof: the emailed code, plus the password if the account has one. */
export function deleteAccount(proof: { otp: string; password?: string }): Promise<{ message: string }> {
  return request("/api/profile", { method: "DELETE", body: JSON.stringify(proof) });
}

/**
 * Accounts without a password (Google sign-up) add one through the reset flow:
 * POST /api/auth/forgot-password emails a code (at most one a minute), then this sets the password.
 */
export function requestSetPasswordCode(email: string): Promise<{ message: string }> {
  return request("/api/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
}

export function setPasswordWithCode(email: string, otp: string, newPassword: string): Promise<{ message: string }> {
  return request("/api/auth/reset-password", { method: "POST", body: JSON.stringify({ email, otp, newPassword }) });
}

// ─── Interests (categories picked after sign-up) ───────────

export type Interest = {
  id: string;
  slug: string;
  name: string;
  coverThumbUrl: string | null;
  coverImageUrl: string | null;
};

/** The signed-in user's picked categories, first pick first. */
export async function getInterests(): Promise<Interest[]> {
  const res = await request<{ interests: Interest[] }>("/api/profile/interests");
  return res.interests;
}

/** Replaces the user's picks (in order, max 4). An empty list clears them. */
export async function saveInterests(categoryIds: string[]): Promise<Interest[]> {
  const res = await request<{ interests: Interest[] }>("/api/profile/interests", {
    method: "PUT",
    body: JSON.stringify({ categoryIds }),
  });
  return res.interests;
}
