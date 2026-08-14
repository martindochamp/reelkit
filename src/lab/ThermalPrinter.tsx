import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { mono, palettes, tokens } from "../tokens";

/**
 * ThermalPrinter — the machine itself as the show. A receipt emerges from
 * a slot bar, line by line: the paper feeds up, a print head sweeps each
 * line into existence left-to-right, and when the tape is done the evening
 * verdict stamp lands on it.
 *
 * The paper is physical — always the light palette, whatever the canvas
 * theme (same rule as the reel's Card). The stamp red is the app's evening
 * verdict and appears nowhere else.
 *
 * End state: a complete static receipt above the machine, stamped.
 */

export const PRINTER_FPS = 30;

const ease = Easing.bezier(0.25, 0.1, 0.25, 1);
const clamp = {
  easing: ease,
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

/** The app's evening verdict red — light-paper variant (the receipt is paper). */
const STAMP_RED = "#C0392B";

// Geometry — 1080×1920 canvas, content x 84→936, y 210→1360.
const PAPER_W = 660;
const PAPER_X = (1080 - PAPER_W) / 2;
const PAD_X = 46; // inner paper margin
const PRINT_EDGE = 1270; // the slot: paper exists only above this line
const BAR_X = 150;
const BAR_W = 780;
const BAR_H = 48;
const WRAPPER_TOP = 140;
const PAD_TOP = 56; // blank leader before the first printed line
const PAD_BOTTOM = 60; // blank margin after the tear line

const HEAD_W = 26;
const HEAD_H = 46;

// Timing (frames @30).
const START = 8;
const FEED = 6; // paper feed before each line
const FINAL_FEED = 10;
const STAMP_DELAY = 10;
const STAMP_FALL = 9; // approach; contact on the last frame
const HOLD = 55;

export type PrinterLine =
  | { kind: "wordmark"; text: string }
  | { kind: "meta"; text: string }
  | { kind: "rule" }
  | { kind: "row"; left: string; right: string }
  | { kind: "total"; left: string; right: string }
  | { kind: "tear" }
  | { kind: "space" };

export type ThermalPrinterProps = {
  lines: PrinterLine[];
  /** The evening verdict. Omit it and the receipt simply finishes printing. */
  stamp?: { text: string };
  theme?: "light" | "dark";
};

const lineH = (l: PrinterLine): number => {
  switch (l.kind) {
    case "wordmark":
      return 96;
    case "meta":
      return 44;
    case "rule":
      return 36;
    case "row":
      return 64;
    case "total":
      return 84;
    case "tear":
      return 56;
    case "space":
      return 40;
  }
};

const sweepF = (l: PrinterLine): number => {
  switch (l.kind) {
    case "wordmark":
      return 12;
    case "meta":
      return 10;
    case "rule":
    case "tear":
      return 7;
    case "row":
    case "total":
      return 12;
    case "space":
      return 0;
  }
};

type Entry = {
  line: PrinterLine;
  y: number;
  h: number;
  feedStart: number;
  sweepStart: number;
  sweepEnd: number;
  sweep: number;
  fedFrom: number;
  fedTo: number;
};

type Schedule = {
  entries: Entry[];
  paperH: number;
  finalFeed: { start: number; end: number; from: number; to: number };
  stampStart: number;
  contact: number;
  total: number;
};

export const buildSchedule = (
  lines: PrinterLine[],
  hasStamp: boolean,
): Schedule => {
  const entries: Entry[] = [];
  let y = PAD_TOP;
  let t = START;
  let fed = 0;
  for (const line of lines) {
    const h = lineH(line);
    const sweep = sweepF(line);
    entries.push({
      line,
      y,
      h,
      feedStart: t,
      sweepStart: t + FEED,
      sweepEnd: t + FEED + sweep,
      sweep,
      fedFrom: fed,
      fedTo: y + h,
    });
    y += h;
    fed = y;
    t += FEED + sweep;
  }
  const paperH = y + PAD_BOTTOM;
  const finalFeed = { start: t, end: t + FINAL_FEED, from: fed, to: paperH };
  const stampStart = finalFeed.end + (hasStamp ? STAMP_DELAY : 0);
  const contact = stampStart + (hasStamp ? STAMP_FALL : 0);
  return { entries, paperH, finalFeed, stampStart, contact, total: contact + HOLD };
};

export const thermalPrinterDuration = (props: ThermalPrinterProps) =>
  buildSchedule(props.lines, Boolean(props.stamp)).total;

/** How much paper has emerged above the slot at this frame. */
const fedAt = (frame: number, sched: Schedule): number => {
  let fed = 0;
  for (const e of sched.entries) {
    if (frame < e.feedStart) return fed;
    if (frame < e.sweepStart) {
      return interpolate(frame, [e.feedStart, e.sweepStart], [e.fedFrom, e.fedTo], clamp);
    }
    fed = e.fedTo;
  }
  const f = sched.finalFeed;
  if (frame < f.start) return fed;
  return interpolate(frame, [f.start, f.end], [f.from, f.to], clamp);
};

/** Print-head position: x 0..1 across the text width, y in screen space. */
const headAt = (frame: number, sched: Schedule): { x: number; y: number } => {
  const first = sched.entries[0];
  let prevX = 0;
  let prevY = PRINT_EDGE - (first ? first.h : 64) / 2;
  for (const e of sched.entries) {
    const stripY = PRINT_EDGE - e.h / 2;
    if (frame < e.feedStart) return { x: prevX, y: prevY };
    if (frame < e.sweepStart) {
      const t = interpolate(frame, [e.feedStart, e.sweepStart], [0, 1], clamp);
      return { x: prevX * (1 - t), y: prevY + (stripY - prevY) * t };
    }
    if (e.sweep > 0 && frame < e.sweepEnd) {
      const s = interpolate(frame, [e.sweepStart, e.sweepEnd], [0, 1], clamp);
      return { x: s, y: stripY };
    }
    prevX = e.sweep > 0 ? 1 : 0;
    prevY = stripY;
  }
  const f = sched.finalFeed;
  if (frame < f.end) {
    const t = interpolate(frame, [f.start, f.end], [0, 1], clamp);
    return { x: prevX * (1 - t), y: prevY };
  }
  return { x: 0, y: prevY };
};

/** A line is hidden until its sweep; during it, revealed left-to-right. */
const revealStyle = (frame: number, e: Entry): React.CSSProperties => {
  if (e.sweep === 0) return {};
  if (frame < e.sweepStart) return { visibility: "hidden" };
  if (frame >= e.sweepEnd) return {};
  const s = interpolate(frame, [e.sweepStart, e.sweepEnd], [0, 1], clamp);
  return { clipPath: `inset(0 ${(1 - s) * 100}% 0 0)` };
};

const LineBody: React.FC<{ line: PrinterLine }> = ({ line }) => {
  switch (line.kind) {
    case "wordmark":
      return (
        <div
          style={{
            height: lineH(line),
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: mono,
            fontWeight: 700,
            fontSize: 54,
            letterSpacing: "0.3em",
            paddingLeft: "0.3em",
            textTransform: "uppercase",
            color: tokens.ink,
          }}
        >
          {line.text}
        </div>
      );
    case "meta":
      return (
        <div
          style={{
            height: lineH(line),
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: mono,
            fontSize: 24,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: tokens.faded,
          }}
        >
          {line.text}
        </div>
      );
    case "rule":
      return (
        <div style={{ height: lineH(line), display: "flex", alignItems: "center" }}>
          <div style={{ width: "100%", height: 3, backgroundColor: tokens.ink }} />
        </div>
      );
    case "row":
      return (
        <div
          style={{
            height: lineH(line),
            boxSizing: "border-box",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 24,
            borderBottom: `2px dashed ${tokens.trace}`,
            fontFamily: mono,
            fontSize: 30,
            textTransform: "uppercase",
            color: tokens.ink,
          }}
        >
          <span style={{ letterSpacing: "0.06em" }}>{line.left}</span>
          <span style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{line.right}</span>
        </div>
      );
    case "total":
      return (
        <div
          style={{
            height: lineH(line),
            boxSizing: "border-box",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 24,
            borderTop: `3px solid ${tokens.ink}`,
            fontFamily: mono,
            fontWeight: 700,
            fontSize: 33,
            textTransform: "uppercase",
            color: tokens.ink,
          }}
        >
          <span style={{ letterSpacing: "0.06em" }}>{line.left}</span>
          <span style={{ whiteSpace: "nowrap" }}>{line.right}</span>
        </div>
      );
    case "tear":
      return (
        <div style={{ height: lineH(line), display: "flex", alignItems: "center" }}>
          <div style={{ width: "100%", borderTop: `3px dashed ${tokens.faded}` }} />
        </div>
      );
    case "space":
      return <div style={{ height: lineH(line) }} />;
  }
};

export const ThermalPrinter: React.FC<ThermalPrinterProps> = ({
  lines,
  stamp,
  theme = "dark",
}) => {
  const frame = useCurrentFrame();
  const canvas = palettes[theme];
  const sched = buildSchedule(lines, Boolean(stamp));

  const fed = fedAt(frame, sched);
  const head = headAt(frame, sched);

  // The verdict lands and the paper takes the hit: a 6px thud, settled in
  // four frames, no overshoot.
  const thud =
    stamp && frame >= sched.contact
      ? interpolate(frame, [sched.contact, sched.contact + 4], [6, 0], clamp)
      : 0;

  const paperTop = PRINT_EDGE - fed - WRAPPER_TOP + thud;

  const headOpacity = interpolate(
    frame,
    [0, 4, sched.finalFeed.end, sched.finalFeed.end + 8],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const headScreenX =
    PAPER_X + PAD_X + head.x * (PAPER_W - 2 * PAD_X) - HEAD_W / 2;

  // Stamp approach: slightly large, rotation settling, ink snapping full
  // at contact. Decisive, not bouncy.
  //
  // A RECEIPT WITH NO STAMP still computes these. `buildSchedule` sets
  // stampStart = contact = finalFeed.end when `stamp` is absent — a
  // zero-width range, and Remotion throws `inputRange must be strictly
  // monotonically increasing` from inside the renderer, naming no post
  // and no beat. It had never fired because the element's only outing
  // was the demo sheet, which hands it a KEPT stamp; the first real
  // reel to print a plain lipid panel hit it after the TTS was already
  // paid for.
  //
  // Widening here rather than in `buildSchedule` on purpose: the
  // schedule also sets `total`, so padding it there would silently add
  // hold frames to every stampless receipt. These three values are
  // simply never read when nothing is drawn.
  const stampEnd = Math.max(sched.contact, sched.stampStart + 2);
  const stampScale = interpolate(
    frame,
    [sched.stampStart, stampEnd],
    [1.18, 1],
    clamp,
  );
  const stampRot = interpolate(
    frame,
    [sched.stampStart, stampEnd],
    [-11, -6],
    clamp,
  );
  const stampOpacity =
    frame >= sched.contact
      ? 1
      : interpolate(frame, [sched.stampStart, stampEnd - 1], [0.25, 0.8], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

  const totalEntry = [...sched.entries].reverse().find((e) => e.line.kind === "total");
  const stampY = (totalEntry ? totalEntry.y : sched.paperH - 260) - 72;

  return (
    <AbsoluteFill style={{ backgroundColor: canvas.paper }}>
      {/* Paper, emerging from the slot. Physical — always light. */}
      <div
        style={{
          position: "absolute",
          top: WRAPPER_TOP,
          left: 0,
          right: 0,
          height: PRINT_EDGE + BAR_H / 2 - WRAPPER_TOP,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: PAPER_X,
            width: PAPER_W,
            top: 0,
            height: sched.paperH,
            transform: `translateY(${paperTop}px)`,
            backgroundColor: tokens.paper,
            borderLeft: `2px solid ${tokens.trace}`,
            borderRight: `2px solid ${tokens.trace}`,
            borderTop: `2px solid ${tokens.trace}`,
            boxSizing: "border-box",
          }}
        >
          <div style={{ padding: `${PAD_TOP}px ${PAD_X}px 0` }}>
            {sched.entries.map((e, i) => (
              <div key={i} style={revealStyle(frame, e)}>
                <LineBody line={e.line} />
              </div>
            ))}
          </div>
          {stamp && frame >= sched.stampStart ? (
            <div
              style={{
                position: "absolute",
                top: stampY,
                left: PAPER_W - PAD_X - 390,
                transform: `rotate(${stampRot}deg) scale(${stampScale})`,
                transformOrigin: "center",
                border: `6px solid ${STAMP_RED}`,
                color: STAMP_RED,
                padding: "10px 36px",
                fontFamily: mono,
                fontWeight: 700,
                fontSize: 84,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
                opacity: stampOpacity,
              }}
            >
              {stamp.text}
            </div>
          ) : null}
        </div>
      </div>

      {/* The machine: a slot bar. */}
      <div
        style={{
          position: "absolute",
          left: BAR_X,
          top: PRINT_EDGE,
          width: BAR_W,
          height: BAR_H,
          boxSizing: "border-box",
          backgroundColor: canvas.paper,
          border: `3px solid ${canvas.ink}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            fontFamily: mono,
            fontSize: 20,
            letterSpacing: "0.32em",
            textTransform: "uppercase",
            color: canvas.faded,
          }}
        >
          It reports — it never cheers
        </span>
      </div>

      {/* The print head. */}
      <div
        style={{
          position: "absolute",
          left: headScreenX,
          top: head.y - HEAD_H / 2,
          width: HEAD_W,
          height: HEAD_H,
          backgroundColor: tokens.ink,
          opacity: headOpacity,
        }}
      />
    </AbsoluteFill>
  );
};
