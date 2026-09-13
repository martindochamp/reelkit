// The ground's PATTERN ARITHMETIC, in plain JS so both sides can run it: the
// element draws with it (src/lab/DynamicBackground.tsx) and a test asserts on
// it without a bundler (scripts/presets.test.mjs). Same arrangement as
// src/lab/tier-fit.mjs, and for the same reason — two copies drift and the
// second one is always the one that lies.
//
// Everything here is a pure function of a spec: shape in, CSS background
// layers out. No frame, no React, no clock. The motion lives in the TSX,
// because only it can ask what frame this is.

/**
 * The spec, for the type checker's benefit — the TSX re-exports a `FieldSpec`
 * that matches this. JSDoc rather than a `.d.ts`, so the shape sits in the
 * file it describes and cannot be edited without being seen.
 *
 * @typedef {{
 *   preset?: string, shape?: "dot"|"grid"|"cross"|"diagonal"|"rings"|"checker",
 *   ground?: string|null, color?: string, pitch?: number, size?: number,
 *   major?: number, majorColor?: string, majorSize?: number, angle?: number,
 *   drift?: { x?: number, y?: number }, zoom?: { from: number, to: number },
 * }} FieldSpec
 */

/** `#373737` has to reach a data URI, where a bare `#` ends the document. */
const enc = (svg) => `url("data:image/svg+xml,${svg.replace(/#/g, "%23").replace(/"/g, "'").replace(/\n\s*/g, " ").trim()}")`;

/**
 * shape → the layers to paint, top-most first, each with its own tile size.
 * Multi-layer is what a major/minor grid needs: four gradients, two tiles.
 */
/** @param {FieldSpec} f @returns {{image: string, tile: number}[]} */
export const fieldLayers = (f) => {
  const { shape, color: c, pitch: p, size: s } = f;
  switch (shape) {
    case "dot":
      // Byte-for-byte the string DotField emitted, when the numbers are its own.
      return [{ image: `radial-gradient(${c} ${s}px, transparent ${s}px)`, tile: p }];

    case "grid": {
      const line = (dir, col, w) =>
        `linear-gradient(to ${dir}, ${col} ${w}px, transparent ${w}px)`;
      const minor = [
        { image: line("right", c, s), tile: p },
        { image: line("bottom", c, s), tile: p },
      ];
      if (!f.major || f.major < 2) return minor;
      const mc = f.majorColor ?? c;
      const mw = f.majorSize ?? s * 2;
      const mp = p * f.major;
      // Major first: the first background-image in the list paints on top.
      return [
        { image: line("right", mc, mw), tile: mp },
        { image: line("bottom", mc, mw), tile: mp },
        ...minor,
      ];
    }

    case "diagonal":
      // A repeating-linear-gradient looked right until `background-size`
      // chopped it: the gradient repeats on its own period, so tiling it at
      // the pitch cuts every stripe and the result reads as noise. A line
      // drawn corner to corner inside one tile is seamless by construction —
      // the tiles join at the corners — and it takes drift and zoom through
      // the same two properties as every other shape.
      return [{
        image: enc(`<svg xmlns="http://www.w3.org/2000/svg" width="${p}" height="${p}">
          <path d="${(f.angle ?? 45) >= 90 ? `M0 0 L${p} ${p}` : `M0 ${p} L${p} 0`}"
                stroke="${c}" stroke-width="${s}"/></svg>`),
        tile: p,
      }];

    case "checker":
      // One layer, not two offset ones: a conic gradient already alternates
      // both ways inside a single tile, so the shared drift/zoom code below
      // needs no special case for it.
      return [{
        image: `conic-gradient(${c} 0 25%, transparent 0 50%, ${c} 0 75%, transparent 0)`,
        tile: p,
      }];

    case "cross":
      return [{
        image: enc(`<svg xmlns="http://www.w3.org/2000/svg" width="${p}" height="${p}">
          <path d="M${p / 2 - s} ${p / 2} H${p / 2 + s} M${p / 2} ${p / 2 - s} V${p / 2 + s}"
                stroke="${c}" stroke-width="${f.majorSize ?? 1.5}" stroke-linecap="round"/></svg>`),
        tile: p,
      }];

    case "rings":
      return [{
        image: enc(`<svg xmlns="http://www.w3.org/2000/svg" width="${p}" height="${p}">
          <circle cx="${p / 2}" cy="${p / 2}" r="${s}" fill="none"
                  stroke="${c}" stroke-width="${f.majorSize ?? 1.5}"/></svg>`),
        tile: p,
      }];
  }
};

