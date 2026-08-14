import React from "react";
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

/**
 * Reveal primitives — the three ways a thing gets onto the paper.
 *
 * Everything in the reel prints top-down (`PrintWipe`). These two siblings
 * widen the vocabulary without leaving the instrument:
 *
 * - `DissolveIn`  — glyphs materialize cell by cell in a deterministic
 *   hash order, each cell a middle dot for a beat before it snaps to its
 *   real glyph. The inverse spirit of GlyphDissolve's decay.
 * - `Typewriter`  — letter by letter, left to right, an ink block caret
 *   riding the frontier. Square-wave blink, no fades — a caret is binary.
 * - `PrintWipe`   — the existing top-down clip wipe, extracted clean.
 *
 * Shared contract, all three:
 * - `cue`   — the frame (relative to the enclosing Sequence) the reveal
 *   starts. Before it: invisible but layout-stable (`visibility: hidden`
 *   on the full content — parts never reflow).
 * - `frames` — reveal duration. After `cue + frames` the output is the
 *   plain content, exactly: a still of the last frame is the still.
 * - `DissolveIn` and `Typewriter` need per-character access, so their
 *   children are a string rendered `whiteSpace: pre` (type styles come
 *   in via `style` or inheritance); `PrintWipe` clips anything.
 */

export type RevealProps = {
  /** Frame at which the reveal starts (relative to the Sequence). */
  cue: number;
  /** Reveal duration in frames. */
  frames?: number;
};

const ease = Easing.bezier(0.25, 0.1, 0.25, 1);
const eased = {
  easing: ease,
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};
const linear = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

/** Deterministic per-cell jitter — the same content always materializes
 *  the same way. Same formula as GlyphDissolve, so the two feel related. */
const hash = (x: number, y: number, seed: number) => {
  const s = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return s - Math.floor(s);
};

/* ------------------------------------------------------------------ */
/* DissolveIn                                                          */
/* ------------------------------------------------------------------ */

export type DissolveInProps = RevealProps & {
  /** Mono text — a receipt block or a pre-converted ASCII specimen. */
  children: string;
  /** Type styles; `whiteSpace: pre` is always applied on top. */
  style?: React.CSSProperties;
  /** Vary to reshuffle the cell order for identical content. */
  seed?: number;
  /** How long a cell holds the "·" before snapping to its glyph. */
  dotFrames?: number;
};

/**
 * Characters materialize cell by cell in hash order: paper → "·" → glyph.
 * Whitespace stays whitespace. Steps, not fades — the easing lives in the
 * global progress curve, each cell itself snaps.
 */
export const DissolveIn: React.FC<DissolveInProps> = ({
  cue,
  frames = 18,
  children,
  style,
  seed = 1,
  dotFrames = 4,
}) => {
  const frame = useCurrentFrame();
  const base: React.CSSProperties = { ...style, whiteSpace: "pre" };
  const lines = React.useMemo(() => children.split("\n"), [children]);

  if (frame < cue) {
    return <div style={{ ...base, visibility: "hidden" }}>{children}</div>;
  }
  const p = interpolate(frame, [cue, cue + frames], [0, 1], eased);
  if (p >= 1) return <div style={base}>{children}</div>;

  // Each cell's birth is its hash, compressed so every cell has time to
  // pass through its dot beat before the window closes.
  const dotShare = Math.min(0.6, dotFrames / frames);
  const spread = 1 - dotShare;
  const out = lines
    .map((line, y) => {
      let acc = "";
      for (let x = 0; x < line.length; x += 1) {
        const ch = line[x];
        if (ch === " ") {
          acc += " ";
          continue;
        }
        const birth = hash(x, y, seed) * spread;
        acc += p < birth ? " " : p < birth + dotShare ? "·" : ch;
      }
      return acc;
    })
    .join("\n");
  return <div style={base}>{out}</div>;
};

/* ------------------------------------------------------------------ */
/* Typewriter                                                          */
/* ------------------------------------------------------------------ */

export type TypewriterProps = RevealProps & {
  /** The text, left-aligned; "\n" is a carriage return the caret takes. */
  children: string;
  /** Characters per second. `frames` (total typing time) wins if given. */
  cps?: number;
  /** Type styles; `whiteSpace: pre` is always applied on top. */
  style?: React.CSSProperties;
};

/**
 * Letter by letter, an ink block caret riding the frontier. The full text
 * sits underneath as an invisible layout ghost, the typed slice overlays
 * it — so the block never reflows and the end state is the plain text.
 * When typing ends the caret blinks twice (square wave) and vanishes.
 */
export const Typewriter: React.FC<TypewriterProps> = ({
  cue,
  frames,
  children,
  cps = 20,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const len = children.length;
  const framesPerChar =
    frames !== undefined && len > 0 ? frames / len : fps / cps;
  const typed =
    frame < cue
      ? 0
      : Math.min(len, Math.floor((frame - cue) / framesPerChar));

  const doneFrame = cue + Math.ceil(len * framesPerChar);
  let caret = false;
  if (frame >= cue && len > 0) {
    if (frame < doneFrame) {
      caret = true;
    } else {
      // Two square-wave blinks, then gone for good. Half-period derived
      // from fps so the wave keeps its ~6 Hz feel off-30fps.
      const half = Math.max(1, Math.round(fps / 6));
      const b = frame - doneFrame;
      caret = b < half || (b >= 2 * half && b < 3 * half);
    }
  }

  const pre: React.CSSProperties = { whiteSpace: "pre" };
  return (
    <div style={{ ...style, position: "relative" }}>
      {/* Layout ghost — holds the block's final size from frame one. */}
      <div style={{ ...pre, visibility: "hidden" }} aria-hidden>
        {children}
      </div>
      <div style={{ ...pre, position: "absolute", top: 0, left: 0 }}>
        {children.slice(0, typed)}
        {caret ? "█" : ""}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* PrintWipe                                                           */
/* ------------------------------------------------------------------ */

export type PrintWipeProps = RevealProps & {
  children: React.ReactNode;
};

/**
 * The reel's native reveal: clipped top-to-bottom from the cue, linear,
 * ten frames — a receipt coming out of the printer. Extracted verbatim
 * from ReelElements' `usePrintedStyle`.
 */
export const PrintWipe: React.FC<PrintWipeProps> = ({
  cue,
  frames = 10,
  children,
}) => {
  const frame = useCurrentFrame();
  if (frame < cue) {
    return <div style={{ visibility: "hidden" }}>{children}</div>;
  }
  const hidden = interpolate(frame, [cue, cue + frames], [100, 0], linear);
  return (
    <div
      style={
        hidden > 0 ? { clipPath: `inset(0 0 ${hidden}% 0)` } : undefined
      }
    >
      {children}
    </div>
  );
};
