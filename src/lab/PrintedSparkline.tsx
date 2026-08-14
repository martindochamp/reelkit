import React, { useMemo } from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { mono, palettes, type Palette } from "../tokens";

/**
 * PrintedSparkline — a dot-matrix line chart laid down by a visible
 * printing head.
 *
 * The plot is a character grid in SF Mono: faint trace "·" gridpoints, the
 * data line as ink glyphs — ":" for the sampled path, "|" for steep
 * connectors, "+" at the actual day columns. A solid head block travels
 * left → right laying the line (a clip-path tracks it exactly); a faint
 * carriage hairline rides with it and vanishes when the print is done, so
 * the last frame reads as a still.
 *
 * A dashed target hairline crosses the plot; the derived receipt row
 * (days at target — counted from the data, never hand-set) prints when
 * the head parks.
 */

export type PrintedSparklineProps = {
  theme?: "light" | "dark";
  /** "PROTEIN — LAST 14 DAYS" */
  kicker: string;
  /** One value per day, left to right. */
  points: number[];
  /** Plot scale. */
  yMax: number;
  yMin?: number;
  /** Dashed hairline; also the threshold for the derived row. */
  target?: number;
  /** "TARGET 140 G" */
  targetLabel?: string;
  /** First and last x labels, e.g. ["JUL 19", "AUG 01"]. */
  xLabels?: [string, string];
  /** Left column of the derived receipt row; right is counted. */
  rowLabel?: string;
  /** Faded footer line. */
  line?: string;
  /** Frame the head starts printing. */
  drawStart?: number;
  /** Frames the head takes to cross the plot. */
  drawFrames?: number;
};

const rule = 2;
const PAD_X = 84;
const PAD_RIGHT = 1080 - 936;
const CONTENT_W = 1080 - PAD_X - PAD_RIGHT;
const EASE = Easing.bezier(0.25, 0.1, 0.25, 1);
const PRINT_FRAMES = 10;

const COLS = 48;
const ROWS = 20;
const GUTTER = 96;
const PLOT_W = CONTENT_W - GUTTER;
const CELL_W = PLOT_W / COLS;
const FONT = CELL_W / 0.6;
const CELL_H = Math.round(FONT);
const PLOT_H = CELL_H * ROWS;

