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
//
// EVERY PROPERTY OWNS ITS OWN CLOCK. A real combo is not one span driving
// two properties: it is a short fade under a slightly longer zoom, each
// starting when it wants to. So a property may carry `frames`, `delay`,
// `ease` and `at` of its own, and falls back to the spec's when it does not.
// Without that, "zoom in + fade" can only be written as two identical spans,
// which is the one version of it nobody uses.

/**
 * @typedef {"linear"|"in"|"out"|"inout"|{spring: {stiffness?: number, damping?: number}}} Ease
 *
 * @typedef {[number, number] | number | {
 *   from?: number, to: number,
 *   frames?: number, delay?: number, ease?: Ease, at?: "enter"|"exit"|number,
 * }} Prop
 * `[from, to]`, a bare number (from the property's rest value), or an object
 * carrying its own timing. The object form is what makes a combo a combo.
 *
 * @typedef {{
 *   opacity?: Prop, scale?: Prop, x?: Prop, y?: Prop, rotate?: Prop,
 *   blur?: Prop, brightness?: Prop,
 *   at?: "enter"|"exit"|number, frames?: number, delay?: number, ease?: Ease,
 *   lead?: number, origin?: string,
 * }} Motion
 * `at` says what a span hangs off: `"enter"` the element's arrival, `"exit"`
 * its departure, a number the seconds into its life. `lead` holds the element
 * HIDDEN for that many frames before anything starts — without it a zoom with
 * no opacity sits there small and still, waiting, which is not an entrance.
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

// `split` and `stagger` USED TO BE HERE and were deleted 2026-09-13. They
// were declared on the type, sampled by this module, and passed an `index` by
// nobody: both call sites — the stage box and the footage layer — hand over
// `{ life }` and nothing else, so every part was part zero and no cascade
// ever staggered. The measurement they came from is real (a title's words
// arrive one after another), but nothing SPLITS an element into parts yet, so
// the axis described a capability the engine does not have. It comes back the
// day something produces an index, and not before.

/** `[from, to]`, a number, or an object → `{from, to}` for that property. */
const endsOf = (key, v) => {
  if (Array.isArray(v)) return { from: v[0], to: v[1] };
  if (v && typeof v === "object") return { from: v.from ?? REST[key], to: v.to };
  return { from: REST[key], to: v };
};

/** One property's timing: its own where it has one, the spec's otherwise. */
export const spanOf = (m, v) => {
  const own = v && typeof v === "object" && !Array.isArray(v) ? v : {};
  return {
    at: own.at ?? m.at ?? "enter",
    frames: Math.max(1, own.frames ?? m.frames ?? 7),
    delay: (own.delay ?? m.delay ?? 0) + (m.lead ?? 0),
    ease: own.ease ?? m.ease,
  };
};

/**
 * The progress of one span at `frame`, 0 → 1.
 *
 * @param {{at: any, frames: number, delay: number, ease: any}} span
 * @param {number} frame frames since the element arrived
 * @param {{life?: number, index?: number, fps?: number, stagger?: number}} ctx
 */
export const progressOfSpan = (span, frame, { life, fps = 30 } = {}) => {
  let start;
  if (span.at === "exit") {
    if (life == null) return 1; // nothing to hang an exit off: hold the end state
    start = life - span.frames;
  } else if (typeof span.at === "number") {
    start = span.at * fps;
  } else {
    start = 0;
  }
  start += span.delay;
  const t = (frame - start) / span.frames;
  return curve(span.ease)(Math.min(1, Math.max(0, t)));
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
  const out = {};
  for (const key of PROPS) {
    const v = m[key];
    if (v == null) continue;
    const { from, to } = endsOf(key, v);
    const p = progressOfSpan(spanOf(m, v), frame, ctx);
    out[key] = from + (to - from) * p;
  }
  return out;
};

/**
 * The frame the last ARRIVING span finishes — what a specimen's length is
 * measured from, so a clip can run exactly one second past its effect
 * instead of four. Exits are not counted: they end when the element does.
 *
 * Returns 0 for a spec that only leaves or only moves later.
 */
export const motionEnd = (m) => {
  if (!m || typeof m !== "object") return 0;
  let end = 0;
  for (const key of PROPS) {
    const v = m[key];
    if (v == null) continue;
    const span = spanOf(m, v);
    if (span.at === "exit") continue;
    const start = (typeof span.at === "number" ? span.at * 30 : 0) + span.delay;
    end = Math.max(end, start + span.frames);
  }
  return Math.round(end);
};

/**
 * An origin keyword resolved against an element's OWN box, in canvas pixels.
 *
 * A CSS `transform-origin` is relative to the node carrying the transform,
 * and for an element that places itself inside a full-canvas layer — the
 * footage box does exactly that — the node is the canvas. Measured
 * 2026-09-13: `origin: "top"` on a footage card did not grow it from its own
 * top edge, it dragged the whole card toward the top of the SCREEN. An
 * anchor nobody can predict is worse than no anchor.
 *
 * @param {string} [origin] `center`, `top left`, `bottom`, …
 * @param {{left: number, top: number, width: number, height: number}} box
 */
export const originPx = (origin = "center", box) => {
  const words = String(origin).trim().toLowerCase().split(/\s+/);
  const has = (w) => words.includes(w);
  const x = has("left")
    ? box.left
    : has("right")
      ? box.left + box.width
      : box.left + box.width / 2;
  const y = has("top")
    ? box.top
    : has("bottom")
      ? box.top + box.height
      : box.top + box.height / 2;
  return `${x}px ${y}px`;
};

/**
 * The CSS a motion spec is worth at `frame`.
 *
 * Transform order is fixed — translate, rotate, scale — because a spec that
 * reads the same and composes differently is the kind of difference nobody
 * finds by looking at a frame.
 */
export const motionStyle = (m, frame, ctx = {}) => {
  if (!m || typeof m !== "object") return {};
  // `lead` is black time: the element is not there yet. Held as visibility
  // so the layout underneath never moves when it arrives.
  const lead = m.lead ?? 0;
  // The literal is pinned rather than left as `string`: React's CSSProperties
  // types `visibility` as a union, and a widened string fails the build.
  if (lead > 0 && frame < lead) {
    return { visibility: /** @type {"hidden"} */ ("hidden") };
  }
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
