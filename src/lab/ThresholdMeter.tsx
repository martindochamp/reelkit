import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { mono, mu, palettes, type Palette } from "../tokens";
import { revealClip } from "./reveal";

/**
 * ThresholdMeter — a vertical tape measure with a hard ceiling.
 *
 * A graduated column (minor ticks every unit, majors labeled) stands on
 * the paper with two marks across it: the EU reference as a dashed
 * hairline, the tolerable upper limit as a heavy solid rule. Sources
 * land one by one on cue — day's food, a supplement, a multivitamin —
 * each raising the ink fill by its amount while its row prints beside
 * the segment it poured. A live total counts in the header.
 *
 * The limit line does not move and does not yield: fill that crosses it
 * turns to diagonal hatching — ink that exceeded the instrument's rule,
 * drawn as overrun, never celebrated, never hidden. A verdict row
 * prints last: OVER THE LIMIT / +8.2 MG (or the headroom if under).
 * All arithmetic, computed from the same numbers the meter draws.
 *
 * End state: filled column, hatched overage, verdict — a static still.
 * Motion doctrine: print wipes and one bezier ease. Nothing bounces.
 */

export type ThresholdMeterProps = {
  /** Small faded uppercase line, top left. */
  kicker?: string;
  /** Display unit for counter and verdict (default "MG"). */
  unit?: string;
  /** Decimals for the live counter / verdict (default 1). */
  decimals?: number;
  /** Top of the tape, in nutrient units. */
  scaleMax: number;
  /** Labeled graduation interval (default 5). */
  majorTick?: number;
  /** Dashed mark — the reference, never a target. */
  reference?: { value: number; label: string };
  /** Solid heavy mark — the hard line. */
  limit: { value: number; label: string };
  /** What lands, in order. Amounts are in scale units. */
  sources: { label: string; amount: number; detail?: string }[];
  overLabel?: string; // default "OVER THE LIMIT"
  underLabel?: string; // default "BELOW THE LIMIT"
  /** Suppress the computed verdict row. */
  showVerdict?: boolean;
  /** Faded provenance line under the verdict. */
  line?: string;
  theme?: "light" | "dark";
  /** Frame the instrument prints (default 0). */
  appearAt?: number;
  /** Absolute frames each source starts pouring — for word-sync. */
  cues?: number[];
};

const rule = 2;
const PAD_X = 84;
const PAD_RIGHT = 144; // content ends at x = 936
const STAGE_W = 1080 - PAD_X - PAD_RIGHT; // 852

const METER_H = 810;
const PADT = 26; // headroom so the top graduation is not clipped
const NUM_W = 56; // scale numbers, right-aligned
const TICK_W = 26;
const COL_W = 190;
const COL_LEFT = NUM_W + 14 + TICK_W;
const COL_RIGHT = COL_LEFT + COL_W;
const LABEL_GAP = 48; // connector run between column and source label

const PRINT_FRAMES = 14;
const RISE_FRAMES = 26;
const CUE_STAGGER = 60;

const ease = Easing.bezier(0.25, 0.1, 0.25, 1);

/** Top→down print wipe from `cue`, layout stable before it. */
const printStyle = (
  frame: number,
  cue: number,
  frames: number = PRINT_FRAMES,
): React.CSSProperties => revealClip(frame, cue, frames);

/** "8.2" but "15", never "15.0" — receipts do not pad. */
const fmt = (v: number, decimals: number) => {
  const s = v.toFixed(decimals);
  return s.replace(/\.0+$/, "");
};

