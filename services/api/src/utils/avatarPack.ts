/**
 * Aurora avatar pack: three original vector styles (Night critters, Celestials, Faces), each
 * drawn from parts so every (style, seed) gives the same picture. Pure SVG strings — rendered to
 * PNG by avatarPack.service for profile pictures, and served as previews for the pickers.
 */

export const AVATAR_STYLES = ["critter", "celestial", "face"] as const;
export type AvatarStyle = (typeof AVATAR_STYLES)[number];
export const isAvatarStyle = (s: string): s is AvatarStyle => (AVATAR_STYLES as readonly string[]).includes(s);
/** Seeds are unsigned 32-bit integers. */
export const MAX_SEED = 0xffffffff;
export const randomSeed = () => Math.floor(Math.random() * MAX_SEED);

const rng = (seed: number) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
type Rand = () => number;
const pick = <T,>(r: Rand, a: readonly T[]): T => a[Math.floor(r() * a.length)]!;

const BGS: [string, string][] = [["#1B2340", "#2E1E47"], ["#13302B", "#1B2340"], ["#3A1E33", "#1E2444"], ["#2A2340", "#113035"], ["#14263D", "#30203D"]];
const GLOW = ["#81EE4E", "#2DD4BF", "#38BDF8", "#A78BFA", "#F472B6", "#FB923C", "#FACC15"];
const INK = "#1B1626";

function bg(r: Rand, id: string) {
  const [a, b] = pick(r, BGS);
  const g = pick(r, GLOW);
  const gx = 20 + r() * 60, gy = 10 + r() * 30;
  return `<defs><linearGradient id="b${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>
<radialGradient id="g${id}" cx="${gx}%" cy="${gy}%" r="60%"><stop offset="0" stop-color="${g}" stop-opacity=".55"/><stop offset="1" stop-color="${g}" stop-opacity="0"/></radialGradient>
<clipPath id="c${id}"><circle cx="50" cy="50" r="50"/></clipPath></defs>
<circle cx="50" cy="50" r="50" fill="url(#b${id})"/><circle cx="50" cy="50" r="50" fill="url(#g${id})"/>`;
}

// ── 1. Faces ────────────────────────────────────────────────
const SKIN = ["#F6D5B8", "#EDBE95", "#D9A06F", "#B87A4B", "#8A5634", "#5E3A23"];
const HAIR = ["#1C1820", "#3B2416", "#6B3E1F", "#C98B3A", "#A8432C", "#A78BFA", "#F472B6", "#2DD4BF", "#E8E3DA"];
const SHIRT = ["#81EE4E", "#2DD4BF", "#38BDF8", "#A78BFA", "#F472B6", "#FB923C", "#FACC15", "#F5F0EB"];

