import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { FIELD_PRESETS, fieldLayers, resolveField } from "./field.mjs";

export { FIELD_PRESETS, resolveField };

/**
 * The ground, as a parameter instead of a constant.
 *
 * This replaces `DotField` in Reel.tsx, which was fifteen lines of hardcoded
 * radial gradient and the only ground the engine could draw. The `dots`
 * preset below emits the same CSS string it did, so nothing that asked for
 * `"dots"` changes; everything else the references measured — a blueprint
 * grid, engineering paper, a crosshatch — is now the same component with
 * different numbers.
 *
 * WHY A BACKGROUND-IMAGE AND NOT AN SVG NODE. Every shape here resolves to
 * one `background-image` + `background-size` + `background-position`. That
 * buys three things for free: the tile repeats to any canvas without an
 * asset, `background-position` gives a seamless infinite drift (a tiled
 * image has no edge to reach), and `background-size` gives a zoom that
 * costs no `transform` — which matters, because a transform is a stacking
 * context and this engine has been bitten three times by one silently
 * killing `mix-blend-mode` on the layer above.
 *
 * The two shapes a gradient cannot draw (a plus, a ring) arrive as an
 * inline SVG data URI, so they travel the same three properties as the rest
 * and the drift/zoom code has exactly one branch.
 */

export type FieldShape = "dot" | "grid" | "cross" | "diagonal" | "rings" | "checker";

export type FieldSpec = {
  /** A name from FIELD_PRESETS. Any key set beside it wins over the preset. */
  preset?: string;
  shape?: FieldShape;
  /** Painted under the pattern. `null` lets the beat's own ground through. */
  ground?: string | null;
  color?: string;
  /** Cell size in canvas px. */
  pitch?: number;
  /** Dot radius, stroke width, or arm length depending on the shape. */
  size?: number;
  /** Every Nth line drawn heavier. `grid` only — this is what reads as a blueprint. */
  major?: number;
  majorColor?: string;
  majorSize?: number;
  /**
   * `diagonal` only, and it picks a direction rather than an angle: below 90
   * the stripe runs "/", 90 or above it runs "\\". An arbitrary degree was
   * promised by the first draft and never worked — a tiled diagonal is only
   * seamless corner to corner.
   */
  angle?: number;
  /**
   * The infinite travel, in canvas px per second. Negative x and y send the
   * field up and to the left. There is no wrap and no reset: the tile has no
   * edge, so the position can run forever and the seam never arrives.
   */
  drift?: { x?: number; y?: number };
  /** Multiplier on `pitch`, eased across the shot. */
  zoom?: { from: number; to: number };
};

/**
 * `durationInFrames` is the shot's, not the reel's — the zoom is a move
 * across one picture, and a field that kept easing across a cut would be
 * the one motion the teardowns found no instance of.
 */
export const DynamicBackground: React.FC<{
  /** Absent means `dots` — see resolveField. */
  field?: FieldSpec | string;
  durationInFrames?: number;
}> = ({ field, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames: comp } = useVideoConfig();
  const span = durationInFrames ?? comp;
  const f = resolveField(field);

  // The camera's own curve (`Easing.inOut(Easing.cubic)` in Reel.tsx), because
  // a ground that zoomed linearly next to a viewport that eases reads as two
  // different moves. A linear zoom also starts and stops on a hard edge, which
  // is the one thing a continuous move must not do.
  const z = f.zoom
    ? interpolate(frame, [0, Math.max(span - 1, 1)], [f.zoom.from, f.zoom.to], {
        easing: Easing.inOut(Easing.cubic),
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 1;

  const t = frame / fps;
  const dx = (f.drift?.x ?? 0) * t;
  const dy = (f.drift?.y ?? 0) * t;

  // The stroke scales with the cell, on every shape.
  //
  // It used to scale only for `dot` and `rings`, so a zoomed grid drew the
  // same 1 px line across a cell half again as big and changed its visual
  // weight mid-move. That is a design defect on its own and this fixes it.
  //
  // IT DOES NOT FIX THE SOFTNESS, and I claimed here that it did before
  // measuring. Rendered both ways and compared at the same frames, edge
  // strength during the zoom is 71 % of the same preset held still, with the
  // stroke scaling and without it — identical. The cause is elsewhere: a tile
  // drawn at a fractional `background-size` cannot land its lines on pixel
  // boundaries, so every edge is antialiased no matter how thick it is.
  //
  // Rounding the pitch to whole pixels restores 97 % of it, and costs the
  // move: 46 % of frames come out identical to the one before, because the
  // zoom can only advance when the rounded pitch changes. That trade is a
  // decision, not a default — see docs/GROUND.md.
  const ls = fieldLayers({
    ...f,
    pitch: f.pitch * z,
    size: f.size * z,
    ...(f.majorSize ? { majorSize: f.majorSize * z } : {}),
  });
  const biggest = Math.max(...ls.map((l) => l.tile));

  return (
    <AbsoluteFill
      style={{
        ...(f.ground ? { backgroundColor: f.ground } : null),
        backgroundImage: ls.map((l) => l.image).join(","),
        backgroundSize: ls.map((l) => `${l.tile}px ${l.tile}px`).join(","),
        // Modulo the largest tile so the number stays small on a long reel;
        // the pattern is identical either way, this is only float hygiene.
        backgroundPosition: ls
          .map(() => `${dx % biggest}px ${dy % biggest}px`)
          .join(","),
      }}
    />
  );
};

export default DynamicBackground;
