import Link from "next/link";
import Image from "next/image";
import { SITE_LOGO_URL } from "@/lib/site";

interface LogoProps {
  href?: string;
  showTagline?: boolean;
  /** Icon size in px (navbar default 35). */
  size?: number;
  priority?: boolean;
  /**
   * Skip `/_next/image` and load `src` directly. Default true for the Cloudinary logo
   * so production doesn’t depend on the optimizer fetching remote URLs (navbar/footer behave the same).
   */
  unoptimized?: boolean;
}

const Logo = ({
  href = "/",
  showTagline = false,
  size = 35,
  priority = true,
  unoptimized = true,
}: LogoProps) => {
  const content = (
    <div className="flex items-center gap-2">
      <Image
        src={SITE_LOGO_URL}
        alt="Aurora"
        width={size}
        height={size}
        className="shrink-0"
        sizes={`${size}px`}
        priority={priority}
        unoptimized={unoptimized}
      />
      {showTagline && (
        <span
          className="text-[10px] tracking-[0.4em] uppercase mt-0.5"
          style={{ color: 'var(--text-muted)' }}
        >
          Visual Culture
        </span>
      )}
    </div>
  );

  if (!href) return content;

  return (
    <Link
      href={href}
      className="transition-opacity hover:opacity-70"
    >
      {content}
    </Link>
  );
};

export default Logo;