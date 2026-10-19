// Creator applications: apply with 3–6 sample wallpapers; an admin approves or rejects.

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export interface CreatorSample {
  id: string;
  thumbUrl: string;
  width: number;
  height: number;
}

export interface CreatorRules {
  minSamples: number;
  maxSamples: number;
  minShortSide: number;
  maxBytes: number;
  rejectionsBeforePause: number;
  pauseHours: number;
  aboutMaxLength: number;
}

export interface CreatorStatus {
  isCreator: boolean;
  canApply: boolean;
  /** ISO time the pause after a 3rd rejection ends, or null */
  nextApplyAt: string | null;
  /** Applications left before the next pause */
  triesBeforePause: number;
  rejections: number;
  application: {
    id: string;
    status: "pending" | "approved" | "rejected";
    note: string | null;
    createdAt: string;
    reviewedAt: string | null;
    samples: CreatorSample[];
  } | null;
  /** Uploaded to the form but not sent yet */
  drafts: CreatorSample[];
  rules: CreatorRules;
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_URL}/api/creator${path}`, {
    method,
    credentials: "include",
    cache: "no-store",
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error || "Something went wrong. Try again.");
  return data as T;
}

export const getCreatorStatus = () => call<CreatorStatus>("GET", "/application");

export const removeSample = (id: string) => call<{ ok: true }>("DELETE", `/samples/${id}`);

export const submitApplication = (payload: { sampleIds: string[]; about: string; portfolioUrl: string }) =>
  call<CreatorStatus>("POST", "/application", payload);

/**
 * Upload one sample: signed URL → PUT straight to storage (with progress) → the API checks it and makes a preview.
 * `onProgress` gets 0–1 for the upload part.
 */
export async function uploadSample(file: File, onProgress: (p: number) => void, signal?: AbortSignal): Promise<CreatorSample> {
  const { uploadUrl, key } = await call<{ uploadUrl: string; key: string }>("POST", "/samples/upload-url", {
    fileType: file.type,
    size: file.size,
  });
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("Upload failed. Try again.")));
    xhr.onerror = () => reject(new Error("Upload failed — check your connection."));
    xhr.onabort = () => reject(new DOMException("Aborted", "AbortError"));
    signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(file);
  });
  onProgress(1);
  const { sample } = await call<{ sample: CreatorSample }>("POST", "/samples", { key });
  return sample;
}

/** Pixel size of a local image file, read in the browser (no upload). */
export function imageSize(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file isn’t an image we can read."));
    };
    img.src = url;
  });
}
