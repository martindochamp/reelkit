// The SUBTITLE STYLE's resolution, in plain JS so both sides can run it: the
// band draws with it (src/Reel.tsx) and the renderer PAGINATES with it
// (scripts/render-reel.mjs) before a frame exists. Same arrangement as
// tier-fit.mjs, field.mjs and footage.mjs, and here it is not optional —
// `maxWords`/`maxChars` decide how a sentence is cut into pages, and that
// happens in Node at staging. A preset that changed the look but not the
// pagination would be a preset that lies.
//
// WHY `subtitles` AND NOT `captions`. `theme.captions` already exists and is
// the PROJECT's default look; `reel.captions` is already the MODE string.
// Renaming either would move the floor under every post that has one. So the
// new key is `subtitles`, it carries the mode inside it, and the theme stays
// the base every preset is merged onto — a project that themed its captions
// keeps exactly what it had until a post asks for something else.
//
// A PRESET IS A CLASS. Same contract as the ground and the footage box: it
// sets some keys, any key beside it wins.

/**
 * @typedef {{
 *   preset?: string,
 *   mode?: "page"|"words"|"bump",
 *   fontFamily?: string,
 *   fontSize?: number, fontWeight?: number, letterSpacing?: string,
 *   textTransform?: "uppercase"|"none",
 *   plate?: boolean, background?: {color?: string, radius?: number, padding?: number|number[]},
 *   maxWords?: number, maxChars?: number,
 *   dim?: number, emphasisColor?: string,
 *   emphasis?: { color?: string, scale?: number, outline?: number }[],
 *   bandTop?: number, stroke?: number, strokeColor?: string, color?: string,
 *   saidWeight?: number, shadow?: string|object|object[]|null, ink?: string|object,
 *   floor?: number,
 * }} SubtitleSpec
 *
 * `align` was declared here and never drawn — the band is centred in
 * Reel.tsx and one reference's left-pinned growing line is the only thing
 * that ever wanted otherwise. A key a post can write that does nothing is
 * worse than an absent one, so it is gone rather than implemented.
 */

/**
 * THE caption face, and THE caption default — one copy, two consumers.
 *
 * This block existed twice: once in `src/theme.default.ts` (what a project
 * with no theme at all gets) and once as a wall of `??` fallbacks in
 * `scripts/bundle.mjs` (what a project that HAS a theme but has not named a
 * caption gets). On 2026-09-09 the measured look was promoted into the first
 * one and the second was left alone — so every real project, all of which
 * have a theme, silently kept the old receipt caption: 48 px, weight 400,
 * uppercase, tracked, in SF Mono. The look Martin measured and asked to make
 * the default reached exactly the projects that do not exist.
 *
 * MEASURED, not chosen (Martin, 2026-09-09: "les soustitres avec la police
 * espacements positions et autres est parfaite, ça devrait être celle de
 * défaut"). These are the values the casino reproduction ran on, and the
 * teardowns agree across references: no plate, heavy weight, mixed case,
 * tight tracking, one gold.
 */
export const CAPTION_FACE =
  '"Helvetica Neue", "Inter", "SF Pro Display", -apple-system, sans-serif';

export const CAPTION_DEFAULTS = {
  fontSize: 66,
  fontWeight: 700,
  letterSpacing: "-0.01em",
  textTransform: "none",
  plate: false,
  maxWords: 6,
  maxChars: 40,
  dim: 0.42,
  emphasisColor: "#F9EDA4",
};

/**
 * The bank.
 *
 * Every look here was measured on a reference, not invented — the two caption
 * SYSTEMS the teardowns found (dim-and-light, hand-picked accent) plus the
 * genre default. `docs/REFERENCES.md` is explicit that these are per-ACCOUNT
 * and not per-genre: the French reference lights words out of a dim line and
 * hand-picks a gold accent; Peterson, same genre, same gold uppercase over a
 * talking head, does none of that — one colour, whole cards, hard swap, no dim
 * state anywhere in 21 s sampled. A build that carried the first system over
 * as "how captions work here" was wrong on screen until a teardown corrected
 * it. So this bank is a menu, never a default.
 */
