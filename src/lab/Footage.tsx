import React from "react";
import { AbsoluteFill, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import {
  FOOTAGE_PRESETS,
  footageBox,
  resolveFootage,
  trackAt,
} from "./footage.mjs";
import { MatteLayer } from "./Cutout";

export { FOOTAGE_PRESETS, resolveFootage };

/**
 * A shaped, placed window onto moving pictures.
 *
 * The geometry — presets, ratios, anchors, radius, and the keyframe tracks —
 * lives in `footage.mjs` and is a pure function of (spec, seconds). This file
 * holds only what needs a clock: reading the frame, and mounting the video.
 *
 * THE SPILL is the one thing here that is not geometry. A box clips its
 * contents; that is what a box is for. So a subject cannot break its own
 * frame, which is the effect where a head rises past the top edge of the
 * card it is inside. `spill` draws a SECOND layer — a matte of the same take
 * with its background already removed — outside the clip, aligned to the same
 * box. The box shows the shot; the matte shows the person; the person is
 * drawn over the edge. Two layers, one geometry, no masking at render time.
 */
export type Margin =
  | number
  | "auto"
  | (number | "auto")[]
  | { top?: number | "auto"; right?: number | "auto"; bottom?: number | "auto"; left?: number | "auto" };

export type Track = number | { at: number; to: number; ease?: "in" | "out" | "inout" | "linear" }[];

export type FootageSpec = {
  /** A name from FOOTAGE_PRESETS. Any key beside it wins over the preset. */
  preset?: string;
  /** Under `posts/media/`, staged into the bundle by render-reel. */
  file: string;
  ratio?: number | string | null;
  width?: Track;
  height?: Track;
  /**
   * Canvas pixels from each edge, CSS-shaped: one value, `[v, h]`,
   * `[t, h, b]`, `[t, r, b, l]`, or an object. `"auto"` is "whatever is
   * left" — two autos on an axis centre the box, one absorbs the remainder,
   * a side nobody names is auto.
   *
   * It exists because `width` + `x` cannot say "the same gutter on both
   * sides": that is a subtraction from the canvas, and saying it as a
   * fraction means recomputing two numbers by hand every time the gutter
   * changes. When `margin` is present it decides the box and `x`/`y`/`anchor`
   * are not consulted.
   */
  margin?: Margin;
  /** A synonym for `margin`. A video frame has no border and no content box. */
  padding?: Margin;
  x?: Track;
  y?: Track;
  /** Which edge the box sits against when it is shorter than the frame. */
  anchor?: "top" | "middle" | "bottom";
  /** Canvas px, a track, or a percentage of the short side (`"50%"` = round). */
  radius?: Track | string;
  fit?: "cover" | "contain";
  /**
   * Where in the SOURCE the box looks, and how close. This is the shoulder
   * crop: the subject's head sits high in a phone take, so a box that wants
   * shoulders has to push the picture down and in.
   */
  focus?: { x?: number; y?: number; zoom?: Track };
  /** Seconds into the source. */
  from?: number;
  mute?: boolean;
  /**
   * The subject, drawn outside the box, so a head can rise past the frame it
   * is inside. `srcW`/`srcH` are the matte's own pixel size and are filled in
   * at staging — a post never writes them.
   */
  spill?: { matte: string; scale?: number; dy?: number; srcW?: number; srcH?: number };
};

export const Footage: React.FC<{ spec: FootageSpec }> = ({ spec }) => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const t = frame / fps;
  const f = resolveFootage(spec) as FootageSpec;
  const box = footageBox(f, t, W, H);

  const zoom = trackAt(f.focus?.zoom as any, t, 1);
  // objectPosition moves the crop inside the box; the zoom is a scale on the
  // video itself, so `cover` still decides which axis fills.
  const inner: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: f.fit ?? "cover",
    objectPosition: `${(f.focus?.x ?? 0.5) * 100}% ${(f.focus?.y ?? 0.5) * 100}%`,
    ...(zoom !== 1 ? { transform: `scale(${zoom})` } : null),
  };

  const src = staticFile(`media/${f.file}`);
  const common = {
    muted: f.mute !== false,
    volume: f.mute === false ? 1 : 0,
    ...(f.from ? { trimBefore: Math.round(f.from * fps) } : null),
  };

  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left: box.left,
          top: box.top,
          width: box.width,
          height: box.height,
          borderRadius: box.radius,
          overflow: "hidden",
        }}
      >
        <OffthreadVideo src={src} style={inner} {...common} />
      </div>

      {f.spill && f.spill.srcW && f.spill.srcH ? (
        (() => {
          // THE SPILL, and why it needs the source's own dimensions.
          //
          // The box crops by `object-fit: cover`, so drawing the matte at the
          // box's size crops it identically and nothing escapes — which is
          // what the first version of this did. To let the subject break the
          // frame the matte has to be drawn at the size `cover` would have
          // produced, positioned so the part visible inside the box lands
          // exactly where the box shows it, and NOT clipped. Then everything
          // `cover` was hiding — the head above the top edge — is simply
          // painted.
          //
          // The source's pixel size is read at staging (render-reel probes it
          // with ffprobe, the way `media` already does) because a React
          // component rendering one frame cannot ask a video how big it is.
          // A `cutout` needs none of this: with no box there is no crop to
          // escape, so it names one edge and lets the source's aspect decide
          // its height. See src/lab/cutout.mjs.
          const fx = f.focus?.x ?? 0.5;
          const fy = f.focus?.y ?? 0.5;
          const cover = Math.max(box.width / f.spill.srcW, box.height / f.spill.srcH);
          const rw = f.spill.srcW * cover;
          const rh = f.spill.srcH * cover;
          return (
            <MatteLayer
              file={f.spill.matte}
              left={box.left - (rw - box.width) * fx}
              top={box.top - (rh - box.height) * fy + (f.spill.dy ?? 0)}
              width={rw}
              height={rh}
              scale={zoom * (f.spill.scale ?? 1)}
              trimBefore={Math.round((f.from ?? 0) * fps)}
            />
          );
        })()
      ) : null}
    </AbsoluteFill>
  );
};

export default Footage;
