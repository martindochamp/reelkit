import React from "react";
import { mono, palettes, type Palette } from "./tokens";

/**
 * Flags, printed rather than photographed.
 *
 * A reel that says "the US allows 4 700, the EU says 2 000" needs to name
 * two jurisdictions in half a second, and the two words do not read at
 * reel pace — a flag does. But a colour flag would break the whole system
 * (two inks and one red, and the red is spoken for), so every flag here
 * is redrawn in the receipt's own three tones:
 *
 *   PAPER   the sheet
 *   HATCH   45° ink rules, 10 px apart — the engraver's mid-tone, which is
 *           how a newspaper printed a colour before it could print one
 *   INK     solid
 *
 * Consequences worth stating out loud, because they are not defects:
 *
 * - **Two flags can come out identical.** France and Italy are both
 *   vertical tricolours; in three tones they differ by which band is which
 *   and nothing else. The LABEL under the flag is the identification, and
 *   it is not optional — the flag is the glance, the word is the fact.
 * - **Every flag prints 3:2.** Real ratios run from 1:1 (Switzerland) to
 *   2:1 (the UK). A row of flags at their true ratios is a ragged row; a
 *   receipt prints a column of equal cells, so they are all drawn 3:2 and
 *   the geometry inside is scaled to fit. Switzerland keeps its square
 *   field, centred, because a wide Swiss flag is not a Swiss flag.
 * - **An unknown code still prints.** It becomes a hairline box with the
 *   code set in it, which is a worse flag and a perfectly good label —
 *   a render never dies over a country nobody drew.
 *
 * **A flag never takes the post's skin.** Every other element on this
 * stage inverts on a dark post, and should: type is type either way. A
 * flag is the one graphic whose POLARITY is part of its identity —
 * Switzerland is a white cross on red, and on the dark skin the first
 * contact sheet printed it as a dark cross on light, which is not the
 * Swiss flag, it is a photographic negative of it. So a flag is always
 * drawn on paper, in ink, like the printed card a photo beat lays on a
 * scene: physical paper has no dark mode.
 */

const W = 300;
const H = 200;

/** paper · hatch · ink — the only three values a flag is made of. */
type Tone = 0 | 1 | 2;

type Shape =
  | { kind: "field"; tone: Tone }
  | { kind: "stripes"; dir: "h" | "v"; tones: Tone[]; weights?: number[] }
  /** x, y, w, h as fractions of the flag. */
  | { kind: "rect"; tone: Tone; at: [number, number, number, number] }
  | { kind: "disc"; tone: Tone; at: [number, number, number] }
  | { kind: "ring"; tone: Tone; at: [number, number, number]; width?: number }
  /** A nordic cross: bar thickness and the vertical bar's centre, both fractions. */
  | { kind: "cross"; tone: Tone; thickness: number; x?: number }
  | { kind: "star"; tone: Tone; at: [number, number, number]; turn?: number }
  /** N stars evenly around a circle — the European ring. */
  | { kind: "starring"; tone: Tone; at: [number, number, number]; count: number; size: number }
  /** A grid of stars, the American canton. */
  | { kind: "stargrid"; tone: Tone; at: [number, number, number, number]; cols: number; rows: number; size: number }
  /** `w` is the stroke width for an open path; a closed path (Z) is filled. */
  | { kind: "path"; tone: Tone; d: string; w?: number }
  | { kind: "hairline" };

type FlagSpec = { shapes: Shape[]; note?: string };

// ---------------------------------------------------------------------------
// Shorthands. Most flags in the world are three bands, and the ones that
// are not are a band plus one mark.

const bands = (dir: "h" | "v", tones: Tone[], weights?: number[]): Shape => ({
  kind: "stripes",
  dir,
  tones,
  weights,
});

/** The US canton and its 50 stars, and the 13 stripes under them. */
const usStripes = (): Shape =>
  bands(
    "h",
    Array.from({ length: 13 }, (_, i) => ((i % 2 === 0 ? 2 : 0) as Tone)),
  );

