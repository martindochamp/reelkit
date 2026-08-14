import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { mono, mu, palettes, type Palette } from "../tokens";

/**
 * Timeline — the hidden author.
 *
 * A horizontal ink hairline scaled by the years themselves (a decade is a
 * decade wide), with faint decade ticks under it. A sweep head travels
 * left → right and the axis exists only behind it: the clip's right edge
 * IS the head's x, so no rule and no tick can appear ahead of the thing
 * drawing it — LineChart's one law, kept.
 *
 * The head does not glide through: it HOPS, event to event, arriving at
 * each one on its cue and easing to a stop there. Cues are therefore the
 * script — pass `eventCues` and the instrument reaches 1998 exactly when
 * the voice says it. Each arrival stamps a small ink square on the line
 * and prints its block: the year in faded mono nearest the tick, the note
 * beyond it, alternating above and below so two notes never share a lane.
 * The last event lands heavy — a bigger stamp, heavier type. It is the
 * punchline, and it is the only one that is not history.
 *
 * End state: the full axis, every stamp, every note, head lifted off. A
 * static still.
 */

export type TimelineEvent = {
  /** "1941" — placed on the scale if numeric, otherwise evenly spaced. */
  year: string;
  /** Uppercase note printed at the tick. */
  label: string;
  /** The punchline: bigger stamp, heavier type. */
  heavy?: boolean;
};

export type TimelineProps = {
  events: TimelineEvent[];
  /** Small faded uppercase line, top left. */
  kicker?: string;
  /** Faded provenance line at the bottom. */
  line?: string;
  theme?: "light" | "dark";
  /** Frame the head parks on the first event's mark (default 0). */
  appearAt?: number;
  /** Absolute frame the head ARRIVES at each event — for word-sync. */
  eventCues?: number[];
};

const rule = 2;
const PAD_X = 84;
const PAD_RIGHT = 144; // content ends at x = 936
const AXIS_W = 1080 - PAD_X - PAD_RIGHT; // 852

const STROKE = 3;
const MARK = 14; // the event stamp
const MARK_HEAVY = 22;
const DECADE_TICK = 14;
const LEADER = 36; // hairline from the axis to the block
const NOTE_W = 380;

const ABOVE_H = 230;
const BELOW_H = 230;
const BAND_H = ABOVE_H + BELOW_H;
const AXIS_Y = ABOVE_H;

const HEAD_W = 16;
const HEAD_H = 30;
const PARK_IN = 12; // the head sits on the first mark before it moves
const PARK_OUT = 12; // and holds the last one, then lifts off
const HOP = 54; // default frames between arrivals
const TAIL = 14; // run-out to the end of the scale

const PRINT_FRAMES = 12;
const EASE = Easing.bezier(0.25, 0.1, 0.25, 1);

/** Ink never crosses the content margin: end stamps sit flush inside. */
const clampX = (x: number, w: number) => Math.min(AXIS_W - w, Math.max(0, x));

