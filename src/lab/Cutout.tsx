import React from "react";
import { OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { CUTOUT_PRESETS, cutoutBox, resolveCutout } from "./cutout.mjs";

export { CUTOUT_PRESETS, resolveCutout };

/**
 * A matted person, on the canvas, with nothing behind them — the reaction
 * cutout. `reel.cutout` puts one under every beat; `beat.cutout` puts one on
 * this beat, and `null` there takes it away.
 *
 * WHY THIS IS ITS OWN LAYER AND NOT AN ELEMENT. An element is the beat's
 * SCREEN, and there is one per beat: as an element, a cutout could only ever
 * be the whole picture, which is the one thing this device never is. It sits
 * OVER whatever the beat shows and UNDER the caption band, so the words stay
 * on top — a person who covers the sentence is a bug, not a look.
 *
 * THE ONE PIECE OF DRAWING CODE FOR A MATTE. `MatteLayer` below is what the
 * footage box's `spill` also uses now. Before this file there were going to
 * be two: the spill's, written inline in Footage.tsx, and this one — two
 * places to remember `transparent`, and that flag costs a render every time
 * it is forgotten. One layer, two geometries: the spill computes the rect
 * `object-fit: cover` would have produced, a cutout computes its own.
 */
export const MatteLayer: React.FC<{
  /** Under `posts/media/`, staged into the bundle by render-reel. */
  file: string;
  left: number;
  width: number;
  /**
   * A cutout names ONE vertical edge and no height: the source's own aspect
   * ratio decides how tall it is, in the browser, for free. That is what
   * lets the engine place a person without ever probing how tall they are.
   * The spill names all four, because a cover crop is a rect.
   */
  top?: number | null;
  bottom?: number | null;
  height?: number | null;
  flip?: boolean;
  opacity?: number;
  /** Frames into the SOURCE, already absolute. */
  trimBefore?: number;
  /** Extra scale about the centre — the spill's zoom. */
  scale?: number;
}> = ({
  file,
  left,
  width,
  top = null,
  bottom = null,
  height = null,
  flip = false,
  opacity = 1,
  trimBefore = 0,
  scale = 1,
}) => {
  const boxed = height != null;
  const t = [flip ? "scaleX(-1)" : "", scale !== 1 ? `scale(${scale})` : ""]
    .filter(Boolean)
    .join(" ");
  return (
    <div
      style={{
        position: "absolute",
        left,
        width,
        ...(top != null ? { top } : null),
        ...(bottom != null ? { bottom } : null),
        ...(boxed ? { height } : null),
        ...(opacity !== 1 ? { opacity } : null),
        ...(t ? { transform: t, transformOrigin: "center" } : null),
        pointerEvents: "none",
      }}
    >
      <OffthreadVideo
        src={staticFile(`media/${file}`)}
        style={{
          display: "block",
          width: "100%",
          // `auto` is the whole trick: no source dimensions anywhere.
          height: boxed ? "100%" : "auto",
          objectFit: boxed ? "fill" : "contain",
        }}
        // Without this the alpha channel is dropped and the matte paints its
        // own garbage background opaque — RVM's foreground pass leaves
        // arbitrary colour wherever alpha is 0, so the failure is loud rather
        // than subtle. It cost one render, in the spill, before this moved.
        transparent
        muted
        volume={0}
        {...(trimBefore ? { trimBefore } : null)}
      />
    </div>
  );
};

export type CutoutSpec = {
  /** A name from CUTOUT_PRESETS. Any key beside it wins over the preset. */
  preset?: string;
  /** The matte, under `posts/media/`. VP9 with alpha — see docs/CUTOUT.md. */
  file: string;
  /** Fraction of the canvas width. Takes a track. */
  width?: number | { at: number; to: number; ease?: string }[];
  /** Centre, fraction of the canvas width. Takes a track. */
  x?: number | { at: number; to: number; ease?: string }[];
  /** The cutout's BOTTOM edge, fraction up from the canvas floor. A track. */
  bottom?: number | { at: number; to: number; ease?: string }[];
  /** Its TOP edge instead, fraction down from the canvas ceiling. A track. */
  top?: number | { at: number; to: number; ease?: string }[];
  /** Mirror it. A person shot facing left, placed on the right. */
  flip?: boolean;
  opacity?: number;
  /** Seconds into the source. */
  from?: number;
};

export const Cutout: React.FC<{
  spec: CutoutSpec | string;
  /**
   * Frames from the REEL's start to this beat's. A `reel.cutout` is one
   * continuous take: mounted per beat, it would restart on every cut, so the
   * offset both seeks the source and shifts the clock its tracks read. A
   * `beat.cutout` gets 0 — its own beat is its whole world.
   */
  offsetFrames?: number;
}> = ({ spec, offsetFrames = 0 }) => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const c = resolveCutout(spec as never) as CutoutSpec;
  const t = (frame + offsetFrames) / fps;
  const box = cutoutBox(c as never, t, W, H);

  return (
    <MatteLayer
      file={c.file}
      left={box.left}
      width={box.width}
      top={box.top}
      bottom={box.bottom}
      flip={c.flip}
      opacity={c.opacity}
      trimBefore={Math.round((c.from ?? 0) * fps) + offsetFrames}
    />
  );
};

export default Cutout;