export const ThresholdMeter: React.FC<ThresholdMeterProps> = ({
  kicker,
  unit = "MG",
  decimals = 1,
  scaleMax,
  majorTick = 5,
  reference,
  limit,
  sources,
  overLabel = "Over the limit",
  underLabel = "Below the limit",
  showVerdict = true,
  line,
  theme = "dark",
  appearAt = 0,
  cues,
}) => {
  const frame = useCurrentFrame();
  const palette: Palette = palettes[theme];

  const px = (v: number) => (METER_H * v) / scaleMax;

  // --- the pours ----------------------------------------------------------
  const cueOf = (i: number) => cues?.[i] ?? appearAt + 44 + i * CUE_STAGGER;
  const cums: number[] = [0];
  for (const s of sources) cums.push(cums[cums.length - 1] + s.amount);
  const total = cums[cums.length - 1];

  let level = 0;
  for (let i = 0; i < sources.length; i += 1) {
    const t = interpolate(frame, [cueOf(i), cueOf(i) + RISE_FRAMES], [0, 1], {
      easing: ease,
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    level += sources[i].amount * t;
  }

  const lastEnd = cueOf(sources.length - 1) + RISE_FRAMES;
  const verdictCue = lastEnd + 10;
  const over = total > limit.value;
  const verdictValue = over
    ? `+${fmt(total - limit.value, decimals)} ${unit}`
    : `${fmt(limit.value - total, decimals)} ${unit} left`;

  // --- graduations --------------------------------------------------------
  const ticks: React.ReactNode[] = [];
  for (let v = 0; v <= scaleMax; v += 1) {
    const major = v % majorTick === 0;
    const y = PADT + METER_H - px(v);
    ticks.push(
      <div
        key={`t${v}`}
        style={{
          position: "absolute",
          top: y - 1,
          left: NUM_W + 14 + (major ? 0 : TICK_W / 2),
          width: major ? TICK_W : TICK_W / 2,
          height: rule,
          backgroundColor: major ? palette.faded : palette.trace,
        }}
      />,
    );
    if (major && v > 0) {
      ticks.push(
        <div
          key={`n${v}`}
          style={{
            position: "absolute",
            top: y - 14,
            left: 0,
            width: NUM_W,
            textAlign: "right",
            fontFamily: mono,
            fontSize: 22,
            color: palette.faded,
          }}
        >
          {v}
        </div>,
      );
    }
  }

  // --- marks --------------------------------------------------------------
  const mark = (
    value: number,
    label: string,
    hard: boolean,
    key: string,
  ): React.ReactNode => {
    const y = PADT + METER_H - px(value);
    return (
      <React.Fragment key={key}>
        <div
          style={{
            position: "absolute",
            top: y - (hard ? 2 : 1),
            left: NUM_W + 14,
            right: 0,
            height: hard ? 4 : 0,
            backgroundColor: hard ? palette.ink : undefined,
            borderTop: hard ? undefined : `${rule}px dashed ${palette.faded}`,
          }}
        />
        {/* The hard line is labeled BELOW itself — the safe side of the
            ceiling — which also keeps it clear of source labels above. */}
        <div
          style={{
            position: "absolute",
            top: hard ? y + 16 : y - 36,
            right: 0,
            fontFamily: mono,
            fontWeight: hard ? 700 : 400,
            fontSize: 24,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: hard ? palette.ink : palette.faded,
          }}
        >
          {label}
        </div>
      </React.Fragment>
    );
  };

  // --- fill ---------------------------------------------------------------
  const inset = 8; // paper margin inside the column track
  const fillW = COL_W - inset * 2;
  const solidH = px(Math.min(level, limit.value));
  const overH = px(Math.max(0, level - limit.value));

  // Segment boundaries: a hairline of paper where one pour ends and the
  // next begins — additions stay countable.
  const boundaries = cums.slice(1, -1).map((c, i) =>
    level > c ? (
      <div
        key={`b${i}`}
        style={{
          position: "absolute",
          bottom: px(c) - 1,
          left: COL_LEFT + inset,
          width: fillW,
          height: 3,
          backgroundColor: palette.paper,
        }}
      />
    ) : null,
  );

  // --- source rows --------------------------------------------------------
  // Each row is an absolutely positioned REAL box: the print wipe clips
  // against it (a zero-height wrapper would clip everything away).
  const limitY = PADT + METER_H - px(limit.value);
  const sourceRows = sources.map((s, i) => {
    const midY = PADT + METER_H - px((cums[i] + cums[i + 1]) / 2);
    // The hard line labels itself BELOW, which clears source labels only
    // while every source sits above the line. A single pour that STRADDLES
    // the limit puts its midpoint on the line itself and the two labels
    // print on top of each other (biotin: one 10 mg pill against a 5 mg
    // limit — mid = 5 = the line). When the label box would cross the
    // line, lift it clear and let the connector stretch.
    const box = 96;
    const straddles = midY + box - 40 > limitY - 4 && midY - 40 < limitY + 56;
    const top = straddles ? limitY - box - 12 : midY - 40;
    return (
      <div
        key={i}
        style={{
          position: "absolute",
          top,
          left: COL_RIGHT,
          right: 0,
          height: 96,
          ...printStyle(frame, cueOf(i)),
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 39,
            left: 14,
            width: LABEL_GAP - 26,
            height: rule,
            backgroundColor: palette.trace,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 6,
            left: LABEL_GAP,
            fontFamily: mono,
            textTransform: "uppercase",
            color: palette.ink,
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 30, letterSpacing: "0.04em" }}>
            +{fmt(s.amount, decimals)} {mu(unit)}
          </div>
          <div
            style={{
              marginTop: 10,
              fontSize: 23,
              letterSpacing: "0.14em",
              color: palette.faded,
            }}
          >
            {mu(s.label)}
            {s.detail ? mu(` — ${s.detail}`) : ""}
          </div>
        </div>
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
        {/* Header: kicker left, live total right. */}
        <div
          style={{
            ...printStyle(frame, appearAt, 10),
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 44,
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
            {mu(kicker)}
          </span>
          <span
            style={{
              fontFamily: mono,
              fontWeight: 700,
              fontSize: 30,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: palette.ink,
            }}
          >
            {fmt(Math.round(level * 10 ** decimals) / 10 ** decimals, decimals)}{" "}
            {mu(unit)}
          </span>
        </div>

        {/* The instrument. */}
        <div
          style={{
            ...printStyle(frame, appearAt + 4),
            position: "relative",
            height: PADT + METER_H,
            width: STAGE_W,
          }}
        >
          {ticks}

          {/* Column track. */}
          <div
            style={{
              position: "absolute",
              top: PADT - rule,
              bottom: 0,
              left: COL_LEFT,
              width: COL_W,
              border: `${rule}px solid ${palette.trace}`,
              boxSizing: "border-box",
            }}
          />

          {/* Solid fill up to the limit. */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: COL_LEFT + inset,
              width: fillW,
              height: solidH,
              backgroundColor: palette.ink,
            }}
          />
          {/* Overrun: hatched, above the hard line. */}
          {overH > 0 ? (
            <div
              style={{
                position: "absolute",
                bottom: px(limit.value) + 3,
                left: COL_LEFT + inset,
                width: fillW,
                height: Math.max(0, overH - 3),
                backgroundImage: `repeating-linear-gradient(45deg, ${palette.ink} 0px, ${palette.ink} 4px, transparent 4px, transparent 12px)`,
              }}
            />
          ) : null}
          {boundaries}

          {reference
            ? mark(reference.value, reference.label, false, "ref")
            : null}
          {mark(limit.value, limit.label, true, "limit")}

          {sourceRows}
        </div>

        {/* Verdict — arithmetic, printed last. */}
        {showVerdict ? (
          <div style={printStyle(frame, verdictCue, 10)}>
            <div
              style={{
                marginTop: 48,
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
              <span style={{ letterSpacing: "0.06em" }}>
                {mu(over ? overLabel : underLabel)}
              </span>
              <span style={{ whiteSpace: "nowrap" }}>{mu(verdictValue)}</span>
            </div>
          </div>
        ) : null}

        {line ? (
          <div
            style={{
              ...printStyle(frame, verdictCue + 8, 10),
              marginTop: 24,
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
