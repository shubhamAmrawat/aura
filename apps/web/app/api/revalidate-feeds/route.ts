import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { verifySessionToken } from "@/lib/sessionToken";

/**
 * POST /api/revalidate-feeds — called by the upload page after a wallpaper goes live, so it shows
 * on the home page, /latest and /trending straight away. Signed-in users only.
 *
 * A route handler rather than a server action on purpose: Next.js holds page navigations until a
 * running server action finishes, which made "View wallpaper" on the finish screen feel frozen.
 */
export async function POST(request: NextRequest) {
  const claims = await verifySessionToken(request.cookies.get("aura_token")?.value);
  if (!claims) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  revalidateTag("wallpapers", { expire: 0 });
  revalidatePath("/");
  revalidatePath("/latest");
  revalidatePath("/trending");
  return NextResponse.json({ revalidated: true });
}