/**
 * The gold every measured reference in this genre lands on: RGB(250,231,160)
 * on chad-128-135, the same swatch as its frame border, and within a shade of
 * chad-48-55's (249,237,164) and chad-00-07's (247,238,146).
 */
const GOLD = "#FAE6A0";

/**
 * The rounded, casual letterform of the loud retention caption.
 *
 * PROVENANCE: this one is Martin's eye, not a teardown — "mr beast c'était un
 * peu comme du comic sans ms épais" (2026-09-10). It is recorded as an
 * observation because that is what it is, and it happens to agree with the
 * only letterform detail the measured references in this family keep
 * repeating: ad-2's "bold, ROUNDED-TERMINAL geometric sans", speechify-ad's
 * "bold, rounded/geometric sans-serif", the korean hook's "bold sans-serif,
 * ROUNDED terminals".
 *
 * Chalkboard SE leads by Martin's own pick off a five-face render (2026-09-10):
 * of the faces this machine has it is the one that IS "thick Comic Sans" —
 * round, squat, casual — where SF Pro Rounded reads modern and geometric and
 * Comic Sans itself has strokes too thin to look heavy at all.
 *
 * The cost of that choice, stated because it is real: Chalkboard SE ships
 * Regular and Bold and nothing above, so `LOUD`'s weight of 800 is
 * SYNTHESISED by the renderer rather than drawn. SF Pro Rounded is next in
 * the stack and does carry Heavy and Black, so a project that wants a real
 * 800 names it — `{ "preset": "beast", "fontFamily": "\"SF Pro Rounded\"" }`
 * — and one that has licensed the actual face names that instead, and this
 * stack never runs.
 */
export const ROUNDED =
  '"Chalkboard SE", "SF Pro Rounded", "SF Compact Rounded", ' +
  '"Arial Rounded MT Bold", "Comic Sans MS", ui-rounded, sans-serif';

/**
 * The loud caps body, shared by `hormozi`, `hormozi-outline` and `beast` —
 * so the three differ only where they differ, and none of them can drift a
 * font size away from the others by accident.
 */
const LOUD = {
  mode: "bump", fontSize: 96, fontWeight: 800, letterSpacing: "0.01em",
  textTransform: "uppercase", plate: false, dim: null,
  maxWords: 3, maxChars: 16,
};

/**
 * THE SEPARATION: a stroke, or a shadow, and they are two different devices.
 *
 * A stroke is a hard edge round the glyph — the platform caption, and what
 * the loud one needs at 8 px. A shadow is a soft one, and it is what every
 * other face wants: a thick stroke on a light or narrow letterform eats the
 * counters and the word stops being readable, which is the failure `beast`
 * avoids by being drawn in a face with room for it.
 *
 * Before this bank the shadow was TWO STRING LITERALS in Reel.tsx, chosen by
 * an `overArt` boolean, with no name and no way for a look to disagree. That
 * is what is being deleted here; `spread` is those literals, so nothing that
 * has not asked moves.
 *
 * A value is a name, `"none"`/`null`, a spec, or a list of specs. A spec is
 * `{x, y, blur, color}` in canvas px, and `color` absent means "the page's
 * own separation colour" — the paper over a flat page, black over pictures,
 * which is the only way one entry can work on both.
 */
