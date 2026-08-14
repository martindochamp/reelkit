import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  interpolateColors,
  useCurrentFrame,
} from "remotion";
import { mono, palettes, type Palette } from "../tokens";
import { revealClip } from "./reveal";

/**
 * CalendarStrip — the month, stamped.
 *
 * A month prints as a week grid of trace-bordered squares, each carrying
 * its day number. Then the record replays: day by day, every kept day
 * takes the stamp — an ink fill that lands with the verdict's settle
 * (approach slightly large, contact, no bounce) — while a live counter
 * tallies in the header. Missed days take nothing: their number ghosts
 * from faded to trace on their beat and the square stays empty. What was
 * not done is shown, not hidden.
 *
 * End state: a static grid — ink squares kept, empty squares missed —
 * and a receipt row: DAYS KEPT / 28 / 31 KEPT.
 *
 * Motion doctrine: print wipes, one bezier ease, a stamp settle lifted
 * from the thermal printer's verdict (in ink — stamp red belongs to the
 * evening verdict alone). Nothing springs, nothing bounces.
 */

export type CalendarStripProps = {
  /** Small faded uppercase line, top left. */
  kicker?: string;
  /** Days in the month (28–31). */
  days: number;
  /** Column of day 1 — 0 = first column (Monday in the default header). */
  startWeekday?: number;
  /** 1-based day numbers that were NOT kept. Everything else stamps. */
  missed?: number[];
  /** Column initials. Default Monday-first M T W T F S S. */
  weekdays?: string[];
  /** Receipt row label under the grid (default "Days kept"). */
  title?: string;
  /** Receipt row value (default computed "N / DAYS"). */
  value?: string;
  /** Faded provenance line under the row. */
  line?: string;
  theme?: "light" | "dark";
  /** Frame the grid starts printing (default 0). */
  appearAt?: number;
  /** Frame day 1's beat lands (default appearAt + 50). */
  stampsAt?: number;
  /** Frames between day beats (default 5). */
  stampStagger?: number;
  /** Absolute frame of day N's beat at cues[N-1] — for word-sync. */
  cues?: number[];
};

const rule = 2;
const PAD_X = 84;
const PAD_RIGHT = 144; // content ends at x = 936
const STAGE_W = 1080 - PAD_X - PAD_RIGHT; // 852

const COLS = 7;
const GAP = 22;
const CELL = Math.floor((STAGE_W - (COLS - 1) * GAP) / COLS); // 102
const GRID_W = COLS * CELL + (COLS - 1) * GAP;

const CELL_PRINT = 5; // frames one square's print wipe takes
const CELL_STAGGER = 0.7; // frames between square print starts
const STAMP_FALL = 5; // approach; contact on the last frame
const GHOST_FRAMES = 10; // missed number easing faded -> trace
const PRINT_FRAMES = 10; // kicker / row print wipe (house style)

const EASE = Easing.bezier(0.25, 0.1, 0.25, 1);
const clamp = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

/** Top-down print wipe, the house reveal. */
const printClip = (
  frame: number,
  cue: number,
  frames: number = PRINT_FRAMES,
): React.CSSProperties => revealClip(frame, cue, frames);

