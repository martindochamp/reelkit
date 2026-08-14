import React from "react";
import { interpolate } from "remotion";

/**
 * How a part arrives on the paper — one definition, imported by every lab
 * element instead of the ten byte-identical copies that were here before.
 *
 * **THE DEFAULT CHANGED ON 2026-08-11 AND THIS REVERSES A DOCUMENTED
 * DOCTRINE.** From 2026-08-02 the rule was "things PRINT — a top-down
 * clip wipe, the paper printing, the only motion in the system". Martin,
 * after watching the whole bank back to back in one sitting:
 *
 *   "je n'aime pas que la plupart des animations et images sont print de
 *    haut en bas comme un scanner alors que ça devrait directement
 *    s'afficher ou bien un fade très simple ou autre."
 *
 * He is right for a reason the doctrine could not see from inside one
 * element: a wipe reads as *printing* exactly once. Twenty of them in a
 * row read as a scanner, and the demo sheet is the first artefact that
 * showed twenty in a row. The signature move became a tic.
 *
 * So the default is now a 4-frame opacity fade — fast enough to feel like
 * an arrival rather than a dissolve, slow enough not to strobe. `print`
 * survives as an opt-in for the places where the wipe IS the argument
 * (the thermal printer element, a receipt actually coming out of a head).
 *
 * Do not switch it back globally without him. Do reach for `print` on one
 * element when that element is about paper.
 */
export type RevealMode = "fade" | "print" | "cut";

/** Frames a fade takes. */
const FADE_FRAMES = 4;
/** Frames the wipe takes, when a part opts into printing. */
const PRINT_FRAMES = 7;

export const DEFAULT_REVEAL: RevealMode = "fade";

/**
 * The style a part carries at `frame`, given the frame it arrives on.
 *
 * `visibility: hidden` before the cue in every mode: the part holds its
 * own space from the first frame, so nothing reflows as parts land. That
 * was true of the wipe and it stays true here — it is the half of the
 * old doctrine that was never the problem.
 */
export const revealStyle = (
  frame: number,
  cue: number,
  mode: RevealMode = DEFAULT_REVEAL,
): React.CSSProperties => {
  if (frame < cue) return { visibility: "hidden" };
  if (mode === "cut") return {};
  if (mode === "print") {
    const hidden = interpolate(frame, [cue, cue + PRINT_FRAMES], [100, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    return { clipPath: `inset(0 0 ${hidden}% 0)` };
  }
  return {
    opacity: interpolate(frame, [cue, cue + FADE_FRAMES], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  };
};

/**
 * The same thing for elements that were written against a clip-path
 * helper taking an explicit duration (`printClip(frame, cue, frames)`).
 * In fade mode the duration argument is ignored — a 40-frame wipe and a
 * 7-frame wipe are the same 4-frame fade, which is the point.
 */
export const revealClip = (
  frame: number,
  cue: number,
  frames: number = PRINT_FRAMES,
  mode: RevealMode = DEFAULT_REVEAL,
): React.CSSProperties => {
  if (frame < cue) return { visibility: "hidden" };
  if (mode === "cut") return {};
  if (mode === "print") {
    const hidden = interpolate(frame, [cue, cue + frames], [100, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    return { clipPath: `inset(0 0 ${hidden}% 0)` };
  }
  return {
    opacity: interpolate(frame, [cue, cue + FADE_FRAMES], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  };
};
