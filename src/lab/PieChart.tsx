import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { mono, palettes, type Palette } from "../tokens";
import { revealStyle } from "./reveal";

/**
 * PieChart — a camembert drawn in glyphs, plus its rectangle-native
 * sibling CompositionBar (one stacked bar, same textures, same legend).
 *
 * The disc is a character grid in the house metric (SF Mono, 0.6 em
 * advance, line height 1). Every cell inside the disc belongs to a
 * sector by its angle from 12 o'clock; sectors are told apart by GLYPH
 * DENSITY, never by color — sector 1 prints heavy glyphs, sector 2 thin
 * strokes, sector 3 sparse dots, all in the same ink (coverage, not
 * tone, separates them — faded dots vanish on a phone; the tone drops
 * to faded only at the fourth class). Per-cell glyph
 * choice is deterministic jitter (the same paper prints the same way
 * every frame), so the texture looks organic without ever shimmering.
 *
 * Motion: the pie SWEEPS in clockwise from 12 o'clock — a radial
 * reveal on the house bezier; a cell prints as the sweep passes its
 * angle, showing a "·" for a beat at the ragged frontier, the way the
 * print bar leaves a wake in GlyphDissolve. Legend rows print as their
 * sector completes. Nothing springs, nothing bounces. The end state
 * reads as a static.
 */

export type PieSlice = {
  label: string;
  value: string;
  /** Share of the whole, 0..1. Normalized against the sum, so the disc always closes. */
  fraction: number;
};

export type PieChartProps = {
  slices: PieSlice[];
  /** Small faded uppercase line above the chart. */
  kicker?: string;
  /** Faded provenance line under the legend. */
  line?: string;
  theme?: "light" | "dark";
  /** Frame the kicker prints; the sweep starts a beat later (default 0). */
  appearAt?: number;
  /** Absolute start frames, one per slice — sector-by-sector reveal instead of one sweep. */
  sectorCues?: number[];
  /** Punch the center out — a donut instead of a camembert. */
  donut?: boolean;
  /** Glyph columns across the disc (default 56). */
  cols?: number;
};

export type CompositionBarProps = Omit<PieChartProps, "donut" | "cols"> & {
  /** Glyph columns across the bar (default 66). */
  cols?: number;
};

// Stage geometry — 1080×1920, content x 84→936, y 210→1360.
const rule = 2;
const PAD_X = 84;
const PAD_RIGHT = 144;
const STAGE_W = 1080 - PAD_X - PAD_RIGHT; // 852
const TOP = 210;
const BOTTOM = 1920 - 1360;

const PRINT_FRAMES = 10; // kicker / legend print wipe, house style
const SWEEP = 45; // frames the full-circle sweep takes
const KICKER_LEAD = 8; // the kicker leads the sweep by a beat
const MAX_DISC = 640; // disc diameter budget, px

