import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  interpolateColors,
  useCurrentFrame,
} from "remotion";
import { mono, palettes, type Palette } from "../tokens";
import { PrintWipe } from "./reveals";

/**
 * Bullets — one message per line.
 *
 * A receipt bullet list for spoken enumerations: each item is a small ink
 * square (a real 14px div — no glyph, no icon) and an uppercase mono line.
 * Items print one by one (cue-able). The CURRENT item holds full ink;
 * when the next one cues, the previous eases to faded — the voice has
 * moved on, the paper remembers. The last item stays ink forever, so the
 * end state reads as a still: one live line, a faded trail above it.
 *
 * `numbered` swaps the squares for a faded "01 02 03" index column —
 * both variants exist; squares were picked as the default on film.
 *
 * Motion: print wipes and bezier(0.25,0.1,0.25,1) color easing only.
 */

export type BulletsProps = {
  items: string[];
  /** Small faded uppercase line above the list. */
  kicker?: string;
  /** Faded two-digit index instead of the ink square. Default: squares. */
  numbered?: boolean;
  theme?: "light" | "dark";
  appearAt?: number;
  /** Frames between item cues when `itemCues` is not given. */
  stagger?: number;
  /** Absolute cue frame per item. */
  itemCues?: number[];
  /** Previous items ease to faded as the voice moves on. Default true. */
  dimPast?: boolean;
};

const rule = 2;
const PAD_X = 84;
const PAD_RIGHT = 144; // content ends at x = 936
const EASE = Easing.bezier(0.25, 0.1, 0.25, 1);
const PRINT_FRAMES = 10;
const DIM_FRAMES = 12;

const ITEM_SIZE = 38;
const ITEM_LINE = 1.45;
const SQUARE = 14;
// Optically centers the square on the cap height of the first line.
const SQUARE_TOP = Math.round((ITEM_SIZE * ITEM_LINE - SQUARE) / 2 - 2);

export const Bullets: React.FC<BulletsProps> = ({
  items,
  kicker,
  numbered = false,
  theme = "dark",
  appearAt = 0,
  stagger = 22,
  itemCues,
  dimPast = true,
}) => {
  const frame = useCurrentFrame();
  const palette: Palette = palettes[theme];

  const cueFor = (i: number) =>
    itemCues?.[i] ?? appearAt + (kicker ? 14 : 0) + i * stagger;

  /** Ink → faded, easing from the moment the NEXT item cues. */
  const itemColor = (i: number): string => {
    if (!dimPast || i >= items.length - 1) return palette.ink;
    const dimStart = cueFor(i + 1);
    const p = interpolate(frame, [dimStart, dimStart + DIM_FRAMES], [0, 1], {
      easing: EASE,
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    return interpolateColors(p, [0, 1], [palette.ink, palette.faded]);
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
        {kicker ? (
          <PrintWipe cue={appearAt} frames={PRINT_FRAMES}>
            <div
              style={{
                fontFamily: mono,
                fontSize: 26,
                letterSpacing: "0.25em",
                textTransform: "uppercase",
                color: palette.faded,
                paddingBottom: 30,
                borderBottom: `${rule}px solid ${palette.ink}`,
                marginBottom: 54,
              }}
            >
              {kicker}
            </div>
          </PrintWipe>
        ) : null}

        <div style={{ display: "flex", flexDirection: "column", gap: 48 }}>
          {items.map((item, i) => {
            const color = itemColor(i);
            return (
              <PrintWipe key={i} cue={cueFor(i)} frames={PRINT_FRAMES}>
                <div
                  style={{
                    display: "flex",
                    gap: 34,
                    alignItems: numbered ? "baseline" : "flex-start",
                  }}
                >
                  {numbered ? (
                    <span
                      style={{
                        fontFamily: mono,
                        fontSize: ITEM_SIZE,
                        letterSpacing: "0.06em",
                        color: palette.faded,
                        width: Math.round(ITEM_SIZE * 1.9),
                        flexShrink: 0,
                      }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  ) : (
                    <div
                      style={{
                        width: SQUARE,
                        height: SQUARE,
                        marginTop: SQUARE_TOP,
                        backgroundColor: color,
                        flexShrink: 0,
                      }}
                    />
                  )}
                  <span
                    style={{
                      fontFamily: mono,
                      fontSize: ITEM_SIZE,
                      fontWeight: 500,
                      lineHeight: ITEM_LINE,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color,
                    }}
                  >
                    {item}
                  </span>
                </div>
              </PrintWipe>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
