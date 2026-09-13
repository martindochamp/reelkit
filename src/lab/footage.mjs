// The FOOTAGE BOX's geometry, in plain JS so both sides can run it: the
// element draws with it (src/lab/Footage.tsx) and a test asserts on it without
// a bundler (scripts/presets.test.mjs). Same arrangement as tier-fit.mjs and
// field.mjs, for the same reason — two copies drift.
//
// WHY "FOOTAGE" AND NOT "VIDEO". `media`, `clip` and `recording` are already
// three element types in this engine and each means something narrower (one
// credited excerpt, an ASCII specimen, an app capture). This is the general
// case: a shaped, placed window onto moving pictures. Film calls that footage.
//
// A PRESET IS A CLASS. It sets some keys and nothing else; any key written
// beside it wins. `{ "preset": "circle", "width": 0.4 }` is a circle at 40 %
// of the frame. That is the whole contract, and it is the same one the ground
// (field.mjs) already uses, deliberately — one idea, learned once.

/**
 * @typedef {number | {at: number, to: number, ease?: "in"|"out"|"inout"|"linear"}[]} Track
 * A number, or keyframes in SECONDS into the shot. A Track is what makes an
 * item able to MOVE after it arrives — the gap `REFERENCES.md` lists third and
 * that nothing in the engine could express: `x`, `y`, `width`, `radius` and
 * `zoom` all take one.
 *
 * @typedef {number | "auto" | (number|"auto")[] | {top?: number|"auto", right?: number|"auto", bottom?: number|"auto", left?: number|"auto"}} Margin
 * Canvas pixels from each edge, CSS-shaped: one value for all four, `[v, h]`,
 * `[t, h, b]`, `[t, r, b, l]`, or an object. `"auto"` means "whatever is
 * left" — two autos on one axis centre the box, one auto absorbs the
 * remainder. A side nobody names is `auto`.
 *
 * @typedef {{
 *   preset?: string, file?: string,
 *   ratio?: number | string | null, width?: Track, height?: Track,
 *   margin?: Margin, padding?: Margin,
 *   x?: Track, y?: Track, anchor?: "top"|"middle"|"bottom",
 *   radius?: Track | string, fit?: "cover"|"contain",
 *   focus?: { x?: number, y?: number, zoom?: Track },
 *   from?: number, mute?: boolean,
 *   spill?: { matte: string, scale?: number, dy?: number },
 * }} FootageSpec
 */

/** "16:9" → 1.777…; a number passes through; null means "no ratio, use height". */
export const parseRatio = (r) => {
  if (r == null) return null;
  if (typeof r === "number") return r;
  const m = String(r).match(/^\s*(\d+(?:\.\d+)?)\s*[:/x]\s*(\d+(?:\.\d+)?)\s*$/i);
  if (!m) throw new Error(`footage: ratio "${r}" is not a number or "w:h"`);
  const [w, h] = [Number(m[1]), Number(m[2])];
  if (!(w > 0 && h > 0)) throw new Error(`footage: ratio "${r}" has a zero side`);
  return w / h;
};

/**
 * The bank. Every entry is a set of keys, nothing more.
 *
 * `full`, `half-*` and the named ratios are the three things a shot actually
 * asks for. `circle` is the proof the class idea works: it is `square` plus
 * one key, and it carries no drawing code of its own.
 */
export const FOOTAGE_PRESETS = {
  /**
   * Fills the canvas. This is now exactly what the defaults say, so the
   * preset is a NAME for the floor rather than a set of overrides — kept
   * because `"preset": "full"` reads as an intention and `{}` does not.
   */
  full: { y: 0.5 },

  /** Half the frame, pinned. `anchor` is what the three of these differ by. */
  "half-top":    { width: 1, height: 0.5, ratio: null, radius: 0, x: 0.5, anchor: "top" },
  "half-middle": { width: 1, height: 0.5, ratio: null, radius: 0, x: 0.5, anchor: "middle" },
  "half-bottom": { width: 1, height: 0.5, ratio: null, radius: 0, x: 0.5, anchor: "bottom" },

  /** The known ratios, centred at 84 % width — a size, not a law; override it. */
  square:    { ratio: "1:1",  width: 0.84, x: 0.5, y: 0.5, radius: 0 },
  portrait:  { ratio: "4:5",  width: 0.84, x: 0.5, y: 0.5, radius: 0 },
  landscape: { ratio: "16:9", width: 0.92, x: 0.5, y: 0.5, radius: 0 },
  story:     { ratio: "9:16", width: 0.62, x: 0.5, y: 0.5, radius: 0 },
  academy:   { ratio: "4:3",  width: 0.88, x: 0.5, y: 0.5, radius: 0 },

  /** A square taken all the way round. Two keys, no code. */
  circle: { ratio: "1:1", width: 0.62, x: 0.5, y: 0.5, radius: "50%" },

  /** The reference's host card: 4:5, soft corners, bleeding off the bottom. */
  card: { ratio: "4:5", width: 0.87, x: 0.5, y: 0.74, radius: 30 },

  /** Wide and fully rounded on the short side. */
  pill: { ratio: "21:9", width: 0.9, x: 0.5, y: 0.5, radius: "50%" },
};

