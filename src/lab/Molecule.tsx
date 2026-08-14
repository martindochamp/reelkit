import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { mono, palettes, type Palette } from "../tokens";
import { revealClip } from "./reveal";

/**
 * Molecule — the structural formula, as chemistry draws it.
 *
 * A skeletal formula in hairline ink: carbon vertices are implied (lines
 * simply meet), heteroatoms are written where a chemist writes them — O,
 * OH, HO — in SF Mono, with every bond trimmed to point at the O it
 * attaches to. Single bonds are one stroke; double bonds are two: a
 * symmetric parallel pair off-ring, an inner shortened stroke in-ring.
 *
 * The structure assembles bond by bond, each stroke drawing on the house
 * bezier while a plotter head rides the tip — the instrument drafting,
 * not an artist flourishing. Labels print as their vertex completes.
 * A receipt row names the compound; the formula stands as the value.
 *
 * End state: a clean static formula — usable as a slideshow still.
 * Motion doctrine: line draws and print wipes on one ease. No springs.
 */

export type MoleculeAtom = {
  /** Written symbol — omit for an implied carbon vertex. */
  label?: string;
  /** Char index the bond points at (default: the first "O", else center). */
  anchor?: number;
  x: number; // abstract structure units; the stage auto-fits
  y: number;
};

export type MoleculeBond = {
  a: number; // index into atoms — the stroke draws a -> b
  b: number;
  order?: 1 | 2;
  /**
   * For an in-ring double bond: which side the inner shortened stroke
   * sits, as a sign on the left normal of a->b (+1 or -1). Omitted on a
   * double bond = symmetric parallel pair (C=O style).
   */
  side?: 1 | -1;
};

export type MoleculeProps = {
  /** Small faded uppercase line, top left. */
  kicker?: string;
  atoms: MoleculeAtom[];
  bonds: MoleculeBond[];
  /** Receipt row: compound name (left). */
  title?: string;
  /** Receipt row: molecular formula (right). */
  value?: string;
  /** Faded provenance line under the row. */
  line?: string;
  theme?: "light" | "dark";
  /** Frame the instrument prints (default 0). */
  appearAt?: number;
  /** Absolute frame each bond starts drawing — for word-sync. */
  cues?: number[];
  /** Height of the drawing stage in px (default 780). */
  drawHeight?: number;
};

const rule = 2;
const PAD_X = 84;
const PAD_RIGHT = 144; // content ends at x = 936
const STAGE_W = 1080 - PAD_X - PAD_RIGHT; // 852

const STROKE = 3; // bond weight — the drawing's line, above hairline
const DOUBLE_GAP = 10; // centre distance between paired strokes
const INNER_TRIM = 0.16; // inner ring stroke shortened at both ends
const LABEL_SIZE = 44;
const CH = LABEL_SIZE * 0.6; // SF Mono advance
const ATOM_R = 30; // bonds stop this short of a written O
const MARGIN = 78; // fit margin so labels never clip

const BOND_DRAW = 7; // frames one stroke takes
const BOND_STAGGER = 8; // frames between bond starts
const LABEL_PRINT = 5;
const PRINT_FRAMES = 10;

const EASE = Easing.bezier(0.25, 0.1, 0.25, 1);
const clamp = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

const printClip = (
  frame: number,
  cue: number,
  frames: number = PRINT_FRAMES,
): React.CSSProperties => revealClip(frame, cue, frames);

type Pt = { x: number; y: number };

