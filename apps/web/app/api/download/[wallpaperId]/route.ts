import { NextRequest, NextResponse } from "next/server";

// Edge runtime: supports streaming responses with no response-size cap,
// unlike the 4.5 MB serverless function body limit.
export const runtime = "edge";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ wallpaperId: string }> }
) {
  const { wallpaperId } = await params;

  if (!wallpaperId) {
    return new NextResponse("Missing wallpaper ID", { status: 400 });
  }

  if (!API_URL) {
    return new NextResponse("API not configured", { status: 500 });
  }

  try {
    // Fetch wallpaper metadata server-side to resolve the CDN fileUrl.
    // Server → CDN is not subject to browser CORS restrictions.
    const metaRes = await fetch(`${API_URL}/api/wallpapers/${wallpaperId}`, {
      headers: { cookie: request.headers.get("cookie") ?? "" },
    });

    if (!metaRes.ok) {
      return new NextResponse("Wallpaper not found", { status: 404 });
    }

    const { data } = (await metaRes.json()) as {
      data: { fileUrl: string; title: string };
    };

    const { fileUrl, title } = data;

    // Fetch the actual file server-side — no CORS issue here.
    const fileRes = await fetch(fileUrl);

    if (!fileRes.ok) {
      return new NextResponse("Failed to fetch file from storage", { status: 502 });
    }

    const contentType = fileRes.headers.get("content-type") ?? "image/jpeg";
    const ext = contentType.includes("png") ? "png" : "jpg";
    const safeName = `${title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.${ext}`;

    // Stream the body straight through — no buffering, no image transformation.
    return new NextResponse(fileRes.body, {
      headers: {
        "Content-Type": contentType,
        // Forces browser to save the file instead of opening it.
        "Content-Disposition": `attachment; filename="${safeName}"`,
        "Cache-Control": "private, no-cache",
      },
    });
  } catch {
    return new NextResponse("Internal error", { status: 500 });
  }
}
