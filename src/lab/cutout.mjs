// THE CUTOUT's geometry — a matted person placed on the canvas with nothing
// behind them. Plain JS so both sides can run it: the component draws with it
// (src/lab/Cutout.tsx) and a test asserts on it without a bundler
// (scripts/presets.test.mjs). Same arrangement as footage.mjs and field.mjs.
//
// WHY THIS IS NOT A FOOTAGE BOX WITH `spill`.
//
// `spill` draws a matte OUTSIDE a box so a head can break the frame it sits
// in. It needs the box: the matte is aligned to what `object-fit: cover`
// would have produced, which is why staging has to probe the source with
// ffprobe and write `srcW`/`srcH` into the spec. Take the box away and there
// is nothing to align to.
//
// A reaction cutout has no box, so it needs none of that — and deliberately
// asks for NO SOURCE DIMENSIONS AT ALL. That is the part this file deletes.
// The trick is to place the cutout by an EDGE instead of a centre: a width
// and a left edge need only the canvas, and the source's own aspect ratio
// decides the height in the browser (`height: auto` on the video). Nothing
// here, and nothing at staging, ever has to know how tall a person is.
//
// It also means `y` is not a key. A centre needs a height; every placement
// this device actually uses is an edge — feet on the bottom of the frame,
// head hanging from the top — so `bottom` and `top` say it directly and the
// engine stays ignorant of the source. `footage` keeps `y` because a box's
// height is decided by its own ratio, which the post wrote down.

import { trackAt } from "./footage.mjs";

export { trackAt };

/**
 * @typedef {number | {at: number, to: number, ease?: "in"|"out"|"inout"|"linear"}[]} Track
 *
 * @typedef {{
 *   preset?: string,
 *   file?: string,
 *   width?: Track,
 *   x?: Track,
 *   bottom?: Track,
 *   top?: Track,
 *   flip?: boolean,
 *   opacity?: Track,
 *   from?: number,
 * }} CutoutSpec
 */

/**
 * The bank. Four placements, and each one is a different DEVICE rather than a
 * different number: the corner reaction, the presenter in front of the work,
 * the commentator beside it, and the half-entered body at the edge.
 *
 * It stops at four on purpose. A placement here is two numbers, and a name
 * that saves two numbers is not worth a lookup unless it carries an
 * intention — the footage bank already learned that lesson the other way,
 * where five of its twelve entries are a width and a `y` apart.
 */
export const CUTOUT_PRESETS = {
  /** Bottom-right corner, feet on the frame's edge. The reaction. */
  reaction: { width: 0.46, x: 0.74, bottom: 0 },

  /** Centred and large, standing in front of whatever the beat shows. */
  stage: { width: 0.8, x: 0.5, bottom: 0 },

  /** Small, left, lifted off the edge — commenting beside the content. */
  aside: { width: 0.38, x: 0.2, bottom: 0.12 },

  /** Half out of frame at the left edge: the body that just walked in. */
  peek: { width: 0.54, x: 0.04, bottom: 0 },
};

/**
 * `width` and `x` are NOT here, for footage.mjs's reason: injected as
 * defaults they are always defined, so nothing downstream can tell "the
 * author asked" from "nobody said". They are applied as fallbacks at use
 * time. `bottom: 0` is the default and IS stated, because a cutout with no
 * vertical word is standing on the bottom of the frame — that is the device.
 */
export const CUTOUT_DEFAULTS = { bottom: 0 };

/** @param {CutoutSpec|string} [spec] @returns {CutoutSpec} */
export const resolveCutout = (spec) => {
  const s = !spec ? {} : typeof spec === "string" ? { preset: spec } : spec;
  const base = s.preset ? CUTOUT_PRESETS[s.preset] : null;
  if (s.preset && !base) {
    throw new Error(
      `cutout: no preset "${s.preset}". Have: ${Object.keys(CUTOUT_PRESETS).join(", ")}`,
    );
  }
  // A preset that names `bottom` must not be overruled by the default, and a
  // spec that names `top` must not keep the default `bottom` — a box pinned
  // to both edges is the one thing this geometry cannot draw without a
  // height, so the later word wins outright.
  const merged = { ...CUTOUT_DEFAULTS, ...(base ?? {}), ...s };
  if (s.top !== undefined && s.bottom === undefined) delete merged.bottom;
  else if (base?.top !== undefined && s.bottom === undefined && s.top === undefined) {
    delete merged.bottom;
  }
  return merged;
};

/**
 * Spec + time → where the cutout goes, in canvas pixels, as a HEIGHTLESS
 * rect: left, width, and one vertical edge. The caller sets `height: auto`
 * and the source's aspect does the rest.
 *
 * @param {CutoutSpec} c @param {number} t seconds into the shot
 * @param {number} W @param {number} H
 * @returns {{left: number, width: number, top: number|null, bottom: number|null}}
 */
export const cutoutBox = (c, t, W, H) => {
  const width = trackAt(c.width, t, 0.46) * W;
  const left = trackAt(c.x, t, 0.5) * W - width / 2;
  if (c.top !== undefined) {
    return { left, width, top: trackAt(c.top, t, 0) * H, bottom: null };
  }
  return { left, width, top: null, bottom: trackAt(c.bottom, t, 0) * H };
};