export const FOOTAGE_DEFAULTS = {
  // THE DEFAULT IS THE WHOLE FRAME. No padding, no inset, no centred card —
  // a footage box that names nothing fills the canvas (Martin, 2026-09-09:
  // "par défaut je voudrais que y'ai pas de padding et que le position
  // prennent tout"). It was 0.84, which quietly put a margin on every box
  // nobody asked for one on, and made `full` a preset rather than the floor.
  //
  // A ratio still narrows it: `{ ratio: "16:9" }` alone is now a full-WIDTH
  // 16:9 band, not a centred card. Ask for a smaller box by saying `width`.
  //
  // NO `y` HERE, deliberately. `anchor` only gets a say when `y` is absent,
  // and a default `y: 0.5` made every `half-top` / `half-bottom` render in
  // the middle — the anchor was dead the moment it was written. A preset that
  // wants a centre says so itself; the three `half-*` presets do not.
  // `width`/`height` are NOT here, and that is load-bearing: they are applied
  // as a FALLBACK at use time (`trackAt(f.width, t, 1)`) instead. Injected as
  // defaults they were always defined, so the box model could never tell "the
  // author asked for a width" from "nobody said" — and a `margin` was
  // silently cancelled by a width of 1 it never asked for. The default is
  // still the whole frame; it is expressed once, where it is read.
  ratio: null, x: 0.5, radius: 0, fit: "cover", anchor: "middle",
};

/** @param {FootageSpec|string} [spec] @returns {FootageSpec} */
export const resolveFootage = (spec) => {
  const s = !spec ? {} : typeof spec === "string" ? { preset: spec } : spec;
  const base = s.preset ? FOOTAGE_PRESETS[s.preset] : null;
  if (s.preset && !base) {
    throw new Error(
      `footage: no preset "${s.preset}". Have: ${Object.keys(FOOTAGE_PRESETS).join(", ")}`,
    );
  }
  return { ...FOOTAGE_DEFAULTS, ...(base ?? {}), ...s };
};

/**
 * A Margin in any of its shapes → the four sides.
 *
 * `padding` is accepted as a synonym and means the same thing here: there is
 * no border and no content box on a video frame, so the distinction CSS draws
 * would be a distinction without a difference, and having two keys that did
 * subtly different things is exactly the kind of part this repo removes.
 */
export const marginSides = (m) => {
  if (m == null) return null;
  const A = "auto";
  if (typeof m === "number" || m === A) return { top: m, right: m, bottom: m, left: m };
  if (Array.isArray(m)) {
    const v = m.map((x) => (x == null ? A : x));
    if (v.length === 1) return { top: v[0], right: v[0], bottom: v[0], left: v[0] };
    if (v.length === 2) return { top: v[0], bottom: v[0], left: v[1], right: v[1] };
    if (v.length === 3) return { top: v[0], left: v[1], right: v[1], bottom: v[2] };
    return { top: v[0], right: v[1], bottom: v[2], left: v[3] };
  }
  return {
    top: m.top ?? A, right: m.right ?? A, bottom: m.bottom ?? A, left: m.left ?? A,
  };
};

/**
 * One axis of the box model: two margins and maybe a known length, in a span.
 *
 * The three cases are CSS's and nothing here is invented — both margins known
 * gives the length, a known length with both margins auto centres it, a known
 * length with one margin auto pins the other edge.
 */
