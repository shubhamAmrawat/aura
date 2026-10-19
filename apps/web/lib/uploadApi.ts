// Creator upload ("Studio"): signed URL → PUT to storage (with progress) → prepare (AI details,
// duplicate check) → publish. The API repeats the duplicate check on publish.

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export interface DuplicateInfo {
  id: string;
  title: string;
  thumbUrl: string | null;
  by: string | null;
  yours: boolean;
}

export interface PreparedUpload {
  key: string;
  fileUrl: string;
  thumbUrl: string | null;
  width: number;
  height: number;
  isMobile: boolean;
  fileSizeBytes: number;
  dominantColor: string;
  palette: string[];
  suggestions: {
    title: string | null;
    description: string | null;
    tags: string[];
    categoryId: string | null;
    alternativeId: string | null;
    extraCategoryIds: string[];
    confident: boolean;
  };
  /** Very similar to a wallpaper on Aurora — can be published, goes to review */
  similarTo: DuplicateInfo | null;
}

export interface PublishResult {
  wallpaper: { id: string; title: string };
  moderationStatus: "approved" | "pending";
  message: string;
  similarTo: DuplicateInfo | null;
}

/** An API error, with the matched wallpaper when the image is a duplicate (409). */
export class UploadError extends Error {
  constructor(message: string, public readonly status: number, public readonly duplicate: DuplicateInfo | null = null) {
    super(message);
  }
}

async function call<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/wallpapers${path}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new UploadError("Couldn’t reach Aurora — check your connection and try again.", 0);
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string; duplicate?: DuplicateInfo };
  if (!res.ok) throw new UploadError(data.error || "Something went wrong. Try again.", res.status, data.duplicate ?? null);
  return data as T;
}

/** Upload the file to storage; `onProgress` gets 0–1. Returns where it landed. */
export async function sendToStorage(file: File, onProgress: (p: number) => void, signal: AbortSignal) {
  const { uploadUrl, fileUrl, key } = await call<{ uploadUrl: string; fileUrl: string; key: string }>("/upload-url", { fileType: file.type });
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new UploadError(`Upload failed (${xhr.status}). Try again.`, xhr.status)));
    xhr.onerror = () => reject(new UploadError("Upload failed — check your connection and try again.", 0));
    xhr.onabort = () => reject(new DOMException("Aborted", "AbortError"));
    signal.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(file);
  });
  onProgress(1);
  return { key, fileUrl };
}

export const prepareUpload = (p: { key: string; fileUrl: string; fileType: string; fileSizeBytes: number }) =>
  call<PreparedUpload>("/upload/prepare", p);

export const discardUpload = (key: string) => call<{ discarded: true }>("/upload/discard", { key }).catch(() => undefined);

export const publishUpload = (p: {
  key: string;
  fileUrl: string;
  fileType: string;
  fileSizeBytes: number;
  width: number;
  height: number;
  title: string;
  description: string;
  categoryId: string;
  extraCategoryIds: string[];
  tags: string[];
}) => call<PublishResult>("/upload", p);
