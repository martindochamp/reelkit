import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  interpolateColors,
  useCurrentFrame,
} from "remotion";
import { mono, mu, palettes, type Palette } from "../tokens";
import { PrintWipe } from "./reveals";

/**
 * ComparisonTable — the duel.
 *
 * Two subjects head to head, tale-of-the-tape: subject A owns the left
 * column, subject B the right, the metric sits centered between them like
 * the spine of the card. Per row the WINNING cell prints heavy ink, the
 * loser regular faded — the table itself renders the verdict. No colors,
 * no icons; `winner: "none"` prints both cells plain ink (a draw has no
 * heavy type). Optional closing verdict row under a heavy top rule.
 *
 * Rows print one by one (cue-able). Two landing modes for a row's values:
 * - "together" — one print wipe carries the whole row.
 * - "duel"     — metric + A land first, B answers `duelDelay` frames
 *                later (default). A losing A prints FULL ink and only
 *                concedes — eases to faded — once B's answer is on the
 *                paper: the row never pre-judges the exchange.
 *
 * End state is a valid static: every row printed, winners heavy, verdict
 * stamped in type. Motion is print wipes and bezier(0.25,0.1,0.25,1) only.
 */

export type ComparisonRow = {
  metric: string;
  va: string;
  vb: string;
  /** Heavy-ink cell. "none" (default) prints both plain ink — a draw. */
  winner?: "a" | "b" | "none";
};

export type ComparisonTableProps = {
  a: string;
  b: string;
  title?: string;
  rows: ComparisonRow[];
  /** Closing row under a heavy rule — the overall verdict as text. */
  verdict?: { left: string; right: string };
  theme?: "light" | "dark";
  appearAt?: number;
  /** Frames between row cues when `rowCues` is not given. */
  stagger?: number;
  /**
   * Absolute cue frame per row. May carry rows.length + 1 entries — the
   * extra last one cues the verdict row.
   */
  rowCues?: number[];
  /** How a row's two values land. Picked on film: "duel". */
  landing?: "together" | "duel";
  /** Frames between A landing and B answering in "duel" mode. */
  duelDelay?: number;
};

const rule = 2;
const PAD_X = 84;
const PAD_RIGHT = 144; // content ends at x = 936
const EASE = Easing.bezier(0.25, 0.1, 0.25, 1);
const PRINT_FRAMES = 7;
const CONCEDE_FRAMES = 12;

type Role = "win" | "lose" | "flat";

const valueStyle = (role: Role, palette: Palette): React.CSSProperties => ({
  fontFamily: mono,
  fontSize: 34,
  fontWeight: role === "win" ? 700 : 400,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
  color: role === "lose" ? palette.faded : palette.ink,
});

export const ComparisonTable: React.FC<ComparisonTableProps> = ({
  a,
  b,
  title,
  rows,
  verdict,
  theme = "dark",
  appearAt = 0,
  stagger = 26,
  rowCues,
  landing = "duel",
  duelDelay = 8,
}) => {
  const frame = useCurrentFrame();
  const palette: Palette = palettes[theme];

  // --- timeline -----------------------------------------------------------
  const headerCue = appearAt + (title ? 8 : 0);
  const firstRow = headerCue + 18;
  const cueFor = (i: number) => rowCues?.[i] ?? firstRow + i * stagger;
  const verdictCue =
    rowCues?.[rows.length] ?? cueFor(rows.length - 1) + stagger + 8;

  const headerName: React.CSSProperties = {
    fontFamily: mono,
    fontWeight: 700,
    fontSize: 34,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    whiteSpace: "nowrap",
    color: palette.ink,
  };

  const metricStyle: React.CSSProperties = {
    fontFamily: mono,
    fontSize: 24,
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    textAlign: "center",
    color: palette.faded,
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
        {title ? (
          <PrintWipe cue={appearAt} frames={PRINT_FRAMES}>
            <div
              style={{
                fontFamily: mono,
                fontSize: 26,
                letterSpacing: "0.25em",
                textTransform: "uppercase",
                color: palette.faded,
                marginBottom: 44,
              }}
            >
              {mu(title)}
            </div>
          </PrintWipe>
        ) : null}

        {/* Header — A left, B right, a trace rule bridging the middle. */}
        <PrintWipe cue={headerCue} frames={PRINT_FRAMES}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 32,
              paddingBottom: 26,
              borderBottom: `${rule}px solid ${palette.ink}`,
            }}
          >
            <span style={headerName}>{mu(a)}</span>
            <div
              style={{ flex: 1, height: rule, backgroundColor: palette.trace }}
            />
            <span style={headerName}>{mu(b)}</span>
          </div>
        </PrintWipe>

        {/* Metric rows — tale of the tape. */}
        {rows.map((row, i) => {
          const cue = cueFor(i);
          const roleA: Role =
            row.winner === "a" ? "win" : row.winner === "b" ? "lose" : "flat";
          const roleB: Role =
            row.winner === "b" ? "win" : row.winner === "a" ? "lose" : "flat";
          const cellB = (
            <span style={valueStyle(roleB, palette)}>{mu(row.vb)}</span>
          );
          // In duel mode a losing A prints full ink and concedes only
          // once B's answer has landed on the paper.
          let styleA = valueStyle(roleA, palette);
          if (landing === "duel" && roleA === "lose") {
            const start = cue + duelDelay + PRINT_FRAMES / 2;
            const p = interpolate(
              frame,
              [start, start + CONCEDE_FRAMES],
              [0, 1],
              {
                easing: EASE,
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              },
            );
            styleA = {
              ...styleA,
              color: interpolateColors(p, [0, 1], [palette.ink, palette.faded]),
            };
          }
          return (
            <PrintWipe key={i} cue={cue} frames={PRINT_FRAMES}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto 1fr",
                  alignItems: "baseline",
                  gap: 24,
                  padding: "32px 0",
                  borderBottom: `${rule}px dashed ${palette.trace}`,
                }}
              >
                <span style={{ ...styleA, justifySelf: "start" }}>
                  {mu(row.va)}
                </span>
                <span style={metricStyle}>{mu(row.metric)}</span>
                <div style={{ justifySelf: "end" }}>
                  {landing === "duel" ? (
                    <PrintWipe cue={cue + duelDelay} frames={PRINT_FRAMES}>
                      {cellB}
                    </PrintWipe>
                  ) : (
                    cellB
                  )}
                </div>
              </div>
            </PrintWipe>
          );
        })}

        {/* Verdict — the closing row, heavy top rule, house total style. */}
        {verdict ? (
          <PrintWipe cue={verdictCue} frames={PRINT_FRAMES}>
            <div
              style={{
                marginTop: 12,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: 24,
                padding: "28px 0 0",
                borderTop: `${rule}px solid ${palette.ink}`,
                fontFamily: mono,
                fontWeight: 700,
                fontSize: 34,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: palette.ink,
              }}
            >
              <span>{mu(verdict.left)}</span>
              <span style={{ whiteSpace: "nowrap" }}>{mu(verdict.right)}</span>
            </div>
          </PrintWipe>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
