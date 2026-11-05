/**
 * Aurora avatar packs: original vector styles (Night critters, Celestials, Faces, Masked heroes,
 * Anime, Shades crew, Animals — Aurora's own characters, not copies of existing ones), each
 * drawn from parts so every (style, seed) gives the same picture. Pure SVG strings — rendered to
 * PNG by avatarPack.service for profile pictures, and served as previews for the pickers.
 */

export const AVATAR_STYLES = ["critter", "celestial", "face", "hero", "anime", "shades", "animal"] as const;
export type AvatarStyle = (typeof AVATAR_STYLES)[number];
export const isAvatarStyle = (s: string): s is AvatarStyle => (AVATAR_STYLES as readonly string[]).includes(s);
/** Seeds are unsigned 32-bit integers. */
export const MAX_SEED = 0xffffffff;
export const randomSeed = () => Math.floor(Math.random() * MAX_SEED);

/**
 * The packs the pickers show, in order (GET /api/avatars/packs). The website and app build their
 * tabs from this list, so adding a pack here (plus its drawing below) needs no app update.
 */
export const AVATAR_PACKS: { key: AvatarStyle; label: string }[] = [
  { key: "critter", label: "Night critters" },
  { key: "celestial", label: "Celestials" },
  { key: "face", label: "Faces" },
  { key: "hero", label: "Masked heroes" },
  { key: "anime", label: "Anime" },
  { key: "shades", label: "Shades crew" },
  { key: "animal", label: "Animals" },
];

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



// ── shared bits for the later packs ─────────────────────────
const SKIN2 = ["#F6D5B8", "#EDBE95", "#D9A06F", "#B87A4B", "#8A5634", "#5E3A23"];
const HAIR2 = ["#1C1820", "#3B2416", "#6B3E1F", "#C98B3A", "#A8432C", "#E8E3DA"];
const FUNHAIR = ["#A78BFA", "#F472B6", "#2DD4BF", "#38BDF8", "#FB923C", "#81EE4E", "#F5F0EB", "#1C1820", "#FACC15"];
const BRIGHT = ["#81EE4E", "#2DD4BF", "#38BDF8", "#A78BFA", "#F472B6", "#FB923C", "#FACC15", "#F87171"];
const shade2 = "rgba(0,0,0,.14)";
const wrap = (r: Rand, id: string, inner: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${bg(r, id)}<g clip-path="url(#c${id})">${inner}</g></svg>`;
const capHair = (c: string) => `<path d="M29 47 C27 25 73 25 71 47 C66 35 34 35 29 47 Z" fill="${c}"/>`;
const person = (skin: string, shirt: string) => `<path d="M10 104 C12 76 88 76 90 104 Z" fill="${shirt}"/><rect x="44" y="64" width="12" height="14" rx="5" fill="${skin}"/><rect x="44" y="64" width="12" height="7" fill="${shade2}"/><circle cx="30" cy="52" r="4.5" fill="${skin}"/><circle cx="70" cy="52" r="4.5" fill="${skin}"/><ellipse cx="50" cy="49" rx="20.5" ry="22.5" fill="${skin}"/>`;
const smiles = [
  `<path d="M45 61 Q50 65.5 55 61" stroke="${INK}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`,
  `<path d="M44 60 Q50 68 56 60 Z" fill="${INK}"/>`,
  `<path d="M45 62 Q51 64 55 59.5" stroke="${INK}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`,
  `<path d="M46 62 L54 62" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>`,
];