/**
 * The bank.
 *
 * The stroke weights are not taste. Every preset here is driven at some point
 * by `drift` or `zoom`, which puts its lines on fractional pixel positions
 * every frame — and a 1 px line landing on a half pixel is antialiased across
 * two columns at half strength each, which measured as a 27-37 % loss of edge
 * contrast against the same preset held still. Nothing below is thinner than
 * 1.5 px, because that loss is proportionally smaller the heavier the stroke,
 * and the alternative (snapping the offset to whole pixels) trades the
 * smoothness of the move for the crispness of the line. The move is the point.
 *
 * `dots` is the exception and does not move: it is the ground the engine
 * already had, its CSS is asserted byte-for-byte in scripts/presets.test.mjs,
 * and changing it would move the floor under every post that ever asks for it.
 *
 * A preset is a set of numbers, nothing more — every key it sets
 * can be overridden beside it, which is the whole contract:
 * `{ "preset": "blueprint", "drift": { "x": -18, "y": -18 } }`.
 */
/** @type {Record<string, FieldSpec>} */
export const FIELD_PRESETS = {
  /** The engine's original ground. Measured off the reference at 720 wide. */
  dots: { shape: "dot", pitch: 15, size: 1.5, color: "#373737", ground: null },

  /** Wider, dimmer, for a busy foreground. */
  "dots-wide": { shape: "dot", pitch: 40, size: 2, color: "#333333", ground: null },

  /** Squared paper on deep navy, a heavier line every fifth cell. */
  blueprint: {
    shape: "grid", ground: "#0B2545", color: "rgba(180,214,255,0.20)", pitch: 46, size: 1.5,
    major: 4, majorColor: "rgba(202,228,255,0.46)", majorSize: 2.5,
  },

  /** The same construction, white. Engineering paper. */
  graph: {
    shape: "grid", ground: "#FAFAF8", color: "rgba(24,48,96,0.13)", pitch: 34, size: 1.5,
    major: 4, majorColor: "rgba(24,48,96,0.26)", majorSize: 2,
  },

  /** Register marks. Sparse, so it reads as a surface and not as a texture. */
  crosshatch: { shape: "cross", ground: "#0A0A0A", color: "#727272", pitch: 72, size: 9, majorSize: 2.5 },

  /** Machined diagonal. Close pitch, low contrast. */
  carbon: { shape: "diagonal", ground: "#0A0A0A", color: "#2C2C2C", pitch: 28, size: 3.5, angle: 45 },

  /** Sonar. Big rings, cool ink — the one that wants a drift under it. */
  sonar: { shape: "rings", ground: "#07090C", color: "rgba(130,205,255,0.38)", pitch: 96, size: 34, majorSize: 2.5 },

  /** Two-tone board, light. */
  board: { shape: "checker", ground: "#F2F1EC", color: "rgba(20,20,20,0.14)", pitch: 108, size: 1 },
};

export const FIELD_DEFAULTS = { shape: "dot", color: "#373737", pitch: 15, size: 1.5 };

/**
 * @param {FieldSpec|string|undefined} [spec]
 * @returns {FieldSpec & { shape: NonNullable<FieldSpec["shape"]>, color: string, pitch: number, size: number }}
 */
export const resolveField = (spec) => {
  // `undefined` is a real caller: `reelkit lab dynbg` previews an element with
  // no props at all, and a ground that throws there is a ground nobody can
  // look at alone. It falls back to the bank's first entry, not to an empty
  // frame — a preview that renders nothing is the failure this repo keeps
  // naming, the placeholder that renders cleanly.
  const s = !spec ? { preset: "dots" } : typeof spec === "string" ? { preset: spec } : spec;
  const base = s.preset ? (FIELD_PRESETS[s.preset] ?? {}) : {};
  return { ...FIELD_DEFAULTS, ...base, ...s };
};