/** Top→down print wipe from `cue`, layout stable before it. */
const printStyle = (
  frame: number,
  cue: number,
  frames: number = PRINT_FRAMES,
): React.CSSProperties => {
  if (frame < cue) return { visibility: "hidden" };
  const hidden = interpolate(frame, [cue, cue + frames], [100, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return { clipPath: `inset(0 0 ${hidden}% 0)` };
};

export const Timeline: React.FC<TimelineProps> = ({
  events,
  kicker,
  line,
  theme = "dark",
  appearAt = 0,
  eventCues,
}) => {
  const frame = useCurrentFrame();
  const palette: Palette = palettes[theme];

  const n = events.length;
  const nums = events.map((e) => Number(e.year.replace(/[^0-9.-]/g, "")));
  const scaled = nums.every((v) => Number.isFinite(v)) && nums[n - 1] > nums[0];
  const minY = nums[0];
  const maxY = nums[n - 1];
  // A decade is a decade wide — the gaps are part of the argument.
  const xOf = (i: number) =>
    scaled
      ? ((nums[i] - minY) / (maxY - minY)) * AXIS_W
      : n > 1
        ? (i / (n - 1)) * AXIS_W
        : 0;
  const xs = events.map((_, i) => xOf(i));

  const cueOf = (i: number) => eventCues?.[i] ?? appearAt + PARK_IN + i * HOP;
  const cues = events.map((_, i) => cueOf(i));
  const start = Math.min(appearAt, cues[0] - 1);
  const lastCue = cues[n - 1];
  const done = lastCue + TAIL;

  // The head's whole life: park on the first mark, hop to each cue, run
  // out to the end of the scale. Easing is applied per hop, so it stops
  // at every event instead of gliding past it.
  const headX = interpolate(
    frame,
    [start, ...cues, done],
    [xs[0], ...xs, AXIS_W],
    { easing: EASE, extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const headVisible = frame >= start && frame < done + PARK_OUT;
  const moving = frame >= cues[0] && frame < done;

  // Sides: alternate, but never let two blocks share a lane if their boxes
  // would touch — collision is decided here, not hoped for.
  const lastRight: Record<"up" | "down", number> = {
    up: -Infinity,
    down: -Infinity,
  };
  const sides: ("up" | "down")[] = [];
  const boxLeft = (x: number) =>
    x < AXIS_W * 0.25
      ? x
      : x > AXIS_W * 0.75
        ? x - NOTE_W
        : x - NOTE_W / 2;
  events.forEach((_, i) => {
    const l = boxLeft(xs[i]);
    let side: "up" | "down" = i % 2 === 0 ? "up" : "down";
    if (l < lastRight[side] + 24 && l >= lastRight[side === "up" ? "down" : "up"] + 24) {
      side = side === "up" ? "down" : "up";
    }
    lastRight[side] = l + NOTE_W;
    sides.push(side);
  });

  const decades: number[] = [];
  if (scaled) {
    for (let y = Math.ceil(minY / 10) * 10; y <= maxY; y += 10) {
      const x = ((y - minY) / (maxY - minY)) * AXIS_W;
      if (xs.every((ex) => Math.abs(ex - x) > 10)) decades.push(x);
    }
  }

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
              fontFamily: mono,
              fontSize: 26,
              letterSpacing: "0.25em",
              textTransform: "uppercase",
              color: palette.faded,
              marginBottom: 30,
              ...printStyle(frame, appearAt, 10),
            }}
          >
            {mu(kicker)}
          </div>
        ) : null}

        <div style={{ position: "relative", width: AXIS_W, height: BAND_H }}>
          <svg
            width={AXIS_W}
            height={BAND_H}
            viewBox={`0 0 ${AXIS_W} ${BAND_H}`}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              display: "block",
              overflow: "visible",
            }}
          >
            <defs>
              {/* The one law: the clip's right edge IS the head's x. */}
              <clipPath id="tl-head-reveal">
                <rect
                  x={0}
                  y={0}
                  width={Math.max(0, headX)}
                  height={BAND_H}
                />
              </clipPath>
            </defs>

            <g clipPath="url(#tl-head-reveal)">
              <line
                x1={0}
                y1={AXIS_Y}
                x2={AXIS_W}
                y2={AXIS_Y}
                stroke={palette.ink}
                strokeWidth={STROKE}
                strokeLinecap="square"
              />
              {decades.map((x) => (
                <line
                  key={`d${x}`}
                  x1={x}
                  y1={AXIS_Y + 2}
                  x2={x}
                  y2={AXIS_Y + DECADE_TICK}
                  stroke={palette.faded}
                  strokeWidth={rule}
                  strokeLinecap="square"
                />
              ))}
            </g>

            {/* Stamps sit outside the clip so the last one — at the very
                end of the scale — is never cut in half by it. Both end
                stamps are clamped flush INSIDE the rule: ink never crosses
                the content margin the type is aligned to. */}
            {events.map((e, i) => {
              if (headX < xs[i]) return null;
              const s = e.heavy ? MARK_HEAVY : MARK;
              return (
                <rect
                  key={`m${i}`}
                  x={clampX(xs[i] - s / 2, s)}
                  y={AXIS_Y - s / 2}
                  width={s}
                  height={s}
                  fill={palette.ink}
                />
              );
            })}

            {moving ? (
              <rect
                x={headX - 0.5}
                y={0}
                width={1}
                height={BAND_H}
                fill={palette.trace}
              />
            ) : null}
            {headVisible ? (
              <rect
                x={clampX(headX - HEAD_W / 2, HEAD_W)}
                y={AXIS_Y - HEAD_H / 2}
                width={HEAD_W}
                height={HEAD_H}
                fill={palette.ink}
              />
            ) : null}
          </svg>

          {events.map((e, i) => {
            const x = xs[i];
            const l = boxLeft(x);
            const align =
              x < AXIS_W * 0.25 ? "left" : x > AXIS_W * 0.75 ? "right" : "center";
            const up = sides[i] === "up";
            return (
              <div
                key={`b${i}`}
                style={{
                  position: "absolute",
                  left: l,
                  width: NOTE_W,
                  ...(up
                    ? { bottom: BAND_H - AXIS_Y, paddingBottom: LEADER }
                    : { top: AXIS_Y, paddingTop: LEADER }),
                  textAlign: align,
                  fontFamily: mono,
                  textTransform: "uppercase",
                  ...printStyle(frame, cueOf(i)),
                }}
              >
                {/* The leader — which tick this note belongs to, said in
                    ink rather than left to proximity. Faded, not trace:
                    it must survive a phone screen. */}
                <div
                  style={{
                    position: "absolute",
                    left: x - l - 1,
                    width: rule,
                    height: LEADER - 12,
                    backgroundColor: palette.faded,
                    ...(up ? { bottom: 12 } : { top: 12 }),
                  }}
                />
                {up ? (
                  <>
                    <Note event={e} palette={palette} />
                    <Year event={e} palette={palette} up />
                  </>
                ) : (
                  <>
                    <Year event={e} palette={palette} />
                    <Note event={e} palette={palette} />
                  </>
                )}
              </div>
            );
          })}
        </div>

        {line ? (
          <div
            style={{
              marginTop: 40,
              fontFamily: mono,
              fontSize: 24,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: palette.faded,
              ...printStyle(frame, done + 8, 10),
            }}
          >
            {mu(line)}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

/** The year, always the line nearest the axis — it captions the tick. */
const Year: React.FC<{
  event: TimelineEvent;
  palette: Palette;
  up?: boolean;
}> = ({ event, palette, up }) => (
  <div
    style={{
      marginTop: up ? 14 : 0,
      marginBottom: up ? 0 : 14,
      fontFamily: mono,
      fontWeight: event.heavy ? 700 : 400,
      fontSize: event.heavy ? 32 : 27,
      letterSpacing: "0.2em",
      color: event.heavy ? palette.ink : palette.faded,
    }}
  >
    {mu(event.year)}
  </div>
);

const Note: React.FC<{ event: TimelineEvent; palette: Palette }> = ({
  event,
  palette,
}) => (
  <div
    style={{
      fontFamily: mono,
      fontWeight: event.heavy ? 700 : 400,
      fontSize: event.heavy ? 40 : 30,
      lineHeight: 1.35,
      letterSpacing: event.heavy ? "0.04em" : "0.08em",
      color: palette.ink,
    }}
  >
    {mu(event.label)}
  </div>
);