// ── Masked heroes ───────────────────────────────────────────
function hero(seed: number, sfx = ""): string {
  const r = rng(seed), id = seed.toString(36) + sfx;
  const skin = pick(r, SKIN2), hair = pick(r, HAIR2), suit = pick(r, BRIGHT), mask = pick(r, ["#1C1820", ...BRIGHT]), cape = pick(r, ["#B91C1C", "#1E3A8A", "#4C1D95", "#0F766E", "#1C1820", "#9D174D"]);
  const em = pick(r, ["star", "bolt", "diamond", "ring", "wing"] as const);
  const emblems = {
    star: `<path d="M50 80 l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z" fill="#FACC15"/>`,
    bolt: `<path d="M53 79 L45 90 L50 90 L47 99 L56 87 L51 87 Z" fill="#FACC15"/>`,
    diamond: `<path d="M50 79 L57 88 L50 97 L43 88 Z" fill="#F5F0EB"/>`,
    ring: `<circle cx="50" cy="88" r="7" fill="none" stroke="#F5F0EB" stroke-width="3"/><circle cx="50" cy="88" r="2.5" fill="#FACC15"/>`,
    wing: `<path d="M50 90 C44 82 38 84 36 86 C42 87 45 89 50 94 C55 89 58 87 64 86 C62 84 56 82 50 90 Z" fill="#F5F0EB"/>`,
  };
  const hairStyle = pick(r, ["cap", "spiky", "swoop", "hood"] as const);
  const front = {
    cap: capHair(hair),
    spiky: `<path d="M29 46 L28 32 L35 36 L37 24 L44 31 L50 20 L56 31 L63 24 L65 36 L72 32 L71 46 C66 36 34 36 29 46 Z" fill="${hair}"/>`,
    swoop: `<path d="M29 47 C27 26 73 24 71 44 C62 33 48 38 40 33 C35 38 31 42 29 47 Z" fill="${hair}"/>`,
    hood: `<path d="M24 56 C22 22 78 22 76 56 L72 56 C72 34 28 34 28 56 Z" fill="${mask === "#1C1820" ? suit : mask}"/>`,
  }[hairStyle];
  const maskSvg = `<path d="M28 45 Q50 39 72 45 L71 55 Q61 51 50 55 Q39 51 29 55 Z" fill="${mask}"/><ellipse cx="41.5" cy="49.5" rx="4.6" ry="3.4" fill="#fff"/><ellipse cx="58.5" cy="49.5" rx="4.6" ry="3.4" fill="#fff"/><circle cx="42" cy="49.8" r="1.8" fill="${INK}"/><circle cx="59" cy="49.8" r="1.8" fill="${INK}"/>`;
  const body = `<path d="M6 104 L18 74 Q50 86 82 74 L94 104 Z" fill="${cape}"/><path d="M14 104 C16 78 84 78 86 104 Z" fill="${suit}"/><path d="M38 77 L50 84 L62 77" stroke="${shade2}" stroke-width="3" fill="none"/>`;
  const head = `<rect x="44" y="62" width="12" height="14" rx="5" fill="${skin}"/><circle cx="30" cy="50" r="4.5" fill="${skin}"/><circle cx="70" cy="50" r="4.5" fill="${skin}"/><ellipse cx="50" cy="47" rx="20.5" ry="22.5" fill="${skin}"/>`;
  return wrap(r, id, `<g transform="translate(50 46) scale(.96) translate(-50 -48)">${body}${emblems[em]}${head}${front}${maskSvg}${pick(r, smiles)}</g>`);
}

