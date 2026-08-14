import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { mono, mu, palettes, type Palette } from "../tokens";
import { revealStyle } from "./reveal";

/**
 * RankShuffle — the leaderboard that re-sorts itself.
 *
 * A ranked list prints under criterion A ("per 100 g"). At `sortAt` the
 * criterion line swaps and the strips SLIDE to their new slots — the
 * chart argument as motion: spirulina falls, beef climbs. Rank numbers
 * are printed on the paper and never move; the strips travel between
 * them. Each strip carries its own dashed underline and paper backing,
 * so crossings read as physical slips of receipt re-ordered, not text
 * ghosting through text.
 *
 * The value column swaps criterion mid-slide (A fades out on the first
 * half, B fades in on the second), and an optional faded portion tag
 * appears beside the name under criterion B.
 *
 * End state: the list sorted by B, static — usable as a still.
 *
 * Motion doctrine: print wipes and one bezier ease. Nothing springs.
 */

export type RankShuffleItem = {
  name: string;
  /** Display value under criterion A (array order = rank under A). */
  a: string;
  /** Display value under criterion B. */
  b: string;
  /** 1-based rank under criterion B. */
  rankB: number;
  /** Faded tag shown beside the name once B rules, e.g. "150 G". */
  subB?: string;
};

export type RankShuffleProps = {
  /** Small faded uppercase line above everything. */
  kicker?: string;
  /** Criterion headers, e.g. "RANKED BY — MG PER 100 G". */
  criterionA: string;
  criterionB: string;
  items: RankShuffleItem[];
  /** Faded provenance line under the list. */
  line?: string;
  theme?: "light" | "dark";
  /** Frame the header starts printing (default 0). */
  appearAt?: number;
  /** Frame the re-sort begins. */
  sortAt?: number;
  /** Absolute print frames per strip (A order) — overrides the stagger. */
  cues?: number[];
};

const rule = 2;
const PAD_X = 84;
const PAD_RIGHT = 144; // content ends at x = 936
const STAGE_W = 1080 - PAD_X - PAD_RIGHT;

const ROW_H = 132;
const RANK_W = 96;
const PRINT_FRAMES = 10;
const GROUP_STAGGER = 16; // frames between re-filing waves
const SWAP_LEAD = 10; // criterion swap leads the value swap by a beat
const VALUE_LEAD = 26; // values re-measure BEFORE the board re-orders

const ease = Easing.bezier(0.25, 0.1, 0.25, 1);

/** Top→down print wipe from `cue`, layout stable before it. */
const printStyle = (frame: number, cue: number): React.CSSProperties =>
  revealStyle(frame, cue);