export const SHADOW_PRESETS = {
  /** None. The words carry their own weight, or a stroke does. */
  none: [],

  /**
   * The engine's own, unchanged: a wide soft halo in the page's own colour
   * plus a tight one to close the gap at the glyph's edge. Not measured on
   * any reference — no reference in the teardowns has a caption shadow at
   * all — so it is reelkit's, and now it says so.
   */
  spread: [{ y: 2, blur: 18 }, { blur: 4 }],

  /**
   * The same over PICTURES, where the page's colour means nothing and the
   * halo has to be its own. The two alphas are the ones that shipped, kept
   * to the digit: the parity fixture asserts byte-identical frames against
   * Tally, and a photo beat's caption is one of the things it compares.
   */
  "spread-art": [
    { y: 2, blur: 18, color: "rgba(0,0,0,0.6)" },
    { blur: 4, color: "rgba(0,0,0,0.5)" },
  ],

  /**
   * Legibility over moving pictures, and the one to reach for instead of a
   * stroke on a face with thin strokes: a tight dark halo at zero offset, so
   * it reads as contact rather than as a drop.
   */
  contact: [{ blur: 7, color: "rgba(0,0,0,0.88)" }, { blur: 2, color: "rgba(0,0,0,0.92)" }],

  /** An offset drop. The one that reads as depth rather than as separation. */
  drop: [{ y: 6, blur: 10, color: "rgba(0,0,0,0.55)" }],

  /** Offset, no blur — the sticker. Hard edge, so it survives compression. */
  hard: [{ y: 8, blur: 0, color: "#0A0A0A" }],
};

/**
 * A shadow value → a CSS `text-shadow`.
 *
 * `"auto"` is the default and the only entry that looks at the ground: the
 * page's own colour over a flat beat, its own halo over pictures, which is
 * the two-branch behaviour that was hardcoded in Reel.tsx. Every other name
 * means exactly one thing on any ground.
 *
 * @param {string|object|object[]|null|undefined} v
 * @param {{paper: string, overArt: boolean}} ground
 */
export const resolveShadow = (v, ground) => {
  if (v === null || v === "none") return undefined;
  const name = v === undefined || v === "auto" ? (ground.overArt ? "spread-art" : "spread") : v;
  const list = typeof name === "string" ? SHADOW_PRESETS[name] : Array.isArray(name) ? name : [name];
  if (typeof name === "string" && !list) {
    throw new Error(
      `subtitles: no shadow "${name}". Have: ${Object.keys(SHADOW_PRESETS).join(", ")}`,
    );
  }
  if (!list.length) return undefined;
  return list
    .map((l) => `${l.x ?? 0}px ${l.y ?? 0}px ${l.blur ?? 0}px ${l.color ?? ground.paper}`)
    .join(", ");
};

/**
 * THE INKS: named colour sets for the band, so a look can say "this pair" and
 * not three hex codes.
 *
 * Three colours, and they are three ROLES rather than three decorations:
 * `fill` is the word, `stroke` is what separates it from anything behind it,
 * and `emphasis` is the accent a `*marked*` word takes. Every set here clears
 * a contrast floor against its own stroke — asserted in
 * `scripts/presets.test.mjs`, which refuses a set that does not, because "a
 * well-contrasted palette" is a measurement and not a claim.
 *
 * `paper` is the floor and the exception: it names no colour at all, so the
 * band keeps borrowing the page's ink the way it always has.
 */