const printed = (frame: number, cue: number): React.CSSProperties => {
  if (frame < cue) return { visibility: "hidden" };
  const hidden = interpolate(frame, [cue, cue + PRINT_FRAMES], [100, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return { clipPath: `inset(0 0 ${hidden}% 0)` };
};

/** Piecewise-linear sample of the day values at a fractional column. */
const sampleAt = (points: number[], c: number) => {
  const t = (c / (COLS - 1)) * (points.length - 1);
  const i = Math.min(points.length - 2, Math.floor(t));
  const f = t - i;
  return points[i] * (1 - f) + points[i + 1] * f;
};

const rowOf = (val: number, yMin: number, yMax: number) =>
  (1 - (val - yMin) / (yMax - yMin)) * (ROWS - 1);

export const PrintedSparkline: React.FC<PrintedSparklineProps> = ({
  theme = "dark",
  kicker,
  points,
  yMax,
  yMin = 0,
  target,
  targetLabel,
  xLabels,
  rowLabel,
  line,
  drawStart = 15,
  drawFrames = 90,
}) => {
  const frame = useCurrentFrame();
  const palette: Palette = palettes[theme];

  // Build the two glyph layers once: the trace grid and the ink line.
  const { gridLines, dataLines } = useMemo(() => {
    const grid: string[][] = Array.from({ length: ROWS }, () =>
      Array.from({ length: COLS }, () => " "),
    );
    for (let r = 0; r < ROWS; r += 4) {
      for (let c = 0; c < COLS; c += 6) grid[r][c] = "·";
    }

    const data: string[][] = Array.from({ length: ROWS }, () =>
      Array.from({ length: COLS }, () => " "),
    );
    const dayCols = points.map((_, i) =>
      Math.round((i / (points.length - 1)) * (COLS - 1)),
    );
    let prev: number | null = null;
    for (let c = 0; c < COLS; c++) {
      const r = Math.round(rowOf(sampleAt(points, c), yMin, yMax));
      if (prev !== null && Math.abs(r - prev) > 1) {
        const [lo, hi] = prev < r ? [prev + 1, r - 1] : [r + 1, prev - 1];
        for (let rr = lo; rr <= hi; rr++) {
          if (rr >= 0 && rr < ROWS && data[rr][c] === " ") data[rr][c] = "|";
        }
      }
      if (r >= 0 && r < ROWS) data[r][c] = dayCols.includes(c) ? "+" : ":";
      prev = r;
    }
    return {
      gridLines: grid.map((r) => r.join("")),
      dataLines: data.map((r) => r.join("")),
    };
  }, [points, yMin, yMax]);

  const progress = EASE(
    Math.min(1, Math.max(0, (frame - drawStart) / drawFrames)),
  );
  const headCol = Math.floor(progress * (COLS - 1));
  const headRow = Math.round(rowOf(sampleAt(points, headCol), yMin, yMax));
  const drawEnd = drawStart + drawFrames;
  const drawing = frame >= drawStart && frame < drawEnd;
  // The reveal is by whole characters — the printer strikes a column at a
  // time, and the head "█" lives in the same glyph grid as the data, so
  // the two can never drift apart by a sub-pixel advance.
  const visibleCols =
    frame < drawStart ? 0 : frame >= drawEnd ? COLS : headCol + 1;
  const headLines = Array.from({ length: ROWS }, (_, r) =>
    r === headRow ? " ".repeat(headCol) + "█" : "",
  );

  const targetY =
    target !== undefined
      ? rowOf(target, yMin, yMax) * CELL_H + CELL_H / 2
      : 0;
  const atTarget =
    target !== undefined ? points.filter((p) => p >= target).length : 0;

  const preStyle: React.CSSProperties = {
    position: "absolute",
    top: 0,
    left: 0,
    margin: 0,
    fontFamily: mono,
    fontSize: FONT,
    lineHeight: `${CELL_H}px`,
    whiteSpace: "pre",
  };

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
        <div
          style={{
            fontFamily: mono,
            fontSize: 26,
            letterSpacing: "0.25em",
            textTransform: "uppercase",
            color: palette.faded,
            marginBottom: 48,
          }}
        >
          {kicker}
        </div>

        <div style={{ display: "flex" }}>
          {/* Y gutter. */}
          <div
            style={{
              width: GUTTER,
              position: "relative",
              fontFamily: mono,
              fontSize: 22,
              color: palette.faded,
            }}
          >
            <span style={{ position: "absolute", top: -4, right: 24 }}>
              {yMax}
            </span>
            {target !== undefined ? (
              <span
                style={{
                  position: "absolute",
                  top: targetY - 14,
                  right: 24,
                }}
              >
                {target}
              </span>
            ) : null}
            <span
              style={{ position: "absolute", bottom: -4, right: 24 }}
            >
              {yMin}
            </span>
          </div>

          {/* Plot. */}
          <div
            style={{
              position: "relative",
              width: PLOT_W,
              height: PLOT_H,
              borderBottom: `${rule}px solid ${palette.trace}`,
            }}
          >
            <pre style={{ ...preStyle, color: palette.trace }}>
              {gridLines.join("\n")}
            </pre>

            {target !== undefined ? (
              <div
                style={{
                  position: "absolute",
                  top: targetY - rule / 2,
                  left: 0,
                  right: 0,
                  borderTop: `${rule}px dashed ${palette.faded}`,
                  ...printed(frame, 4),
                }}
              />
            ) : null}
            <pre
              style={{
                ...preStyle,
                color: palette.ink,
                fontWeight: 600,
              }}
            >
              {dataLines
                .map((l) => l.slice(0, visibleCols))
                .join("\n")}
            </pre>

            {/* The head and its carriage line — gone when the print is done. */}
            {drawing ? (
              <>
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    bottom: 0,
                    left: (headCol + 0.5) * CELL_W,
                    width: 1,
                    backgroundColor: palette.trace,
                  }}
                />
                <pre style={{ ...preStyle, color: palette.ink }}>
                  {headLines.join("\n")}
                </pre>
              </>
            ) : null}
          </div>
        </div>

        {/* X labels — the target label sits between the dates, off the plot,
            where no data can ever run through it. */}
        {xLabels || targetLabel ? (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginLeft: GUTTER,
              marginTop: 18,
              fontFamily: mono,
              fontSize: 22,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: palette.faded,
            }}
          >
            <span>{xLabels?.[0]}</span>
            {targetLabel ? <span>- - {targetLabel}</span> : null}
            <span>{xLabels?.[1]}</span>
          </div>
        ) : null}

        {/* Derived receipt row — the arithmetic, not a claim. */}
        {target !== undefined && rowLabel ? (
          <div style={{ marginTop: 52, ...printed(frame, drawEnd + 6) }}>
            <div
              style={{
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
              <span style={{ letterSpacing: "0.06em" }}>{rowLabel}</span>
              <span style={{ whiteSpace: "nowrap" }}>
                {atTarget} / {points.length}
              </span>
            </div>
          </div>
        ) : null}

        {line ? (
          <div
            style={{
              marginTop: 26,
              fontFamily: mono,
              fontSize: 22,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: palette.faded,
              ...printed(frame, drawEnd + 12),
            }}
          >
            {line}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