function face(seed: number, sfx = ""): string {
  const r = rng(seed), id = seed.toString(36) + sfx;
  const skin = pick(r, SKIN), hair = pick(r, HAIR), shirt = pick(r, SHIRT);
  const hairStyle = pick(r, ["short", "bun", "long", "curly", "buzz", "swoop", "beanie", "bob"] as const);
  const eyes = pick(r, ["dots", "happy", "wink", "glasses", "sleepy", "dots", "happy"] as const);
  const mouth = pick(r, ["smile", "grin", "flat", "o", "smile", "smirk"] as const);
  const extra = pick(r, ["none", "blush", "freckles", "earring", "headphones", "star", "blush", "none"] as const);
  const shade = "rgba(0,0,0,.12)";
  let back = "", front = "";
  if (hairStyle === "long") back = `<path d="M26 48 C25 22 75 22 74 48 L76 80 C66 74 34 74 24 80 Z" fill="${hair}"/>`;
  if (hairStyle === "bob") back = `<path d="M27 50 C26 24 74 24 73 50 L73 66 C66 70 34 70 27 66 Z" fill="${hair}"/>`;
  if (hairStyle === "bun") back = `<circle cx="50" cy="21" r="9" fill="${hair}"/>`;
  const cap = `M29 47 C27 25 73 25 71 47 C66 35 34 35 29 47 Z`;
  front = {
    short: `<path d="${cap}" fill="${hair}"/>`,
    bun: `<path d="${cap}" fill="${hair}"/>`,
    long: `<path d="M29 47 C28 27 72 27 71 47 C64 34 44 33 38 40 C35 43 32 45 29 47 Z" fill="${hair}"/>`,
    bob: `<path d="M29 48 C28 28 72 28 71 48 C70 40 62 34 50 35 C40 35 31 40 29 48 Z" fill="${hair}"/>`,
    curly: ([[32, 38], [38, 31], [46, 28], [54, 28], [62, 31], [68, 38], [50, 33], [42, 34], [58, 34]] as const).map(([x, y]) => `<circle cx="${x}" cy="${y}" r="7" fill="${hair}"/>`).join(""),
    buzz: `<path d="M30 44 C30 28 70 28 70 44 C64 37 36 37 30 44 Z" fill="${hair}" opacity=".85"/>`,
    swoop: `<path d="M29 47 C27 26 73 24 71 44 C62 33 48 38 40 33 C35 38 31 42 29 47 Z" fill="${hair}"/>`,
    beanie: `<path d="M27 44 C27 20 73 20 73 44 Z" fill="${shirt}"/><rect x="26" y="40" width="48" height="7" rx="3.5" fill="${shirt}"/><rect x="26" y="40" width="48" height="7" rx="3.5" fill="${shade}"/><circle cx="50" cy="19" r="4.5" fill="${shirt}"/>`,
  }[hairStyle];
  const ex = 42, ey = 51, ex2 = 58;
  const eyesSvg = {
    dots: `<circle cx="${ex}" cy="${ey}" r="2.6" fill="${INK}"/><circle cx="${ex2}" cy="${ey}" r="2.6" fill="${INK}"/>`,
    happy: `<path d="M${ex - 3.5} ${ey + 1} Q${ex} ${ey - 3.5} ${ex + 3.5} ${ey + 1}" stroke="${INK}" stroke-width="2.2" fill="none" stroke-linecap="round"/><path d="M${ex2 - 3.5} ${ey + 1} Q${ex2} ${ey - 3.5} ${ex2 + 3.5} ${ey + 1}" stroke="${INK}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`,
    wink: `<circle cx="${ex}" cy="${ey}" r="2.6" fill="${INK}"/><path d="M${ex2 - 3.5} ${ey} L${ex2 + 3.5} ${ey}" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>`,
    glasses: `<circle cx="${ex}" cy="${ey}" r="2.2" fill="${INK}"/><circle cx="${ex2}" cy="${ey}" r="2.2" fill="${INK}"/><circle cx="${ex}" cy="${ey}" r="6" fill="rgba(255,255,255,.18)" stroke="${INK}" stroke-width="1.8"/><circle cx="${ex2}" cy="${ey}" r="6" fill="rgba(255,255,255,.18)" stroke="${INK}" stroke-width="1.8"/><path d="M${ex + 6} ${ey} L${ex2 - 6} ${ey}" stroke="${INK}" stroke-width="1.8"/>`,
    sleepy: `<path d="M${ex - 3.5} ${ey - 0.5} Q${ex} ${ey + 3} ${ex + 3.5} ${ey - 0.5}" stroke="${INK}" stroke-width="2.2" fill="none" stroke-linecap="round"/><path d="M${ex2 - 3.5} ${ey - 0.5} Q${ex2} ${ey + 3} ${ex2 + 3.5} ${ey - 0.5}" stroke="${INK}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`,
  }[eyes];
  const mouthSvg = {
    smile: `<path d="M45 61 Q50 65.5 55 61" stroke="${INK}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`,
    grin: `<path d="M44 60 Q50 68 56 60 Z" fill="${INK}"/><path d="M46 61.2 Q50 63 54 61.2" stroke="#fff" stroke-width="1.4" fill="none"/>`,
    flat: `<path d="M46 62 L54 62" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>`,
    o: `<ellipse cx="50" cy="62" rx="2.6" ry="3.2" fill="${INK}"/>`,
    smirk: `<path d="M45 62 Q51 64 55 59.5" stroke="${INK}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`,
  }[mouth];
  const extraSvg = {
    none: "",
    blush: `<circle cx="37" cy="58" r="3.6" fill="#F472B6" opacity=".35"/><circle cx="63" cy="58" r="3.6" fill="#F472B6" opacity=".35"/>`,
    freckles: ([[37, 56], [39.5, 58.5], [35.5, 59], [63, 56], [60.5, 58.5], [64.5, 59]] as const).map(([x, y]) => `<circle cx="${x}" cy="${y}" r=".9" fill="#7A4A2C" opacity=".7"/>`).join(""),
    earring: `<circle cx="29.5" cy="57" r="2" fill="#FACC15"/>`,
    headphones: `<path d="M27 50 C26 22 74 22 73 50" stroke="#2A2A33" stroke-width="4" fill="none"/><rect x="22" y="45" width="8" height="13" rx="4" fill="${shirt}"/><rect x="70" y="45" width="8" height="13" rx="4" fill="${shirt}"/>`,
    star: `<path d="M64 60 l1.2 2.5 2.7.4-2 1.9.5 2.7-2.4-1.3-2.4 1.3.5-2.7-2-1.9 2.7-.4z" fill="#FACC15"/>`,
  }[extra];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${bg(r, id)}<g clip-path="url(#c${id})"><g transform="translate(50 52) scale(1.15) translate(-50 -50)">
${back}
<path d="M10 104 C12 76 88 76 90 104 Z" fill="${shirt}"/><path d="M42 77 Q50 84 58 77" stroke="${shade}" stroke-width="3" fill="none"/>
<rect x="44" y="64" width="12" height="14" rx="5" fill="${skin}"/><rect x="44" y="64" width="12" height="8" fill="${shade}"/>
<circle cx="30" cy="52" r="4.5" fill="${skin}"/><circle cx="70" cy="52" r="4.5" fill="${skin}"/>
<ellipse cx="50" cy="49" rx="20.5" ry="22.5" fill="${skin}"/>
${front}${eyesSvg}${mouthSvg}${extraSvg}</g></g></svg>`;
}

// ── 2. Night critters ───────────────────────────────────────
function critter(seed: number, sfx = ""): string {
  const r = rng(seed), id = seed.toString(36) + sfx;
  const body = pick(r, GLOW);
  const kind = pick(r, ["blob", "ghost", "cat", "horns", "antenna", "sprout", "bear"] as const);
  const eyes = pick(r, ["big", "dots", "one", "happy", "big"] as const);
  const shapes = {
    blob: `<path d="M22 86 C14 52 30 26 50 26 C70 26 86 52 78 86 Z" fill="${body}"/>`,
    ghost: `<path d="M24 92 L24 52 C24 34 36 24 50 24 C64 24 76 34 76 52 L76 92 L68 86 L59 92 L50 86 L41 92 L32 86 Z" fill="${body}"/>`,
    cat: `<path d="M26 34 L32 16 L42 30 L58 30 L68 16 L74 34 C80 46 80 74 74 92 L26 92 C20 74 20 46 26 34 Z" fill="${body}"/>`,
    horns: `<path d="M34 30 C30 22 30 16 33 12 C36 18 40 22 42 27 Z M66 30 C70 22 70 16 67 12 C64 18 60 22 58 27 Z" fill="#F5F0EB"/><path d="M22 92 C18 56 30 28 50 28 C70 28 82 56 78 92 Z" fill="${body}"/>`,
    antenna: `<path d="M50 28 L50 14" stroke="${body}" stroke-width="3"/><circle cx="50" cy="12" r="4.5" fill="#FACC15"/><rect x="24" y="28" width="52" height="64" rx="24" fill="${body}"/>`,
    sprout: `<path d="M50 30 C50 22 46 16 38 15 C40 23 44 27 50 30 Z M50 30 C50 22 55 15 63 15 C61 23 57 27 50 30 Z" fill="#81EE4E"/><path d="M50 30 L50 24" stroke="#4E8F2F" stroke-width="2"/><ellipse cx="50" cy="64" rx="28" ry="32" fill="${body}"/>`,
    bear: `<circle cx="30" cy="34" r="9" fill="${body}"/><circle cx="70" cy="34" r="9" fill="${body}"/><path d="M22 92 C18 58 30 30 50 30 C70 30 82 58 78 92 Z" fill="${body}"/>`,
  }[kind];
  const belly = `<ellipse cx="50" cy="80" rx="16" ry="12" fill="#fff" opacity=".22"/>`;
  const y = 54;
  const eyesSvg = {
    big: `<circle cx="41" cy="${y}" r="7" fill="#fff"/><circle cx="59" cy="${y}" r="7" fill="#fff"/><circle cx="42.5" cy="${y + 1}" r="3.4" fill="${INK}"/><circle cx="60.5" cy="${y + 1}" r="3.4" fill="${INK}"/><circle cx="43.6" cy="${y - 0.5}" r="1.1" fill="#fff"/><circle cx="61.6" cy="${y - 0.5}" r="1.1" fill="#fff"/>`,
    dots: `<circle cx="42" cy="${y}" r="3" fill="${INK}"/><circle cx="58" cy="${y}" r="3" fill="${INK}"/>`,
    one: `<circle cx="50" cy="${y - 1}" r="9" fill="#fff"/><circle cx="51.5" cy="${y}" r="4.4" fill="${INK}"/><circle cx="53" cy="${y - 2}" r="1.4" fill="#fff"/>`,
    happy: `<path d="M37 ${y + 1} Q41 ${y - 4} 45 ${y + 1}" stroke="${INK}" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M55 ${y + 1} Q59 ${y - 4} 63 ${y + 1}" stroke="${INK}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`,
  }[eyes];
  const mouth = pick(r, [
    `<path d="M45 66 Q50 70 55 66" stroke="${INK}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`,
    `<path d="M44 65 Q50 73 56 65 Z" fill="${INK}"/>`,
    `<path d="M46 66 L48 68 L50 66 L52 68 L54 66" stroke="${INK}" stroke-width="2" fill="none" stroke-linejoin="round"/>`,
    `<ellipse cx="50" cy="67" rx="2.6" ry="2.2" fill="${INK}"/>`,
  ]);
  const cheeks = r() < 0.6 ? `<circle cx="35" cy="64" r="3.6" fill="#fff" opacity=".28"/><circle cx="65" cy="64" r="3.6" fill="#fff" opacity=".28"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${bg(r, id)}<g clip-path="url(#c${id})">${shapes}${belly}${eyesSvg}${mouth}${cheeks}</g></svg>`;
}