export const CAPTION_INKS = {
  /** The floor and the exception: it names no colour, so the band borrows. */
  paper: {},

  /** White in black, no accent. The highest contrast available anywhere. */
  mono: { fill: "#FFFFFF", stroke: "#0A0A0A", emphasis: "#FFFFFF" },

  /** The loud yellow. Full chroma, which is the whole difference between
   *  this and the pale gold that reads as nothing beside a white fill. */
  punch: { fill: "#FFFFFF", stroke: "#0A0A0A", emphasis: "#FFE800" },

  /** Green, for a warm picture. The most distant accent from white here. */
  signal: { fill: "#FFFFFF", stroke: "#0A0A0A", emphasis: "#00E676" },

  /** Pink. The one that cannot be mistaken for the fill at any size. */
  hot: { fill: "#FFFFFF", stroke: "#0A0A0A", emphasis: "#FF2D8E" },

  /**
   * MEASURED, and exempt from the accent floors by being a reproduction:
   * Peterson's RGB(248,200,58) is the fill and there is no accent at all —
   * no white default state anywhere in 21 s sampled.
   */
  amber: { fill: "#F8C83A", stroke: "#14100A", emphasis: "#F8C83A" },

  /**
   * Ink on paper, for a light ground — the pair inverted, not the hue.
   *
   * The red is #C81E12 and not the brighter #D92B1F it started as: a light
   * stroke means the accent's contrast is measured against PAPER, where a
   * bright red scores 4.3:1 and misses the floor. Two shades down clears it
   * at 5.1 and loses nothing the eye can see. The floors caught that; the
   * eye would not have.
   */
  inverse: { fill: "#14140F", stroke: "#F2F1EC", emphasis: "#C81E12" },
};

/** An ink name or a set → the set. An unknown name is refused, not ignored. */
export const resolveInk = (v) => {
  if (v == null) return {};
  if (typeof v !== "string") return v;
  const set = CAPTION_INKS[v];
  if (!set) {
    throw new Error(
      `subtitles: no ink "${v}". Have: ${Object.keys(CAPTION_INKS).join(", ")}`,
    );
  }
  return set;
};

/**
 * OKLab, because WCAG alone was the wrong measurement and said so on screen.
 *
 * The first version of this bank judged an accent by its WCAG ratio against
 * the stroke. `#FAE6A0` scores 15.9:1 there — excellent — and Martin's answer
 * was that it is "loin d'être la définition du contraste", which is correct:
 * a pale tint of the fill can be as far from black as pure white is, and
 * still be invisible AS AN ACCENT because it looks like the fill.
 *
 * Two numbers say what WCAG cannot. `chroma` is saturation, so a washed-out
 * tint fails it outright (#FAE6A0 reads 0.091 against a vivid yellow's
 * 0.193). `deltaE` is perceptual distance, so an accent that does not look
 * DIFFERENT from the fill fails it (#FAE6A0 sits 0.118 from white; the same
 * yellow at full chroma sits 0.209).
 *
 * Yellow is the case that makes the pair necessary: it is intrinsically close
 * to white in lightness, so no luminance metric can tell a good one from a
 * bad one — only its chroma can.
 */
const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

const rgbOf = (hex) => {
  const h = hex.replace("#", "");
  const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255);
};

