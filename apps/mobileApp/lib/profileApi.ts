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
