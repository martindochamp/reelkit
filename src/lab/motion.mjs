// MOTION — one channel, every element. In plain JS so both sides can run it:
// the components draw with it and a test asserts on it without a bundler.
// Same arrangement as field.mjs, footage.mjs and cutout.mjs, for the same
// reason — two copies drift.
//
// WHY THIS EXISTS. Before it, 17 files carried their own `PRINT_FRAMES` at
// five different durations, `revealStyle` offered a `print` mode no caller
// ever passed, and every entrance in the engine — the beat `push`, the
// caption `bump`, the placed-item rise, the Ken Burns — was written once by
// hand. Motion was the one axis of the look a post could not reach, which is
// why no preset could ever carry it.
//
// THE STYLE GOES ON THE ELEMENT, NEVER ON A WRAPPER. A parent carrying
// `transform`, `filter` or `opacity` is a stacking context and kills
// `mix-blend-mode` silently — the trap this codebase hit three times in one
// day. An element that animates its OWN transform still blends with its
// backdrop; a parent that animates on its behalf does not.

/**
 * @typedef {"linear"|"in"|"out"|"inout"|{spring: {stiffness?: number, damping?: number}}} Ease
 *
 * @typedef {{
 *   opacity?: [number, number], scale?: [number, number],
 *   x?: [number, number], y?: [number, number], rotate?: [number, number],
 *   blur?: [number, number], brightness?: [number, number],
 *   at?: "enter"|"exit"|number, frames?: number, ease?: Ease,
 *   split?: "none"|"line"|"word"|"char", stagger?: number,
 *   origin?: string,
 * }} Motion
 * A property, from → to, over a span. `at` says what the span hangs off:
 * `"enter"` the element's arrival, `"exit"` its departure, a number the
 * seconds into its life. Everything else is a default.
 */

/** The animatable properties. Anything else on a spec is configuration. */
export const PROPS = ["opacity", "scale", "x", "y", "rotate", "blur", "brightness"];

/** What a property is worth when nothing animates it. */
const REST = { opacity: 1, scale: 1, x: 0, y: 0, rotate: 0, blur: 0, brightness: 1 };

export const EASE = {
  linear: (t) => t,
  in: (t) => t * t * t,
  out: (t) => 1 - (1 - t) ** 3,
  inout: (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2),
};

/**
 * A damped spring, normalised: 0 at t=0, exactly 1 at t=1.
 *
 * `damping` below ~2·√stiffness overshoots — that is the whole of "bounce",
 * and it is a NUMBER on this axis rather than a preset of its own. The
 * closing clamp is deliberate: a spring still ringing when its span ends
 * would snap, and a snap at the end of an entrance is the one artefact the
 * references never show.
 */
export const springAt = (t, { stiffness = 120, damping = 14 } = {}) => {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const w0 = Math.sqrt(stiffness);
  const zeta = damping / (2 * w0);
  if (zeta >= 1) return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
  const wd = w0 * Math.sqrt(1 - zeta * zeta);
  return (
    1 -
    Math.exp(-zeta * w0 * t) *
      (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t))
  );
};

/** An ease name, a spring spec, or nothing → the function to sample. */
export const curve = (ease) => {
  if (ease && typeof ease === "object" && ease.spring) {
    return (t) => springAt(t, ease.spring);
  }
  return EASE[ease] ?? EASE.out;
};

/**
 * Frames of delay for part `index` under a stagger.
 *
 * Measured: a title's words arrive in a staggered cascade, not together —
 * REFERENCES.md, "opacity, staggered per line or per word".
 */
export const partDelay = (index = 0, stagger = 2) =>
  Math.max(0, Math.round(index * stagger));

/**
 * The progress of one span at `frame`, 0 → 1.
 *
 * @param {Motion} m
 * @param {number} frame frames since the element arrived
 * @param {{life?: number, index?: number, fps?: number}} ctx
 *   `life` is the element's whole span in frames — only `at: "exit"` needs it.
 */
export const progressAt = (m, frame, { life, index = 0, fps = 30 } = {}) => {
  const span = Math.max(1, m.frames ?? 7);
  const delay = partDelay(index, m.stagger ?? 2);
  const at = m.at ?? "enter";
  let start;
  if (at === "exit") {
    if (life == null) return 1; // nothing to hang an exit off: hold the end state
    start = life - span;
  } else if (typeof at === "number") {
    start = at * fps;
  } else {
    start = 0;
  }
  start += delay;
  const t = (frame - start) / span;
  const eased = curve(m.ease)(Math.min(1, Math.max(0, t)));
  // An exit runs the other way: it ends at its `to`, having held `from`.
  return at === "exit" ? eased : eased;
};

/**
 * Every animated property, resolved at `frame`.
 *
 * A property nobody animates is absent from the result rather than set to
 * its rest value — the caller must be able to tell "not animated" from
 * "animated back to rest", or a motion spec would silently overwrite an
 * element's own static transform.
 */
export const motionAt = (m, frame, ctx = {}) => {
  if (!m || typeof m !== "object") return {};
  const p = progressAt(m, frame, ctx);
  const out = {};
  for (const key of PROPS) {
    const v = m[key];
    if (v == null) continue;
    const [from, to] = Array.isArray(v) ? v : [REST[key], v];
    out[key] = from + (to - from) * p;
  }
  return out;
};

/**
 * The CSS a motion spec is worth at `frame`.
 *
 * Transform order is fixed — translate, rotate, scale — because a spec that
 * reads the same and composes differently is the kind of difference nobody
 * finds by looking at a frame.
 */
export const motionStyle = (m, frame, ctx = {}) => {
  const v = motionAt(m, frame, ctx);
  if (Object.keys(v).length === 0) return {};
  const style = {};
  if (v.opacity != null) style.opacity = v.opacity;
  const tf = [];
  if (v.x != null || v.y != null) tf.push(`translate(${v.x ?? 0}px, ${v.y ?? 0}px)`);
  if (v.rotate != null) tf.push(`rotate(${v.rotate}deg)`);
  if (v.scale != null) tf.push(`scale(${v.scale})`);
  if (tf.length) {
    style.transform = tf.join(" ");
    style.transformOrigin = m.origin ?? "center";
  }
  const fx = [];
  if (v.blur != null && v.blur > 0.001) fx.push(`blur(${v.blur}px)`);
  if (v.brightness != null) fx.push(`brightness(${v.brightness})`);
  if (fx.length) style.filter = fx.join(" ");
  return style;
};
