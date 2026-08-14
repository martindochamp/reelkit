import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  interpolateColors,
  useCurrentFrame,
} from "remotion";
import { mono, palettes, type Palette } from "../tokens";
import { revealClip } from "./reveal";

/**
 * UnitGrid — the absorption waffle.
 *
 * A quantity becomes countable: `count` square units print in rows of
 * `perRow`, then — from the last unit backwards — units extinguish one by
 * one, ink easing to trace, until only `keep` remain. What is lost does
 * not disappear; it stays on the paper as a ghost. The end state reads as
 * a static: ink = kept, trace = lost.
 *
 * Motion doctrine: things PRINT (top-down clip wipe) or ease on
 * bezier(0.25, 0.1, 0.25, 1). Nothing springs, nothing bounces.
 */

export type UnitGridProps = {
  count: number;            // total units, e.g. 49
  keep: number;             // units that stay ink
  perRow?: number;          // default 8
  kicker?: string;          // small faded uppercase label above
  title?: string;           // receipt row under the grid
  value?: string;
  line?: string;            // faded provenance line under the row
  theme?: "light" | "dark";
  appearAt?: number;        // frame the grid starts printing in (default 0)
  reduceAt?: number;        // frame the extinction starts
  reduceDuration?: number;  // frames the whole extinction spans (default 75)
  /**
   * What an extinguished unit settles to. `trace` is the slide value and it
   * is right on a full screen: the lost units are meant to be a ghost you
   * notice second. On a COVER it is wrong — trace against dark paper is
   * #2E2C27 on #151412, three levels apart, and the field simply vanishes at
   * tile size, leaving the kept unit alone on empty paper with nothing to be
   * kept OUT OF. The whole meaning of the waffle is the ratio, so the cover
   * pass runs `faded` and the ghost survives the downsample.
   */
  unlit?: "trace" | "faded";
};

const rule = 2;
const PAD_X = 84;
const PAD_RIGHT = 144; // content ends at x = 936
const STAGE_W = 1080 - PAD_X - PAD_RIGHT; // 852

const EASE = Easing.bezier(0.25, 0.1, 0.25, 1);

const UNIT_PRINT = 4;       // frames one unit's print wipe takes
const PRINT_STAGGER = 0.3;  // frames between unit print starts
const UNIT_FADE = 9;        // frames one unit's extinction takes
const PRINT_FRAMES = 10;    // kicker / row print wipe (house style)

/** Top-down print wipe, the ReelElements reveal. */
const printClip = (
  frame: number,
  cue: number,
  frames: number = PRINT_FRAMES,
): React.CSSProperties => revealClip(frame, cue, frames);

export const UnitGrid: React.FC<UnitGridProps> = ({
  count,
  keep,
  perRow = 8,
  kicker,
  title,
  value,
  line,
  theme = "dark",
  appearAt = 0,
  reduceAt,
  reduceDuration = 75,
  unlit = "trace",
}) => {
  const frame = useCurrentFrame();
  const palette: Palette = palettes[theme];
  const unlitColor = unlit === "faded" ? palette.faded : palette.trace;

  // --- geometry -----------------------------------------------------------
  const rows = Math.ceil(count / perRow);
  const gapRatio = 0.25;
  const maxGridH = 780;
  const unit = Math.floor(
    Math.min(
      STAGE_W / (perRow + (perRow - 1) * gapRatio),
      maxGridH / (rows + (rows - 1) * gapRatio),
    ),
  );
  const gap = Math.round(unit * gapRatio);

  // --- timeline -----------------------------------------------------------
  const gridStart = appearAt + 6; // kicker leads by a beat
  const gridDone =
    gridStart + Math.ceil((count - 1) * PRINT_STAGGER) + UNIT_PRINT;
  const rowCue = gridDone + 2;

  const lost = Math.max(0, count - Math.max(0, keep));
  const reduceStart = reduceAt ?? gridDone + 45;
  const fadeStagger =
    lost > 1 ? Math.max(0, reduceDuration - UNIT_FADE) / (lost - 1) : 0;

  /** Extinction progress for unit i (0 = ink, 1 = trace).
   *  The LAST unit goes first; kept units never move. */
  const extinction = (i: number): number => {
    if (i < keep) return 0;
    const order = count - 1 - i; // 0 = first to go
    const start = reduceStart + order * fadeStagger;
    return interpolate(frame, [start, start + UNIT_FADE], [0, 1], {
      easing: EASE,
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  };

  // Live counter: a unit is counted out once its extinction crosses midway.
  let remaining = count;
  for (let j = 0; j < lost; j++) {
    if (frame >= reduceStart + j * fadeStagger + UNIT_FADE / 2) remaining--;
  }

  // --- units --------------------------------------------------------------
  // A unit is a solid square div — the app's bar style. A "█" glyph in
  // SF Mono was tried and rejected: the full-block glyph is a vertical
  // rectangle (0.6 em advance, full em height), so rows nearly touch and
  // 49 units read as 8 columns. The div stays square and countable.
  const units = Array.from({ length: count }, (_, i) => {
    const gone = extinction(i);
    const color = interpolateColors(gone, [0, 1], [palette.ink, unlitColor]);
    const scale = 1 - 0.15 * gone;
    return (
      <div
        key={i}
        style={{
          width: unit,
          height: unit,
          backgroundColor: color,
          transform: `scale(${scale})`,
          ...printClip(frame, gridStart + i * PRINT_STAGGER, UNIT_PRINT),
        }}
      />
    );
  });

  // --- layout -------------------------------------------------------------
  return (
    <AbsoluteFill style={{ backgroundColor: palette.paper }}>
      <div
        style={{
          position: "absolute",
          top: 210,
          bottom: 560,
          left: PAD_X,
          right: PAD_RIGHT,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        {kicker ? (
          <div
            style={{
              ...printClip(frame, appearAt, PRINT_FRAMES),
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: 48,
            }}
          >
            <span
              style={{
                fontFamily: mono,
                fontSize: 26,
                letterSpacing: "0.25em",
                textTransform: "uppercase",
                color: palette.faded,
              }}
            >
              {kicker}
            </span>
            <span
              style={{
                fontFamily: mono,
                fontWeight: 700,
                fontSize: 26,
                letterSpacing: "0.1em",
                color: palette.ink,
              }}
            >
              {remaining}
            </span>
          </div>
        ) : null}

        <div style={{ display: "flex", justifyContent: "center" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${perRow}, ${unit}px)`,
              gap,
            }}
          >
            {units}
          </div>
        </div>

        {title || value || line ? (
          <div style={printClip(frame, rowCue, PRINT_FRAMES)}>
            {title || value ? (
              <div
                style={{
                  marginTop: 56,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  gap: 24,
                  padding: "26px 0 0",
                  borderTop: `${rule}px solid ${palette.ink}`,
                  fontFamily: mono,
                  fontWeight: 700,
                  fontSize: 34,
                  textTransform: "uppercase",
                  color: palette.ink,
                }}
              >
                <span style={{ letterSpacing: "0.06em" }}>{title}</span>
                <span style={{ whiteSpace: "nowrap" }}>{value}</span>
              </div>
            ) : null}
            {line ? (
              <div
                style={{
                  marginTop: 24,
                  fontFamily: mono,
                  fontSize: 24,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: palette.faded,
                }}
              >
                {line}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
