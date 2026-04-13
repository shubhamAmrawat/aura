import Link from "next/link";
import Image from "next/image";

interface LogoProps {
  href?: string;
  showTagline?: boolean;
  /** Icon size in px (navbar default 35). */
  size?: number;
  priority?: boolean;
  /**
   * Use the file from /public directly (no /_next/image). Prefer this for small
   * footer marks when lazy + the optimizer misbehaves behind some CDNs or blockers.
   */
  unoptimized?: boolean;
}

const Logo = ({
  href = "/",
  showTagline = false,
  size = 35,
  priority = true,
  unoptimized = false,
}: LogoProps) => {
  const content = (
    <div className="flex items-center gap-2">
      <Image
        src="/logo_1266.png"
        alt="AURA"
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