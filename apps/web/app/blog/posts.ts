/**
 * Static blog post data.
 *
 * Each post has a slug used in /blog/[slug] routes and a list of paragraph
 * blocks rendered by the article page. Keeping this as a typed module
 * eliminates the need for a CMS while still giving us strong typing at the
 * page layer.
 */

export type BlogParagraph = {
  type: "p";
  text: string;
};

export type BlogHeading = {
  type: "h2";
  text: string;
};

export type BlogList = {
  type: "ul";
  items: string[];
};

export type BlogBlock = BlogParagraph | BlogHeading | BlogList;

export type BlogPost = {
  slug: string;
  title: string;
  category: string;
  /**
   * Keyword passed to the wallpapers API at render time. The blog pages pick
   * the top matching wallpaper from our own platform to use as the card visual,
   * so every article is illustrated by real content from the gallery — not
   * stock imagery.
   */
  searchQuery: string;
  /**
   * CSS gradient used only as a fallback when the API is unreachable or
   * returns no matches. Never displayed when a real wallpaper is available.
   */
  gradient: string;
  readTime: string;
  date: string;
  excerpt: string;
  content: BlogBlock[];
};

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "best-dark-wallpapers-oled-screens",
    title: "Best Dark Wallpapers for OLED Screens in 2025",
    category: "Guides",
    searchQuery: "dark",
    gradient: "linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%)",
    readTime: "5 min read",
    date: "May 2025",
    excerpt:
      "OLED screens can display true black, making dark wallpapers look stunning. Here’s how to choose the perfect one — and why it matters for battery life too.",
    content: [
      {
        type: "p",
        text: "If you own a phone or monitor with an OLED display, your screen has a superpower that LCDs simply cannot replicate: when a pixel needs to show black, it physically turns off. There is no backlight bleeding through, no gray haze where there should be void — just pure, infinite, light-swallowing black. This is why a great dark wallpaper on an OLED feels almost three-dimensional, like a window cut into the device itself. It is also why choosing the right one matters more than it does on any other display.",
      },
      {
        type: "h2",
        text: "Why OLED Loves True Black",
      },
      {
        type: "p",
        text: "Because OLED pixels generate their own light, every pixel showing pure #000000 draws zero power. A wallpaper that is mostly black isn’t just an aesthetic choice — it is a measurable battery upgrade. Independent testing has consistently shown 5–15% all-day battery improvements on flagship phones when switching from a bright wallpaper to a properly dark one. Combine that with a dark system theme and you reclaim meaningful screen time without a single hardware change.",
      },
      {
        type: "h2",
        text: "What to Look For",
      },
      {
        type: "p",
        text: "Not every dark image is a good OLED wallpaper. A photo of a dim alleyway might look black on a laptop screen but reveal itself as a wash of dark gray when displayed on an OLED — and gray pixels are still on, still drawing power. The cleanest OLED wallpapers use deliberate negative space: a small luminous subject (a moon, a single character, a distant city skyline) surrounded by uncompromising black. Look for backgrounds at or near pure #000000, high subject contrast, and minimal noise. Compressed JPEGs often introduce gray dithering in dark areas, so prefer PNG or high-bitrate sources where you can.",
      },
      {
        type: "h2",
        text: "Best Categories on Aurora for OLED",
      },
      {
        type: "p",
        text: "A few of the categories on Aurora consistently produce excellent OLED material. Dark & Moody is the most obvious — atmospheric photography with crushed shadows works perfectly. Space and astrophotography is another natural fit, with stars and nebulae sitting on a true-black void. Abstract dark wallpapers (geometric forms, monochrome gradients fading into black) tend to be the most efficient battery-wise because the dark regions are often pure rather than dim. Anime stills with night scenes are also surprisingly good if you check the actual black levels.",
      },
      {
        type: "h2",
        text: "Avoiding OLED Burn-In",
      },
      {
        type: "p",
        text: "OLED burn-in is real but largely preventable. Static elements like a centered logo, a status bar, or a clock burned into the same pixels for hours, every day, over years, are what cause permanent image retention. To minimize the risk: enable auto-brightness so peak brightness only happens when needed, use the system’s built-in screen savers, and rotate your wallpaper occasionally. Pick wallpapers that don’t place high-contrast static subjects in the same screen location for months on end. A simple monthly rotation keeps your panel healthy and your home screen feeling new.",
      },
    ],
  },
  {
    slug: "how-to-change-wallpaper-android-ios",
    title: "How to Change Your Wallpaper on Android & iOS (Complete Guide)",
    category: "How-To",
    searchQuery: "abstract",
    gradient: "linear-gradient(135deg, #1e3a5f 0%, #2d6a9f 50%, #5fb6d4 100%)",
    readTime: "4 min read",
    date: "May 2025",
    excerpt:
      "A step-by-step guide to setting wallpapers on every major device — phone, tablet, and desktop. No guesswork, no buried menus.",
    content: [
      {
        type: "p",
        text: "Setting a wallpaper sounds trivial until you realize every operating system has buried it behind a slightly different set of menus, with naming that changes every release. This guide covers the exact path on every major platform — phone, tablet, laptop — and a few tips that make the difference between a wallpaper that looks great and one that gets awkwardly cropped or stretched.",
      },
      {
        type: "h2",
        text: "Android 14+",
      },
      {
        type: "p",
        text: "On stock Android (Pixel and most clean Android builds), open Settings, scroll to Wallpaper & style, and tap Change wallpaper. Pick a source — your photo library, Aurora downloads in your gallery, or one of the built-in collections. You’ll then see a preview with two toggles at the bottom: Home screen and Lock screen. You can apply the same wallpaper to both, or pick a different one for each. Tap the checkmark to confirm. Android 14 also supports cinematic wallpaper effects and themed icons that adapt to your wallpaper’s dominant color.",
      },
      {
        type: "h2",
        text: "Samsung One UI",
      },
      {
        type: "p",
        text: "Samsung’s One UI takes a different path. Long-press an empty area on your home screen, tap Wallpaper and style at the bottom, then choose Change wallpapers. Pick from Gallery, Color palette, or a Samsung collection. Before applying, you’ll see Lock screen and Home screen previews — tap each to crop independently. If you want the wallpaper to extend across all your home screen panels rather than scrolling with them, look for the Move wallpaper with swipes toggle and turn it off for a fixed background.",
      },
      {
        type: "h2",
        text: "iOS 17+",
      },
      {
        type: "p",
        text: "On iPhone, go to Settings → Wallpaper → Add New Wallpaper. iOS will present a picker that includes Photos, dynamic options, and Apple’s built-in collections. After choosing your image, you can pinch to zoom and reposition the subject. Tap Add when you’re done. iOS will ask whether to use the wallpaper as a Wallpaper Pair (both Home and Lock screens) or to customize the home screen separately. The Depth Effect — where the foreground subject overlaps the clock on the lock screen — only activates on portrait photos where iOS can detect a clear subject, and it’s often the deciding factor for which wallpaper looks best on lock.",
      },
      {
        type: "h2",
        text: "macOS",
      },
      {
        type: "p",
        text: "On modern macOS (Sonoma and later), open System Settings → Wallpaper. You can pick from Apple’s aerials, photo screensavers, or your own collection. Click Add Folder under the Photos section to point macOS at a local folder of wallpapers (such as your Aurora downloads) and have it cycle through them automatically. macOS handles multi-monitor setups gracefully — you can drag a different wallpaper onto each monitor preview at the top of the settings panel.",
      },
      {
        type: "h2",
        text: "Windows 11",
      },
      {
        type: "p",
        text: "On Windows 11, open Settings → Personalization → Background. Set Personalize your background to Picture for a single image, or Slideshow to cycle through a folder. Under Choose a fit, Fill is almost always the right answer for wallpapers downloaded at your monitor’s native resolution — it preserves aspect ratio without stretching. Avoid Stretch unless you want your wallpapers to look squished. If you’re running multiple monitors, right-click any wallpaper in the picker for a Set for monitor option.",
      },
      {
        type: "h2",
        text: "A Few Tips",
      },
      {
        type: "p",
        text: "Always download a wallpaper that matches or exceeds your screen’s native resolution — never upscale. On iOS, disable the parallax effect (Settings → Accessibility → Motion → Reduce Motion) if you’re tired of your wallpaper subtly drifting as you tilt the phone. And consider keeping your lock screen and home screen wallpapers different: a busy, detailed image works on the lock screen where you’ll see it for two seconds, while a quieter image is friendlier on the home screen where it lives behind your apps all day.",
      },
    ],
  },
  {
    slug: "top-anime-wallpapers-2025",
    title: "Top Anime Wallpaper Trends in 2025",
    category: "Trends",
    searchQuery: "anime",
    gradient: "linear-gradient(135deg, #3d1e6d 0%, #8b3a8c 50%, #ff6b9d 100%)",
    readTime: "6 min read",
    date: "April 2025",
    excerpt:
      "From cinematic stills to fan art masterpieces — here are the anime wallpaper styles dominating screens this year, and where they’re coming from.",
    content: [
      {
        type: "p",
        text: "Anime wallpapers have always been one of the most active categories on Aurora and across the web, but the aesthetic has shifted noticeably in the last twelve months. The clipped action shots and high-energy character portraits that dominated for years are giving ground to something quieter, more cinematic, and visibly influenced by the painterly tradition that anime films like to indulge in. Here’s what’s defining 2025.",
      },
      {
        type: "h2",
        text: "Landscape and Scenic Stills Are Eating Everything",
      },
      {
        type: "p",
        text: "The biggest shift this year is the rise of empty-stage scenic wallpapers — sweeping rural landscapes, dimly lit train stations, summer cicadas at dusk, snow falling on a wooden engawa. Studio Ghibli set this template decades ago, but the surge in 2025 comes from how many newer productions are explicitly composing static frames that work as standalone art. Fans pause, screenshot at native resolution, and post upscaled crops within hours of an episode airing. The result is a flood of wallpapers that feel less like character merchandise and more like a still from a film.",
      },
      {
        type: "h2",
        text: "The Aesthetic Subcategories Driving Demand",
      },
      {
        type: "p",
        text: "Three sub-aesthetics dominate the conversation right now. Dark fantasy — moody, low-saturation, lots of black and deep red — pulls from the long tradition of grimdark seinen and continues to power some of the most-requested categories. Isekai-style imagery — wide vistas, soft pastels, a lone figure looking out over an impossibly beautiful world — has matured from a meme into a legitimate visual language. And slice-of-life aesthetics — warm summer afternoons, classroom windows, convenience stores at 2 a.m. — have become the de facto default for anyone who wants their phone to feel calm rather than aggressive.",
      },
      {
        type: "h2",
        text: "Art Styles That Are Trending",
      },
      {
        type: "p",
        text: "On the technique side, painterly fan art continues to gain ground over clean cel-shaded portraits. The reason is partly tooling — Procreate, Krita, and Photoshop brush packs have made high-quality painted finishes accessible to amateur artists — and partly fatigue with the flat anime look that dominated the 2010s. At the same time, minimalist anime wallpapers (single character on a flat color background, sometimes with a single line of text) have carved out their own niche, especially for users who want personality without visual clutter.",
      },
      {
        type: "h2",
        text: "Finding High-Resolution Versions",
      },
      {
        type: "p",
        text: "The biggest mistake new anime wallpaper collectors make is using upscaled or compressed sources. A 720p screencap blown up to fill a 4K monitor looks soft and noisy. When you find a wallpaper you like, check that it’s at least 1920×1080 for a laptop, 2560×1440 for a desktop monitor, and 1170×2532 (or equivalent) for a modern phone. Aurora flags every wallpaper with its native resolution on the detail page, so you can spot the bad ones before they hit your screen.",
      },
      {
        type: "h2",
        text: "Phone vs Desktop Aspect Ratios",
      },
      {
        type: "p",
        text: "Most anime art is created in landscape or square aspect ratios, which makes it tricky to use on a portrait phone screen. A 16:9 cinematic still cropped to 9:19.5 (modern phone) loses two-thirds of the frame. When picking a wallpaper for a phone, look for compositions where the subject is centered vertically or where a tall slice of the image still tells the full story. Aurora’s mobile filter does this automatically — only showing wallpapers that work in portrait — but if you’re browsing the full gallery, it’s worth previewing the crop before downloading.",
      },
    ],
  },
  {
    slug: "what-makes-a-great-wallpaper",
    title: "What Makes a Great Wallpaper? A Designer’s Perspective",
    category: "Design",
    searchQuery: "gradient",
    gradient: "linear-gradient(135deg, #b8860b 0%, #d4a76a 50%, #f4e4c1 100%)",
    readTime: "5 min read",
    date: "April 2025",
    excerpt:
      "Not every beautiful image works as a wallpaper. Here’s what separates a great wallpaper from a great photo — and why some images that look amazing on Instagram fall flat on your home screen.",
    content: [
      {
        type: "p",
        text: "There’s a strange thing that happens when a stunning photograph becomes someone’s desktop or phone background: half the time, it doesn’t work. The colors clash with the operating system’s icons. The focal point sits exactly where the dock will be. The subject competes with the time display. A wallpaper isn’t just a great image — it’s a great image designed (or selected) to live behind a layer of interface. Here’s what makes one work.",
      },
      {
        type: "h2",
        text: "Composition: Mind the Interface",
      },
      {
        type: "p",
        text: "Every screen has fixed real estate that a wallpaper has to negotiate with. On a phone: the clock and weather widget at the top, the dock at the bottom, sometimes a row of widgets in the middle. On a laptop: the menu bar, the dock or taskbar, and a scatter of icons. A great wallpaper is composed so that its subject doesn’t collide with those zones. The rule of thirds is your best friend here — place the focal point on a third intersection that doesn’t overlap a system element and the wallpaper instantly feels designed rather than borrowed.",
      },
      {
        type: "h2",
        text: "Color Harmony With Your OS",
      },
      {
        type: "p",
        text: "Modern operating systems apply subtle tints to interface elements — folder backgrounds, control center pills, notification bubbles — based on the dominant color of your wallpaper. A wallpaper with chaotic color (lots of competing hues, full saturation everywhere) creates an OS UI that looks muddled. A wallpaper with two or three dominant colors and clear hierarchy gives the system something coherent to work with. Aurora exposes each wallpaper’s palette on the detail page; use it to spot images that will play nicely with the rest of your setup.",
      },
      {
        type: "h2",
        text: "Resolution Is Non-Negotiable",
      },
      {
        type: "p",
        text: "Never, ever stretch a wallpaper. A 1080p image stretched to fill a 4K monitor produces visible blur, fuzzy text, and softened edges that make the whole screen feel cheap. The rule is simple: download a file that matches or exceeds your screen’s native resolution. If you’re on a Retina or HiDPI display, you actually want 2x the logical resolution — a MacBook Pro 14’s 3024×1964 screen wants a wallpaper at that exact pixel count or higher. Aurora always shows the native dimensions and offers device-specific delivery so you don’t have to guess.",
      },
      {
        type: "h2",
        text: "Busy vs Minimal — Pick the Right One",
      },
      {
        type: "p",
        text: "Busy wallpapers (dense forests, painted cityscapes, intricate illustrations) reward you when you actually look at them — but they also make app icons harder to find and create constant visual noise behind your work. Minimal wallpapers (gradients, single subjects, plenty of negative space) recede into the background but can feel sterile if your taste runs to maximalist. Most people end up running busy on the lock screen (where you see it briefly, framed) and minimal on the home screen (where it competes with apps all day). That split is a small win that takes thirty seconds to set up.",
      },
      {
        type: "h2",
        text: "Aspect Ratios at a Glance",
      },
      {
        type: "ul",
        items: [
          "Modern phones: 9:19.5 or 9:20 portrait (e.g. 1170×2532, 1320×2868).",
          "Tablets: 4:3 or 3:4 — varies significantly by model.",
          "Laptops: 16:10 is taking over from 16:9 (1920×1200, 2560×1600).",
          "Standard desktop monitors: 16:9 (1920×1080, 2560×1440, 3840×2160).",
          "Ultrawide: 21:9 (3440×1440) or 32:9 (5120×1440) — these need wallpapers explicitly composed for the format.",
        ],
      },
      {
        type: "h2",
        text: "Color Temperature and Eye Fatigue",
      },
      {
        type: "p",
        text: "Wallpapers with extremely bright, saturated colors (especially blues) can subtly increase eye strain over an 8-hour workday. Warmer, less saturated images are easier on the eyes for long sessions. This is one of the reasons sunset and golden-hour photography is so popular as desktop material — those amber and rose tones biologically read as relaxing. Save the high-saturation cyberpunk neon for the lock screen and let your work-from-home wallpaper run quieter.",
      },
      {
        type: "h2",
        text: "Seasonal Rotation",
      },
      {
        type: "p",
        text: "One last designer trick: rotate your wallpaper with the season. Cool blues and crisp whites in winter, warm greens and golden tones in summer, autumnal palettes in fall. It’s a small ritual that costs nothing, prevents wallpaper fatigue, and keeps the screen feeling alive. Aurora’s curated seasonal collections exist exactly for this — four new sets every year, each tuned to the time of year you’ll actually use them.",
      },
    ],
  },
  {
    slug: "minimal-wallpapers-why-less-is-more",
    title: "Minimal Wallpapers: Why Less Is Always More",
    category: "Design",
    searchQuery: "minimal",
    gradient: "linear-gradient(135deg, #f5f0eb 0%, #c0c0c0 50%, #6e6e6e 100%)",
    readTime: "4 min read",
    date: "March 2025",
    excerpt:
      "The case for stripping your screen down to its beautiful essentials — and the design science behind why minimal setups feel calmer.",
    content: [
      {
        type: "p",
        text: "Spend a week scrolling through wallpaper communities and you’ll see a clear split: half the screenshots are dense, maximalist setups with every pixel earning its keep, and the other half are barely-there minimal compositions — a single gradient, an off-center sphere, a horizon line. Both have their fans, but for daily-use wallpapers, the minimal camp has science on its side.",
      },
      {
        type: "h2",
        text: "The Psychology of Visual Clutter",
      },
      {
        type: "p",
        text: "Cognitive load research is consistent on one point: every visual element in your field of view takes a small slice of attention, whether you notice or not. A wallpaper packed with detail — a dense cityscape, a painting full of faces, a layered illustration — keeps your visual system busy even when you’re trying to read your inbox. Strip that down to a single subject or a clean gradient and the background literally becomes background. Your brain stops parsing it, and focus on the foreground (your work) gets easier.",
      },
      {
        type: "h2",
        text: "How Minimal Wallpapers Improve Productivity",
      },
      {
        type: "p",
        text: "This isn’t self-help — it’s measurable. People working with cluttered backgrounds switch focus more often, take longer to return to a task after an interruption, and report higher subjective fatigue at the end of the day. Wallpapers are only one small input, but they’re a constant one. A minimal home screen wallpaper is a low-effort productivity intervention that costs nothing and lasts as long as you keep it.",
      },
      {
        type: "h2",
        text: "Design Principles That Make Minimal Work",
      },
      {
        type: "p",
        text: "Great minimal wallpapers aren’t just lazy minimalism. There are real design principles holding them together: generous negative space, a strong single focal point (often off-center using the rule of thirds), a tight color palette (usually monochromatic or analogous), and clean compositions where every element earns its place. Bad minimal wallpapers feel empty; good ones feel intentional — they pull the eye somewhere specific and then let you go.",
      },
      {
        type: "h2",
        text: "The Best Minimal Categories on Aurora",
      },
      {
        type: "ul",
        items: [
          "Gradients — pure color transitions, mesh gradients, sunset palettes.",
          "Single-subject compositions — one object, one creature, one shape on a clean field.",
          "Geometric — simple forms, monochromatic studies, vector-based compositions.",
          "Atmospheric photography — fog, dawn light, single horizon lines.",
          "Negative-space typography — a single word or character treated as art.",
        ],
      },
      {
        type: "h2",
        text: "Pairing With Minimal Icon Packs",
      },
      {
        type: "p",
        text: "A minimal wallpaper does its best work when the rest of your setup matches. On Android, pair with a monochromatic icon pack and themed-icons enabled. On iOS, use Shortcut-based custom icons or one of the system tinting modes. On macOS, hide the dock and switch to a light or dark mode that complements your wallpaper’s temperature. The wallpaper is one ingredient — the calm comes from the whole composition.",
      },
      {
        type: "h2",
        text: "Recommended Color Palettes",
      },
      {
        type: "p",
        text: "If you’re starting from scratch, three palettes never disappoint. Off-white into warm gray creates a paper-like calm that works in every season. Deep navy into pure black gives you a dark mode wallpaper that doubles as an OLED battery saver. Soft pastel — pale rose into peach into cream — is unusually flattering on OS UI elements because nothing competes with the system’s accent color. Pick one, try it for two weeks, and notice how often you stop noticing it. That’s the point.",
      },
    ],
  },
  {
    slug: "4k-wallpapers-guide",
    title: "4K Wallpapers Explained: Do You Actually Need Them?",
    category: "Guides",
    searchQuery: "landscape",
    gradient: "linear-gradient(135deg, #1a1a40 0%, #2c5f9e 50%, #5eb3e8 100%)",
    readTime: "5 min read",
    date: "March 2025",
    excerpt:
      "4K sounds impressive, but does your screen actually benefit? We break down what resolution really means for wallpapers — and when it’s pure marketing.",
    content: [
      {
        type: "p",
        text: "Every wallpaper site loves the word ‘4K.’ It signals quality, it sells. But strip away the marketing and the question worth asking is more practical: does the screen you’re actually using benefit from a 4K wallpaper, or are you just downloading bigger files for the same visual result? The honest answer depends entirely on your display.",
      },
      {
        type: "h2",
        text: "What 4K Actually Means",
      },
      {
        type: "p",
        text: "‘4K’ in consumer language refers to a resolution of 3840×2160 pixels — also called UHD. The ‘4’ comes from roughly 4,000 horizontal pixels. That’s exactly four times the pixel count of standard 1080p (1920×1080), which is why 4K files are roughly four times the size of their 1080p equivalents. The format originated in cinema (where ‘true’ 4K is 4096×2160) and bled into consumer displays around 2014.",
      },
      {
        type: "h2",
        text: "When 4K Wallpapers Matter",
      },
      {
        type: "p",
        text: "4K wallpapers genuinely matter on three types of displays. First, native 4K monitors and TVs — anything from a 27-inch 4K desktop monitor up. At that pixel density, a 1080p wallpaper has to be upscaled by the GPU, and the upscaling is visible. Second, HiDPI and Retina laptops. A 14-inch MacBook Pro has a 3024×1964 panel, and modern Windows laptops with 3K or 4K screens are increasingly common. These devices render in logical pixels but draw with the full pixel grid, so a higher-resolution source produces visibly sharper output. Third, ultrawide and dual-monitor setups, where a wallpaper might need to span 5120 pixels across.",
      },
      {
        type: "h2",
        text: "When 4K Doesn’t Matter",
      },
      {
        type: "p",
        text: "Modern phones almost never benefit from 4K wallpapers. Yes, a flagship phone’s OLED panel might have 2796×1290 logical pixels, but it’s a small screen viewed from 12 inches away. The visible difference between a well-compressed 1440p wallpaper and a 4K one is essentially zero. The 4K file just eats more storage, takes longer to download, and demands more decoding work every time the device wakes. Older 1080p laptops, classroom projectors, and non-Retina displays are also in this camp — anything below ~150 PPI gains nothing from 4K source material.",
      },
      {
        type: "h2",
        text: "File Size Tradeoffs",
      },
      {
        type: "p",
        text: "A well-compressed 1080p wallpaper is typically 300–800 KB. A 4K wallpaper is usually 4–12 MB. That’s a real difference when you’re on cellular data or working with limited device storage. If your screen actually shows the extra detail, the storage hit is worth it. If it doesn’t, you’re paying for resolution you can’t see.",
      },
      {
        type: "h2",
        text: "How Aurora Serves the Right Size",
      },
      {
        type: "p",
        text: "Aurora delivers wallpapers in adaptive sizes. When you preview an image, the page serves a compressed version sized to your viewport — never the full file. The Download button on each wallpaper page offers the native resolution, and on mobile we automatically deliver a phone-optimized crop that’s already sized for portrait screens. You get the right file for the device, every time, without ever having to think about resolution math.",
      },
      {
        type: "h2",
        text: "4K Photos vs Upscaled 4K",
      },
      {
        type: "p",
        text: "Not all ‘4K’ files are equal. A photograph shot on a 24-megapixel camera and exported at 3840×2160 is genuinely 4K — every pixel carries real information. A 1080p file run through an AI upscaler to 3840×2160 is 4K by file dimensions but visibly soft, often with characteristic upscaling artifacts in fine detail. Aurora flags upscaled content during review and rejects it from the curated gallery. When you download something marked native 4K on Aurora, it’s real.",
      },
      {
        type: "h2",
        text: "How to Check Your Display’s Native Resolution",
      },
      {
        type: "ul",
        items: [
          "macOS: Apple menu → About This Mac → Displays.",
          "Windows 11: Settings → System → Display → Display resolution.",
          "iOS: Settings → Display & Brightness → check device model; cross-reference with Apple’s spec page.",
          "Android: Settings → Display → Screen resolution (where available) or use a free identifier app.",
          "Linux: run xrandr in a terminal — your active monitor’s mode is listed first.",
        ],
      },
      {
        type: "p",
        text: "Match your wallpaper resolution to that native value (or one notch above on HiDPI displays) and you’ll have a screen that looks exactly as the artist intended — no upscaling blur, no wasted bytes.",
      },
    ],
  },
];

export function getPostBySlug(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}

export function getRelatedPosts(slug: string, count = 3): BlogPost[] {
  return BLOG_POSTS.filter((p) => p.slug !== slug).slice(0, count);
}

import { getWallpapers } from "@/lib/api";
import type { Wallpaper } from "@aura/types";

/**
 * Pick a single representative wallpaper from the platform for a given post.
 * Used as the card / hero visual on blog pages so every article is
 * illustrated by real content from the gallery instead of placeholder art.
 *
 * Returns null on any API failure — the caller falls back to the gradient.
 */
export async function getWallpaperForPost(
  post: BlogPost
): Promise<Wallpaper | null> {
  try {
    const { data } = await getWallpapers({ q: post.searchQuery, limit: 1 });
    return data[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Resolve wallpapers for many posts in parallel, preserving order.
 * Each entry is independently fault-tolerant: one failed lookup never
 * blocks the others.
 */
export async function getWallpapersForPosts(
  posts: BlogPost[]
): Promise<Array<Wallpaper | null>> {
  return Promise.all(posts.map(getWallpaperForPost));
}
