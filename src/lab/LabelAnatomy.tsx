import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  interpolateColors,
  useCurrentFrame,
} from "remotion";
import { mono, mu, palettes, tokens, type Palette } from "../tokens";
import { PrintWipe } from "./reveals";

/**
 * LabelAnatomy — a nutrition label being read.
 *
 * The recurring device for scan stories: an EU-style NUTRITION panel drawn
 * as a physical paper card (warm paper + ink ALWAYS — a label has no dark
 * mode) anchored LEFT on the canvas, leaving a dark margin to its right.
 * The card is the specimen; the margin is the reading. The reading pass
 * never writes on the card except two instruments:
 *
 * - the HIGHLIGHT — one 3px ink rectangle, transparent fill, that frames a
 *   row and EASES to the next target at each cue (bezier, ~14 frames): one
 *   instrument traveling, never blinking between positions;
 * - the STRIKE — a 3px ink line drawn left→right through a row's VALUE
 *   ("this number misleads"); the struck figure concedes to faded as the
 *   line crosses it.
 *
 * Everything said ABOUT the label lives in the margin: a hairline leader
 * exits the card at the row's center and carries to a margin note
 * (uppercase mono, paper-colored ink on the dark canvas) that prints as
 * the frame lands. A strike's corrected value prints as the note's heavy
 * first line — the annotation answers, the label is never rewritten.
 *
 * Layout is pure arithmetic (fixed row heights), so frame, strikes and
 * leaders are computable without measuring the DOM. Notes are placed at
 * their row's center and pushed DOWN below an earlier note when they would
 * collide; a pushed note gets an L-shaped leader (right-angle elbow) so
 * the line still starts at its row. End state is a STATIC still: panel
 * printed, frame parked on the last step, all strikes and notes standing.
 */

export type LabelRow = {
  left: string;
  right: string;
  /** Indented "of which …" line, smaller type. */
  sub?: boolean;
  /** Sits under a heavy solid rule with a breathing gap — the per-portion line. */
  footer?: boolean;
};

export type LabelStep = {
  /** Index into `rows` the highlight frame travels to. */
  row: number;
  /** Margin note; "\n" marks authored line breaks, long lines auto-wrap. */
  note?: string;
  /** Draw the 3px ink line through this row's value. */
  strike?: boolean;
  /** Corrected value — prints heavy as the note's first line, post-strike. */
  correction?: string;
};

export type LabelAnatomyProps = {
  /** Heavy title row of the panel. */
  title?: string;
  rows: LabelRow[];
  steps: LabelStep[];
  /** Faded line above the card, on the canvas. */
  kicker?: string;
  /** Faded closing line under the card, prints after the last step. */
  line?: string;
  /** Canvas theme; the card itself is always physical light paper. */
  theme?: "light" | "dark";
  /** Frame the panel starts printing. */
  appearAt?: number;
  /** Absolute cue frame per step; falls back to `stagger` spacing. */
  stepCues?: number[];
  /** Frames between step cues when `stepCues` is not given. */
  stagger?: number;
};

const rule = 2;
const PAD_X = 84;
const PAD_RIGHT = 144; // content ends at x = 936
const STAGE_W = 1080 - PAD_X - PAD_RIGHT; // 852
const EASE = Easing.bezier(0.25, 0.1, 0.25, 1);
const CLAMP = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};
const EASED = { easing: EASE, ...CLAMP };

const TRAVEL = 14; // frames the highlight takes to reach the next row
const STRIKE_FRAMES = 10;
const PRINT_FRAMES = 10;

// --- card metrics — fixed, so every overlay is arithmetic ----------------
const CARD_W = 560;
const CARD_PAD = 36; // inner padding inside the 2px border
const INSET = rule + CARD_PAD; // content origin from the card's outer edge
const TITLE_BLOCK = 78; // title text + its solid rule
const ROW_H = 74; // every row, dashed rule included
const FOOTER_GAP = 12; // breathing room above the footer's solid rule
const ROW_FONT = 27;
const SUB_FONT = 24;
const VALUE_TRACK = 0.04; // em — explicit, so strike width is computable
const CHAR = 0.6; // SF Mono advance in em — the repo's metric contract

