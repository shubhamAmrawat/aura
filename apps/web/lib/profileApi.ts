const API_URL = process.env.NEXT_PUBLIC_API_URL;

function getApiUrl(): string {
  if (!API_URL) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured");
  }
  return API_URL;
}

function jsonHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
  };
}

export interface ProfileUser {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  bio: string | null;
  contactNo: string | null;
  isCreator: boolean;
  isPro: boolean;
  totalDownloads: number;
  totalUploads: number;
  usernameChangedAt: string | null;
  createdAt: string;
}

export interface UpdateProfilePayload {
  displayName?: string;
  bio?: string;
  contactNo?: string;
  username?: string;
}

export interface UploadUrlResponse {
  uploadUrl: string;
  fileUrl: string;
  key: string;
}

async function parseJson<T>(response: Response): Promise<T> {
  const data: unknown = await response.json();
  const errorMessage =
    typeof data === "object" &&
    data !== null &&
    "error" in data &&
    typeof (data as { error: unknown }).error === "string"
      ? (data as { error: string }).error
      : "Request failed";
  if (!response.ok) throw new Error(errorMessage);
  return data as T;
}

export async function getProfile(): Promise<ProfileUser> {
  const response = await fetch(`${getApiUrl()}/api/profile`, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });
  const data = await parseJson<{ user: ProfileUser }>(response);
  return data.user as ProfileUser;
}

export async function updateProfile(payload: UpdateProfilePayload): Promise<ProfileUser> {
  const response = await fetch(`${getApiUrl()}/api/profile`, {
    method: "PUT",
    headers: jsonHeaders(),
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const data = await parseJson<{ user: ProfileUser }>(response);
  return data.user as ProfileUser;
}

export async function getAvatarUploadUrl(fileType: string): Promise<UploadUrlResponse> {
  const response = await fetch(`${getApiUrl()}/api/profile/avatar/upload-url`, {
    method: "POST",
    headers: jsonHeaders(),
    credentials: "include",
    body: JSON.stringify({ fileType }),
  });
  return await parseJson<UploadUrlResponse>(response);
}

export async function confirmAvatarUpload(fileUrl: string, key: string): Promise<string> {
  const response = await fetch(`${getApiUrl()}/api/profile/avatar`, {
    method: "PUT",
    headers: jsonHeaders(),
    credentials: "include",
    body: JSON.stringify({ fileUrl, key }),
  });
  const data = await parseJson<{ avatarUrl: string }>(response);
  return data.avatarUrl as string;
}

export async function uploadAvatarToSignedUrl(uploadUrl: string, file: File): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type,
    },
    body: file,
  });
  if (!response.ok) {
    throw new Error("Failed to upload avatar");
  }
}

export async function uploadAvatarDirect(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("avatar", file);

  const response = await fetch(`${getApiUrl()}/api/profile/avatar/direct`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  const data = await parseJson<{ avatarUrl: string }>(response);
  return data.avatarUrl;
}

export async function verifyCurrentPassword(currentPassword: string): Promise<void> {
  const response = await fetch(`${getApiUrl()}/api/profile/change-password/verify`, {
    method: "POST",
    headers: jsonHeaders(),
    credentials: "include",
    body: JSON.stringify({ currentPassword }),
  });
  await parseJson(response);
}

export async function confirmPasswordChange(otp: string, newPassword: string): Promise<void> {
  const response = await fetch(`${getApiUrl()}/api/profile/change-password/confirm`, {
    method: "POST",
    headers: jsonHeaders(),
    credentials: "include",
    body: JSON.stringify({ otp, newPassword }),
  });
  await parseJson(response);
}

export async function getCoverUploadUrl(fileType: string): Promise<UploadUrlResponse> {
  const response = await fetch(`${getApiUrl()}/api/profile/cover/upload-url`, {
    method: "POST",
    headers: jsonHeaders(),
    credentials: "include",
    body: JSON.stringify({ fileType }),
  });
  return await parseJson<UploadUrlResponse>(response);
}

export async function confirmCoverUpload(fileUrl: string, key: string): Promise<string> {
  const response = await fetch(`${getApiUrl()}/api/profile/cover`, {
    method: "PUT",
    headers: jsonHeaders(),
    credentials: "include",
    body: JSON.stringify({ fileUrl, key }),
  });
  const data = await parseJson<{ coverUrl: string }>(response);
  return data.coverUrl;
}

export async function uploadCoverDirect(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("cover", file);
  const response = await fetch(`${getApiUrl()}/api/profile/cover/direct`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  const data = await parseJson<{ coverUrl: string }>(response);
  return data.coverUrl;
}

export async function deleteAccount(password: string): Promise<void> {
  const response = await fetch(`${getApiUrl()}/api/profile`, {
    method: "DELETE",
    headers: jsonHeaders(),
    credentials: "include",
    body: JSON.stringify({ password }),
  });
  await parseJson(response);
}