const EASE = Easing.bezier(0.25, 0.1, 0.25, 1);
const clampEase = {
  easing: EASE,
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

type Tone = "ink" | "faded";

/**
 * The density classes — the only differentiator between sectors.
 * Three steps of INK COVERAGE (heavy mass, thin hatch, sparse speckle),
 * all in full ink: the phone test killed faded dots, which read as a
 * hole in the disc at 390 px. Tone drops to faded only at the fourth,
 * dashed class. Slices past four cycle. `swatch` is the 3-char texture
 * sample the legend row carries.
 */
const DENSITY: { glyphs: string; swatch: string; tone: Tone }[] = [
  { glyphs: "QBg&8", swatch: "gQg", tone: "ink" },
  { glyphs: "z|:/", swatch: "z|z", tone: "ink" },
  { glyphs: "·.", swatch: "···", tone: "ink" },
  { glyphs: "~-", swatch: "~-~", tone: "faded" },
];

/** Deterministic per-cell jitter — the same paper prints the same way. */
const hash = (x: number, y: number, seed: number) => {
  const s = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return s - Math.floor(s);
};

/** Top→down print wipe from `cue`, layout stable before it. */
const printStyle = (frame: number, cue: number): React.CSSProperties =>
  revealStyle(frame, cue);

/** First frame (0..dur) at which the eased sweep reaches `target` (0..1). */
const solve = (target: number, dur: number) => {
  for (let f = 0; f <= dur; f += 1) {
    if (EASE(f / dur) >= target - 1e-6) return f;
  }
  return dur;
};

/** Cumulative boundaries [0, …, 1] from normalized slice fractions. */
const cumOf = (slices: PieSlice[]) => {
  const total = slices.reduce((s, r) => s + Math.max(0, r.fraction), 0) || 1;
  const cum: number[] = [0];
  for (const s of slices) {
    cum.push(cum[cum.length - 1] + Math.max(0, s.fraction) / total);
  }
  cum[cum.length - 1] = 1;
  return cum;
};

type Cell = {
  /** Position on the reveal axis, 0..1 (angle for the pie, x for the bar). */
  frac: number;
  sector: number;
  ch: string;
  jit: number;
  tone: Tone;
} | null;

/**
 * The grid, resolved for this frame: hidden cells are spaces, cells at
 * the frontier print "·", settled cells print their glyph. Contiguous
 * same-tone cells collapse into one span so the DOM stays light.
 */
const GlyphGrid: React.FC<{
  grid: Cell[][];
  fontSize: number;
  frontFor: (sector: number) => number;
  started: (sector: number) => boolean;
  frontWidth: number;
  palette: Palette;
}> = ({ grid, fontSize, frontFor, started, frontWidth, palette }) => (
  <div
    style={{
      fontFamily: mono,
      fontSize,
      lineHeight: 1,
      whiteSpace: "pre",
    }}
  >
    {grid.map((row, y) => {
      const runs: { ch: string; tone: Tone }[] = [];
      const push = (ch: string, tone: Tone) => {
        const last = runs[runs.length - 1];
        if (last && (last.tone === tone || ch === " ")) last.ch += ch;
        else runs.push({ ch, tone });
      };
      for (const cell of row) {
        if (!cell) {
          push(" ", "ink");
          continue;
        }
        const a = cell.frac + cell.jit;
        const front = frontFor(cell.sector);
        if (!started(cell.sector) || a > front) push(" ", "ink");
        else if (front - a < frontWidth) push("·", cell.tone);
        else push(cell.ch, cell.tone);
      }
      return (
        <div key={y}>
          {runs.map((r, i) => (
            <span
              key={i}
              style={{ color: r.tone === "ink" ? palette.ink : palette.faded }}
            >
              {r.ch}
            </span>
          ))}
        </div>
      );
    })}
  </div>
);

const Kicker: React.FC<{
  text: string;
  cue: number;
  frame: number;
  palette: Palette;
}> = ({ text, cue, frame, palette }) => (
  <div
    style={{
      ...printStyle(frame, cue),
      fontFamily: mono,
      fontSize: 26,
      letterSpacing: "0.25em",
      textTransform: "uppercase",
      color: palette.faded,
      marginBottom: 48,
    }}
  >
    {text}
  </div>
);

/**
 * Receipt legend — one row per sector: a texture swatch in the sector's
 * own glyphs, label left, heavy value right. Rows print as their sector
 * completes; the provenance line follows.
 */
const Legend: React.FC<{
  slices: PieSlice[];
  cues: number[];
  line?: string;
  lineCue: number;
  frame: number;
  palette: Palette;
}> = ({ slices, cues, line, lineCue, frame, palette }) => (
  <div style={{ marginTop: 48 }}>
    {slices.map((s, i) => {
      const cls = DENSITY[i % DENSITY.length];
      return (
        <div
          key={i}
          style={{
            ...printStyle(frame, cues[i]),
            display: "flex",
            alignItems: "baseline",
            gap: 28,
            padding: "18px 0",
            borderTop: `${rule}px solid ${i === 0 ? palette.ink : palette.trace}`,
            fontFamily: mono,
            fontSize: 29,
            textTransform: "uppercase",
            color: palette.ink,
          }}
        >
          <span
            style={{
              whiteSpace: "pre",
              // The swatch is a texture sample, not a word — the row's
              // uppercase must not rewrite its glyphs (gQg, not GQG).
              textTransform: "none",
              color: cls.tone === "ink" ? palette.ink : palette.faded,
            }}
          >
            {cls.swatch}
          </span>
          <span style={{ letterSpacing: "0.06em", flex: 1 }}>{s.label}</span>
          <span style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{s.value}</span>
        </div>
      );
    })}
    {line ? (
      <div
        style={{
          ...printStyle(frame, lineCue),
          marginTop: 22,
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
);

/** Shared reveal timing for both charts, continuous or per-sector cued. */
const useReveal = (
  frame: number,
  cum: number[],
  sweepStart: number,
  sectorCues?: number[],
) => {
  const spans = cum.slice(1).map((c, i) => c - cum[i]);
  const durs = spans.map((s) => Math.max(10, Math.round(SWEEP * s)));
  const frontFor = (s: number) => {
    if (sectorCues) {
      const p = interpolate(
        frame,
        [sectorCues[s], sectorCues[s] + durs[s]],
        [0, 1],
        clampEase,
      );
      return cum[s] + spans[s] * p;
    }
    return interpolate(frame, [sweepStart, sweepStart + SWEEP], [0, 1], clampEase);
  };
  const started = (s: number) =>
    frame >= (sectorCues ? sectorCues[s] : sweepStart);
  const legendCues = spans.map((_, i) =>
    sectorCues
      ? sectorCues[i] + durs[i] + 2
      : sweepStart + solve(cum[i + 1], SWEEP) + 2,
  );
  const lineCue = Math.max(...legendCues) + 12;
  return { frontFor, started, legendCues, lineCue };
};

export const PieChart: React.FC<PieChartProps> = ({
  slices,
  kicker,
  line,
  theme = "dark",
  appearAt = 0,
  sectorCues,
  donut = false,
  cols = 56,
}) => {
  const frame = useCurrentFrame();
  const palette: Palette = palettes[theme];
  const cum = React.useMemo(() => cumOf(slices), [slices]);

  // A square disc in px: rows tall = cols × 0.6 wide (the char aspect).
  const rows = Math.round(cols * 0.6);
  const fontSize = MAX_DISC / rows;

  const grid = React.useMemo(() => {
    const R = Math.min(rows, cols * 0.6) / 2;
    const inner = donut ? R * 0.46 : 0;
    const g: Cell[][] = [];
    for (let y = 0; y < rows; y += 1) {
      const row: Cell[] = [];
      for (let x = 0; x < cols; x += 1) {
        // Cell center in row-height units; columns are 0.6 of a row.
        const dx = (x + 0.5 - cols / 2) * 0.6;
        const dy = y + 0.5 - rows / 2;
        const r = Math.hypot(dx, dy);
        if (r > R - 0.05 || r < inner) {
          row.push(null);
          continue;
        }
        // Angle from 12 o'clock, clockwise, 0..1.
        let a = Math.atan2(dx, -dy) / (2 * Math.PI);
        if (a < 0) a += 1;
        let sector = 0;
        while (sector < cum.length - 2 && a >= cum[sector + 1]) sector += 1;
        const cls = DENSITY[sector % DENSITY.length];
        row.push({
          frac: a,
          sector,
          ch: cls.glyphs[Math.floor(hash(x, y, 3) * cls.glyphs.length)],
          jit: (hash(x, y, 7) - 0.5) * 0.02,
          tone: cls.tone,
        });
      }
      g.push(row);
    }
    return g;
  }, [rows, cols, donut, cum]);

  const sweepStart = appearAt + KICKER_LEAD;
  const { frontFor, started, legendCues, lineCue } = useReveal(
    frame,
    cum,
    sweepStart,
    sectorCues,
  );

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
        {kicker ? (
          <Kicker text={kicker} cue={appearAt} frame={frame} palette={palette} />
        ) : null}

        <div style={{ display: "flex", justifyContent: "center" }}>
          <GlyphGrid
            grid={grid}
            fontSize={fontSize}
            frontFor={frontFor}
            started={started}
            frontWidth={0.035}
            palette={palette}
          />
        </div>

        <Legend
          slices={slices}
          cues={legendCues}
          line={line}
          lineCue={lineCue}
          frame={frame}
          palette={palette}
        />
      </div>
    </AbsoluteFill>
  );
};

/**
 * CompositionBar — the same composition as one horizontal stacked bar:
 * a trace-hairline track, glyph-textured segments split by fraction,
 * revealed left→right so segments complete in order (or per-segment via
 * `sectorCues`), the same legend printing row by row.
 */
export const CompositionBar: React.FC<CompositionBarProps> = ({
  slices,
  kicker,
  line,
  theme = "dark",
  appearAt = 0,
  sectorCues,
  cols = 66,
}) => {
  const frame = useCurrentFrame();
  const palette: Palette = palettes[theme];
  const cum = React.useMemo(() => cumOf(slices), [slices]);

  const BAR_ROWS = 7;
  const PAD_IN = 8; // glyphs off the hairline
  const innerW = STAGE_W - 2 * rule - 2 * PAD_IN;
  const fontSize = innerW / (cols * 0.6);

  const grid = React.useMemo(() => {
    const g: Cell[][] = [];
    for (let y = 0; y < BAR_ROWS; y += 1) {
      const row: Cell[] = [];
      for (let x = 0; x < cols; x += 1) {
        const f = (x + 0.5) / cols;
        let sector = 0;
        while (sector < cum.length - 2 && f >= cum[sector + 1]) sector += 1;
        const cls = DENSITY[sector % DENSITY.length];
        row.push({
          frac: f,
          sector,
          ch: cls.glyphs[Math.floor(hash(x, y, 3) * cls.glyphs.length)],
          jit: (hash(x, y, 7) - 0.5) * 0.015,
          tone: cls.tone,
        });
      }
      g.push(row);
    }
    return g;
  }, [cols, cum]);

  const sweepStart = appearAt + KICKER_LEAD;
  const { frontFor, started, legendCues, lineCue } = useReveal(
    frame,
    cum,
    sweepStart,
    sectorCues,
  );

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
        {kicker ? (
          <Kicker text={kicker} cue={appearAt} frame={frame} palette={palette} />
        ) : null}

        <div
          style={{
            ...printStyle(frame, appearAt + 4),
            boxSizing: "border-box",
            border: `${rule}px solid ${palette.trace}`,
            padding: `6px ${PAD_IN}px`,
          }}
        >
          <GlyphGrid
            grid={grid}
            fontSize={fontSize}
            frontFor={frontFor}
            started={started}
            frontWidth={1.8 / cols}
            palette={palette}
          />
        </div>

        <Legend
          slices={slices}
          cues={legendCues}
          line={line}
          lineCue={lineCue}
          frame={frame}
          palette={palette}
        />
      </div>
    </AbsoluteFill>
  );
};