// --- margin metrics ------------------------------------------------------
const LEADER_GAP = 60; // card's right border → note column
const NOTE_X = CARD_W + LEADER_GAP; // 620
const NOTE_W = STAGE_W - NOTE_X; // 232
const NOTE_FONT = 23;
const NOTE_LH = 1.55;
const NOTE_TRACK = 0.04;
const CORR_FONT = 30;
const CORR_LH = Math.round(CORR_FONT * 1.2); // 36
const NOTE_MARGIN = 24; // minimum air between stacked notes
const ELBOW_X = CARD_W + 28; // where an L-leader turns
const LEADER_END = NOTE_X - 14; // leaders stop short of the type

/** Greedy wrap on spaces — mono makes the math exact, no measurement. */
const wrapLine = (text: string, maxChars: number): string[] => {
  const out: string[] = [];
  for (const authored of text.split("\n")) {
    const words = authored.split(" ").filter((w) => w.length > 0);
    let acc = "";
    for (const w of words) {
      const next = acc.length === 0 ? w : `${acc} ${w}`;
      if (next.length <= maxChars || acc.length === 0) {
        acc = next;
      } else {
        out.push(acc);
        acc = w;
      }
    }
    if (acc.length > 0) out.push(acc);
  }
  return out.length > 0 ? out : [""];
};

