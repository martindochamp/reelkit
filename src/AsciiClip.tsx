import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { mono, palettes } from "./tokens";

/**
 * AsciiClip — an animated specimen: every frame of a short clip converted
 * through the same img2ascii pipeline as the art slides, played back in
 * ink on paper. The moving version of the receipt's specimen block.
 */

export const ASCII_CLIP_FPS = 30;

export type AsciiClipProps = {
  /** One ASCII string per source frame, all converted with trim: false. */
  frames: string[];
  /** Source clip frame rate — playback maps composition frames onto it. */
  clipFps: number;
  theme?: "light" | "dark";
  loops?: number;
};

export const asciiClipDuration = ({
  frames,
  clipFps,
  loops = 4,
}: AsciiClipProps) =>
  Math.max(1, Math.round(((frames.length * loops) / clipFps) * ASCII_CLIP_FPS));

export const AsciiClip: React.FC<AsciiClipProps> = ({
  frames,
  clipFps,
  theme = "dark",
}) => {
  const frame = useCurrentFrame();
  const palette = palettes[theme];
  const idx =
    Math.floor((frame * clipFps) / ASCII_CLIP_FPS) % Math.max(1, frames.length);
  // trim: false keeps every frame the same size — measure once, on the
  // first frame, so the glyph block never breathes between frames.
  const lines = (frames[0] ?? "").split("\n");
  const cols = Math.max(1, ...lines.map((l) => l.length));
  const fontSize = Math.min(912 / (cols * 0.6), 1500 / lines.length);
  return (
    <AbsoluteFill
      style={{
        backgroundColor: palette.paper,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          fontFamily: mono,
          fontSize,
          lineHeight: 1,
          whiteSpace: "pre",
          color: palette.ink,
        }}
      >
        {frames[idx]}
      </div>
    </AbsoluteFill>
  );
};
