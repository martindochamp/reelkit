import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { mono, palettes, type Palette } from "../tokens";
import { revealClip } from "./reveal";

/**
 * FlowDiagram — where the number goes.
 *
 * A schematic of an absorption journey, stacked vertically because the
 * frame is 9:16: two to four stages, each a hairline-bordered box with an
 * uppercase label, a heavy value and a faded sub. Between them a single
 * ink stroke is DRAWN downward — never present before its draw — ending
 * in a 90° chevron of two strokes at the next box's top edge.
 *
 * At a transition where something is lost, the stroke splits at a junction
 * (a small ink square) and a FADED branch exits sideways with its own
 * label: the amount that leaves, and where it goes. The branch cannot lead
 * the main stroke — its growth is driven by how far down the main stroke
 * has actually been laid, not by a second clock.
 *
 * The value shrinks stage by stage, in the number AND in the type: what
 * arrives is smaller than what was eaten, and the page says so twice. The
 * last box is bordered in ink — it is the number that matters.
 *
 * End state: every box printed, every stroke laid, the branch parked. A
 * static still. Motion doctrine: print wipes and one bezier ease.
 */

export type FlowStage = {
  /** Uppercase, small, faded — "COCOA POWDER". */
  label: string;
  /** The heavy line — "49 MG". */
  value: string;
  /** Faded qualifier under the value. */
  sub?: string;
};

/** One per transition: `losses[i]` leaves between stage i and stage i+1. */
export type FlowLoss = { label: string } | null;

export type FlowDiagramProps = {
  stages: FlowStage[];
  losses?: FlowLoss[];
  /** Small faded uppercase line, top left. */
  kicker?: string;
  /** Faded provenance line at the bottom. */
  line?: string;
  theme?: "light" | "dark";
  /** Frame the first stage prints (default 0). */
  appearAt?: number;
  /** Absolute frame each stage lands — for word-sync. */
  stageCues?: number[];
};

const rule = 2;
const PAD_X = 84;
const PAD_RIGHT = 144; // content ends at x = 936
const STAGE_W = 1080 - PAD_X - PAD_RIGHT; // 852

const BOX_W = 520; // the column; the rest is the loss gutter
const CX = BOX_W / 2; // the stroke runs down the box's centre
const GAP_H = 150;

const STROKE = 3;
const ARROW = 13; // chevron arm
const JUNCTION = 7; // the split marker, an ink square

const BRANCH_X = 556; // where the faded branch ends
const LABEL_X = BRANCH_X + 28;

const PRINT_FRAMES = 8;
const CONNECT_FRAMES = 14;
const STAGE_STAGGER = 52;
const ARRIVE_LEAD = 6; // the stroke lands this many frames before the box

const EASE = Easing.bezier(0.25, 0.1, 0.25, 1);

/** Top→down print wipe from `cue`, layout stable before it. */
const printStyle = (
  frame: number,
  cue: number,
  frames: number = PRINT_FRAMES,
): React.CSSProperties => revealClip(frame, cue, frames);

/** "−44 to −47.5 mg — passes through" → the amount, then where it went. */
const splitLoss = (label: string): [string, string | null] => {
  const parts = label.split("—").map((s) => s.trim());
  return parts.length > 1 ? [parts[0], parts.slice(1).join(" — ")] : [label, null];
};

/** The value type steps down with the value: 68, 59, 50, 44. */
const valueSize = (i: number) => Math.max(44, 68 - i * 9);