// ── Anime ───────────────────────────────────────────────────
function anime(seed: number, sfx = ""): string {
  const r = rng(seed), id = seed.toString(36) + sfx;
  const skin = pick(r, SKIN2.slice(0, 4)), hair = pick(r, FUNHAIR), iris = pick(r, ["#38BDF8", "#A78BFA", "#81EE4E", "#F472B6", "#FB923C", "#8B5A2B", "#2DD4BF"]), shirt = pick(r, BRIGHT);
  const style = pick(r, ["bangs", "spiky", "long", "twin"] as const);
  const back = style === "long" ? `<path d="M26 44 C24 18 76 18 74 44 L78 86 C68 80 32 80 22 86 Z" fill="${hair}"/>` : style === "twin" ? `<path d="M26 40 C14 46 14 70 22 82 C26 70 28 58 30 50 Z M74 40 C86 46 86 70 78 82 C74 70 72 58 70 50 Z" fill="${hair}"/>` : "";
  const headPath = `M30 45 C30 26 70 26 70 45 C70 59 61 70 50 72 C39 70 30 59 30 45 Z`;
  const front = {
    bangs: `<path d="M27 48 L28 32 Q50 12 72 32 L73 48 L67 37 L63 46 L57 35 L51 45 L45 35 L39 46 L34 37 Z" fill="${hair}"/>`,
    spiky: `<path d="M27 48 L22 30 L32 32 L30 16 L42 26 L50 10 L58 26 L70 16 L68 32 L78 30 L73 48 L66 37 L60 45 L54 35 L46 35 L40 45 L34 37 Z" fill="${hair}"/>`,
    long: `<path d="M28 50 L29 32 Q50 14 71 32 L72 50 L66 38 L58 40 L50 34 L42 40 L34 38 Z" fill="${hair}"/>`,
    twin: `<path d="M28 48 L29 32 Q50 14 71 32 L72 48 L65 38 L58 44 L52 36 L44 42 L36 38 Z" fill="${hair}"/><circle cx="29" cy="36" r="3.4" fill="${pick(r, ["#F472B6", "#FACC15", "#F5F0EB"])}"/>`,
  }[style];
  const eye = (x: number) => `<ellipse cx="${x}" cy="52" rx="4.4" ry="5.8" fill="#fff"/><ellipse cx="${x}" cy="53" rx="3.6" ry="4.9" fill="${iris}"/><ellipse cx="${x}" cy="54" rx="1.9" ry="2.8" fill="${INK}"/><circle cx="${x + 1.4}" cy="50.6" r="1.4" fill="#fff"/><circle cx="${x - 1.3}" cy="55.6" r=".7" fill="#fff"/><path d="M${x - 5.2} 47.6 Q${x} 45 ${x + 5.2} 47.6" stroke="${INK}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
  const closed = (x: number) => `<path d="M${x - 4.5} 53 Q${x} 49 ${x + 4.5} 53" stroke="${INK}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
  const happy = r() < 0.25;
  const eyes = happy ? closed(41) + closed(59) : eye(41) + eye(59);
  const mouth = pick(r, [
    `<path d="M47.5 63 Q50 65 52.5 63" stroke="${INK}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`,
    `<path d="M46.5 62.5 Q48 64.5 50 62.5 Q52 64.5 53.5 62.5" stroke="${INK}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`,
    `<path d="M47 62 L53 62 L50 65.5 Z" fill="#B4234B"/>`,
  ]);
  const blush = `<g stroke="#F472B6" stroke-width="1.4" stroke-linecap="round" opacity=".75"><path d="M33.5 59.5 L35.5 57.5 M36.5 60 L38.5 58 M39.5 60.5 L41.5 58.5"/><path d="M58.5 60.5 L60.5 58.5 M61.5 60 L63.5 58 M64.5 59.5 L66.5 57.5"/></g>`;
  const extra = pick(r, ["", "", `<path d="M71 40 C73 44 74 46 72 48 C70 49 68 47 69 45 Z" fill="#7DD3FC"/>`, `<path d="M30 30 L34 18 L40 28 Z M70 30 L66 18 L60 28 Z" fill="${hair}"/><path d="M31.5 27 L34 21 L37 26 Z M68.5 27 L66 21 L63 26 Z" fill="#F9A8D4"/>`]);
  return wrap(r, id, `<g transform="translate(50 52) scale(1.12) translate(-50 -50)">${back}<path d="M12 104 C14 78 86 78 88 104 Z" fill="${shirt}"/><path d="M40 78 L50 86 L60 78" fill="#fff" opacity=".9"/><rect x="45" y="64" width="10" height="13" rx="4" fill="${skin}"/><path d="${headPath}" fill="${skin}"/>${front}${eyes}${mouth}${blush}${extra}</g>`);
}

