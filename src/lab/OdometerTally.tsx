import React, { useMemo } from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { mono, palettes, type Palette } from "../tokens";

/**
 * OdometerTally — a mechanical counter absorbing the day's tape.
 *
 * The big SF Mono number counts 0 → total with bezier deceleration. Wheels
 * behave like a real odometer: the ones wheel rolls continuously, a higher
 * wheel snap-rolls only while the wheel below wraps 9 → 0 — so the end
 * state lands exactly on the integer and reads as a still.
 *
 * Under it, a metered track fills toward the reference hairline. Each
 * receipt row prints at the exact frame the rolling count absorbs that
 * food's contribution; the moment the count crosses the reference, the
 * hairline's label flips to ink and a REFERENCE MET chip prints.
 *
 * "The instrument, not the theater": two inks, 2px rules, no red.
 */

export type OdometerTallyProps = {
  theme?: "light" | "dark";
  /** "MAGNESIUM — TODAY" */
  kicker: string;
  /** Final integer the counter lands on. */
  value: number;
  /** "MG" */
  unit: string;
  /** The hairline on the track. */
  reference: number;
  /** "EU NRV 375 MG" — flips faded → ink when crossed. */
  referenceLabel: string;
  /** Chip text printed at the crossing. Omit to skip the chip. */
  metLabel?: string;
  /** Track scale end; defaults to a little past max(value, reference). */
  max?: number;
  /** Receipt rows; each prints when the count absorbs its amount. */
  rows?: { left: string; right: string; amount: number }[];
  /** Faded footer line, prints when the count settles. */
  line?: string;
  /** Frame the count starts. */
  countStart?: number;
  /** Frames the count takes. */
  countFrames?: number;
};

const rule = 2;
const PAD_X = 84;
const PAD_RIGHT = 1080 - 936;
// A mechanical counter launches fast and tapers long — the last units
// tick in one by one as the wheels lose momentum. The symmetric S-curve
// read as a machine hesitating to start; this one only decelerates.
const EASE = Easing.bezier(0.15, 0.55, 0.2, 1);
const PRINT_FRAMES = 10;

