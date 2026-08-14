import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { mono, mu, palettes, type Palette } from "../tokens";
import { revealStyle } from "./reveal";

/**
 * BarChart — receipt bars that grow. The app's own protein bar, staged:
 * a hairline-bordered track in trace, a solid ink fill easing left→right,
 * an uppercase SF Mono label line above each bar. Rows print one after
 * another (stagger), each individually cue-able via `rowCues` for
 * word-sync later. The end state reads as a static — usable in slides.
 *
 * "The instrument, not the theater": rectangles, 2px rules, print wipes
 * and one bezier ease. Nothing springs, nothing bounces.
 */

export type BarChartProps = {
  /** Small faded uppercase line above the chart. */
  title?: string;
  /**
   * One receipt row per bar; `fraction` is 0..1 of the full track width.
   * `shrinkTo` eases the fill back DOWN after it settles — the printed
   * number against the kept one — and `shrinkValue` swaps the right
   * column as the fill lands. `blink` runs three cursor blinks
   * (ink↔faded, square wave — a terminal caret, not a pulse) once the
   * bar's motion ends, then holds ink.
   */
  rows: {
    label: string;
    value: string;
    fraction: number;
    shrinkTo?: number;
    shrinkValue?: string;
    blink?: boolean;
  }[];
  /**
   * Optional vertical dashed hairline crossing every bar at its fraction,
   * with a tiny faded caption under the last bar — a reference, never a
   * target.
   */
  reference?: { label: string; fraction: number };
  theme?: "light" | "dark";
  /** Frame the first row starts printing (default 0). */
  appearAt?: number;
  /** Frames between row starts (default 14). */
  stagger?: number;
  /** Absolute start frames per row — overrides stagger (for word-sync). */
  rowCues?: number[];
  /** Absolute frames the shrinks start, per row (default: grow end + 24). */
  shrinkCues?: number[];
};

const rule = 2;
const PAD_X = 84;
const PAD_RIGHT = 144; // content ends at x = 936
const TOP = 210;
const BOTTOM = 1920 - 1360; // below 1360 is subtitle territory

const PRINT_FRAMES = 7; // the print wipe, top→down
const GROW_DELAY = 2; // the fill starts as the row finishes printing
const GROW_FRAMES = 12;
const SHRINK_FRAMES = 30;
const BLINK_PERIOD = 18; // one smooth pulse; three then steady
const TRACK_HEIGHT = 38;

const ease = Easing.bezier(0.25, 0.1, 0.25, 1);
// The comedown is its own gesture: a soft launch and a long settle —
// the number deflating, not a bar snapping to a new value.
const shrinkEase = Easing.bezier(0.45, 0.05, 0.15, 1);

/** Top→down print wipe from `cue`, layout stable before it. */
const printStyle = (frame: number, cue: number): React.CSSProperties =>
  revealStyle(frame, cue);