export const CalendarStrip: React.FC<CalendarStripProps> = ({
  kicker,
  days,
  startWeekday = 0,
  missed = [],
  weekdays = ["M", "T", "W", "T", "F", "S", "S"],
  title = "Days kept",
  value,
  line,
  theme = "dark",
  appearAt = 0,
  stampsAt,
  stampStagger = 5,
  cues,
}) => {
  const frame = useCurrentFrame();
  const palette: Palette = palettes[theme];

  const missedSet = new Set(missed);
  const keptTotal = days - missedSet.size;

  // --- timeline -----------------------------------------------------------
  const gridStart = appearAt + 8;
  const beatsStart = stampsAt ?? appearAt + 50;
  const cueOf = (day: number) =>
    cues?.[day - 1] ?? beatsStart + (day - 1) * stampStagger;
  const contactOf = (day: number) => cueOf(day) + STAMP_FALL;

  let lastContact = 0;
  for (let d = 1; d <= days; d += 1) lastContact = Math.max(lastContact, contactOf(d));
  const rowCue = lastContact + 14;

  // Live counter: a day counts once its stamp makes contact.
  let keptSoFar = 0;
  for (let d = 1; d <= days; d += 1) {
    if (!missedSet.has(d) && frame >= contactOf(d)) keptSoFar += 1;
  }

  // --- cells --------------------------------------------------------------
  const cells: React.ReactNode[] = [];
  for (let i = 0; i < startWeekday; i += 1) {
    cells.push(<div key={`off${i}`} style={{ width: CELL, height: CELL }} />);
  }
  for (let d = 1; d <= days; d += 1) {
    const cue = cueOf(d);
    const contact = contactOf(d);
    const isMissed = missedSet.has(d);
    const stamped = !isMissed && frame >= cue;
    const landed = !isMissed && frame >= contact;

    // Stamp approach: slightly large, a settling tilt, ink snapping full
    // at contact. Decisive, not bouncy.
    const t = interpolate(frame, [cue, contact], [0, 1], {
      easing: EASE,
      ...clamp,
    });
    const stampScale = 1.16 - 0.16 * t;
    const stampRot = -4 * (1 - t);
    const stampOpacity = landed
      ? 1
      : interpolate(frame, [cue, contact - 1], [0.3, 0.85], clamp);

    // Missed days ghost on their beat: the number eases faded -> trace.
    const numberColor = landed
      ? palette.paper
      : isMissed && frame >= cue
        ? interpolateColors(
            interpolate(frame, [cue, cue + GHOST_FRAMES], [0, 1], {
              easing: EASE,
              ...clamp,
            }),
            [0, 1],
            [palette.faded, palette.trace],
          )
        : palette.faded;

    const order = startWeekday + d - 1; // print position in reading order
    cells.push(
      <div
        key={d}
        style={{
          position: "relative",
          width: CELL,
          height: CELL,
          boxSizing: "border-box",
          border: `${rule}px solid ${palette.trace}`,
          ...printClip(frame, gridStart + order * CELL_STAGGER, CELL_PRINT),
        }}
      >
        {stamped ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundColor: palette.ink,
              transform: `scale(${stampScale}) rotate(${stampRot}deg)`,
              opacity: stampOpacity,
            }}
          />
        ) : null}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: mono,
            fontSize: 34,
            fontWeight: landed ? 700 : 400,
            color: numberColor,
          }}
        >
          {d}
        </div>
      </div>,
    );
  }

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
        {/* Header: kicker left, live tally right. */}
        <div
          style={{
            ...printClip(frame, appearAt),
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 40,
          }}
        >
          <span
            style={{
              fontFamily: mono,
              fontSize: 26,
              letterSpacing: "0.25em",
              textTransform: "uppercase",
              color: palette.faded,
            }}
          >
            {kicker}
          </span>
          <span
            style={{
              fontFamily: mono,
              fontWeight: 700,
              fontSize: 30,
              letterSpacing: "0.06em",
              color: palette.ink,
            }}
          >
            {keptSoFar} / {days}
          </span>
        </div>

        <div style={{ display: "flex", justifyContent: "center" }}>
          <div style={{ width: GRID_W }}>
            {/* Weekday initials. */}
            <div
              style={{
                ...printClip(frame, appearAt + 4, 8),
                display: "grid",
                gridTemplateColumns: `repeat(${COLS}, ${CELL}px)`,
                columnGap: GAP,
                marginBottom: 18,
              }}
            >
              {weekdays.slice(0, COLS).map((w, i) => (
                <div
                  key={i}
                  style={{
                    textAlign: "center",
                    fontFamily: mono,
                    fontSize: 22,
                    letterSpacing: "0.2em",
                    textTransform: "uppercase",
                    color: palette.faded,
                  }}
                >
                  {w}
                </div>
              ))}
            </div>

            {/* The month. */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${COLS}, ${CELL}px)`,
                gap: GAP,
              }}
            >
              {cells}
            </div>
          </div>
        </div>

        {/* Receipt row — arithmetic, printed last. */}
        <div style={printClip(frame, rowCue)}>
          <div
            style={{
              marginTop: 52,
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
            <span style={{ whiteSpace: "nowrap" }}>
              {value ?? `${keptTotal} / ${days}`}
            </span>
          </div>
        </div>

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