export const Molecule: React.FC<MoleculeProps> = ({
  kicker,
  atoms,
  bonds,
  title,
  value,
  line,
  theme = "dark",
  appearAt = 0,
  cues,
  drawHeight = 780,
}) => {
  const frame = useCurrentFrame();
  const palette: Palette = palettes[theme];

  // --- fit ----------------------------------------------------------------
  const xs = atoms.map((a) => a.x);
  const ys = atoms.map((a) => a.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const w = Math.max(maxX - minX, 0.001);
  const h = Math.max(maxY - minY, 0.001);
  const s = Math.min(
    (STAGE_W - 2 * MARGIN) / w,
    (drawHeight - 2 * MARGIN) / h,
  );
  const offX = (STAGE_W - w * s) / 2;
  const offY = (drawHeight - h * s) / 2;
  const px = (a: MoleculeAtom): Pt => ({
    x: offX + (a.x - minX) * s,
    y: offY + (a.y - minY) * s,
  });

  // --- timeline -----------------------------------------------------------
  const cueOf = (i: number) => cues?.[i] ?? appearAt + 14 + i * BOND_STAGGER;
  const lastEnd = cueOf(bonds.length - 1) + BOND_DRAW;
  const rowCue = lastEnd + 12;

  // A label prints when its vertex is reached: as a stroke leaves it
  // (start, a beat early) or as the first stroke arriving at it completes.
  const labelCue: number[] = atoms.map(() => Infinity);
  bonds.forEach((bd, i) => {
    labelCue[bd.a] = Math.min(labelCue[bd.a], cueOf(i) - 3);
    labelCue[bd.b] = Math.min(labelCue[bd.b], cueOf(i) + BOND_DRAW - 2);
  });
  for (let i = 0; i < labelCue.length; i += 1) {
    if (!Number.isFinite(labelCue[i])) labelCue[i] = appearAt;
  }

  // --- strokes ------------------------------------------------------------
  const strokes: React.ReactNode[] = [];
  let penTip: Pt | null = null;

  bonds.forEach((bd, i) => {
    const cue = cueOf(i);
    if (frame < cue) return;

    const A = px(atoms[bd.a]);
    const B = px(atoms[bd.b]);
    const dx = B.x - A.x;
    const dy = B.y - A.y;
    const len = Math.hypot(dx, dy);
    const ux = dx / len;
    const uy = dy / len;
    const nx = -uy; // left normal of a -> b
    const ny = ux;

    const rA = atoms[bd.a].label ? ATOM_R : 0;
    const rB = atoms[bd.b].label ? ATOM_R : 0;
    const sx = A.x + ux * rA;
    const sy = A.y + uy * rA;
    const ex = B.x - ux * rB;
    const ey = B.y - uy * rB;

    const t = interpolate(frame, [cue, cue + BOND_DRAW], [0, 1], {
      easing: EASE,
      ...clamp,
    });
    const tip: Pt = { x: sx + (ex - sx) * t, y: sy + (ey - sy) * t };
    if (frame < cue + BOND_DRAW + 1) penTip = tip;
    else if (i === bonds.length - 1 && penTip === null) penTip = tip;

    // Every stroke of the bond draws its own span on the same progress.
    const lineEl = (
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      key: string,
    ) => (
      <line
        key={key}
        x1={x1}
        y1={y1}
        x2={x1 + (x2 - x1) * t}
        y2={y1 + (y2 - y1) * t}
        stroke={palette.ink}
        strokeWidth={STROKE}
        strokeLinecap="square"
      />
    );

    if (bd.order === 2 && bd.side) {
      // In-ring double: main stroke on the axis, inner stroke offset and
      // shortened at both ends — the chemist's convention.
      strokes.push(lineEl(sx, sy, ex, ey, `b${i}`));
      const off = DOUBLE_GAP * bd.side;
      const trim = len * INNER_TRIM;
      strokes.push(
        lineEl(
          sx + nx * off + ux * trim,
          sy + ny * off + uy * trim,
          ex + nx * off - ux * trim,
          ey + ny * off - uy * trim,
          `b${i}i`,
        ),
      );
    } else if (bd.order === 2) {
      // Exocyclic double: symmetric parallel pair.
      const off = DOUBLE_GAP / 2;
      strokes.push(
        lineEl(sx + nx * off, sy + ny * off, ex + nx * off, ey + ny * off, `b${i}a`),
        lineEl(sx - nx * off, sy - ny * off, ex - nx * off, ey - ny * off, `b${i}b`),
      );
    } else {
      strokes.push(lineEl(sx, sy, ex, ey, `b${i}`));
    }
  });

  // The plotter head: rides the tip of the stroke being drawn, lifts away
  // after the final bond. An instrument drafting, not a cursor blinking.
  const penOpacity =
    frame < cueOf(0)
      ? 0
      : interpolate(frame, [lastEnd + 2, lastEnd + 8], [1, 0], clamp);

  // --- labels -------------------------------------------------------------
  const labels = atoms.map((a, idx) => {
    if (!a.label) return null;
    const p = px(a);
    const anchor =
      a.anchor ?? (a.label.indexOf("O") >= 0 ? a.label.indexOf("O") : (a.label.length - 1) / 2);
    // The anchored char sits centred on the vertex point.
    const left = p.x - (anchor + 0.5) * CH;
    return (
      <div
        key={`l${idx}`}
        style={{
          position: "absolute",
          left,
          top: p.y - LABEL_SIZE / 2,
          fontFamily: mono,
          fontWeight: 700,
          fontSize: LABEL_SIZE,
          lineHeight: `${LABEL_SIZE}px`,
          letterSpacing: 0,
          color: palette.ink,
          whiteSpace: "nowrap",
          ...printClip(frame, labelCue[idx], LABEL_PRINT),
        }}
      >
        {a.label}
      </div>
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
              ...printClip(frame, appearAt),
              marginBottom: 8,
              fontFamily: mono,
              fontSize: 26,
              letterSpacing: "0.25em",
              textTransform: "uppercase",
              color: palette.faded,
            }}
          >
            {kicker}
          </div>
        ) : null}

        {/* The drawing stage. */}
        <div style={{ position: "relative", width: STAGE_W, height: drawHeight }}>
          <svg
            width={STAGE_W}
            height={drawHeight}
            viewBox={`0 0 ${STAGE_W} ${drawHeight}`}
            style={{ position: "absolute", inset: 0 }}
          >
            {strokes}
          </svg>
          {labels}
          {penTip && penOpacity > 0 ? (
            <div
              style={{
                position: "absolute",
                left: (penTip as Pt).x - 7,
                top: (penTip as Pt).y - 7,
                width: 14,
                height: 14,
                backgroundColor: palette.ink,
                opacity: penOpacity,
              }}
            />
          ) : null}
        </div>

        {/* Receipt row — the compound, named. */}
        {title || value ? (
          <div style={printClip(frame, rowCue)}>
            <div
              style={{
                marginTop: 12,
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
          </div>
        ) : null}

        {line ? (
          <div
            style={{
              ...printClip(frame, rowCue + 8),
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
    </AbsoluteFill>
  );
};