export const FLAGS: Record<string, FlagSpec> = {
  US: {
    shapes: [
      usStripes(),
      { kind: "rect", tone: 2, at: [0, 0, 0.4, 7 / 13] },
      { kind: "stargrid", tone: 0, at: [0.035, 0.045, 0.33, 7 / 13 - 0.09], cols: 6, rows: 5, size: 7.4 },
    ],
  },
  EU: {
    shapes: [
      { kind: "field", tone: 2 },
      { kind: "starring", tone: 0, at: [0.5, 0.5, 0.3], count: 12, size: 13 },
    ],
  },
  GB: {
    // Saltire first, cross over it, and on each one a narrow hatch inside
    // a wider paper bar — which is how the union reads once the colour is
    // gone. The cross is the wider of the two, as it is on the real flag.
    shapes: [
      { kind: "field", tone: 2 },
      { kind: "path", tone: 0, w: 30, d: `M0,0 L${W},${H} M${W},0 L0,${H}` },
      { kind: "path", tone: 1, w: 12, d: `M0,0 L${W},${H} M${W},0 L0,${H}` },
      { kind: "path", tone: 0, w: 54, d: `M${W / 2},0 V${H} M0,${H / 2} H${W}` },
      { kind: "path", tone: 1, w: 30, d: `M${W / 2},0 V${H} M0,${H / 2} H${W}` },
    ],
  },
  FR: { shapes: [bands("v", [2, 0, 1])] },
  IT: { shapes: [bands("v", [1, 0, 2])] },
  IE: { shapes: [bands("v", [1, 0, 2])] },
  BE: { shapes: [bands("v", [2, 1, 0])] },
  DE: { shapes: [bands("h", [2, 1, 0])] },
  NL: { shapes: [bands("h", [2, 0, 1])] },
  RU: { shapes: [bands("h", [0, 1, 2])] },
  ES: { shapes: [bands("h", [2, 0, 2], [1, 2, 1])] },
  AT: { shapes: [bands("h", [2, 0, 2], [1, 1, 1])] },
  JP: {
    shapes: [
      { kind: "field", tone: 0 },
      { kind: "hairline" },
      { kind: "disc", tone: 2, at: [0.5, 0.5, 0.3] },
    ],
  },
  CH: {
    shapes: [
      { kind: "field", tone: 0 },
      // Square field, centred: a Swiss flag stretched to 3:2 is a red
      // rectangle with a cross in it, which is a different flag.
      { kind: "rect", tone: 2, at: [(1 - H / W) / 2, 0, H / W, 1] },
      { kind: "path", tone: 0, w: 34, d: `M${W / 2},${H * 0.17} V${H * 0.83} M${W / 2 - H * 0.33},${H / 2} H${W / 2 + H * 0.33}` },
    ],
  },
  SE: {
    shapes: [
      { kind: "field", tone: 2 },
      { kind: "cross", tone: 0, thickness: 0.18, x: 0.36 },
    ],
  },
  DK: {
    shapes: [
      { kind: "field", tone: 2 },
      { kind: "cross", tone: 0, thickness: 0.16, x: 0.38 },
    ],
  },
  NO: {
    shapes: [
      { kind: "field", tone: 2 },
      { kind: "cross", tone: 0, thickness: 0.26, x: 0.36 },
      { kind: "cross", tone: 2, thickness: 0.12, x: 0.36 },
    ],
  },
  FI: {
    shapes: [
      { kind: "field", tone: 0 },
      { kind: "hairline" },
      { kind: "cross", tone: 2, thickness: 0.18, x: 0.36 },
    ],
  },
  CA: {
    shapes: [
      bands("v", [2, 0, 2], [1, 2, 1]),
      {
        kind: "path",
        tone: 2,
        // A maple leaf reduced to the eleven points that make it one.
        d:
          `M${W / 2},${H * 0.16} l${W * 0.028},${H * 0.13} l${W * 0.07},-${H * 0.03} ` +
          `l-${W * 0.02},${H * 0.1} l${W * 0.085},${H * 0.02} l-${W * 0.03},${H * 0.05} ` +
          `l${W * 0.06},${H * 0.06} l-${W * 0.105},${H * 0.03} l${W * 0.012},${H * 0.05} ` +
          `l-${W * 0.09},-${H * 0.02} l${W * 0.008},${H * 0.16} l-${W * 0.037},0 ` +
          `l${W * 0.008},-${H * 0.16} l-${W * 0.09},${H * 0.02} l${W * 0.012},-${H * 0.05} ` +
          `l-${W * 0.105},-${H * 0.03} l${W * 0.06},-${H * 0.06} l-${W * 0.03},-${H * 0.05} ` +
          `l${W * 0.085},-${H * 0.02} l-${W * 0.02},-${H * 0.1} l${W * 0.07},${H * 0.03} Z`,
      },
    ],
  },
  AU: {
    shapes: [
      { kind: "field", tone: 2 },
      // The canton is the SAME ink as the field — that is how the real
      // flag works, and the union's paper bars are what mark it out. Over
      // hatch they read as a smudge, which is what the sheet showed.
      { kind: "rect", tone: 2, at: [0, 0, 0.5, 0.5] },
      { kind: "path", tone: 0, w: 13, d: `M0,0 L${W / 2},${H / 2} M${W / 2},0 L0,${H / 2}` },
      { kind: "path", tone: 0, w: 24, d: `M${W / 4},0 V${H / 2} M0,${H / 4} H${W / 2}` },
      { kind: "star", tone: 0, at: [0.25, 0.75, 0.075] },
      { kind: "star", tone: 0, at: [0.76, 0.24, 0.045] },
      { kind: "star", tone: 0, at: [0.86, 0.5, 0.045] },
      { kind: "star", tone: 0, at: [0.76, 0.78, 0.045] },
      { kind: "star", tone: 0, at: [0.66, 0.56, 0.04] },
    ],
  },
  NZ: {
    shapes: [
      { kind: "field", tone: 2 },
      // The canton is the SAME ink as the field — that is how the real
      // flag works, and the union's paper bars are what mark it out. Over
      // hatch they read as a smudge, which is what the sheet showed.
      { kind: "rect", tone: 2, at: [0, 0, 0.5, 0.5] },
      { kind: "path", tone: 0, w: 13, d: `M0,0 L${W / 2},${H / 2} M${W / 2},0 L0,${H / 2}` },
      { kind: "path", tone: 0, w: 24, d: `M${W / 4},0 V${H / 2} M0,${H / 4} H${W / 2}` },
      { kind: "star", tone: 0, at: [0.78, 0.26, 0.05] },
      { kind: "star", tone: 0, at: [0.88, 0.54, 0.05] },
      { kind: "star", tone: 0, at: [0.7, 0.76, 0.05] },
      { kind: "star", tone: 0, at: [0.63, 0.5, 0.045] },
    ],
  },
  CN: {
    shapes: [
      { kind: "field", tone: 2 },
      { kind: "star", tone: 0, at: [0.17, 0.28, 0.11] },
      { kind: "star", tone: 0, at: [0.33, 0.13, 0.04] },
      { kind: "star", tone: 0, at: [0.4, 0.24, 0.04] },
      { kind: "star", tone: 0, at: [0.4, 0.39, 0.04] },
      { kind: "star", tone: 0, at: [0.33, 0.5, 0.04] },
    ],
  },
  IN: {
    shapes: [
      bands("h", [1, 0, 2]),
      { kind: "ring", tone: 2, at: [0.5, 0.5, 0.13], width: 4 },
      { kind: "disc", tone: 2, at: [0.5, 0.5, 0.022] },
    ],
  },
  BR: {
    shapes: [
      { kind: "field", tone: 2 },
      { kind: "path", tone: 0, d: `M${W / 2},${H * 0.1} L${W * 0.87},${H / 2} L${W / 2},${H * 0.9} L${W * 0.13},${H / 2} Z` },
      { kind: "disc", tone: 1, at: [0.5, 0.5, 0.17] },
    ],
  },
  MX: {
    shapes: [
      bands("v", [2, 0, 1]),
      { kind: "ring", tone: 2, at: [0.5, 0.5, 0.16], width: 4 },
    ],
  },
  KR: {
    shapes: [
      { kind: "field", tone: 0 },
      { kind: "hairline" },
      { kind: "disc", tone: 2, at: [0.5, 0.5, 0.19] },
      { kind: "path", tone: 1, d: `M${W / 2 - H * 0.19},${H / 2} a${H * 0.095},${H * 0.095} 0 0 1 ${H * 0.19},0 a${H * 0.095},${H * 0.095} 0 0 0 ${H * 0.19},0 a${H * 0.19},${H * 0.19} 0 0 1 -${H * 0.38},0 Z` },
      { kind: "rect", tone: 2, at: [0.11, 0.14, 0.11, 0.035] },
      { kind: "rect", tone: 2, at: [0.11, 0.82, 0.11, 0.035] },
      { kind: "rect", tone: 2, at: [0.78, 0.14, 0.11, 0.035] },
      { kind: "rect", tone: 2, at: [0.78, 0.82, 0.11, 0.035] },
    ],
  },
};

