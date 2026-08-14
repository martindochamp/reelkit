import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { mono, mu, palettes, type Palette } from "../tokens";
import { revealStyle } from "./reveal";
import {
  CELL_GAP,
  CHIP_GAP,
  CHIP_PAD_X,
  CHIP_PAD_Y,
  CHIP_TEXT_GAP,
  LABEL_LINE,
  ROW_GAP,
  VALUE_LINE,
  knit,
  layout,
  rule,
} from "./tier-fit.mjs";

/**
 * TierList — S to D, printed instead of colored.
 *
 * The internet's tier list ranks with a red→green band. Ours ranks with
 * ink: the tier cell IS the scale. S is a solid block with its letter
 * reversed out in paper; every tier under it holds the SAME ink at a
 * lower alpha, until the last one is an outline on bare paper. One ink,
 * five weights — the ramp still reads at thumbnail size, and the palette
 * stays two inks (stamp red belongs to the evening verdict, never to a
 * chart).
 *
 * Items print INTO their row at their cue — the top-down wipe, the paper
 * coming out of the printer. Nothing flies in from a tray: this is a
 * receipt, not a game board. The grid — title, letters, empty rows — is
 * on the paper from the cut, so the drama is the row standing there and
 * the food landing in it.
 *
 * Tiers render in the order given, never sorted: the writer ranked them,
 * the element only prints the ranking. A tier with no items prints an em
 * dash — the receipt states the absence rather than leaving a hole.
 *
 * Every chip in a row shares one type size, fitted to the longest name in
 * that row (`fitLabel`), and every value is pinned to its chip's floor —
 * so the numbers read as a column no matter how the names wrap. The name
 * is what gives way when the column is tight; the number never does.
 *
 * A number never leaves its unit either: `knit` ties "1 cup" into one
 * unbreakable word before the wrap counts it and before the span prints
 * it, so "KALE, COOKED — 1 / CUP" cannot happen and no writer has to
 * remember a non-breaking space.
 *
 * End state is a valid static — the slideshow prints it through
 * ElementFrame.
 */

export type TierListItem = {
  /** The thing ranked — a food, a form, a habit. */
  label: string;
  /** What earned it the row. Optional: a tier list can be labels only. */
  value?: string;
};

export type TierListRow = {
  /** The letter, printed as given: "S", "A", "B"… (or "S+", "F"). */
  tier: string;
  /** Faded annotation at the row's right edge — the band's rule ("80 mg+"). */
  note?: string;
  /**
   * 1 to 4 read comfortably. A fuller row, or a name too long for its
   * column, shrinks the name — never the number, and never past the
   * chip's edge.
   */
  items?: TierListItem[];
};

export type TierListProps = {
  /** Small faded uppercase line above the grid. */
  title?: string;
  /** What the ranking is measured in — right side of the title rule. */
  unit?: string;
  /** 3 to 6 rows, in the order they should print. Never sorted. */
  tiers: TierListRow[];
  theme?: "light" | "dark";
  /** Frame the grid prints (default 0 — on the paper from the cut). */
  appearAt?: number;
  /** Frames between item cues when `itemCues` is not given (default 10). */
  stagger?: number;
  /**
   * Absolute cue frame per ITEM, in reading order: tier 0's items, then
   * tier 1's, and so on. One cue per item — `elementParts` counts them.
   */
  itemCues?: number[];
};

const PAD_X = 84;
const PAD_RIGHT = 144; // content ends at x = 936
const TOP = 210;
const BOTTOM = 1920 - 1360; // below 1360 is subtitle territory

const PRINT_FRAMES = 7;
/**
 * The note line above a band. Reserved for EVERY row as soon as one tier
 * carries a note, so the bands stay the same height down the column — a
 * ramp of unequal blocks is not a scale.
 */
const NOTE_H = 32;

/**
 * The ink ramp — the tier list's color band, in one ink. Five stops,
 * sampled positionally, so five tiers land on them exactly, three tiers
 * spread across the same range and six subdivide it. The last stop is 0:
 * the bottom tier is an outline, which is the honest drawing of nothing.
 */