// ── 3. Celestials ───────────────────────────────────────────
function celestial(seed: number, sfx = ""): string {
  const r = rng(seed), id = seed.toString(36) + sfx;
  const kind = pick(r, ["moon", "planet", "star", "sun", "cloud", "comet", "crystal"] as const);
  const c = pick(r, GLOW);
  const sparkles = Array.from({ length: 5 }, () => `<circle cx="${(8 + r() * 84).toFixed(1)}" cy="${(8 + r() * 84).toFixed(1)}" r="${(0.6 + r() * 1.1).toFixed(1)}" fill="#fff" opacity="${(0.4 + r() * 0.5).toFixed(2)}"/>`).join("");
  let shape = "", fx = 50, fy = 54;
  if (kind === "moon") { shape = `<circle cx="50" cy="50" r="27" fill="#F5EBC8"/><circle cx="62" cy="40" r="22" fill="url(#b${id})"/><circle cx="62" cy="40" r="22" fill="url(#g${id})"/><circle cx="38" cy="66" r="3" fill="#E2D3A2"/>`; fx = 40; fy = 54; }
  if (kind === "planet") shape = `<ellipse cx="50" cy="52" rx="38" ry="10" fill="none" stroke="#F5F0EB" stroke-opacity=".55" stroke-width="3" transform="rotate(-18 50 52)"/><circle cx="50" cy="52" r="22" fill="${c}"/><path d="M14 64 Q50 40 86 40" stroke="#F5F0EB" stroke-opacity=".75" stroke-width="3" fill="none" transform="rotate(-6 50 52)"/>`;
  if (kind === "star") shape = `<path d="M50 18 L59 41 L84 42 L64 57 L71 81 L50 67 L29 81 L36 57 L16 42 L41 41 Z" fill="#FACC15" stroke="#FACC15" stroke-width="5" stroke-linejoin="round"/>`;
  if (kind === "sun") shape = Array.from({ length: 10 }, (_, i) => `<rect x="48" y="12" width="4" height="12" rx="2" fill="#FB923C" transform="rotate(${i * 36} 50 52)"/>`).join("") + `<circle cx="50" cy="52" r="23" fill="#FDBA74"/>`;
  if (kind === "cloud") shape = `<path d="M24 70 C14 70 14 54 26 54 C26 40 44 36 50 46 C56 34 76 38 74 54 C86 54 86 70 76 70 Z" fill="#F5F0EB"/>`;
  if (kind === "comet") { shape = `<path d="M72 30 L22 74 L30 82 Z" fill="${c}" opacity=".5"/><path d="M72 30 L30 62 L40 72 Z" fill="${c}" opacity=".7"/><circle cx="62" cy="44" r="17" fill="${c}"/>`; fx = 62; fy = 46; }
  if (kind === "crystal") shape = `<path d="M50 16 L72 40 L50 88 L28 40 Z" fill="${c}"/><path d="M50 16 L58 40 L50 88 L42 40 Z" fill="#fff" opacity=".25"/><path d="M28 40 L72 40" stroke="#fff" stroke-opacity=".35" stroke-width="1.5"/>`;
  const e = pick(r, ["dots", "happy", "sleepy"] as const);
  const d = 6.5;
  const eyes = e === "dots"
    ? `<circle cx="${fx - d}" cy="${fy}" r="2.4" fill="${INK}"/><circle cx="${fx + d}" cy="${fy}" r="2.4" fill="${INK}"/>`
    : e === "happy"
      ? `<path d="M${fx - d - 3} ${fy + 1} Q${fx - d} ${fy - 3} ${fx - d + 3} ${fy + 1}" stroke="${INK}" stroke-width="2.2" fill="none" stroke-linecap="round"/><path d="M${fx + d - 3} ${fy + 1} Q${fx + d} ${fy - 3} ${fx + d + 3} ${fy + 1}" stroke="${INK}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`
      : `<path d="M${fx - d - 3} ${fy} Q${fx - d} ${fy + 3} ${fx - d + 3} ${fy}" stroke="${INK}" stroke-width="2.2" fill="none" stroke-linecap="round"/><path d="M${fx + d - 3} ${fy} Q${fx + d} ${fy + 3} ${fx + d + 3} ${fy}" stroke="${INK}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
  const mouth = `<path d="M${fx - 3.5} ${fy + 6} Q${fx} ${fy + 9.5} ${fx + 3.5} ${fy + 6}" stroke="${INK}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
  const blush = `<circle cx="${fx - d - 4}" cy="${fy + 5}" r="2.6" fill="#F472B6" opacity=".4"/><circle cx="${fx + d + 4}" cy="${fy + 5}" r="2.6" fill="#F472B6" opacity=".4"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${bg(r, id)}<g clip-path="url(#c${id})">${sparkles}${shape}${eyes}${mouth}${blush}</g></svg>`;
}


const DRAW: Record<AvatarStyle, (seed: number) => string> = { critter, celestial, face };

/** The avatar as an SVG document (100×100 viewBox). */
export function avatarSvg(style: AvatarStyle, seed: number): string {
  return DRAW[style](seed >>> 0);
}