// ---------------------------------------------------------------------------

const starPath = (cx: number, cy: number, r: number, turn = -90) => {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const rad = ((turn + i * 36) * Math.PI) / 180;
    const rr = i % 2 === 0 ? r : r * 0.382;
    pts.push(`${(cx + rr * Math.cos(rad)).toFixed(2)},${(cy + rr * Math.sin(rad)).toFixed(2)}`);
  }
  return `M${pts.join(" L")} Z`;
};

/**
 * One flag, 3:2, drawn in the palette's own inks. `id` scopes the hatch
 * pattern — two flags in one frame sharing a pattern id is one flag.
 */
export const Flag: React.FC<{ code: string; id: string }> = ({ code, id }) => {
  // Always the light pair — see the header. The caller does not get a say,
  // because the one caller that had one got it wrong.
  const palette = palettes.light;
  const spec = FLAGS[code.toUpperCase()];
  const hatch = `hatch-${id}`;
  const fill = (t: Tone) =>
    t === 0 ? palette.paper : t === 2 ? palette.ink : `url(#${hatch})`;

  if (!spec) {
    // No drawing, no crash: the code itself, boxed. A reel that names a
    // country nobody drew still prints something true.
    return (
      <svg viewBox={`0 0 ${W} ${H}`} style={{ display: "block", width: "100%" }}>
        <rect x={1} y={1} width={W - 2} height={H - 2} fill={palette.paper} stroke={palette.ink} strokeWidth={3} />
        <text
          x={W / 2}
          y={H / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fill={palette.ink}
          style={{ font: `700 72px "SF Mono", monospace`, letterSpacing: 6 }}
        >
          {code.toUpperCase()}
        </text>
      </svg>
    );
  }

  const draw = (s: Shape, i: number): React.ReactNode => {
    switch (s.kind) {
      case "field":
        return <rect key={i} x={0} y={0} width={W} height={H} fill={fill(s.tone)} />;
      case "hairline":
        return (
          <rect key={i} x={1.5} y={1.5} width={W - 3} height={H - 3} fill="none" stroke={palette.trace} strokeWidth={3} />
        );
      case "stripes": {
        const weights = s.weights ?? s.tones.map(() => 1);
        const total = weights.reduce((a, b) => a + b, 0);
        const span = s.dir === "h" ? H : W;
        let at = 0;
        return s.tones.map((tone, j) => {
          const size = (weights[j] / total) * span;
          const rect =
            s.dir === "h" ? (
              <rect key={`${i}-${j}`} x={0} y={at} width={W} height={size + 0.5} fill={fill(tone)} />
            ) : (
              <rect key={`${i}-${j}`} x={at} y={0} width={size + 0.5} height={H} fill={fill(tone)} />
            );
          at += size;
          return rect;
        });
      }
      case "rect":
        return (
          <rect
            key={i}
            x={s.at[0] * W}
            y={s.at[1] * H}
            width={s.at[2] * W}
            height={s.at[3] * H}
            fill={fill(s.tone)}
          />
        );
      case "disc":
        return <circle key={i} cx={s.at[0] * W} cy={s.at[1] * H} r={s.at[2] * H} fill={fill(s.tone)} />;
      case "ring":
        return (
          <circle
            key={i}
            cx={s.at[0] * W}
            cy={s.at[1] * H}
            r={s.at[2] * H}
            fill="none"
            stroke={fill(s.tone)}
            strokeWidth={s.width ?? 3}
          />
        );
      case "cross": {
        const t = s.thickness * H;
        const x = (s.x ?? 0.36) * W;
        return (
          <g key={i} fill={fill(s.tone)}>
            <rect x={0} y={H / 2 - t / 2} width={W} height={t} />
            <rect x={x - t / 2} y={0} width={t} height={H} />
          </g>
        );
      }
      case "star":
        return <path key={i} d={starPath(s.at[0] * W, s.at[1] * H, s.at[2] * H, s.turn)} fill={fill(s.tone)} />;
      case "starring": {
        const [cx, cy, r] = s.at;
        return Array.from({ length: s.count }, (_, j) => {
          const a = (j / s.count) * 2 * Math.PI - Math.PI / 2;
          return (
            <path
              key={`${i}-${j}`}
              d={starPath(cx * W + r * H * Math.cos(a), cy * H + r * H * Math.sin(a), s.size)}
              fill={fill(s.tone)}
            />
          );
        });
      }
      case "stargrid": {
        const [x, y, w, h] = s.at;
        const out: React.ReactNode[] = [];
        // Six columns of five and five of four, offset — the real canton.
        for (let r = 0; r < s.rows * 2 - 1; r++) {
          const odd = r % 2 === 1;
          const cols = odd ? s.cols - 1 : s.cols;
          for (let c = 0; c < cols; c++) {
            const px = x * W + ((c + (odd ? 1 : 0.5)) / s.cols) * w * W;
            const py = y * H + ((r + 0.5) / (s.rows * 2 - 1)) * h * H;
            out.push(<path key={`${i}-${r}-${c}`} d={starPath(px, py, s.size)} fill={fill(s.tone)} />);
          }
        }
        return out;
      }
      case "path":
        // A path with no fill rule is a stroke (the union's bars); a closed
        // one is a shape. `Z` is the tell, and it is the author's own mark.
        //
        // The width is the SHAPE's, never the index's. It was index parity
        // for one afternoon and the contact sheet showed exactly what that
        // is worth: a union jack drawn half-size for a canton kept the
        // full-size 34 px bars and came out as a black scribble.
        return s.d.includes("Z") ? (
          <path key={i} d={s.d} fill={fill(s.tone)} />
        ) : (
          <path
            key={i}
            d={s.d}
            stroke={fill(s.tone)}
            strokeWidth={s.w ?? 24}
            fill="none"
          />
        );
    }
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ display: "block", width: "100%" }}>
      <defs>
        <pattern id={hatch} width={14} height={14} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width={14} height={14} fill={palette.paper} />
          <rect width={5} height={14} fill={palette.ink} />
        </pattern>
        <clipPath id={`clip-${id}`}>
          <rect x={0} y={0} width={W} height={H} />
        </clipPath>
      </defs>
      <g clipPath={`url(#clip-${id})`}>
        <rect x={0} y={0} width={W} height={H} fill={palette.paper} />
        {spec.shapes.map(draw)}
      </g>
    </svg>
  );
};

