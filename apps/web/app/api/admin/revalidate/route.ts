import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { verifySessionToken } from "@/lib/sessionToken";

/** Cache tags the admin dashboard may refresh (see lib/api.ts). */
const ALLOWED = new Set(["categories", "featured", "wallpapers"]);

/**
 * POST /api/admin/revalidate { tags: string[] } — called after an admin change so the public
 * site shows it immediately instead of after its cache time. Admin session required.
 */
export async function POST(request: NextRequest) {
  const claims = await verifySessionToken(request.cookies.get("aura_token")?.value);
  if (claims?.role !== "admin") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const body = (await request.json().catch(() => ({}))) as { tags?: unknown };
  const tags = Array.isArray(body.tags) ? body.tags.filter((t): t is string => typeof t === "string" && ALLOWED.has(t)) : [];
  if (!tags.length) return NextResponse.json({ error: "No valid tags" }, { status: 400 });
  for (const t of tags) revalidateTag(t, { expire: 0 });
  return NextResponse.json({ revalidated: tags });
}
