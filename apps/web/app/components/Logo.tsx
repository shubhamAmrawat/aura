import Link from "next/link";
import { useId } from "react";

/**
 * Aurora logo: the ribbon "A" (aurora gradient legs, wave crossbar) is the first
 * letter of the wordmark. Everything is inline SVG — the "urora" letters are
 * Manrope ExtraBold converted to outlines — so it renders identically everywhere
 * and needs no font download. Static files live in /public/brand.
 */

const LEGS = "M8 47 C 13 34, 19 17, 28 4 C 37 17, 43 34, 48 47";
const BAR = "M14 32 C 21 27, 29 37, 42 29";
const WORD =
  "M2034 32Q1907 32 1827 -11Q1747 -54 1702 -120Q1658 -186 1639 -258Q1620 -329 1616 -388Q1612 -447 1612 -474V-1080H1888V-570Q1888 -533 1892 -476Q1896 -418 1917 -360Q1938 -302 1986 -263Q2033 -224 2120 -224Q2155 -224 2195 -235Q2235 -246 2270 -278Q2305 -309 2328 -370Q2350 -432 2350 -532V-1080H2624V0H2384V-111Q2347 -69 2298 -37Q2193 32 2034 32Z M2864 0V-1080H3104V-906Q3117 -930 3134 -952Q3169 -998 3220 -1028Q3259 -1052 3305 -1066Q3351 -1079 3400 -1082Q3449 -1086 3498 -1080V-826Q3453 -840 3394 -836Q3334 -831 3286 -808Q3238 -786 3205 -750Q3172 -713 3155 -664Q3138 -614 3138 -552V0Z M4134 30Q3971 30 3848 -43Q3725 -116 3656 -244Q3588 -373 3588 -540Q3588 -709 3658 -838Q3728 -966 3851 -1038Q3974 -1110 4134 -1110Q4297 -1110 4420 -1037Q4544 -964 4613 -836Q4682 -707 4682 -540Q4682 -372 4612 -244Q4543 -115 4420 -42Q4296 30 4134 30ZM4134 -224Q4265 -224 4330 -312Q4394 -401 4394 -540Q4394 -684 4328 -770Q4263 -856 4134 -856Q4045 -856 3988 -816Q3931 -776 3904 -705Q3876 -634 3876 -540Q3876 -395 3942 -310Q4007 -224 4134 -224Z M4862 0V-1080H5102V-906Q5115 -930 5132 -952Q5167 -998 5218 -1028Q5257 -1052 5303 -1066Q5349 -1079 5398 -1082Q5447 -1086 5496 -1080V-826Q5451 -840 5392 -836Q5332 -831 5284 -808Q5236 -786 5203 -750Q5170 -713 5153 -664Q5136 -614 5136 -552V0Z M5946 30Q5830 30 5750 -14Q5669 -59 5628 -134Q5586 -208 5586 -298Q5586 -373 5609 -435Q5632 -497 5684 -544Q5735 -592 5822 -624Q5882 -646 5965 -663Q6048 -680 6153 -696Q6215 -705 6284 -715Q6276 -782 6240 -817Q6194 -862 6086 -862Q6026 -862 5961 -833Q5896 -804 5870 -730L5624 -808Q5665 -942 5778 -1026Q5891 -1110 6086 -1110Q6229 -1110 6340 -1066Q6451 -1022 6508 -914Q6540 -854 6546 -794Q6552 -734 6552 -660V0H6314V-133Q6250 -57 6178 -19Q6086 30 5946 30ZM6004 -184Q6079 -184 6130 -210Q6182 -237 6212 -271Q6243 -305 6254 -328Q6275 -372 6279 -431Q6281 -466 6281 -495Q6214 -483 6166 -475Q6091 -461 6045 -450Q5999 -439 5964 -426Q5924 -410 5900 -392Q5875 -373 5864 -351Q5852 -329 5852 -302Q5852 -265 5870 -238Q5889 -212 5923 -198Q5957 -184 6004 -184Z";

/** Lockup width ÷ height. */
const FULL_RATIO = 6552 / 1510;

interface LogoProps {
  /** Link target; pass `null` to render without a link. */
  href?: string | null;
  /** Rendered height in px. */
  height?: number;
  /** `full` = A + "urora" wordmark, `mark` = the A on its own. */
  variant?: "full" | "mark";
  showTagline?: boolean;
  className?: string;
}

function Mark({ gradientId }: { gradientId: string }) {
  return (
    <>
      <defs>
        <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1="8" y1="0" x2="48" y2="0">
          <stop offset="0" stopColor="#81ee4e" />
          <stop offset="0.5" stopColor="#2dd4bf" />
          <stop offset="1" stopColor="#8b7cf6" />
        </linearGradient>
      </defs>
      <path d={LEGS} fill="none" stroke={`url(#${gradientId})`} strokeWidth="8.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d={BAR} fill="none" stroke="currentColor" strokeWidth="5.4" strokeLinecap="round" />
    </>
  );
}

const Logo = ({ href = "/", height = 24, variant = "full", showTagline = false, className = "" }: LogoProps) => {
  const gradientId = `aurora-a-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  const svg =
    variant === "mark" ? (
      <svg viewBox="0 -2.5 56 56" width={height} height={height} role="img" aria-label="Aurora" className="shrink-0">
        <Mark gradientId={gradientId} />
      </svg>
    ) : (
      <svg
        viewBox="40 -1480 6552 1510"
        width={Math.round(height * FULL_RATIO)}
        height={height}
        role="img"
        aria-label="Aurora"
        className="shrink-0"
      >
        <g transform="translate(-76 -1460) scale(29)">
          <Mark gradientId={gradientId} />
        </g>
        <path fill="currentColor" d={WORD} />
      </svg>
    );

  const content = (
    <span className={`flex items-center gap-2 ${href ? "" : className}`} style={{ color: "var(--text-primary)" }}>
      {svg}
      {showTagline && (
        <span className="mt-0.5 text-[10px] uppercase tracking-[0.4em]" style={{ color: "var(--text-muted)" }}>
          Visual Culture
        </span>
      )}
    </span>
  );

  if (!href) return content;

  return (
    <Link href={href} className={`shrink-0 transition-opacity hover:opacity-80 ${className}`}>
      {content}
    </Link>
  );
};

export default Logo;