const axis = (span, a, b, len) => {
  const A = "auto";
  // OVER-CONSTRAINED, and this is the case a ratio creates: the length is
  // already decided by the other axis, so two known margins cannot decide it
  // too. CSS drops one margin; here the useful answer is to keep both and
  // centre the box in the band they leave, because `margin: 84` with a ratio
  // means "84 all round" and a person expects the result to be symmetric.
  // Filling the span instead is what produced a 16:9 box 1752 px tall.
  if (a !== A && b !== A && len != null) {
    return { start: a + (span - a - b - len) / 2, size: len };
  }
  if (a !== A && b !== A) return { start: a, size: Math.max(span - a - b, 0) };
  if (len == null) return { start: a === A ? 0 : a, size: span - (a === A ? 0 : a) - (b === A ? 0 : b) };
  if (a === A && b === A) return { start: (span - len) / 2, size: len };
  if (a === A) return { start: span - b - len, size: len };
  return { start: a, size: len };
};

const EASE = {
  linear: (t) => t,
  in: (t) => t * t * t,
  out: (t) => 1 - (1 - t) ** 3,
  inout: (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2),
};

/**
 * A Track sampled at `t` SECONDS into the shot.
 *
 * Before the first keyframe it holds the first value and after the last it
 * holds the last — a track that ran off its end and snapped to zero is the
 * failure this replaces, not one it should introduce.
 *
 * @param {Track|undefined} v
 * @param {number} t seconds
 * @param {number} [fallback]
 */
export const trackAt = (v, t, fallback = 0) => {
  if (v == null) return fallback;
  if (typeof v === "number") return v;
  if (!Array.isArray(v) || v.length === 0) return fallback;
  const ks = [...v].sort((a, b) => a.at - b.at);
  if (t <= ks[0].at) return ks[0].to;
  if (t >= ks[ks.length - 1].at) return ks[ks.length - 1].to;
  for (let i = 0; i < ks.length - 1; i++) {
    const a = ks[i], b = ks[i + 1];
    if (t >= a.at && t <= b.at) {
      const span = b.at - a.at;
      const p = span === 0 ? 1 : (t - a.at) / span;
      return a.to + (b.to - a.to) * (EASE[b.ease ?? "inout"] ?? EASE.inout)(p);
    }
  }
  return fallback;
};

/**
 * Spec + time → the box, in canvas pixels.
 *
 * `anchor` only means anything when the box is shorter than the frame: it
 * decides which edge it sits against. `y` beside it wins, which is how
 * "half-bottom, but nudged" is written.
 *
 * @param {FootageSpec} f @param {number} t seconds into the shot
 * @param {number} W @param {number} H
 */
export const footageBox = (f, t, W, H) => {
  const ratio = parseRatio(f.ratio);
  const m = marginSides(f.margin ?? f.padding);

  // THE BOX MODEL, when margins are named.
  //
  // It exists because `width` + `x` cannot say "the same gutter on both
  // sides" — that is a subtraction from the canvas, and expressing it as a
  // fraction means recomputing two numbers by hand every time the gutter
  // changes, and getting an asymmetric result whenever the arithmetic drifts.
  // A margin says it once and the box follows.
  if (m) {
    const wLen = f.width != null ? trackAt(f.width, t, 1) * W : null;
    const h = axis(W, m.left, m.right, wLen);
    const vLen =
      ratio ? h.size / ratio : f.height != null ? trackAt(f.height, t, 1) * H : null;
    const v = axis(H, m.top, m.bottom, vLen);
    const rRaw = f.radius;
    const radius =
      typeof rRaw === "string" && rRaw.trim().endsWith("%")
        ? (Math.min(h.size, v.size) * parseFloat(rRaw)) / 100
        : trackAt(rRaw, t, 0);
    return {
      left: h.start, top: v.start, width: h.size, height: v.size,
      radius: Math.min(radius, Math.min(h.size, v.size) / 2),
    };
  }

  const w = trackAt(f.width, t, 1) * W;
  const h = ratio ? w / ratio : trackAt(f.height, t, 1) * H;

  const cx = trackAt(f.x, t, 0.5) * W;
  let cy;
  if (f.y !== undefined) cy = trackAt(f.y, t, 0.5) * H;
  else if (f.anchor === "top") cy = h / 2;
  else if (f.anchor === "bottom") cy = H - h / 2;
  else cy = H / 2;

  const rRaw = f.radius;
  const radius =
    typeof rRaw === "string" && rRaw.trim().endsWith("%")
      ? (Math.min(w, h) * parseFloat(rRaw)) / 100
      : trackAt(/** @type {any} */ (rRaw), t, 0);

  return {
    left: cx - w / 2, top: cy - h / 2, width: w, height: h,
    radius: Math.min(radius, Math.min(w, h) / 2),
  };
};
