import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { verifySessionToken } from "@/lib/sessionToken";

/**
 * POST /api/admin/revalidate-featured — called by the admin Featured page after saving,
 * so the home page hero updates immediately instead of after its 2-minute cache.
 * Admin session required (signed token with role "admin").
 */
export async function POST(request: NextRequest) {
  const claims = await verifySessionToken(request.cookies.get("aura_token")?.value);
  if (claims?.role !== "admin") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  revalidateTag("featured", { expire: 0 });
  return NextResponse.json({ revalidated: true });
}
