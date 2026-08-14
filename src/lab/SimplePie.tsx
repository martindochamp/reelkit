import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { mono, palettes, type Palette } from "../tokens";
import { revealStyle } from "./reveal";

/**
 * SimplePie — the geometric camembert. The clean sibling of the glyph
 * PieChart: same props, same legend contract, same cues, but the disc is
 * SVG arcs in the LineChart register — ink strokes, square joins, no
 * texture theater.
 *
 * Sectors start at 12 o'clock and run clockwise. They are told apart by
 * FILL TREATMENT, never by color: solid ink, diagonal hatch (3px ink
 * lines at 45°, pattern anchored in user space so it cannot shimmer),
 * faded outline (paper fill, 3px faded stroke — trace died the phone
 * test), and — only past three — solid faded. Between sectors, 2px of
 * paper: every wedge is inset half the gap along both radial edges, so
 * the gap stays constant to the rim. The hatch field is bounded by an
 * ink rule along its arcs — stripe tips meeting the rim at a grazing
 * angle read as mush once video compression has had them — while its
 * radial edges stay bare so the paper gaps keep their 2px.
 *
 * Motion: one clockwise sweep over ~45 frames on the house bezier, or
 * sector-by-sector via `sectorCues`. Legend rows print as their sector
 * completes; the optional donut center label prints when the disc
 * closes. Nothing springs, nothing bounces. The end state is a still.
 */

export type SimplePieSlice = {
  label: string;
  value: string;
  /** Share of the whole, 0..1. Normalized against the sum, so the disc always closes. */
  fraction: number;
};

/** Prop shape matches PieChart — specs are interchangeable between the two. */
export type SimplePieProps = {
  slices: SimplePieSlice[];
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
  /** Donut center label: heavy value + faded caption. Ignored without `donut`. */
  center?: { value: string; caption?: string };
};

// Stage geometry — 1080×1920, content x 84→936, y 210→1360.
const rule = 2;
const PAD_X = 84;
const PAD_RIGHT = 144;
const TOP = 210;
const BOTTOM = 1920 - 1360;

const PRINT_FRAMES = 10; // kicker / legend print wipe, house style
const SWEEP = 45; // frames the full-circle sweep takes
const KICKER_LEAD = 8; // the kicker leads the sweep by a beat

const SIZE = 648; // disc block, px
const R = 320; // outer radius
const INNER = 0.46; // donut hole, share of R — same as the glyph pie
const GAP = 2; // paper between sectors, px
const HATCH_PERIOD = 11; // hatch line spacing, px
const HATCH_LINE = 3; // hatch line thickness, px
const SWATCH = 20; // legend swatch square, px
const OUTLINE_STROKE = 3; // the outline sector's rule — LineChart's weight
const TAU = Math.PI * 2;

