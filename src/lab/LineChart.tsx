import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { mono, palettes, type Palette } from "../tokens";

/**
 * LineChart — a real continuous line laid down by a visible printing head.
 *
 * The successor to PrintedSparkline: same layout, same props, but the data
 * is one SVG polyline (ink, 3px, square caps and joins) instead of ASCII
 * glyphs. A solid head block travels left → right along the line; the
 * polyline is revealed by a clip rect whose right edge IS the head's x, so
 * the line can never appear ahead of the head. A faint carriage hairline
 * rides with the head and vanishes when the print is done — the last frame
 * reads as a still.
 *
 * Kept from the glyph take: the faint trace dot grid, the dashed target
 * hairline (its label parked between the x labels, off the plot, where no
 * data can collide with it), x labels at both ends, and the derived
 * receipt row (days at target — counted from the points, never hand-set)
 * that prints when the head parks. Small ink squares mark the actual day
 * points, each appearing as the head passes it.
 */

export type LineChartProps = {
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

const GUTTER = 96;
const PLOT_W = CONTENT_W - GUTTER;
const PLOT_H = 520;

const STROKE = 3;
const MARKER = 10; // ink squares on the day points
const HEAD_W = 16; // the printing head block
const HEAD_H = 28;
const PARK_IN = 12; // head waits on the first point before printing
const PARK_OUT = 10; // and holds the last point after, then lifts off

/** Top→down print wipe from `cue`, layout stable before it. */
const printed = (frame: number, cue: number): React.CSSProperties => {
  if (frame < cue) return { visibility: "hidden" };
  const hidden = interpolate(frame, [cue, cue + PRINT_FRAMES], [100, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return { clipPath: `inset(0 0 ${hidden}% 0)` };
};

export const LineChart: React.FC<LineChartProps> = ({
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

  const n = points.length;
  const yOf = (v: number) => (1 - (v - yMin) / (yMax - yMin)) * PLOT_H;
  const xOf = (i: number) => (n > 1 ? (i / (n - 1)) * PLOT_W : 0);
  const pts = points.map((v, i) => ({ x: xOf(i), y: yOf(v) }));

  /** Piecewise-linear y of the data line at an arbitrary x. */
  const yAt = (x: number) => {
    if (n < 2) return pts[0]?.y ?? 0;
    const t = (x / PLOT_W) * (n - 1);
    const i = Math.min(n - 2, Math.max(0, Math.floor(t)));
    const f = t - i;
    return pts[i].y * (1 - f) + pts[i + 1].y * f;
  };

  const progress = EASE(
    Math.min(1, Math.max(0, (frame - drawStart) / drawFrames)),
  );
  const drawEnd = drawStart + drawFrames;
  const drawing = frame >= drawStart && frame < drawEnd;
  // The head arrives before the stroke and holds after it — carriage
  // hairline only while actually laying ink, so the lift-off reads.
  const headVisible =
    frame >= drawStart - PARK_IN && frame < drawEnd + PARK_OUT;
  const headX = progress * PLOT_W;
  const headY = yAt(headX);
  // The one rule of the head: the clip's right edge IS the head's x, so
  // the line exists exactly up to the head and never past it.
  const clipW = frame < drawStart ? 0 : frame >= drawEnd ? PLOT_W + STROKE : headX;

  const polyline = pts.map((p) => `${p.x},${p.y}`).join(" ");

  const targetY = target !== undefined ? yOf(target) : 0;
  const atTarget =
    target !== undefined ? points.filter((p) => p >= target).length : 0;

  // Faint trace dot grid — same furniture as the glyph take.
  const gridXs: number[] = [];
  for (let x = 0; x <= PLOT_W - 60; x += 108) gridXs.push(x);
  const gridYs: number[] = [];
  for (let y = 0; y <= PLOT_H - 60; y += 104) gridYs.push(y);

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
                style={{ position: "absolute", top: targetY - 14, right: 24 }}
              >
                {target}
              </span>
            ) : null}
            <span style={{ position: "absolute", bottom: -4, right: 24 }}>
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
            {/* Target hairline — an HTML dashed rule, like every other
                dashed reference in the system. */}
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

            <svg
              width={PLOT_W}
              height={PLOT_H}
              viewBox={`0 0 ${PLOT_W} ${PLOT_H}`}
              style={{ position: "absolute", top: 0, left: 0, display: "block", overflow: "visible" }}
            >
              <defs>
                {/* Vertical slack so the stroke is only ever cut by the
                    head's x, never by the plot's top or bottom edge. */}
                <clipPath id="lc-head-reveal">
                  <rect
                    x={0}
                    y={-STROKE * 2}
                    width={clipW}
                    height={PLOT_H + STROKE * 4}
                  />
                </clipPath>
              </defs>

              {/* Trace dot grid. */}
              {gridYs.map((gy) =>
                gridXs.map((gx) => (
                  <rect
                    key={`g${gx}-${gy}`}
                    x={gx - 2}
                    y={gy - 2}
                    width={4}
                    height={4}
                    fill={palette.trace}
                  />
                )),
              )}

              {/* The line — one continuous ink stroke, square everything. */}
              <g clipPath="url(#lc-head-reveal)">
                <polyline
                  points={polyline}
                  fill="none"
                  stroke={palette.ink}
                  strokeWidth={STROKE}
                  strokeLinecap="square"
                  strokeLinejoin="miter"
                />
              </g>

              {/* Day markers — each appears as the head passes it. */}
              {pts.map((p, i) =>
                frame >= drawStart && headX >= p.x ? (
                  <rect
                    key={`m${i}`}
                    x={p.x - MARKER / 2}
                    y={p.y - MARKER / 2}
                    width={MARKER}
                    height={MARKER}
                    fill={palette.ink}
                  />
                ) : null,
              )}

              {/* The carriage hairline rides only while ink is going down;
                  the head parks a beat on each end, then lifts off. */}
              {drawing ? (
                <rect
                  x={headX - 0.5}
                  y={0}
                  width={1}
                  height={PLOT_H}
                  fill={palette.trace}
                />
              ) : null}
              {headVisible ? (
                <rect
                  x={headX - HEAD_W / 2}
                  y={headY - HEAD_H / 2}
                  width={HEAD_W}
                  height={HEAD_H}
                  fill={palette.ink}
                />
              ) : null}
            </svg>
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