export const FlowDiagram: React.FC<FlowDiagramProps> = ({
  stages,
  losses,
  kicker,
  line,
  theme = "dark",
  appearAt = 0,
  stageCues,
}) => {
  const frame = useCurrentFrame();
  const palette: Palette = palettes[theme];

  const cueOf = (i: number) => stageCues?.[i] ?? appearAt + i * STAGE_STAGGER;
  const lastCue = cueOf(stages.length - 1);

  /** The gap ABOVE stage i (i ≥ 1); its loss is `losses[i - 1]`. */
  const gap = (i: number): React.ReactNode => {
    const arrive = cueOf(i) - ARRIVE_LEAD;
    const start = arrive - CONNECT_FRAMES;
    const progress = interpolate(frame, [start, arrive], [0, 1], {
      easing: EASE,
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const drawnY = progress * GAP_H;

    const loss = losses?.[i - 1] ?? null;
    const yJ = Math.round(GAP_H * 0.42);
    // The branch is a function of the ink already laid, never of a second
    // clock — it cannot appear ahead of the stroke that feeds it.
    const branch = interpolate(drawnY, [yJ, GAP_H], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const branchW = branch * (BRANCH_X - CX);
    const [amount, note] = loss ? splitLoss(loss.label) : ["", null];

    return (
      <div
        key={`gap${i}`}
        style={{ position: "relative", width: STAGE_W, height: GAP_H }}
      >
        <svg
          width={STAGE_W}
          height={GAP_H}
          viewBox={`0 0 ${STAGE_W} ${GAP_H}`}
          style={{ position: "absolute", top: 0, left: 0, display: "block" }}
        >
          <defs>
            <clipPath id={`fd-down-${i}`}>
              <rect x={0} y={0} width={STAGE_W} height={drawnY} />
            </clipPath>
            <clipPath id={`fd-side-${i}`}>
              <rect
                x={CX}
                y={yJ - 40}
                width={branchW}
                height={80}
              />
            </clipPath>
          </defs>

          {/* The main stroke and its chevron — one clip, one head. */}
          <g clipPath={`url(#fd-down-${i})`}>
            <line
              x1={CX}
              y1={0}
              x2={CX}
              y2={GAP_H}
              stroke={palette.ink}
              strokeWidth={STROKE}
              strokeLinecap="square"
            />
            <polyline
              points={`${CX - ARROW},${GAP_H - ARROW} ${CX},${GAP_H} ${CX + ARROW},${GAP_H - ARROW}`}
              fill="none"
              stroke={palette.ink}
              strokeWidth={STROKE}
              strokeLinecap="square"
              strokeLinejoin="miter"
            />
          </g>

          {loss ? (
            <>
              {/* The split, marked. */}
              {drawnY >= yJ ? (
                <rect
                  x={CX - JUNCTION / 2}
                  y={yJ - JUNCTION / 2}
                  width={JUNCTION}
                  height={JUNCTION}
                  fill={palette.ink}
                />
              ) : null}
              <g clipPath={`url(#fd-side-${i})`}>
                <line
                  x1={CX}
                  y1={yJ}
                  x2={BRANCH_X}
                  y2={yJ}
                  stroke={palette.faded}
                  strokeWidth={rule}
                  strokeLinecap="square"
                />
                <polyline
                  points={`${BRANCH_X - ARROW},${yJ - ARROW} ${BRANCH_X},${yJ} ${BRANCH_X - ARROW},${yJ + ARROW}`}
                  fill="none"
                  stroke={palette.faded}
                  strokeWidth={rule}
                  strokeLinecap="square"
                  strokeLinejoin="miter"
                />
              </g>
            </>
          ) : null}
        </svg>

        {/* What leaves — faded, so it never competes with the column.
            Its print starts while the branch is still running out, so
            junction, arrow and label read as ONE gesture — the label can
            never sit finished over an unfinished branch (wipe outlasts
            the run-out), and never trails it either. */}
        {loss ? (
          <div
            style={{
              position: "absolute",
              top: yJ - 34,
              left: LABEL_X,
              width: STAGE_W - LABEL_X,
              fontFamily: mono,
              textTransform: "uppercase",
              color: palette.faded,
              ...printStyle(frame, arrive - 4, 10),
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 26, letterSpacing: "0.04em" }}>
              {amount}
            </div>
            {note ? (
              <div
                style={{
                  marginTop: 10,
                  fontSize: 22,
                  lineHeight: 1.35,
                  letterSpacing: "0.14em",
                }}
              >
                {note}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    );
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
          alignItems: "flex-start",
        }}
      >
        {kicker ? (
          <div
            style={{
              fontFamily: mono,
              fontSize: 26,
              letterSpacing: "0.25em",
              textTransform: "uppercase",
              color: palette.faded,
              marginBottom: 44,
              ...printStyle(frame, appearAt, 10),
            }}
          >
            {kicker}
          </div>
        ) : null}

        {stages.map((stage, i) => (
          <React.Fragment key={i}>
            {i > 0 ? gap(i) : null}
            <div
              style={{
                width: BOX_W,
                boxSizing: "border-box",
                border: `${rule}px solid ${
                  i === stages.length - 1 ? palette.ink : palette.trace
                }`,
                padding: "26px 30px",
                ...printStyle(frame, cueOf(i)),
              }}
            >
              <div
                style={{
                  fontFamily: mono,
                  fontSize: 24,
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  color: palette.faded,
                }}
              >
                {stage.label}
              </div>
              <div
                style={{
                  marginTop: 14,
                  fontFamily: mono,
                  fontWeight: 700,
                  fontSize: valueSize(i),
                  lineHeight: 1,
                  letterSpacing: "0.02em",
                  textTransform: "uppercase",
                  color: palette.ink,
                }}
              >
                {stage.value}
              </div>
              {stage.sub ? (
                <div
                  style={{
                    marginTop: 16,
                    fontFamily: mono,
                    fontSize: 22,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: palette.faded,
                  }}
                >
                  {stage.sub}
                </div>
              ) : null}
            </div>
          </React.Fragment>
        ))}

        {line ? (
          <div
            style={{
              marginTop: 48,
              fontFamily: mono,
              fontSize: 24,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: palette.faded,
              ...printStyle(frame, lastCue + 18, 10),
            }}
          >
            {line}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
