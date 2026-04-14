/**
 * Custom Next.js image loader that serves images directly from their source URL
 * (R2 CDN, Unsplash, etc.) without routing through Vercel's /_next/image optimizer.
 *
 * This avoids Vercel's image optimization quota (402 errors) since all wallpapers
 * are already served from a CDN and need no server-side re-encoding.
 */
export default function imageLoader({
  src,
}: {
  src: string;
  width: number;
  quality?: number;
}): string {
  return src;
}