/**
 * The contact sheet — every code in FLAGS, drawn at roughly the size a
 * reel shows one, on one page. `npm run flags`.
 *
 * This exists because the flags are hand-typed coordinates: a wrong
 * fraction does not throw, it just prints a flag that is not that
 * country's flag, and it would ship inside a beat nobody looked at twice.
 * Look at the sheet after touching FLAGS.
 */
export const FlagSheet: React.FC<{ theme?: "light" | "dark" }> = ({
  theme = "dark",
}) => {
  const palette = palettes[theme];
  const codes = Object.keys(FLAGS);
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        backgroundColor: palette.paper,
        padding: "70px 60px",
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: "34px 30px",
        alignContent: "start",
        fontFamily: mono,
      }}
    >
      {codes.map((code, i) => (
        <div key={code}>
          <div style={{ border: `2px solid ${palette.ink}`, lineHeight: 0 }}>
            <Flag code={code} id={`sheet-${i}`} />
          </div>
          <div
            style={{
              marginTop: 10,
              fontSize: 20,
              letterSpacing: "0.18em",
              color: palette.faded,
            }}
          >
            {code}
          </div>
        </div>
      ))}
      <div>
        <div style={{ border: `2px solid ${palette.ink}`, lineHeight: 0 }}>
          <Flag code="ZZ" id="sheet-fallback" />
        </div>
        <div
          style={{
            marginTop: 10,
            fontSize: 20,
            letterSpacing: "0.18em",
            color: palette.faded,
          }}
        >
          UNKNOWN
        </div>
      </div>
    </div>
  );
};