/** Top-down print-wipe from a cue frame — the only way things appear. */
const printed = (frame: number, cue: number): React.CSSProperties => {
  if (frame < cue) return { visibility: "hidden" };
  const hidden = interpolate(frame, [cue, cue + PRINT_FRAMES], [100, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return { clipPath: `inset(0 0 ${hidden}% 0)` };
};

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0];

/**
 * One wheel. `place` is 10^k. The wheel sits on its digit and rolls to the
 * next only during the final unit below it — mechanical-counter behavior,
 * exact landing on integers.
 */
const Wheel: React.FC<{
  place: number;
  v: number;
  size: number;
  color: string;
}> = ({ place, v, size, color }) => {
  const digit = Math.floor(v / place) % 10;
  const below = v % place;
  const roll = place === 1 ? v % 1 : Math.max(0, below - (place - 1));
  const offset = digit + roll;
  return (
    <div
      style={{
        height: size,
        width: size * 0.62,
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div style={{ transform: `translateY(${-offset * size}px)` }}>
        {DIGITS.map((d, i) => (
          <div
            key={i}
            style={{
              height: size,
              lineHeight: `${size}px`,
              textAlign: "center",
              color,
            }}
          >
            {d}
          </div>
        ))}
      </div>
    </div>
  );
};

export const OdometerTally: React.FC<OdometerTallyProps> = ({
  theme = "dark",
  kicker,
  value,
  unit,
  reference,
  referenceLabel,
  metLabel = "REFERENCE MET",
  max,
  rows = [],
  line,
  countStart = 12,
  countFrames = 110,
}) => {
  const frame = useCurrentFrame();
  const palette: Palette = palettes[theme];
  const scaleMax = max ?? Math.ceil((Math.max(value, reference) * 1.06) / 10) * 10;

  const valueAt = (f: number) =>
    value *
    EASE(Math.min(1, Math.max(0, (f - countStart) / countFrames)));
  const v = valueAt(frame);

  // The frame the count crosses a threshold — rows and the chip print there.
  const crossings = useMemo(() => {
    const cross = (threshold: number) => {
      if (threshold <= 0) return countStart;
      for (let f = countStart; f <= countStart + countFrames; f++) {
        if (valueAt(f) >= threshold) return f;
      }
      return countStart + countFrames;
    };
    let sum = 0;
    const rowCues = rows.map((r) => {
      sum += r.amount;
      return cross(Math.min(sum, value));
    });
    return { rowCues, refCue: cross(reference), endCue: countStart + countFrames };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, reference, value, countStart, countFrames]);

  const met = value >= reference && frame >= crossings.refCue;
  const wheels = String(Math.max(1, Math.round(value))).length;
  const size = 210;
  const fillPct = Math.min(100, (v / scaleMax) * 100);
  const refPct = Math.min(100, (reference / scaleMax) * 100);

  const ticks: number[] = [];
  const tickStep = scaleMax / 16;
  for (let t = tickStep; t < scaleMax; t += tickStep) ticks.push(t);

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
        <div
          style={{
            fontFamily: mono,
            fontSize: 26,
            letterSpacing: "0.25em",
            textTransform: "uppercase",
            color: palette.faded,
            marginBottom: 44,
          }}
        >
          {kicker}
        </div>

        {/* The counter. */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            fontFamily: mono,
            fontWeight: 700,
            fontSize: size,
            color: palette.ink,
          }}
        >
          {Array.from({ length: wheels }, (_, i) => {
            const place = 10 ** (wheels - 1 - i);
            const lit = place === 1 || v >= place;
            return (
              <Wheel
                key={i}
                place={place}
                v={v}
                size={size}
                color={lit ? palette.ink : palette.trace}
              />
            );
          })}
          <div
            style={{
              fontSize: 46,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: palette.ink,
              marginLeft: 30,
              marginBottom: 38,
            }}
          >
            {unit}
          </div>
        </div>

        {/* The meter. */}
        <div style={{ marginTop: 52 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontFamily: mono,
              fontSize: 22,
              letterSpacing: "0.14em",
              color: palette.faded,
              marginBottom: 12,
            }}
          >
            <span>0</span>
            <span>{scaleMax}</span>
          </div>
          <div
            style={{
              position: "relative",
              height: 60,
              border: `${rule}px solid ${palette.trace}`,
            }}
          >
            {ticks.map((t, i) => (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: `${(t / scaleMax) * 100}%`,
                  bottom: 0,
                  width: rule,
                  height: 12,
                  backgroundColor: palette.trace,
                }}
              />
            ))}
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: `${fillPct}%`,
                backgroundColor: palette.ink,
              }}
            />
            {/* Reference hairline: the interior segment knocks out to paper
                once the fill swallows it — the crossed line stays visible. */}
            <div
              style={{
                position: "absolute",
                left: `${refPct}%`,
                top: -14,
                bottom: -14,
                width: rule + 1,
                backgroundColor: met ? palette.ink : palette.faded,
              }}
            />
            {fillPct >= refPct ? (
              <div
                style={{
                  position: "absolute",
                  left: `${refPct}%`,
                  top: 0,
                  bottom: 0,
                  width: rule + 1,
                  backgroundColor: palette.paper,
                }}
              />
            ) : null}
          </div>
          <div
            style={{
              position: "relative",
              marginTop: 16,
              height: 28,
              fontFamily: mono,
              fontSize: 22,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
            }}
          >
            <span
              style={{
                position: "absolute",
                ...(refPct > 55
                  ? { right: `${100 - refPct}%` }
                  : { left: `${refPct}%` }),
                whiteSpace: "nowrap",
                color: met ? palette.ink : palette.faded,
              }}
            >
              {referenceLabel}
            </span>
          </div>
        </div>

        {/* The verdict chip — prints the frame the hairline is crossed. */}
        {metLabel && value >= reference ? (
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginTop: 20,
              ...printed(frame, crossings.refCue),
            }}
          >
            <span
              style={{
                border: `${rule}px solid ${palette.ink}`,
                padding: "12px 24px",
                fontFamily: mono,
                fontWeight: 600,
                fontSize: 24,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: palette.ink,
              }}
            >
              {metLabel}
            </span>
          </div>
        ) : null}

        {/* The tape — each row prints as the counter absorbs it. */}
        {rows.length > 0 ? (
          <div style={{ marginTop: 40 }}>
            {rows.map((row, i) => (
              <div key={i} style={printed(frame, crossings.rowCues[i])}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    gap: 24,
                    padding: "20px 0",
                    borderBottom: `${rule}px dashed ${palette.trace}`,
                    fontFamily: mono,
                    fontSize: 28,
                    textTransform: "uppercase",
                    color: palette.ink,
                  }}
                >
                  <span style={{ letterSpacing: "0.06em" }}>{row.left}</span>
                  <span style={{ fontWeight: 700, whiteSpace: "nowrap" }}>
                    {row.right}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {line ? (
          <div
            style={{
              marginTop: 30,
              fontFamily: mono,
              fontSize: 22,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: palette.faded,
              ...printed(frame, crossings.endCue),
            }}
          >
            {line}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