/** 0..1 growth of a fill cued at `cue`, bezier-eased, clamped. */
const growth = (frame: number, cue: number) =>
  interpolate(
    frame,
    [cue + GROW_DELAY, cue + GROW_DELAY + GROW_FRAMES],
    [0, 1],
    { easing: ease, extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

export const BarChart: React.FC<BarChartProps> = ({
  title,
  rows,
  reference,
  theme = "dark",
  appearAt = 0,
  stagger = 14,
  rowCues,
  shrinkCues,
}) => {
  const frame = useCurrentFrame();
  const palette: Palette = palettes[theme];
  const cueOf = (i: number) => rowCues?.[i] ?? appearAt + i * stagger;
  const growEndOf = (i: number) => cueOf(i) + GROW_DELAY + GROW_FRAMES;
  const shrinkCueOf = (i: number) => shrinkCues?.[i] ?? growEndOf(i) + 24;
  const lastCue = rows.length > 0 ? cueOf(rows.length - 1) : appearAt;

  return (
    <AbsoluteFill style={{ backgroundColor: palette.paper }}>
      <div
        style={{
          position: "absolute",
          top: TOP,
          bottom: BOTTOM,
          left: PAD_X,
          right: PAD_RIGHT,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        {title ? (
          <div
            style={{
              ...printStyle(frame, appearAt),
              fontFamily: mono,
              fontSize: 26,
              letterSpacing: "0.25em",
              textTransform: "uppercase",
              color: palette.faded,
              marginBottom: 48,
            }}
          >
            {mu(title)}
          </div>
        ) : null}

        {rows.map((row, i) => {
          const cue = cueOf(i);
          const grown = growth(frame, cue);
          const target = Math.max(0, Math.min(1, row.fraction));
          let fraction = target * grown;
          let motionEnd = growEndOf(i);

          // The comedown: what the pack printed, then what you keep.
          if (row.shrinkTo != null) {
            const at = shrinkCueOf(i);
            fraction = interpolate(
              frame,
              [at, at + SHRINK_FRAMES],
              [fraction, Math.max(0, Math.min(1, row.shrinkTo))],
              { easing: shrinkEase, extrapolateLeft: "clamp", extrapolateRight: "clamp" },
            );
            motionEnd = at + SHRINK_FRAMES;
          }

          // Three smooth pulses once the bar settles: the fill breathes
          // ink→faded→ink on a cosine, then holds. Attention without a
          // hard cut — faded, never gone.
          let fillOpacity = 1;
          if (row.blink && frame >= motionEnd + 4) {
            const t = frame - (motionEnd + 4);
            if (t < BLINK_PERIOD * 3) {
              fillOpacity = 0.45 + 0.55 * (0.5 + 0.5 * Math.cos((2 * Math.PI * t) / BLINK_PERIOD));
            }
          }

          const shownValue =
            row.shrinkValue != null &&
            frame >= shrinkCueOf(i) + Math.floor(SHRINK_FRAMES / 2)
              ? row.shrinkValue
              : row.value;
          const fillPct = fraction * 100;
          return (
            <div
              key={i}
              style={{
                ...printStyle(frame, cue),
                marginBottom: i === rows.length - 1 ? 0 : 46,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  gap: 24,
                  fontFamily: mono,
                  fontSize: 29,
                  textTransform: "uppercase",
                  color: palette.ink,
                  marginBottom: 16,
                }}
              >
                <span style={{ letterSpacing: "0.06em" }}>{mu(row.label)}</span>
                {/* The value stays pinned at the right, like every receipt
                    row in the system — a value riding the bar's tip moves
                    while it is being read, and clips during the print. */}
                <span style={{ fontWeight: 700, whiteSpace: "nowrap" }}>
                  {mu(shownValue)}
                </span>
              </div>
              <div
                style={{
                  position: "relative",
                  boxSizing: "border-box",
                  height: TRACK_HEIGHT,
                  border: `${rule}px solid ${palette.trace}`,
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    bottom: 0,
                    left: 0,
                    width: `${fillPct}%`,
                    backgroundColor: palette.ink,
                    opacity: fillOpacity,
                  }}
                />
                {reference ? (
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      bottom: 0,
                      left: `${reference.fraction * 100}%`,
                      width: 0,
                      borderLeft: `${rule}px dashed ${palette.faded}`,
                    }}
                  />
                ) : null}
              </div>
            </div>
          );
        })}

        {reference ? (
          <div
            style={{
              ...printStyle(frame, lastCue),
              position: "relative",
              height: 30,
              marginTop: 18,
            }}
          >
            <span
              style={{
                position: "absolute",
                left:
                  reference.fraction > 0.6
                    ? `calc(${reference.fraction * 100}% - 16px)`
                    : `calc(${reference.fraction * 100}% + 16px)`,
                transform:
                  reference.fraction > 0.6 ? "translateX(-100%)" : undefined,
                fontFamily: mono,
                fontSize: 22,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
                color: palette.faded,
              }}
            >
              {mu(reference.label)}
            </span>
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