// ── Shades crew ─────────────────────────────────────────────
function shades(seed: number, sfx = ""): string {
  const r = rng(seed), id = seed.toString(36) + sfx;
  const skin = pick(r, SKIN2), hair = pick(r, [...HAIR2, ...FUNHAIR.slice(0, 4)]), shirt = pick(r, BRIGHT);
  const hat = pick(r, ["cap", "beanie", "none", "bucket", "none", "headphones"] as const);
  const lens = pick(r, ["#111017", "#111017", "#1E3A8A", "#7C2D12", "#4C1D95"]);
  const frame = pick(r, ["round", "square", "visor"] as const);
  const shine = `<path d="M37 48 L41 46" stroke="#fff" stroke-opacity=".6" stroke-width="1.4" stroke-linecap="round"/><path d="M54 48 L58 46" stroke="#fff" stroke-opacity=".6" stroke-width="1.4" stroke-linecap="round"/>`;
  const glasses = {
    round: `<circle cx="41.5" cy="50" r="6.5" fill="${lens}"/><circle cx="58.5" cy="50" r="6.5" fill="${lens}"/><path d="M48 49 Q50 47.5 52 49" stroke="${INK}" stroke-width="1.8" fill="none"/>`,
    square: `<rect x="33" y="45" width="15" height="10" rx="3" fill="${lens}"/><rect x="52" y="45" width="15" height="10" rx="3" fill="${lens}"/><path d="M48 48 L52 48" stroke="${INK}" stroke-width="2"/>`,
    visor: `<path d="M30 46 Q50 42 70 46 L69 54 Q60 56 50 52 Q40 56 31 54 Z" fill="${lens}"/>`,
  }[frame] + shine;
  const hats = {
    none: capHair(hair),
    cap: `${capHair(hair)}<path d="M28 42 C28 22 72 22 72 42 Z" fill="${shirt}"/><path d="M28 41 L80 41 Q86 42 84 46 L28 45 Z" fill="${shirt}"/><path d="M28 41 L80 41 Q86 42 84 46 L28 45 Z" fill="${shade2}"/>`,
    beanie: `<path d="M27 44 C27 20 73 20 73 44 Z" fill="${shirt}"/><rect x="26" y="40" width="48" height="7" rx="3.5" fill="${shirt}"/><rect x="26" y="40" width="48" height="7" rx="3.5" fill="${shade2}"/>`,
    bucket: `<path d="M32 40 C32 24 68 24 68 40 Z" fill="${shirt}"/><path d="M22 44 Q50 34 78 44 L74 46 Q50 40 26 46 Z" fill="${shirt}"/><path d="M22 44 Q50 34 78 44 L74 46 Q50 40 26 46 Z" fill="${shade2}"/>`,
    headphones: `${capHair(hair)}<path d="M27 50 C26 22 74 22 73 50" stroke="#2A2A33" stroke-width="4" fill="none"/><rect x="22" y="45" width="8" height="13" rx="4" fill="${shirt}"/><rect x="70" y="45" width="8" height="13" rx="4" fill="${shirt}"/>`,
  }[hat];
  const chain = r() < 0.4 ? `<path d="M40 79 Q50 90 60 79" stroke="#FACC15" stroke-width="1.8" fill="none"/>` : "";
  return wrap(r, id, `<g transform="translate(50 52) scale(1.15) translate(-50 -50)">${person(skin, shirt)}${chain}${hats}${glasses}${pick(r, [smiles[0], smiles[2], smiles[1]])}</g>`);
}