const EASE = Easing.bezier(0.25, 0.1, 0.25, 1);
const clampEase = {
  easing: EASE,
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

/** The four treatments, in order; slices past four cycle. */
const TREATMENTS = ["solid", "hatch", "outline", "faded"] as const;
type Treatment = (typeof TREATMENTS)[number];

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
const cumOf = (slices: SimplePieSlice[]) => {
  const total = slices.reduce((s, r) => s + Math.max(0, r.fraction), 0) || 1;
  const cum: number[] = [0];
  for (const s of slices) {
    cum.push(cum[cum.length - 1] + Math.max(0, s.fraction) / total);
  }
  cum[cum.length - 1] = 1;
  return cum;
};

/** Point at radius r, angle a from 12 o'clock clockwise. */
const pt = (cx: number, cy: number, r: number, a: number) =>
  `${(cx + r * Math.sin(a)).toFixed(2)} ${(cy - r * Math.cos(a)).toFixed(2)}`;

/**
 * One wedge, both radial edges inset by half the paper gap so adjacent
 * sectors sit GAP px apart all the way out. For the pie, the tip parks
 * where the two offset edges meet (capped while the slice is still a
 * sliver mid-reveal). Returns null while the visible span is too thin
 * to carry its gap.
 */
const wedge = (
  cx: number,
  cy: number,
  outer: number,
  inner: number,
  a0: number,
  a1: number,
  g: number,
): string | null => {
  const span = a1 - a0;
  const outIn = g / outer; // angular inset at the rim
  if (inner > 0) {
    const inIn = g / inner;
    if (span <= 2 * inIn + 0.004) return null;
    const largeO = span - 2 * outIn > Math.PI ? 1 : 0;
    const largeI = span - 2 * inIn > Math.PI ? 1 : 0;
    return [
      `M ${pt(cx, cy, outer, a0 + outIn)}`,
      `A ${outer} ${outer} 0 ${largeO} 1 ${pt(cx, cy, outer, a1 - outIn)}`,
      `L ${pt(cx, cy, inner, a1 - inIn)}`,
      `A ${inner} ${inner} 0 ${largeI} 0 ${pt(cx, cy, inner, a0 + inIn)}`,
      "Z",
    ].join(" ");
  }
  if (span <= 2 * outIn + 0.008) return null;
  const tip = Math.min(g / Math.sin(span / 2), 20);
  const largeO = span - 2 * outIn > Math.PI ? 1 : 0;
  return [
    `M ${pt(cx, cy, tip, a0 + span / 2)}`,
    `L ${pt(cx, cy, outer, a0 + outIn)}`,
    `A ${outer} ${outer} 0 ${largeO} 1 ${pt(cx, cy, outer, a1 - outIn)}`,
    "Z",
  ].join(" ");
};

/** Just the arc at radius r between the inset edges — the hatch's rim rule. */
const arcPath = (
  cx: number,
  cy: number,
  r: number,
  a0: number,
  a1: number,
  g: number,
): string | null => {
  const inset = g / r;
  if (a1 - a0 <= 2 * inset + 0.004) return null;
  const large = a1 - a0 - 2 * inset > Math.PI ? 1 : 0;
  return `M ${pt(cx, cy, r, a0 + inset)} A ${r} ${r} 0 ${large} 1 ${pt(cx, cy, r, a1 - inset)}`;
};

/** Fill/stroke for one treatment on the disc. */
const paint = (
  t: Treatment,
  palette: Palette,
  hatchId: string,
): React.SVGProps<SVGPathElement> => {
  switch (t) {
    case "solid":
      return { fill: palette.ink };
    case "hatch":
      return { fill: `url(#${hatchId})` };
    case "outline":
      return {
        fill: palette.paper,
        stroke: palette.faded,
        strokeWidth: OUTLINE_STROKE,
        strokeLinejoin: "miter",
      };
    case "faded":
      return { fill: palette.faded };
  }
};

/** The hatch tile — fixed user-space coordinates, so it never shimmers. */
const HatchDef: React.FC<{ id: string; palette: Palette }> = ({
  id,
  palette,
}) => (
  <pattern
    id={id}
    patternUnits="userSpaceOnUse"
    width={HATCH_PERIOD}
    height={HATCH_PERIOD}
    patternTransform="rotate(45)"
  >
    <rect x={0} y={0} width={HATCH_PERIOD} height={HATCH_LINE} fill={palette.ink} />
  </pattern>
);

/** 20px legend swatch carrying the sector's exact fill treatment. */
const Swatch: React.FC<{ t: Treatment; palette: Palette; uid: string }> = ({
  t,
  palette,
  uid,
}) => (
  <svg
    width={SWATCH}
    height={SWATCH}
    viewBox={`0 0 ${SWATCH} ${SWATCH}`}
    style={{ display: "block", flexShrink: 0 }}
  >
    {t === "hatch" ? (
      <defs>
        <HatchDef id={`${uid}-hp`} palette={palette} />
      </defs>
    ) : null}
    {t === "outline" ? (
      <rect
        x={OUTLINE_STROKE / 2}
        y={OUTLINE_STROKE / 2}
        width={SWATCH - OUTLINE_STROKE}
        height={SWATCH - OUTLINE_STROKE}
        fill={palette.paper}
        stroke={palette.faded}
        strokeWidth={OUTLINE_STROKE}
      />
    ) : (
      <rect
        width={SWATCH}
        height={SWATCH}
        fill={
          t === "solid"
            ? palette.ink
            : t === "faded"
              ? palette.faded
              : `url(#${uid}-hp)`
        }
      />
    )}
  </svg>
);

export const SimplePie: React.FC<SimplePieProps> = ({
  slices,
  kicker,
  line,
  theme = "dark",
  appearAt = 0,
  sectorCues,
  donut = false,
  center,
}) => {
  const frame = useCurrentFrame();
  const palette: Palette = palettes[theme];
  const uid = React.useId().replace(/[^a-zA-Z0-9]/g, "");
  const hatchId = `${uid}-hatch`;

  const cum = React.useMemo(() => cumOf(slices), [slices]);
  const spans = cum.slice(1).map((c, i) => c - cum[i]);
  const durs = spans.map((s) => Math.max(10, Math.round(SWEEP * s)));

  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const inner = donut ? R * INNER : 0;

  const sweepStart = appearAt + KICKER_LEAD;
  /** How far around the circle sector `i`'s reveal has reached, 0..1. */
  const frontOf = (i: number) => {
    if (sectorCues) {
      const p = interpolate(
        frame,
        [sectorCues[i], sectorCues[i] + durs[i]],
        [0, 1],
        clampEase,
      );
      return cum[i] + spans[i] * p;
    }
    return interpolate(frame, [sweepStart, sweepStart + SWEEP], [0, 1], clampEase);
  };
  const started = (i: number) =>
    frame >= (sectorCues ? sectorCues[i] : sweepStart);

  const legendCues = spans.map((_, i) =>
    sectorCues
      ? sectorCues[i] + durs[i] + 2
      : sweepStart + solve(cum[i + 1], SWEEP) + 2,
  );
  const discDone = Math.max(...legendCues);
  const centerCue = discDone + 2;
  const lineCue = discDone + 12;

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
            {kicker}
          </div>
        ) : null}

        {/* The disc. */}
        <div style={{ display: "flex", justifyContent: "center" }}>
          <div style={{ position: "relative", width: SIZE, height: SIZE }}>
            <svg
              width={SIZE}
              height={SIZE}
              viewBox={`0 0 ${SIZE} ${SIZE}`}
              style={{ display: "block" }}
            >
              <defs>
                <HatchDef id={hatchId} palette={palette} />
              </defs>
              {slices.map((_, i) => {
                if (!started(i)) return null;
                const end = Math.min(frontOf(i), cum[i + 1]);
                const d = wedge(
                  cx,
                  cy,
                  R,
                  inner,
                  cum[i] * TAU,
                  end * TAU,
                  GAP / 2,
                );
                if (!d) return null;
                const t = TREATMENTS[i % TREATMENTS.length];
                if (t !== "hatch") {
                  return <path key={i} d={d} {...paint(t, palette, hatchId)} />;
                }
                // The hatch field, bounded by an ink rule on its arcs only.
                const rim = arcPath(cx, cy, R, cum[i] * TAU, end * TAU, GAP / 2);
                const hole = inner
                  ? arcPath(cx, cy, inner, cum[i] * TAU, end * TAU, GAP / 2)
                  : null;
                return (
                  <g key={i}>
                    <path d={d} {...paint(t, palette, hatchId)} />
                    {[rim, hole].map((a, j) =>
                      a ? (
                        <path
                          key={j}
                          d={a}
                          fill="none"
                          stroke={palette.ink}
                          strokeWidth={rule}
                          strokeLinecap="butt"
                        />
                      ) : null,
                    )}
                  </g>
                );
              })}
            </svg>

            {donut && center ? (
              <div
                style={{
                  ...printStyle(frame, centerCue),
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <div
                  style={{
                    fontFamily: mono,
                    fontWeight: 700,
                    fontSize: 64,
                    color: palette.ink,
                  }}
                >
                  {center.value}
                </div>
                {center.caption ? (
                  <div
                    style={{
                      fontFamily: mono,
                      fontSize: 24,
                      letterSpacing: "0.22em",
                      textTransform: "uppercase",
                      color: palette.faded,
                    }}
                  >
                    {center.caption}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        {/* Receipt legend — swatch, label left, heavy value right. */}
        <div style={{ marginTop: 48 }}>
          {slices.map((s, i) => (
            <div
              key={i}
              style={{
                ...printStyle(frame, legendCues[i]),
                display: "flex",
                alignItems: "center",
                gap: 28,
                padding: "18px 0",
                borderTop: `${rule}px solid ${i === 0 ? palette.ink : palette.trace}`,
                fontFamily: mono,
                fontSize: 29,
                textTransform: "uppercase",
                color: palette.ink,
              }}
            >
              <Swatch
                t={TREATMENTS[i % TREATMENTS.length]}
                palette={palette}
                uid={`${uid}s${i}`}
              />
              <span style={{ letterSpacing: "0.06em", flex: 1 }}>{s.label}</span>
              <span style={{ fontWeight: 700, whiteSpace: "nowrap" }}>
                {s.value}
              </span>
            </div>
          ))}
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
      </div>
    </AbsoluteFill>
  );
};
