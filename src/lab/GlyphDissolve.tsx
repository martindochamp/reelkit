import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { mono, palettes } from "../tokens";

/**
 * GlyphDissolve — one specimen becomes another, the way thermal paper
 * would do it: specimen A's glyphs decay cell by cell into sparse dots
 * and vanish (entropy, no machine), then a print bar sweeps down the
 * blank paper and specimen B prints in behind it, row by row with a
 * per-cell stagger. The receipt row underneath fades with A and prints
 * with B as the bar passes it.
 *
 * Both specimens are pre-converted ASCII (imageToAscii, same cols) and
 * arrive as props — this component never touches an image.
 *
 * End state: specimen B and its row, static.
 */

export const DISSOLVE_FPS = 30;

const ease = Easing.bezier(0.25, 0.1, 0.25, 1);
const clamp = {
  easing: ease,
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

// Timing (frames @30).
const HOLD_A = 30;
const DECAY = 34;
const GAP = 8;
const PRINT = 44;
const HOLD_B = 60;

export const glyphDissolveDuration = () =>
  HOLD_A + DECAY + GAP + PRINT + HOLD_B;

// Stage geometry — 1080×1920, content x 84→936, y 210→1360.
const PAD_X = 84;
const PAD_RIGHT = 144;
const STAGE_W = 1080 - PAD_X - PAD_RIGHT;
const MAX_ART_H = 820;

export type DissolveSpecimen = {
  /** Pre-converted ASCII art, every line the same width. */
  ascii: string;
  label: string;
  value: string;
  /** Faded provenance line under the row, e.g. "PER 100 G — RAW". */
  line?: string;
};

export type GlyphDissolveProps = {
  a: DissolveSpecimen;
  b: DissolveSpecimen;
  theme?: "light" | "dark";
};

/** Deterministic per-cell jitter — the same paper fades the same way. */
const hash = (x: number, y: number, seed: number) => {
  const s = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return s - Math.floor(s);
};

/** Pad both specimens onto one shared grid, centered vertically. */
const sharedGrid = (a: string, b: string) => {
  const la = a.split("\n");
  const lb = b.split("\n");
  const cols = Math.max(...la.map((l) => l.length), ...lb.map((l) => l.length));
  const rows = Math.max(la.length, lb.length);
  const pad = (lines: string[]) => {
    const top = Math.floor((rows - lines.length) / 2);
    const out: string[] = [];
    for (let y = 0; y < rows; y += 1) {
      const src = lines[y - top] ?? "";
      out.push(src.padEnd(cols, " "));
    }
    return out;
  };
  return { cols, rows, gridA: pad(la), gridB: pad(lb) };
};

/**
 * Receipt uppercase that keeps its units honest: JS uppercasing maps the
 * micro sign to Greek capital Mu, which prints as "M" — and 12 µg must
 * never read as 12 mg. Restore the µ after the transform.
 */
const upper = (s: string) => s.toUpperCase().replace(/Μ/g, "µ");

const Row: React.FC<{
  label: string;
  value: string;
  line?: string;
  ink: string;
  faded: string;
}> = ({ label, value, line, ink, faded }) => (
  <div>
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 24,
        borderTop: `3px solid ${ink}`,
        paddingTop: 26,
        fontFamily: mono,
        fontWeight: 700,
        fontSize: 34,
        color: ink,
      }}
    >
      <span style={{ letterSpacing: "0.06em" }}>{upper(label)}</span>
      <span style={{ whiteSpace: "nowrap" }}>{upper(value)}</span>
    </div>
    {line ? (
      <div
        style={{
          marginTop: 22,
          fontFamily: mono,
          fontSize: 24,
          letterSpacing: "0.18em",
          color: faded,
        }}
      >
        {upper(line)}
      </div>
    ) : null}
  </div>
);