export const LabelAnatomy: React.FC<LabelAnatomyProps> = ({
  title = "Nutrition — per 100 g",
  rows,
  steps,
  kicker,
  line,
  theme = "dark",
  appearAt = 12,
  stepCues,
  stagger = 90,
}) => {
  const frame = useCurrentFrame();
  const canvas: Palette = palettes[theme];

  // --- card geometry ------------------------------------------------------
  const rowTops: number[] = [];
  let y = INSET + TITLE_BLOCK;
  for (const row of rows) {
    if (row.footer) y += FOOTER_GAP;
    rowTops.push(y);
    y += ROW_H;
  }
  const cardH = y + INSET;
  const rowCenter = (i: number) => rowTops[i] + (ROW_H - rule) / 2;

  // --- step timeline ------------------------------------------------------
  const firstStep = appearAt + 20 + rows.length * 4 + 36;
  const cues = steps.map((_, k) => stepCues?.[k] ?? firstStep + k * stagger);
  // The frame lands: first appearance is a wipe (8), travels take TRAVEL.
  const landAt = (k: number) => cues[k] + (k === 0 ? 8 : TRAVEL);
  const strikeAt = (k: number) => landAt(k) + 2;
  const noteAt = (k: number) =>
    landAt(k) + (steps[k].strike ? 2 + STRIKE_FRAMES + 6 : 4);

  // --- margin notes: wrap, place, resolve collisions downward -------------
  const noteChars = Math.max(
    6,
    Math.floor(NOTE_W / (NOTE_FONT * (CHAR + NOTE_TRACK))),
  );
  const noteLineH = NOTE_FONT * NOTE_LH;
  type PlacedNote = {
    step: number;
    top: number;
    height: number;
    firstLineH: number;
    lines: string[];
    correction?: string;
  };
  const placed: PlacedNote[] = [];
  let floor = -Infinity;
  steps.forEach((step, k) => {
    if (!step.note && !step.correction) return;
    const lines = step.note ? wrapLine(step.note, noteChars) : [];
    const firstLineH = step.correction ? CORR_LH : noteLineH;
    const height =
      (step.correction ? CORR_LH + 10 : 0) + lines.length * noteLineH;
    const desired = rowCenter(step.row) - firstLineH / 2;
    const top = Math.max(desired, floor);
    placed.push({
      step: k,
      top,
      height,
      firstLineH,
      lines,
      correction: step.correction,
    });
    floor = top + height + NOTE_MARGIN;
  });

  const blockH = Math.max(
    cardH,
    ...placed.map((n) => n.top + n.height),
  );

  // --- highlight frame: one rect, eased travel ----------------------------
  const frameTopFor = (k: number) =>
    rowTops[steps[k].row] + (rows[steps[k].row].footer ? 6 : 2);
  let frameTop = steps.length > 0 ? frameTopFor(0) : 0;
  if (steps.length > 1) {
    const input: number[] = [cues[0]];
    const output: number[] = [frameTopFor(0)];
    for (let k = 1; k < steps.length; k += 1) {
      const start = Math.max(cues[k], input[input.length - 1] + 1);
      input.push(start, start + TRAVEL);
      output.push(frameTopFor(k - 1), frameTopFor(k));
    }
    frameTop = interpolate(frame, input, output, EASED);
  }
  const frameH = ROW_H - 8;
  const frameWipe =
    steps.length > 0
      ? interpolate(frame, [cues[0], cues[0] + 8], [100, 0], CLAMP)
      : 0;

  // --- strikes ------------------------------------------------------------
  const strikeByRow = new Map<number, number>(); // row index → step index
  steps.forEach((s, k) => {
    if (s.strike) strikeByRow.set(s.row, k);
  });
  const valueWidth = (row: LabelRow) => {
    const fs = row.sub ? SUB_FONT : ROW_FONT;
    return row.right.length * fs * (CHAR + VALUE_TRACK);
  };

  // --- shared type styles -------------------------------------------------
  const canvasLabel: React.CSSProperties = {
    fontFamily: mono,
    fontSize: 24,
    letterSpacing: "0.25em",
    textTransform: "uppercase",
    color: canvas.faded,
  };

  return (
    <AbsoluteFill style={{ backgroundColor: canvas.paper }}>
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
            <div style={{ ...canvasLabel, marginBottom: 44 }}>{mu(kicker)}</div>
          </PrintWipe>
        ) : null}

        <div style={{ position: "relative", width: STAGE_W, height: blockH }}>
          {/* The specimen — physical paper, always light. */}
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: CARD_W,
              height: cardH,
              boxSizing: "border-box",
              backgroundColor: tokens.paper,
              border: `${rule}px solid ${tokens.ink}`,
              clipPath:
                frame < appearAt + 4
                  ? "inset(0 0 100% 0)"
                  : `inset(0 0 ${interpolate(
                      frame,
                      [appearAt + 4, appearAt + 16],
                      [100, 0],
                      CLAMP,
                    )}% 0)`,
            }}
          >
            <div style={{ padding: CARD_PAD }}>
              <PrintWipe cue={appearAt + 8} frames={8}>
                <div
                  style={{
                    height: TITLE_BLOCK,
                    boxSizing: "border-box",
                    display: "flex",
                    alignItems: "flex-start",
                    paddingTop: 6,
                    borderBottom: `${rule}px solid ${tokens.ink}`,
                    fontFamily: mono,
                    fontWeight: 700,
                    fontSize: 30,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: tokens.ink,
                  }}
                >
                  {mu(title)}
                </div>
              </PrintWipe>
              {rows.map((row, i) => {
                const struckStep = strikeByRow.get(i);
                const strikeStart =
                  struckStep !== undefined ? strikeAt(struckStep) : undefined;
                const conceded =
                  strikeStart === undefined
                    ? tokens.ink
                    : interpolateColors(
                        interpolate(
                          frame,
                          [strikeStart, strikeStart + STRIKE_FRAMES],
                          [0, 1],
                          EASED,
                        ),
                        [0, 1],
                        [tokens.ink, tokens.faded],
                      );
                const fs = row.sub ? SUB_FONT : ROW_FONT;
                return (
                  <PrintWipe key={i} cue={appearAt + 16 + i * 4} frames={8}>
                    <div
                      style={{
                        height: ROW_H,
                        boxSizing: "border-box",
                        marginTop: row.footer ? FOOTER_GAP : 0,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 24,
                        paddingLeft: row.sub ? 28 : 0,
                        borderBottom:
                          row.footer || i === rows.length - 1
                            ? undefined
                            : `${rule}px dashed ${tokens.trace}`,
                        borderTop: row.footer
                          ? `${rule}px solid ${tokens.ink}`
                          : undefined,
                        fontFamily: mono,
                        fontSize: fs,
                        textTransform: "uppercase",
                        color: tokens.ink,
                      }}
                    >
                      <span style={{ letterSpacing: "0.06em" }}>
                        {mu(row.left)}
                      </span>
                      <span
                        style={{
                          fontWeight: 700,
                          letterSpacing: `${VALUE_TRACK}em`,
                          whiteSpace: "nowrap",
                          color: conceded,
                        }}
                      >
                        {mu(row.right)}
                      </span>
                    </div>
                  </PrintWipe>
                );
              })}
            </div>
          </div>

          {/* Strikes — 3px ink, left→right through the value. */}
          {steps.map((step, k) => {
            if (!step.strike) return null;
            const start = strikeAt(k);
            if (frame < start) return null;
            const row = rows[step.row];
            const w = valueWidth(row) + 24;
            const right = CARD_W - INSET + 12;
            const drawn =
              interpolate(frame, [start, start + STRIKE_FRAMES], [0, 1], EASED) *
              w;
            return (
              <div
                key={`strike-${k}`}
                style={{
                  position: "absolute",
                  left: right - w,
                  top: rowCenter(step.row) - 1 + (row.footer ? 2 : 0),
                  width: drawn,
                  height: 3,
                  backgroundColor: tokens.ink,
                }}
              />
            );
          })}

          {/* The highlight — one 3px ink rectangle, traveling. */}
          {steps.length > 0 && frame >= cues[0] ? (
            <div
              style={{
                position: "absolute",
                left: CARD_PAD - 18,
                top: frameTop,
                width: CARD_W - 2 * (CARD_PAD - 18),
                height: frameH,
                boxSizing: "border-box",
                border: `3px solid ${tokens.ink}`,
                clipPath:
                  frameWipe > 0 ? `inset(0 0 ${frameWipe}% 0)` : undefined,
              }}
            />
          ) : null}

          {/* Leaders + margin notes — the reading, in the dark margin. */}
          {placed.map((n) => {
            const k = n.step;
            const cue = noteAt(k);
            const rowY =
              rowCenter(steps[k].row) + (rows[steps[k].row].footer ? 2 : 0);
            const noteY = n.top + n.firstLineH / 2;
            const bent = Math.abs(noteY - rowY) > 2;
            // Never let the leader leave the card before the frame lands.
            const leadStart = Math.max(landAt(k) + 2, cue - 6);
            const p = interpolate(
              frame,
              [leadStart, leadStart + 8],
              [0, 1],
              EASED,
            );
            const segs: React.CSSProperties[] = [];
            if (!bent) {
              const len = LEADER_END - CARD_W;
              segs.push({
                left: CARD_W,
                top: rowY - 1,
                width: p * len,
                height: rule,
              });
            } else {
              // L-leader: out of the card, down (or up), into the note.
              const l1 = ELBOW_X - CARD_W;
              const l2 = Math.abs(noteY - rowY);
              const l3 = LEADER_END - ELBOW_X;
              const total = l1 + l2 + l3;
              const d = p * total;
              segs.push({
                left: CARD_W,
                top: rowY - 1,
                width: Math.min(d, l1),
                height: rule,
              });
              if (d > l1) {
                const v = Math.min(d - l1, l2);
                segs.push({
                  left: ELBOW_X - rule,
                  top: noteY > rowY ? rowY - 1 : rowY - 1 - v,
                  width: rule,
                  height: v + rule,
                });
              }
              if (d > l1 + l2) {
                segs.push({
                  left: ELBOW_X - rule,
                  top: noteY - 1,
                  width: Math.min(d - l1 - l2, l3) + rule,
                  height: rule,
                });
              }
            }
            return (
              <React.Fragment key={`note-${k}`}>
                {frame >= leadStart
                  ? segs.map((s, i) => (
                      <div
                        key={i}
                        style={{
                          position: "absolute",
                          backgroundColor: canvas.faded,
                          ...s,
                        }}
                      />
                    ))
                  : null}
                <div
                  style={{
                    position: "absolute",
                    left: NOTE_X,
                    top: n.top,
                    width: NOTE_W,
                  }}
                >
                  <PrintWipe cue={cue} frames={PRINT_FRAMES}>
                    {n.correction ? (
                      <div
                        style={{
                          fontFamily: mono,
                          fontWeight: 700,
                          fontSize: CORR_FONT,
                          lineHeight: `${CORR_LH}px`,
                          letterSpacing: `${NOTE_TRACK}em`,
                          textTransform: "uppercase",
                          color: canvas.ink,
                          marginBottom: 10,
                        }}
                      >
                        {mu(n.correction)}
                      </div>
                    ) : null}
                    <div
                      style={{
                        fontFamily: mono,
                        fontSize: NOTE_FONT,
                        lineHeight: NOTE_LH,
                        letterSpacing: `${NOTE_TRACK}em`,
                        textTransform: "uppercase",
                        whiteSpace: "pre",
                        color: canvas.ink,
                      }}
                    >
                      {mu(n.lines.join("\n"))}
                    </div>
                  </PrintWipe>
                </div>
              </React.Fragment>
            );
          })}
        </div>

        {line ? (
          <PrintWipe
            cue={
              (steps.length > 0 ? noteAt(steps.length - 1) : appearAt + 40) + 40
            }
            frames={PRINT_FRAMES}
          >
            <div
              style={{
                marginTop: 52,
                fontFamily: mono,
                fontSize: 22,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: canvas.faded,
              }}
            >
              {mu(line)}
            </div>
          </PrintWipe>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