const RAMP = [1, 0.7, 0.45, 0.25, 0];
const rampAt = (i: number, n: number) =>
  n <= 1
    ? RAMP[0]
    : interpolate(
        i,
        RAMP.map((_, k) => (k * (n - 1)) / (RAMP.length - 1)),
        RAMP,
      );

/** Past this much ink under it, the letter reverses out into paper. */
const REVERSE_AT = 0.55;

/**
 * The band height, the chip widths and the fitted name size all come from
 * `./tier-fit.mjs` — plain JS, so the RENDERERS can run the same
 * arithmetic before they spend a frame and warn the writer when a row was
 * fitted under the legible floor (scripts/tier-legibility.mjs). The
 * element draws exactly what the audit measured; there is one copy of the
 * numbers.
 */

/** Top→down print wipe from `cue`, layout stable before it. */
const printStyle = (frame: number, cue: number): React.CSSProperties =>
  revealStyle(frame, cue);

export const TierList: React.FC<TierListProps> = ({
  title,
  unit,
  tiers,
  theme = "dark",
  appearAt = 0,
  stagger = 10,
  itemCues,
}) => {
  const frame = useCurrentFrame();
  const palette: Palette = palettes[theme];

  // The whole board is measured before it is drawn — one pass, shared
  // with the renderers' legibility audit.
  const { bandH: BAND_H, letterSize, rows: fitted } = layout(tiers);
  const noteH = tiers.some((t) => t.note) ? NOTE_H : 0;

  // Items are cued in reading order across the whole grid, so each row
  // needs to know how many printed before it.
  const offsets: number[] = [];
  tiers.reduce((n, t) => {
    offsets.push(n);
    return n + (t.items?.length ?? 0);
  }, 0);
  const cueOf = (k: number) => itemCues?.[k] ?? appearAt + k * stagger;

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
        {/* Header — what is ranked, and what it is ranked in. The two
            share one line while they fit; a long pair wraps and the unit
            drops to its own right-aligned line rather than squeezing the
            title into a column. */}
        {title || unit ? (
          <div
            style={{
              ...printStyle(frame, appearAt),
              display: "flex",
              flexWrap: "wrap",
              alignItems: "flex-end",
              columnGap: 32,
              rowGap: 10,
              paddingBottom: 26,
              borderBottom: `${rule}px solid ${palette.ink}`,
              marginBottom: 44,
              fontFamily: mono,
              lineHeight: 1.3,
              textTransform: "uppercase",
              color: palette.faded,
            }}
          >
            <span
              style={{
                flex: "1 1 auto",
                minWidth: 0,
                fontSize: 26,
                letterSpacing: "0.25em",
              }}
            >
              {mu(title)}
            </span>
            <span
              style={{
                flexShrink: 0,
                marginLeft: "auto",
                fontSize: 22,
                letterSpacing: "0.18em",
                whiteSpace: "nowrap",
              }}
            >
              {mu(unit)}
            </span>
          </div>
        ) : null}

        {tiers.map((row, t) => {
          const items = row.items ?? [];
          const alpha = rampAt(t, tiers.length);
          // The row was fitted to its column before any of this was
          // drawn. The number keeps its size and its band at the floor;
          // the name takes what is left. A three-line name used to push
          // its value through the chip's bottom edge and break the very
          // alignment the board is read by (serving-tier, 2026-08-04) —
          // nothing is left to overflow now, so `space-between` can only
          // put the value on the floor.
          const { labelSize, labelCols, valueSize, valueCols, valued } =
            fitted[t];
          return (
            <div
              key={t}
              style={{
                ...printStyle(frame, appearAt),
                marginBottom: t === tiers.length - 1 ? 0 : ROW_GAP,
              }}
            >
              {noteH ? (
                <div
                  style={{
                    height: noteH,
                    fontFamily: mono,
                    fontSize: 21,
                    letterSpacing: "0.2em",
                    textTransform: "uppercase",
                    textAlign: "right",
                    color: palette.faded,
                  }}
                >
                  {mu(row.note)}
                </div>
              ) : null}

              <div style={{ display: "flex", height: BAND_H }}>
                {/* The tier cell — the scale itself. The fill is one ink
                    at the ramp's alpha, laid UNDER the letter: opacity on
                    the box would fade the letter with it. */}
                <div
                  style={{
                    position: "relative",
                    boxSizing: "border-box",
                    flex: `0 0 ${BAND_H}px`,
                    border: `${rule}px solid ${palette.ink}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      backgroundColor: palette.ink,
                      opacity: alpha,
                    }}
                  />
                  <span
                    style={{
                      position: "relative",
                      fontFamily: mono,
                      fontWeight: 700,
                      fontSize:
                        row.tier.length > 1
                          ? Math.round(letterSize * 0.58)
                          : letterSize,
                      letterSpacing: "0.05em",
                      // Trailing tracking would off-center the letter.
                      paddingLeft: "0.05em",
                      textTransform: "uppercase",
                      color: alpha >= REVERSE_AT ? palette.paper : palette.ink,
                    }}
                  >
                    {row.tier}
                  </span>
                </div>

                <div
                  style={{
                    flex: 1,
                    minWidth: 0,
                    marginLeft: CELL_GAP,
                    display: "flex",
                    gap: CHIP_GAP,
                  }}
                >
                  {items.length === 0 ? (
                    // The receipt prints the absence rather than leaving a
                    // hole: a dashed slot, the way the app draws a tear.
                    <div
                      style={{
                        flex: 1,
                        boxSizing: "border-box",
                        border: `${rule}px dashed ${palette.trace}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontFamily: mono,
                        fontSize: 34,
                        color: palette.faded,
                      }}
                    >
                      —
                    </div>
                  ) : (
                    items.map((item, i) => (
                      <div
                        key={i}
                        style={{
                          ...printStyle(frame, cueOf(offsets[t] + i)),
                          flex: "1 1 0",
                          minWidth: 0,
                          boxSizing: "border-box",
                          border: `${rule}px solid ${palette.trace}`,
                          padding: `${CHIP_PAD_Y}px ${CHIP_PAD_X}px`,
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: valued ? "space-between" : "center",
                          gap: CHIP_TEXT_GAP,
                        }}
                      >
                        {/* `break-word` (never `anywhere`) breaks INSIDE a
                            word only when the word cannot fit a line of
                            its own — the exact rule `wrapLines` counts
                            with. `word-break` is inherited, so it is
                            pinned to `normal` here: `break-all` from any
                            future ancestor would let the browser cut
                            anywhere and the arithmetic would be fiction.
                            The knot `knit` ties is a U+00A0, which no
                            wrapping mode treats as a break opportunity. */}
                        <span
                          style={{
                            fontFamily: mono,
                            fontSize: labelSize,
                            lineHeight: LABEL_LINE,
                            letterSpacing: "0.04em",
                            textTransform: "uppercase",
                            overflowWrap: "break-word",
                            wordBreak: "normal",
                            color: palette.ink,
                          }}
                        >
                          {mu(knit(item.label, labelCols))}
                        </span>
                        {item.value ? (
                          <span
                            style={{
                              fontFamily: mono,
                              fontWeight: 700,
                              fontSize: valueSize,
                              lineHeight: VALUE_LINE,
                              letterSpacing: "0.02em",
                              textTransform: "uppercase",
                              overflowWrap: "break-word",
                              wordBreak: "normal",
                              color: palette.ink,
                            }}
                          >
                            {mu(knit(item.value, valueCols))}
                          </span>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/** Items across every tier, in reading order — the element's cue count. */
export const tierListParts = (props: unknown): number =>
  (((props as TierListProps | undefined)?.tiers ?? []) as TierListRow[]).reduce(
    (n, t) => n + (t.items?.length ?? 0),
    0,
  );
