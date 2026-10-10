import { API_BASE_URL } from "./env";

export type ApiResponse<T = any> = {
  status: number;
  headers: Headers;
  body: T;
  text: string;
};

type Options = {
  token?: string;          // sent as Authorization: Bearer
  cookie?: string;         // sent as Cookie header
  json?: unknown;          // JSON body
  form?: FormData;         // multipart body
  headers?: Record<string, string>;
  ip?: string;             // CF-Connecting-IP (rate limiter key)
};

// The API rate-limits 100 req/min per client IP, read from CF-Connecting-IP (set by
// Cloudflare in prod). Locally each request gets a random IP unless the test pins one.
function randomIp(): string {
  const o = () => Math.floor(Math.random() * 250) + 1;
  return `10.${o()}.${o()}.${o()}`;
}

export async function api<T = any>(
  method: string,
  path: string,
  opts: Options = {}
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {
    "cf-connecting-ip": opts.ip ?? randomIp(),
    ...(opts.headers ?? {}),
  };
  if (opts.token) headers["Authorization"] = `Bearer ${opts.token}`;
  if (opts.cookie) headers["Cookie"] = opts.cookie;

  let body: BodyInit | undefined;
  if (opts.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.json);
  } else if (opts.form) {
    body = opts.form;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, { method, headers, body });
  const text = await res.text();
  let parsed: any = text;
  if ((res.headers.get("content-type") ?? "").includes("application/json")) {
    try { parsed = JSON.parse(text); } catch { /* keep text */ }
  }
  return { status: res.status, headers: res.headers, body: parsed, text };
}