export const oklab = (hex) => {
  const [r, g, b] = rgbOf(hex).map(srgbToLinear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
};

/** Saturation. A pale tint reads low however bright it is. */
export const chroma = (hex) => {
  const { a, b } = oklab(hex);
  return Math.hypot(a, b);
};

/** Perceptual distance. "Do these two look like the same colour." */
export const deltaE = (x, y) => {
  const A = oklab(x);
  const B = oklab(y);
  return Math.hypot(A.L - B.L, A.a - B.a, A.b - B.b);
};

/**
 * The floors the ink bank is held to, and the reason each exists.
 * `scripts/presets.test.mjs` refuses a set that misses one.
 */
export const INK_FLOORS = {
  /** Legibility of the fill against its own stroke. WCAG AAA. */
  fillContrast: 7,
  /** Same for the accent. WCAG AA — an accent is a word, not a paragraph. */
  accentContrast: 4.5,
  /** Saturation, so an accent is a colour and not a tint. */
  accentChroma: 0.15,
  /** Distance from the fill, so the accent is visibly a different ink. */
  accentDistance: 0.2,
};

/**
 * WCAG relative luminance, and the contrast ratio between two hex colours.
 * Kept because legibility against the stroke IS a luminance question — it is
 * the accent's vividness that is not.
 */
export const luminance = (hex) => {
  const h = hex.replace("#", "");
  const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255);
  const f = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

export const contrast = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

/**
 * The band's own box: a colour, a radius, and the padding between the two.
 *
 * `plate: true` is the same thing said the old way and still works — it is
 * the receipt plate, in the page's own paper, square-cornered, at the padding
 * that shipped. A `background` written beside it wins. Returns `null` for a
 * band that paints nothing, which is what every measured reference but two
 * does.
 *
 * @param {{plate?: boolean, background?: object}} style
 * @param {string} paper the page's own colour, for `plate`
 */
export const resolveBackground = (style, paper) => {
  const bg = style.background ?? (style.plate ? { color: paper, radius: 0, padding: [20, 34] } : null);
  if (!bg) return null;
  const pad = bg.padding ?? [20, 34];
  const [py, px] = typeof pad === "number" ? [pad, pad] : [pad[0], pad[1] ?? pad[0]];
  return { color: bg.color ?? paper, radius: bg.radius ?? 0, py, px };
};

export const SAFE_DEFAULTS = { x: 84, bottom: 96 };

/**
 * SHRINK TO FIT, as a pure function of a measurement.
 *
 * The pagination caps (`maxWords`, `maxChars`) are the first defence and they
 * are proxies: a cap counts characters, and what overflows is a WIDTH. Three
 * long words at 96 px in a rounded face leave the safe box while passing a
 * 16-character cap comfortably.
 *
 * So the band measures itself and comes down until it fits, in steps, never
 * below `floor` of the named size. `measure(text, size)` is injected because
 * the only honest measurement is the one the renderer's own font stack makes
 * — Reel.tsx passes a canvas one. Returns the size to draw at, the lines it
 * wrapped into, and whether it gave up, so the caller can say so out loud
 * rather than clipping silently.
 *
 * @param {(string | {text: string, scale?: number})[]} words
 * @param {{fontSize:number, lineHeight?:number, floor?:number}} style
 * @param {{w:number, h:number}} box canvas px
 * @param {(text:string, size:number)=>number} measure
 */
export const fitToBox = (words, style, box, measure) => {
  const named = style.fontSize;
  const lh = style.lineHeight ?? 1.35;
  const floor = Math.max(8, Math.round(named * (style.floor ?? 0.66)));
  const items = words.map((w) => (typeof w === "string" ? { text: w, scale: 1 } : { text: w.text, scale: w.scale ?? 1 }));

  // Per WORD rather than per line, because an emphasised word is drawn at
  // `scale` em and a line measured as one string would miss it — the 1.5×
  // second level is exactly what overflows a 16-character cap.
  const wrap = (size) => {
    const space = measure(" ", size);
    const lines = [];
    let line = { w: 0, n: 0, scale: 1 };
    for (const it of items) {
      const wpx = measure(it.text, Math.round(size * it.scale));
      const next = line.n ? line.w + space + wpx : wpx;
      if (line.n && next > box.w) {
        lines.push(line);
        line = { w: wpx, n: 1, scale: it.scale };
      } else {
        line = { w: next, n: line.n + 1, scale: Math.max(line.scale, it.scale) };
      }
    }
    if (line.n) lines.push(line);
    return lines;
  };

  for (let size = named; size >= floor; size -= 2) {
    const lines = wrap(size);
    const widest = Math.max(...lines.map((l) => l.w), 0);
    const tall = lines.reduce((h, l) => h + size * l.scale * lh, 0);
    if (widest <= box.w && tall <= box.h) {
      return { fontSize: size, lines: lines.length, fits: true, shrunk: size < named };
    }
  }
  const lines = wrap(floor);
  return { fontSize: floor, lines: lines.length, fits: false, shrunk: true };
};

export const SUBTITLE_PRESETS = {
  /** Whatever the project themed. A name for the floor. */
  plain: {},

  /**
   * Dim-and-light. The whole line stands from the first frame at 0.42
   * brightness and each word snaps to full on its cue, in one frame. The line
   * never reflows, so the viewer can read ahead — which is the point.
   * Measured on the French reference.
   */
  karaoke: { mode: "words", dim: 0.42, plate: false, maxWords: 6, maxChars: 34 },

  /**
   * Hand-picked accent. Exactly two colours ever appear. The gold is not the
   * current word and not a fixed vocabulary — it follows the voice's stress,
   * so it is the writer's call. It PERSISTS once printed, same size, same
   * weight, colour only.
   */
  accent: {
    mode: "page", plate: false, emphasisColor: "#FAE6A0",
    emphasis: [{ color: "#FAE6A0" }],
  },

  /**
   * The genre default: big, heavy, upper, two or three words, no plate.
   *
   * `dim: null` is a CORRECTION, not a preference. The default carries the
   * French reference's 0.42, and in a word-arrival mode its mere presence
   * makes the whole page stand dim and light up — which is that one
   * reference's system and not this one's. Measured on chad-48-55: "No fade
   * was found at any reset — every word arrives at full opacity on its first
   * visible frame." Same for every preset below that arrives.
   */
  hormozi: { ...LOUD, shadow: "contact", emphasis: [{ color: GOLD }, { color: GOLD, scale: 1.5 }] },

  /** The same, with the hollow second level one reference actually uses. */
  "hormozi-outline": { ...LOUD, shadow: "contact", emphasis: [{ color: GOLD }, { color: GOLD, outline: 3 }] },

  /**
   * THE PLATFORM CAPTION: a solid white fill inside a hard black stroke,
   * sentence case, no plate, no shadow. What auto-captions look like, and
   * the only look in this bank with three independent measurements behind
   * it — ad-2 System A ("bold, rounded-terminal geometric sans, sentence
   * case... Outline: solid black, ≈3px... a true stroke, not a drop
   * shadow"), speechify-ad System A ("pure white fill with a thick black
   * outline, no background plate at all"), design-tips ("hard black outline
   * around white fill — a crisp stroke, not a blurred shadow").
   *
   * The numbers are those measurements at 1080: ad-2's 35 px cap and
   * design-tips' 39 px cap were read on a 720-wide canvas, so ×1.5, and a
   * bold grotesk's cap is about 0.72 em. Stroke 3 px @720 → 5 @1080.
   *
   * It could not be written before 2026-09-10: `stroke` was declared in the
   * spec and drawn by nothing, and `emphasis[].outline` is the opposite
   * construction — it hollows the glyph out and drops the fill.
   */
  outline: {
    mode: "page", plate: false, dim: null,
    fontSize: 72, fontWeight: 700, letterSpacing: "-0.01em", textTransform: "none",
    ink: "mono", stroke: 5, shadow: "none",
    maxWords: 4, maxChars: 26,
  },

  /**
   * The loud retention caption — MrBeast's, and every channel that copied it.
   *
   * PROVENANCE, because this bank's rule is that a look is measured and not
   * invented: **there is no MrBeast teardown in this repo.** So this preset
   * carries NO numbers of its own. It is `hormozi` — itself measured on the
   * chad reference, 45 px cap uppercase black geometric with a gold payoff
   * word at 2.6× — plus the stroke measured on the three references above.
   * That is the whole difference between the two looks on screen, and it is
   * written here as a spread so nobody has to trust a comment.
   *
   * If the real thing is wanted properly, tear one down: the construction to
   * check is the drop shadow UNDER the stroke (this has none, because none of
   * the measured references has one) and whether the emphasis colour changes
   * per word or per card.
   */
  beast: {
    ...LOUD,
    fontFamily: ROUNDED,
    // The stroke IS this look, so it carries no shadow: two separations on
    // one word is a muddy edge, and at this weight the stroke has already
    // done the job the shadow would be doing.
    //
    // 16 px, not the 8 it started at, and not the ~5 the three measured ads
    // use (Martin, 2026-09-11: "souvent c'est très très épais quand y'a de
    // la stroke"). Those ads are the sentence-case platform caption —
    // `outline` keeps their measurement. This is the loud one, and on a
    // rounded face at 96 px there is room for a stroke that reads from a
    // thumbnail.
    //
    // The accent is `punch`'s full-chroma yellow rather than the chad
    // reference's pale gold: this preset is not a reproduction of anything,
    // so nothing is falsified by making it vivid — and the pale gold beside
    // a white fill is what Martin called fade, correctly.
    ink: "punch", stroke: 16, shadow: "none",
    emphasis: [{ color: "#FFE800" }, { color: "#FFE800", scale: 1.5 }],
  },

  /**
   * Gold caps over a talking head, and nothing else — measured on the
   * Peterson reference and deliberately plainer than it looks.
   *
   * Every one of ~40 cards in 21 s is the SAME gold (RGB 248,200,58): no
   * white default state, no emphasis colour, no per-word dim, no fade, no
   * "currently spoken word goes heavy" — both words of a two-word card hold
   * identical weight for the whole hold, and cards swap as a hard cut. The
   * band sits at 75-78 % of the frame, under the video, and recentres to
   * ~48-51 % on a card with no video band; only the first is expressible.
   *
   * 36-37 px cap @720 → 55 @1080 → 76 px at a bold grotesk's 0.72 em.
   */
  peterson: {
    mode: "page", plate: false, dim: null,
    fontSize: 76, fontWeight: 800, letterSpacing: "0.01em",
    // "Shadow: none detected — the glyph-to-background transition is
    // symmetric on every edge checked, not offset down/right the way a cast
    // shadow would read." So: neither device. The gold carries itself.
    textTransform: "uppercase", ink: "amber", shadow: "none",
    maxWords: 4, maxChars: 22, bandTop: 0.76,
  },

  /**
   * A ROUNDED PLATE, and the only look here that uses one: a white chip with
   * black text inside it, no stroke, no shadow. The background axis —
   * colour, radius, padding — exists for this.
   *
   * Measured twice. speechify-ad System B: "a small, solid white rounded-rect
   * plate with plain black text, no outline/stroke, no drop shadow", ~46 px
   * tall on a 640-high canvas. The korean hook's boxes give the radius:
   * "≈15px at 720 width" → 22 at 1080. Both are the same device — the caption
   * takes the shape of a UI chip rather than floating over the picture.
   */
  chip: {
    mode: "page", dim: null, shadow: "none",
    fontSize: 52, fontWeight: 600, letterSpacing: "0em", textTransform: "none",
    ink: "inverse",
    background: { color: "#FFFFFF", radius: 22, padding: [16, 30] },
    maxWords: 5, maxChars: 30,
  },

  /**
   * A HEAVY CLASSY FACE WITH A SHADOW AND NO STROKE (Martin, 2026-09-11:
   * "certaines avec shadow ont des polices classes et épaisses").
   *
   * The other half of the stroke/shadow choice, and the reason the choice
   * exists: a grotesque this tight would lose its counters under 16 px of
   * stroke, so the separation is a `drop` instead. Mixed case, because the
   * face's own weight is the emphasis and shouting it in caps would be
   * saying the same thing twice.
   */
  editorial: {
    mode: "page", plate: false, dim: null,
    fontFamily: '"Avenir Next", "SF Pro Display", "Helvetica Neue", sans-serif',
    fontSize: 78, fontWeight: 800, letterSpacing: "-0.02em", textTransform: "none",
    ink: "punch", shadow: "drop",
    maxWords: 5, maxChars: 28,
  },

  /**
   * Impact, uppercase, very thick stroke — the condensed loud face, which is
   * on every machine and has exactly one weight because it does not need
   * another. Condensed means more characters fit the safe box at a size the
   * rounded faces cannot reach, so the cap is higher here.
   */
  impact: {
    mode: "bump", plate: false, dim: null,
    fontFamily: '"Impact", "Haettenschweiler", "Arial Narrow Bold", sans-serif',
    fontSize: 108, fontWeight: 400, letterSpacing: "0.01em", textTransform: "uppercase",
    ink: "punch", stroke: 14, shadow: "none",
    maxWords: 4, maxChars: 22,
  },

  /** A solid card under the words. The receipt look, and the only one with a plate. */
  card: { mode: "page", plate: true, fontSize: 48, fontWeight: 400, maxWords: 3, maxChars: 20 },

  /** Small, low, out of the way. For a reel whose picture is the argument. */
  whisper: {
    mode: "page", plate: false, fontSize: 38, fontWeight: 400,
    letterSpacing: "0.12em", maxWords: 5, maxChars: 30, bandTop: 0.82,
  },

  /** Centred in the frame rather than banded low — for a beat with no picture. */
  centred: {
    mode: "bump", plate: false, fontSize: 88, fontWeight: 700,
    textTransform: "uppercase", maxWords: 3, maxChars: 16, bandTop: 0.44,
  },
};

/**
 * theme.captions + preset + the spec's own keys, in that order.
 *
 * `base` is the project's themed block, so a project that never asks for a
 * preset gets byte-identical behaviour to before this file existed.
 *
 * @param {SubtitleSpec|string|undefined} spec
 * @param {object} base the project's `theme.captions`
 * @returns {SubtitleSpec & object}
 */
export const resolveSubtitles = (spec, base) => {
  const s = !spec ? {} : typeof spec === "string" ? { preset: spec } : spec;
  const bank = s.preset ? SUBTITLE_PRESETS[s.preset] : null;
  if (s.preset && !bank) {
    throw new Error(
      `subtitles: no preset "${s.preset}". Have: ${Object.keys(SUBTITLE_PRESETS).join(", ")}`,
    );
  }
  // THE INK IS EXPANDED PER LAYER, and that is the whole reason it works.
  //
  // Resolved once at the end, a preset's ink could never beat
  // `theme.captions.emphasisColor` — the default carries a gold, and a merged
  // object cannot tell "the project asked for this" from "the default came
  // with it". The first version of this shipped that bug and the render
  // showed it: every ink drew the theme's gold accent, `inverse`'s dark red
  // included.
  //
  // Expanded at the layer that NAMED it, the precedence is the one a reader
  // expects: a preset's ink beats the theme's colours, a colour written
  // beside an ink beats that ink, and a later layer's ink beats an earlier
  // layer's colours.
  const expand = (layer) => {
    if (!layer || !layer.ink) return layer ?? {};
    const set = resolveInk(layer.ink);
    const { ink, ...own } = layer;
    return {
      ...(set.fill ? { color: set.fill } : {}),
      ...(set.stroke ? { strokeColor: set.stroke } : {}),
      ...(set.emphasis ? { emphasisColor: set.emphasis } : {}),
      // An inherited `emphasis` LIST has to go with it. The list wins over
      // `emphasisColor` wherever both exist, so a theme that defines three
      // levels — the probe project does — silently beat every ink until this
      // line: naming an ink says "these are my three colours", and a layer
      // that wants levels as well brings its own list (`beast` does).
      ...(set.emphasis && own.emphasis === undefined ? { emphasis: undefined } : {}),
      ...own,
    };
  };
  return { ...expand(base), ...expand(bank), ...expand(s) };
};

/**
 * Where the band sits, in canvas pixels.
 *
 * `bandTop` is a pixel count historically (1180 of 1920) and a FRACTION is
 * the useful form once a preset can move it — a preset cannot know the
 * canvas. Anything at or below 1 is read as a fraction, which is
 * unambiguous: no band has ever sat on row 1.
 */
export const bandTopPx = (style, height) => {
  const v = style?.bandTop ?? 1180;
  return v <= 1 ? Math.round(v * height) : v;
};
