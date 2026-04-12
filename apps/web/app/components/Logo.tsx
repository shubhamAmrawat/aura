import Link from "next/link";
import Image from "next/image";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  href?: string;
  showTagline?: boolean;
}

const sizes = {
  sm: "text-md tracking-[0.25em]",
  md: "text-2xl tracking-[0.3em]",
  lg: "text-4xl tracking-[0.35em]",
};


const Logo = ({ size = "md", href = "/", showTagline = false }: LogoProps) => {
  const content = (
    <div className="flex items-center gap-2">
      <Image
        src="/logo_122.png"
        alt="AURA"
        width={30}
        height={30}
        className="shrink-0"
        priority
      />
      <span
        className={`font-bold ${sizes[size]}`}
        style={{ color: 'var(--accent)' }}
      >
        AURA
      </span>
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