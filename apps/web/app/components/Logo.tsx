import Link from "next/link";
import Image from "next/image";

interface LogoProps {
  href?: string;
  showTagline?: boolean;
}

const Logo = ({ href = "/", showTagline = false }: LogoProps) => {
  const content = (
    <div className="flex items-center gap-2">
      <Image
        src="/logo_1266.png"
        alt="AURA"
        width={35}
        height={35}
        className="shrink-0"
        priority
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