export const GlyphDissolve: React.FC<GlyphDissolveProps> = ({
  a,
  b,
  theme = "dark",
}) => {
  const frame = useCurrentFrame();
  const palette = palettes[theme];

  const { cols, rows, gridA, gridB } = React.useMemo(
    () => sharedGrid(a.ascii, b.ascii),
    [a.ascii, b.ascii],
  );

  const decayStart = HOLD_A;
  const printStart = HOLD_A + DECAY + GAP;
  const printEnd = printStart + PRINT;

  // Same metric contract as every specimen: SF Mono, 0.6 em advance,
  // line height 1.
  const fontSize = Math.min(STAGE_W / (cols * 0.6), MAX_ART_H / rows);
  const artH = fontSize * rows;

  // Decay progress: A fades cell by cell. Darker fate is per-cell jitter —
  // each glyph collapses to a dot, then to paper.
  const p = interpolate(frame, [decayStart, decayStart + DECAY], [0, 1], clamp);

  // The print bar IS the frontier: it sweeps down the paper and cells
  // print as it passes them (a ragged row or two behind), then it exits
  // through the receipt row, printing that too.
  const ROW_TOP = artH + 44;
  const BAR_EXIT = ROW_TOP + 110;
  const barY =
    frame < printStart
      ? -40
      : interpolate(frame, [printStart, printEnd], [-30, BAR_EXIT], clamp);

  const text = React.useMemo(() => {
    const out: string[] = [];
    for (let y = 0; y < rows; y += 1) {
      let line = "";
      for (let x = 0; x < cols; x += 1) {
        const aCh = gridA[y][x];
        const bCh = gridB[y][x];
        let ch = " ";
        if (aCh !== " " && p < 1) {
          const t = 0.1 + 0.75 * hash(x, y, 1);
          if (p < t) ch = aCh;
          else if (p < t + 0.12) ch = "·";
        }
        if (bCh !== " " && frame >= printStart) {
          const jitter = (hash(x, y, 2) - 0.5) * 5;
          const trigger = (y + jitter) * fontSize;
          if (barY >= trigger + fontSize) ch = bCh;
          else if (barY >= trigger) ch = "·";
        }
        line += ch;
      }
      out.push(line);
    }
    return out.join("\n");
  }, [rows, cols, gridA, gridB, p, barY, frame, printStart, fontSize]);

  const barOpacity =
    frame < printStart
      ? 0
      : interpolate(barY, [ROW_TOP + 30, BAR_EXIT - 10], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

  // Row A fades with the paper; row B prints left-to-right as the bar
  // crosses it — keyed to the bar, so they can never drift apart.
  const rowAOpacity = interpolate(frame, [decayStart + 4, decayStart + DECAY], [1, 0], clamp);
  const rowBWipe = interpolate(barY, [ROW_TOP - 10, ROW_TOP + 90], [0, 1], clamp);

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
        <div style={{ position: "relative" }}>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <div
              style={{
                fontFamily: mono,
                fontSize,
                lineHeight: 1,
                whiteSpace: "pre",
                color: palette.ink,
              }}
            >
              {text}
            </div>
          </div>

          {/* The print bar. */}
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: barY,
              height: 3,
              backgroundColor: palette.ink,
              opacity: barOpacity,
            }}
          />

          {/* The receipt row, swapping in place. */}
          <div style={{ position: "relative", marginTop: 44, minHeight: 130 }}>
            <div style={{ opacity: rowAOpacity }}>
              <Row
                label={a.label}
                value={a.value}
                line={a.line}
                ink={palette.ink}
                faded={palette.faded}
              />
            </div>
            <div
              style={{
                position: "absolute",
                inset: 0,
                visibility: rowBWipe > 0 ? "visible" : "hidden",
                clipPath: `inset(0 ${(1 - rowBWipe) * 100}% 0 0)`,
              }}
            >
              <Row
                label={b.label}
                value={b.value}
                line={b.line}
                ink={palette.ink}
                faded={palette.faded}
              />
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
