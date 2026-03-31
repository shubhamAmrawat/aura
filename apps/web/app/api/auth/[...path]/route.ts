import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function backendBase(): string {
  const url = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL;
  if (!url) {
    throw new Error("Set API_URL or NEXT_PUBLIC_API_URL for the auth proxy");
  }
  return url.replace(/\/$/, "");
}

function parseAuraTokenFromSetCookieLine(line: string): { token: string; maxAge: number } | "clear" | null {
  const namePart = line.split(";")[0]?.trim();
  if (!namePart?.toLowerCase().startsWith("aura_token=")) {
    return null;
  }
  const raw = namePart.slice("aura_token=".length).trim();
  if (!raw || /Max-Age=0/i.test(line)) {
    return "clear";
  }
  const maxM = line.match(/Max-Age=(\d+)/i);
  const maxAge = maxM ? parseInt(maxM[1], 10) : 7 * 24 * 60 * 60;
  return { token: decodeURIComponent(raw), maxAge };
}

function applyUpstreamSetCookies(upstream: Response, out: NextResponse) {
  const headers = upstream.headers;
  const rawList =
    typeof headers.getSetCookie === "function" ? headers.getSetCookie() : [];

  const lines =
    rawList.length > 0
      ? rawList
      : (() => {
          const single = headers.get("set-cookie");
          return single ? [single] : [];
        })();

  for (const line of lines) {
    const parsed = parseAuraTokenFromSetCookieLine(line);
    if (parsed === null) continue;

    const secure = process.env.NODE_ENV === "production";

    if (parsed === "clear") {
      out.cookies.set("aura_token", "", {
        httpOnly: true,
        path: "/",
        maxAge: 0,
        sameSite: "lax",
        secure,
      });
      continue;
    }

    out.cookies.set("aura_token", parsed.token, {
      httpOnly: true,
      path: "/",
      maxAge: parsed.maxAge,
      sameSite: "lax",
      secure,
    });
  }
}

async function proxy(req: NextRequest, pathSegments: string[]) {
  const path = pathSegments.join("/");
  const qs = req.nextUrl.search;
  const target = `${backendBase()}/api/auth/${path}${qs}`;

  const forwardHeaders: HeadersInit = {};
  const ct = req.headers.get("content-type");
  if (ct) forwardHeaders["Content-Type"] = ct;
  const cookie = req.headers.get("cookie");
  if (cookie) forwardHeaders["Cookie"] = cookie;

  const init: RequestInit = {
    method: req.method,
    headers: forwardHeaders,
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.arrayBuffer();
  }

  const upstream = await fetch(target, init);
  const body = await upstream.arrayBuffer();
  const out = new NextResponse(body, {
    status: upstream.status,
    statusText: upstream.statusText,
  });

  const outCt = upstream.headers.get("content-type");
  if (outCt) out.headers.set("content-type", outCt);

  applyUpstreamSetCookies(upstream, out);
  return out;
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
) {
  const { path = [] } = await ctx.params;
  return proxy(req, path);
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
) {
  const { path = [] } = await ctx.params;
  return proxy(req, path);
}