export const RankShuffle: React.FC<RankShuffleProps> = ({
  kicker,
  criterionA,
  criterionB,
  items,
  line,
  theme = "dark",
  appearAt = 0,
  sortAt = 120,
  cues,
}) => {
  const frame = useCurrentFrame();
  const palette: Palette = palettes[theme];
  const n = items.length;

  const stripCue = (i: number) => cues?.[i] ?? appearAt + 16 + i * 10;

  // --- criterion swap -----------------------------------------------------
  // A is fully gone before B's print wipe starts — no double exposure.
  const swapAt = sortAt - SWAP_LEAD;
  const aOut = interpolate(frame, [swapAt, swapAt + 5], [1, 0], {
    easing: ease,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // --- choreography -------------------------------------------------------
  // The argument in three beats. (1) The criterion line swaps. (2) Every
  // value re-measures in place — the board is now visibly mis-ordered.
  // (3) Strips re-file in WAVES of equal signed travel: same-speed,
  // same-direction slips keep their spacing and can never cross, so a
  // wave slides as one clean gesture over a settled board. Waves go
  // smallest travel first, falls before climbs at equal travel — the
  // longest climb arrives last, the finale. Opaque paper occlusion then
  // only happens as a brief PASS, never a co-moving pile-up.
  const deltas = items.map((it, i) => it.rankB - 1 - i);
  const waves = Array.from(new Set(deltas.filter((d) => d !== 0))).sort(
    (p, q) => Math.abs(p) - Math.abs(q) || q - p,
  );
  const slideAt = sortAt + VALUE_LEAD;

  // --- strips -------------------------------------------------------------
  const strips = items.map((item, i) => {
    const delta = deltas[i];
    const wave = waves.indexOf(delta);
    const start = slideAt + wave * GROUP_STAGGER;
    const dur = 16 + Math.abs(delta) * 3;
    const t =
      delta === 0
        ? 0
        : interpolate(frame, [start, start + dur], [0, 1], {
            easing: ease,
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
    const y = (i + delta * t) * ROW_H;

    // Every value swaps on the sort's own clock, BEFORE anything moves:
    // A leaves, B arrives — a strip is never blank and never double.
    const swapT = interpolate(frame, [sortAt, sortAt + 18], [0, 1], {
      easing: ease,
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const aOpacity = interpolate(swapT, [0, 0.45], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const bOpacity = interpolate(swapT, [0.55, 1], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

    // Later waves ride above earlier ones and above holders.
    const travel = delta === 0 ? 0 : 1 + wave;

    return (
      <div
        key={i}
        style={{
          position: "absolute",
          top: y,
          left: RANK_W,
          right: 0,
          height: ROW_H,
          zIndex: 1 + travel,
          backgroundColor: palette.paper,
          borderBottom: `${rule}px dashed ${palette.trace}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 24,
          boxSizing: "border-box",
          fontFamily: mono,
          textTransform: "uppercase",
          color: palette.ink,
          ...printStyle(frame, stripCue(i)),
        }}
      >
        <span style={{ fontSize: 31, letterSpacing: "0.06em" }}>
          {mu(item.name)}
          {item.subB ? (
            <span
              style={{
                color: palette.faded,
                fontSize: 25,
                opacity: bOpacity,
              }}
            >
              {"  · "}
              {mu(item.subB)}
            </span>
          ) : null}
        </span>
        <span
          style={{
            position: "relative",
            fontWeight: 700,
            fontSize: 33,
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ opacity: aOpacity }}>{mu(item.a)}</span>
          <span
            style={{
              position: "absolute",
              right: 0,
              top: 0,
              opacity: bOpacity,
            }}
          >
            {mu(item.b)}
          </span>
        </span>
      </div>
    );
  });

  // --- fixed rank slots ---------------------------------------------------
  const slots = Array.from({ length: n }, (_, r) => (
    <div
      key={r}
      style={{
        position: "absolute",
        top: r * ROW_H,
        left: 0,
        width: RANK_W,
        height: ROW_H,
        display: "flex",
        alignItems: "center",
        fontFamily: mono,
        fontWeight: 700,
        fontSize: 29,
        letterSpacing: "0.06em",
        color: palette.faded,
        ...printStyle(frame, stripCue(r)),
      }}
    >
      {String(r + 1).padStart(2, "0")}
    </div>
  ));

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
              ...printStyle(frame, appearAt),
              fontFamily: mono,
              fontSize: 26,
              letterSpacing: "0.25em",
              textTransform: "uppercase",
              color: palette.faded,
              marginBottom: 36,
            }}
          >
            {mu(kicker)}
          </div>
        ) : null}

        {/* The criterion line — the argument's hinge. */}
        <div
          style={{
            ...printStyle(frame, appearAt + 6),
            position: "relative",
            height: 46,
            marginBottom: 26,
            borderBottom: `${rule}px solid ${palette.ink}`,
            fontFamily: mono,
            fontWeight: 700,
            fontSize: 30,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: palette.ink,
          }}
        >
          <span style={{ position: "absolute", left: 0, opacity: aOut }}>
            {mu(criterionA)}
          </span>
          <span
            style={{
              position: "absolute",
              left: 0,
              ...printStyle(frame, swapAt + 6),
            }}
          >
            {mu(criterionB)}
          </span>
        </div>

        <div style={{ position: "relative", height: n * ROW_H, width: STAGE_W }}>
          {slots}
          {strips}
        </div>

        {line ? (
          <div
            style={{
              ...printStyle(frame, stripCue(n - 1) + 12),
              marginTop: 36,
              fontFamily: mono,
              fontSize: 24,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: palette.faded,
            }}
          >
            {mu(line)}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