// ── Animals ─────────────────────────────────────────────────
function animal(seed: number, sfx = ""): string {
  const r = rng(seed), id = seed.toString(36) + sfx;
  const kind = pick(r, ["cat", "fox", "panda", "owl", "bunny", "bear", "penguin", "frog"] as const);
  const dot = (x: number, y: number, s = 2.8) => `<circle cx="${x}" cy="${y}" r="${s}" fill="${INK}"/><circle cx="${x + s * 0.35}" cy="${y - s * 0.35}" r="${s * 0.32}" fill="#fff"/>`;
  const blush = `<circle cx="34" cy="64" r="3.6" fill="#F472B6" opacity=".35"/><circle cx="66" cy="64" r="3.6" fill="#F472B6" opacity=".35"/>`;
  const smileAt = (y: number) => `<path d="M46 ${y} Q48 ${y + 2.5} 50 ${y} Q52 ${y + 2.5} 54 ${y}" stroke="${INK}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`;
  const smile = smileAt(66);
  const c = pick(r, ["#F59E0B", "#9CA3AF", "#E8E3DA", "#A16207", "#F472B6", "#A78BFA", "#2DD4BF"]);
  let s = "";
  if (kind === "cat") s = `<path d="M26 44 L28 20 L44 34 Z M74 44 L72 20 L56 34 Z" fill="${c}"/><path d="M30 38 L31 26 L39 34 Z M70 38 L69 26 L61 34 Z" fill="#F9A8D4"/><ellipse cx="50" cy="58" rx="27" ry="25" fill="${c}"/>${dot(40, 56)}${dot(60, 56)}<path d="M48 62 L52 62 L50 64.5 Z" fill="#F472B6"/>${smile}<g stroke="${INK}" stroke-width="1" opacity=".5"><path d="M30 62 L18 60 M30 66 L18 68 M70 62 L82 60 M70 66 L82 68"/></g>${blush}`;
  if (kind === "fox") s = `<path d="M24 46 L26 14 L46 36 Z M76 46 L74 14 L54 36 Z" fill="#FB923C"/><path d="M28 38 L29 22 L39 33 Z M72 38 L71 22 L61 33 Z" fill="#1C1820"/><path d="M22 52 C22 36 78 36 78 52 C78 66 62 82 50 84 C38 82 22 66 22 52 Z" fill="#FB923C"/><path d="M24 56 C32 58 42 66 50 84 C38 82 26 70 24 56 Z M76 56 C68 58 58 66 50 84 C62 82 74 70 76 56 Z" fill="#FFF7ED"/>${dot(40, 56)}${dot(60, 56)}<ellipse cx="50" cy="72" rx="3.6" ry="2.6" fill="${INK}"/>`;
  if (kind === "panda") s = `<circle cx="30" cy="34" r="9" fill="#1C1820"/><circle cx="70" cy="34" r="9" fill="#1C1820"/><ellipse cx="50" cy="58" rx="28" ry="26" fill="#F5F0EB"/><ellipse cx="39" cy="56" rx="7" ry="8.5" fill="#1C1820" transform="rotate(-20 39 56)"/><ellipse cx="61" cy="56" rx="7" ry="8.5" fill="#1C1820" transform="rotate(20 61 56)"/><circle cx="40" cy="56" r="2.6" fill="#fff"/><circle cx="60" cy="56" r="2.6" fill="#fff"/><ellipse cx="50" cy="65" rx="3.6" ry="2.6" fill="${INK}"/>${smileAt(70)}${blush}`;
  if (kind === "owl") s = `<path d="M26 34 L32 22 L40 32 Z M74 34 L68 22 L60 32 Z" fill="#92400E"/><ellipse cx="50" cy="60" rx="27" ry="28" fill="#B45309"/><ellipse cx="50" cy="72" rx="15" ry="14" fill="#FDE68A" opacity=".6"/><circle cx="40" cy="52" r="10" fill="#FEF3C7"/><circle cx="60" cy="52" r="10" fill="#FEF3C7"/>${dot(40, 52, 4)}${dot(60, 52, 4)}<path d="M46 60 L54 60 L50 67 Z" fill="#F59E0B"/>`;
  if (kind === "bunny") s = `<ellipse cx="38" cy="22" rx="7" ry="20" fill="${c}"/><ellipse cx="62" cy="22" rx="7" ry="20" fill="${c}"/><ellipse cx="38" cy="24" rx="3.4" ry="14" fill="#F9A8D4"/><ellipse cx="62" cy="24" rx="3.4" ry="14" fill="#F9A8D4"/><ellipse cx="50" cy="62" rx="26" ry="24" fill="${c}"/>${dot(41, 60)}${dot(59, 60)}<path d="M48 66 L52 66 L50 68.5 Z" fill="#F472B6"/>${smileAt(70)}${blush}`;
  if (kind === "bear") s = `<circle cx="29" cy="36" r="10" fill="#92400E"/><circle cx="71" cy="36" r="10" fill="#92400E"/><circle cx="29" cy="36" r="5" fill="#FBBF24" opacity=".5"/><circle cx="71" cy="36" r="5" fill="#FBBF24" opacity=".5"/><ellipse cx="50" cy="58" rx="27" ry="26" fill="#A16207"/><ellipse cx="50" cy="68" rx="11" ry="8" fill="#FDE68A"/>${dot(40, 54)}${dot(60, 54)}<ellipse cx="50" cy="65" rx="3.6" ry="2.6" fill="${INK}"/>${smileAt(70)}`;
  if (kind === "penguin") s = `<ellipse cx="50" cy="60" rx="29" ry="32" fill="#1F2937"/><path d="M50 47 C63 47 68 58 66 70 C62 81 38 81 34 70 C32 58 37 47 50 47 Z" fill="#F5F0EB"/><path d="M27 58 C22 66 22 76 26 82 L30 70 Z M73 58 C78 66 78 76 74 82 L70 70 Z" fill="#111827"/>${dot(42, 58)}${dot(58, 58)}<path d="M45 64 L55 64 L50 70 Z" fill="#F59E0B"/>${blush}`;
  if (kind === "frog") s = `<circle cx="36" cy="38" r="11" fill="#4ADE80"/><circle cx="64" cy="38" r="11" fill="#4ADE80"/><ellipse cx="50" cy="62" rx="30" ry="22" fill="#4ADE80"/><circle cx="36" cy="38" r="6.5" fill="#fff"/><circle cx="64" cy="38" r="6.5" fill="#fff"/>${dot(36, 39, 3.4)}${dot(64, 39, 3.4)}<path d="M38 66 Q50 74 62 66" stroke="${INK}" stroke-width="2.2" fill="none" stroke-linecap="round"/>${blush}`;
  return wrap(r, id, s);
}


const DRAW: Record<AvatarStyle, (seed: number) => string> = { critter, celestial, face, hero, anime, shades, animal };

/** The avatar as an SVG document (100×100 viewBox). */
export function avatarSvg(style: AvatarStyle, seed: number): string {
  return DRAW[style](seed >>> 0);
}
