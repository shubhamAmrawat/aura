import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

// All wallpaper files live on our own R2 bucket. Accept only URLs whose
// hostname matches this env var (or *.r2.dev as a fallback) to prevent SSRF.
function isAllowedFileUrl(raw: string): boolean {
  try {
    const { hostname, protocol } = new URL(raw);
    if (protocol !== "https:") return false;

    // Explicit CDN domain configured in env
    const configured = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
    if (configured) {
      try {
        if (hostname === new URL(configured).hostname) return true;
      } catch { /* ignore */ }
    }

    // Cloudflare R2 public bucket domains
    if (hostname.endsWith(".r2.dev")) return true;

    return false;
  } catch {
    return false;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ wallpaperId: string }> }
) {
  await params; // wallpaperId available if needed for future use

  // The client passes the CDN URL and desired filename as query params,
  // so we skip a metadata round-trip and start fetching the file immediately.
  const fileUrl = request.nextUrl.searchParams.get("url");
  const rawName = request.nextUrl.searchParams.get("name") ?? "wallpaper";

  if (!fileUrl) {
    return new NextResponse("Missing url param", { status: 400 });
  }

  if (!isAllowedFileUrl(fileUrl)) {
    return new NextResponse("Invalid file URL", { status: 400 });
  }

  const safeName = `${rawName.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.jpg`;

  try {
    // Server → R2 is same-origin from R2's perspective — no CORS block.
    const fileRes = await fetch(fileUrl);

    if (!fileRes.ok) {
      return new NextResponse("Failed to fetch file from storage", { status: 502 });
    }

    const contentType = fileRes.headers.get("content-type") ?? "image/jpeg";
    const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
    const fileName = safeName.replace(/\.jpg$/, `.${ext}`);

    // Stream straight through to the browser — no buffering, no transformation.
    // Content-Disposition: attachment makes the browser show the save dialog
    // the moment these headers arrive, then streams to disk natively.
    return new NextResponse(fileRes.body, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "private, no-cache",
        // Forward content-length so the browser shows a progress bar.
        ...(fileRes.headers.get("content-length")
          ? { "Content-Length": fileRes.headers.get("content-length")! }
          : {}),
      },
    });
  } catch {
    return new NextResponse("Internal error", { status: 500 });
  }
}
