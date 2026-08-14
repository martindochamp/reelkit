// Programmatic sound design — one emitter per element, reading that
// element's own animation timeline and its own DATA.
//
// THE SHIFT THIS FILE IS (Martin, 2026-08-11):
//
//   "ça utilise presqu'uniquement le print… ce qu'on veut ici c'est de la
//    programmatic UI sound design, dans le sens où ça dépend des données
//    et c'est géré directement au niveau de chaque élément — une fois la
//    logique faite on n'a pas besoin de refaire pour chaque appel."
//
// The old map (`DEFAULT_MAP` in sfx.mjs) keys on the element's TYPE and
// hands back one sound per `[+]` cue. That is why eleven of fourteen
// effects in the demo sheet were `print`: a cue is a word the writer
// marked, not a thing the element did. A bar filling over twelve frames
// makes one animation event to a cue and forty to its own timeline.
//
// So an emitter here takes `(props, cues, fps)` and returns hits with
// frames computed from the element's real motion — every unit in a grid,
// every tooth of a counter, every bond of a molecule, the exact frame a
// pour crosses a limit. Write it once per element; every post that uses
// that element gets it for free, shaped by its own numbers.
//
// ---------------------------------------------------------------------
// THE PALETTE IS A SET OF OBJECTS (rewritten 2026-08-11, second pass)
//
//   "franchement je trouve que ça match pas du tout" — Martin, after the
//   first programmatic pass, having then found a 200-file sound pack.
//
// He was right and the first pass had the architecture without the
// material. Every sound was synthesized: band-limited noise under an
// envelope, which is a plausible description of a click and is not a
// click. Worse, the reveal had just changed from a top-down wipe to a
// fade (src/lab/reveal.ts) while the sound was still a THERMAL HEAD —
// so the loudest event in the system was describing motion that no
// longer happened. That mismatch is what "ça match pas" names.
//
// The kit is now a short list of real objects, and every element is
// assigned the object it actually depicts:
//
//   type / type2  a typewriter hammer   → a line of text arriving
//   ratchet       a bicycle freewheel   → a bar filling, counted
//   detent        a clock escapement    → a counter's digits
//   nib           one pen mark          → a data point, a callout
//   plotter       a pencil stroke       → a line being drawn
//   slide         paper across paper    → any continuous fill
//   shutter       a camera              → a specimen photographed
//   flip          a page turning        → one sheet replacing another
//   stamp         rubber on paper       → a verdict, a limit crossed
//   print / cut   a thermal head, blade → the receipt, and ONLY it
//   latch         a metal detent        → a value settling
//   popsoft/unpop a bubble, both ways   → one unit landing / leaving
//
// The rule that follows: **a sound names its object, not its moment.**
// `print` is no longer "something appeared", it is a thermal head, so it
// survives on exactly one element — the receipt actually coming out of a
// printer. Everything that used to borrow it now says what it is.
//
// TWO RULES THAT KEEP IT FROM BECOMING NOISE
//
// 1. **Density is capped.** A hundred units printing over thirty frames
//    is not a hundred sounds, it is a rattle. Every emitter subsamples to
//    a target rate (`thin`), so a grid of 100 and a grid of 12 both read
//    as "the thing filling" at about the same pulse.
// 2. **Rate carries the shape, not extra samples.** A ratchet that
//    accelerates is ONE click played at rising `playbackRate` on
//    tightening spacing. Twenty samples would be twenty samples to
//    license, store and keep in step.
//
// THE CONSTANTS BELOW MIRROR THE .tsx FILES and cannot import them (a
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { elementsDir } from "./project.mjs";
// .mjs cannot read TypeScript). Same arrangement as src/lab/tier-fit.mjs.
// If you change a timing constant in an element, change it here — the
// symptom of drift is a sound landing next to its animation rather than
// on it, which is audible immediately on the demo sheet.

/** Frames between hits below which the ear stops hearing separate events. */
const MIN_GAP = 3.2;

/**
 * Below this many frames, a staggered run is ONE gesture to the eye and
 * must be one sound to the ear. A 14-unit grid prints in 4 frames
 * (PRINT_STAGGER is 0.3): two pops there were two disconnected clicks
 * describing something nobody saw as two events.
 */
const RUN_FLOOR = 8;

/**
 * Keep at most one hit per MIN_GAP frames, spread evenly over the run.
 * Returns the kept indices, always including the first and the last —
 * a fill that does not sound its own end is a fill that stopped early.
 */
const thin = (frames, gap = MIN_GAP) => {
  if (frames.length <= 2) return frames.map((_, i) => i);
  // Greedy on FRAMES, not evenly spaced on indices. An eased run is
  // exactly the case where those differ: sampling one index in three of
  // a curve that crowds at one end leaves the crowd intact, which is how
  // a thinned barchart still had two teeth on consecutive frames.
  const kept = [0];
  for (let i = 1; i < frames.length - 1; i += 1) {
    if (frames[i] - frames[kept[kept.length - 1]] >= gap) kept.push(i);
  }
  const last = frames.length - 1;
  // The end always sounds — a fill that does not sound its own end is a
  // fill that stopped early — so if it crowds the previous keep, it
  // replaces it rather than being dropped or doubling it.
  if (kept.length > 1 && frames[last] - frames[kept[kept.length - 1]] < gap) kept.pop();
  if (kept[kept.length - 1] !== last) kept.push(last);
  return kept;
};

/**
 * Frames at equal PROGRESS along an eased animation.
 *
 * The trap this exists to close: an element eases, so ticks placed at
 * equal time lie about the motion — but ticks placed by feeding the tick
 * index straight into the ease lie in the opposite direction, and look
 * right in the code. Progress t is reached at the time the ease's INVERSE
 * gives, so a run of n ticks is `easeInverse(k/n)`.
 *
 * The odometer shipped with the ease applied forward for one render: its
 * ratchet accelerated into a stop, and the last three teeth landed on the
 * same frame. Both curves here are inverses, and both are named as such.
 */
const progressFrames = (start, frames, n, power) => {
  const out = [];
  for (let k = 0; k <= n; k += 1) {
    const t = k / n;
    // ease-out of order `power`: p(τ) = 1 - (1-τ)^power
    // inverse:               τ(p) = 1 - (1-p)^(1/power)
    out.push(start + frames * (1 - Math.pow(1 - t, 1 / power)));
  }
  return out;
};

/** Playback rate ramped across a run — the ratchet's rising pitch. */
const rateAt = (t, from = 0.94, to = 1.12) => Number((from + (to - from) * t).toFixed(3));

/**
 * A row of text landing, alternating hammers. One typewriter sample seven
 * times in a row reads as a loop; two alternated reads as typing. The
 * index is the row's own, so the alternation is stable across renders.
 */
export const strike = (frame, i, volume = 0.16) => ({
  sound: i % 2 === 0 ? "type" : "type2",
  frame: Math.round(frame),
  volume,
  // ±4 % on the hammer, keyed to the row: a real machine is not a metronome.
  rate: Number((1 + ((i % 3) - 1) * 0.04).toFixed(3)),
});

/** A staggered run that is one gesture below RUN_FLOOR, N events above it. */
const runOrGesture = (frames, each, gesture) => {
  if (!frames.length) return [];
  const span = frames[frames.length - 1] - frames[0];
  if (span < RUN_FLOOR) return [gesture(frames[0], span)];
  return thin(frames).map((i, k, arr) => each(frames[i], k / Math.max(1, arr.length - 1), i));
};

// ---------------------------------------------------------------------------

export const EMITTERS = {
  /**
   * UNITGRID — a hundred squares print, then the lost ones go out.
   *
   * Martin asked for "un léger pop sur chaque carré, et un unpop quand
   * ils s'enlèvent". Literally per square it is 100 hits in 30 frames,
   * which is a buzz — so the run is thinned to the ear's resolution and
   * the DATA still shows through: a grid of 49 sounds shorter than a
   * grid of 100, and a reduction from 100 to 16 sounds longer than one
   * from 100 to 80, because it is.
   *
   * Mirrors UnitGrid.tsx: gridStart = appearAt + 6, PRINT_STAGGER 0.3,
   * UNIT_PRINT 4, reduceStart = reduceAt ?? gridDone + 45,
   * reduceDuration 75, UNIT_FADE 9.
   */
  "lab:unitgrid": (props, cues) => {
    const count = props.count ?? 0;
    const keep = Math.max(0, props.keep ?? 0);
    const appearAt = cues[0] ?? props.appearAt ?? 0;
    const gridStart = appearAt + 6;
    const gridDone = gridStart + Math.ceil((count - 1) * 0.3) + 4;
    const prints = Array.from({ length: count }, (_, i) => gridStart + i * 0.3);

    const hits = runOrGesture(
      prints,
      (frame, t) => ({
        sound: "popsoft",
        frame: Math.round(frame),
        rate: rateAt(t, 0.96, 1.08),
        volume: 0.13,
      }),
      (frame) => ({
        sound: "slide",
        frame: Math.round(frame),
        rate: Number((1.3 - 0.35 * Math.min(1, count / 100)).toFixed(3)),
        volume: 0.13,
      }),
    );

    const lost = Math.max(0, count - keep);
    if (lost > 0) {
      const reduceStart = cues[1] ?? props.reduceAt ?? gridDone + 45;
      const duration = props.reduceDuration ?? 75;
      const stagger = lost > 1 ? Math.max(0, duration - 9) / (lost - 1) : 0;
      // The LAST unit goes first, so order 0 is the first to leave.
      const outs = Array.from({ length: lost }, (_, o) => reduceStart + o * stagger);
      hits.push(
        ...thin(outs).map((i, k, arr) => ({
          sound: "unpop",
          frame: Math.round(outs[i]),
          // Falling, because the quantity is falling.
          rate: rateAt(k / Math.max(1, arr.length - 1), 1.06, 0.9),
          volume: 0.15,
        })),
      );
    }
    return hits;
  },

  /**
   * BARCHART — "un tick tick tick qui accélère et décélère en fonction de
   * la courbe de progression".
   *
   * The fill is an ease, so evenly-spaced ticks would lie about it. The
   * ticks are placed at equal *progress* instead — sample the eased curve
   * at n points and emit at the frame each point is reached — so the
   * ratchet is dense where the bar moves fast and opens out as it
   * settles. The curve does the rhythm; nothing is hand-timed.
   *
   * The tooth is a real bicycle freewheel (38 ms, sliced out of 141 of
   * them). That is the whole difference between this and the synthesized
   * `tickfine` it replaces: a generator makes every tooth identical, and
   * twenty identical teeth is a buzzer.
   *
   * Mirrors BarChart.tsx: GROW_DELAY 2, GROW_FRAMES 12, SHRINK_FRAMES 30,
   * stagger 14.
   */
  "lab:barchart": (props, cues) => {
    const rows = props.rows ?? [];
    const stagger = props.stagger ?? 14;
    const appearAt = props.appearAt ?? 0;
    const hits = [];
    rows.forEach((row, r) => {
      const cue = cues[r] ?? appearAt + r * stagger;
      // The label lands, then the bar runs out from it.
      hits.push(strike(cue, r, 0.13));
      const start = cue + 7 + 2;
      // Teeth per bar scale with how far it actually travels: a bar at
      // 12 % gets three ticks, a full one gets twelve.
      const teeth = Math.max(2, Math.round((row.fraction ?? 0) * 12));
      // The component's ease is cubic-out, so the bar covers its first
      // eighth inside a third of a frame — equal-progress teeth pile up
      // at the start unless the run is thinned like every other run.
      const raw = progressFrames(start, 12, teeth, 3);
      for (const i of thin(raw)) {
        const t = i / teeth;
        hits.push({
          sound: "ratchet",
          frame: Math.round(raw[i]),
          rate: rateAt(t, 0.9, 1.18),
          volume: 0.09,
        });
      }
      if (row.shrinkTo != null) {
        // The comedown: the same teeth, reversed and slower.
        const back = start + 12 + 6;
        const n = Math.max(2, Math.round(Math.abs((row.fraction ?? 0) - row.shrinkTo) * 10));
        for (let k = 0; k <= n; k += 1) {
          hits.push({
            sound: "ratchet",
            frame: Math.round(back + (k / n) * 30),
            rate: rateAt(k / n, 1.1, 0.86),
            volume: 0.07,
          });
        }
        hits.push({ sound: "latch", frame: Math.round(back + 30), volume: 0.16 });
      }
    });
    return hits;
  },

  /**
   * ODOMETER — the counter. Same ratchet logic, a different mechanism:
   * a clock escapement rather than a freewheel, because a counter moves
   * in DIGITS and a fill moves continuously. Two objects, so two sounds —
   * otherwise the whole system is one click at different speeds.
   *
   * Mirrors OdometerTally.tsx: countStart 12, countFrames 110.
   */
  "lab:odometer": (props, cues) => {
    const start = cues[0] ?? props.countStart ?? 12;
    const frames = props.countFrames ?? 110;
    const teeth = 22;
    const hits = [];
    // A digit is an equal step of VALUE, and the value decelerates — so
    // the teeth are the inverse of the component's ease, which spreads
    // them out as it settles. (Applied forward, the same expression put
    // the last three teeth on one frame and made the counter speed up
    // into its stop. Both are one character apart in the source.)
    const raw = progressFrames(start, frames, teeth, 2.2);
    for (const i of thin(raw)) {
      hits.push({
        sound: "detent",
        frame: Math.round(raw[i]),
        rate: rateAt(i / teeth, 1.16, 0.92),
        volume: 0.1,
      });
    }
    // It stops. Something has to say so.
    hits.push({ sound: "latch", frame: Math.round(start + frames + 2), volume: 0.2 });
    return hits;
  },

  /**
   * LINECHART / SPARKLINE — a pen crosses the plot and leaves a mark at
   * every reading.
   *
   * The first pass ticked once per data point, which on a 14-day series
   * is four hits a second — a drum roll under a chart. What the picture
   * actually shows is ONE continuous stroke, so the stroke is one sound
   * (`plotter`, stretched to the draw's real length), and the marks are
   * spent where a reader's eye actually goes: the highest reading, the
   * lowest, and the last. Three `nib`s, chosen by the DATA.
   *
   * That is the same programmatic idea as the ratchet, applied to
   * restraint instead of density — the numbers pick the frames either way.
   *
   * Mirrors LineChart.tsx / PrintedSparkline.tsx: drawStart 15,
   * drawFrames 90, PARK_IN 12.
   */
  "lab:linechart": lineEmitter,
  "lab:sparkline": lineEmitter,

  /**
   * PIE / SIMPLEPIE / COMPOSITIONBAR — sectors sweeping. A sector is one
   * continuous gesture, so it gets `slide` (paper across paper, which is
   * what a sector opening on a printed sheet is), and its length is its
   * share: a 48 % slice plays slower than a 21 % one because it is bigger.
   */
  "lab:pie": pieEmitter,
  "lab:simplepie": pieEmitter,
  "lab:compositionbar": pieEmitter,

  /**
   * COMPARISON — Martin: "j'aime pas ce bruit". It was `print`, which is
   * the sound of a receipt head, on an element where nothing is printing
   * — two columns answer each other, row by row. So: a hammer per row,
   * and the stamp on the verdict, which is the one row that is a
   * conclusion rather than a reading.
   */
  "lab:comparison": (props, cues) => {
    const rows = props.rows ?? [];
    return cues.map((frame, i) =>
      i >= rows.length
        ? { sound: "stamp", frame, volume: 0.28 }
        : strike(frame, i, 0.15),
    );
  },

  /**
   * THRESHOLD — a pour rises up a tape toward a hard line.
   *
   * The old map left it silent and the demo sheet put a meme sting on it,
   * which is what Martin heard ("wtf le son") and he was right: a sting
   * is a reaction, and this element is a measurement. What it actually
   * does is rise, settle, and sometimes cross — so it rises (`slide`),
   * settles (`latch`), and the crossing is the ONE loud event, computed
   * from the data rather than authored.
   *
   * Mirrors ThresholdMeter.tsx: RISE_FRAMES 26, CUE_STAGGER 60.
   */
  "lab:threshold": (props, cues) => {
    const sources = props.sources ?? [];
    const limit = props.limit?.value ?? Infinity;
    const appearAt = props.appearAt ?? 0;
    const hits = [];
    let running = 0;
    let crossed = false;
    sources.forEach((s, i) => {
      const cue = cues[i] ?? appearAt + i * 60;
      hits.push({ sound: "slide", frame: cue, volume: 0.13, rate: 1.05 });
      hits.push({ sound: "latch", frame: cue + 26, volume: 0.14 });
      const before = running;
      running += s.amount ?? 0;
      if (!crossed && before <= limit && running > limit) {
        crossed = true;
        // The frame the pour actually passes the line, interpolated
        // inside its own rise — not the frame the pour ends.
        const share = (limit - before) / Math.max(1e-6, running - before);
        hits.push({
          sound: "stamp",
          frame: Math.round(cue + 26 * share),
          volume: 0.34,
        });
      }
    });
    return hits;
  },

  /**
   * THERMAL — the one element where `print` is the truth rather than a
   * borrowed noise: a receipt physically coming out of a head, line by
   * line, and the blade taking it off at the tear.
   *
   * Every other element in the system gave `print` back when the reveal
   * became a fade. This one keeps it, and the schedule is mirrored from
   * ThermalPrinter.tsx exactly (START 8, FEED 6, per-kind sweep frames,
   * FINAL_FEED 10, STAMP_DELAY 10, STAMP_FALL 9) so each chatter starts
   * on the frame its line starts sweeping.
   */
  "lab:thermal": (props) => {
    const SWEEP = { wordmark: 12, meta: 10, rule: 7, tear: 7, row: 12, total: 12, space: 0 };
    const lines = props.lines ?? [];
    const hits = [];
    let t = 8; // START
    for (const line of lines) {
      const sweep = SWEEP[line.kind] ?? 10;
      const at = t + 6; // FEED
      if (line.kind === "tear") {
        hits.push({ sound: "cut", frame: Math.round(at), volume: 0.22 });
      } else if (sweep > 0) {
        hits.push({
          sound: "print",
          frame: Math.round(at),
          // A wordmark is a tall line and takes longer to sweep; the head
          // is the same head, so the sample stretches rather than changes.
          rate: Number((12 / sweep).toFixed(3)),
          volume: line.kind === "total" ? 0.2 : 0.15,
        });
      }
      t += 6 + sweep;
    }
    if (props.stamp) {
      // finalFeed(10) + STAMP_DELAY(10) + STAMP_FALL(9); contact is the sound.
      hits.push({ sound: "stamp", frame: Math.round(t + 29), volume: 0.36 });
    }
    return hits;
  },

  /**
   * TIERLIST — items land in a grid that was already on the paper. The
   * clearest "a thing arrives in a place waiting for it" in the system,
   * and now the clearest typewriter: one hammer per item, in reading
   * order, alternating so a seven-item tier does not loop.
   *
   * Mirrors TierList.tsx: PRINT_FRAMES 7, stagger default 10.
   */
  "lab:tierlist": (props, cues) => {
    const stagger = props.stagger ?? 10;
    const appearAt = props.appearAt ?? 0;
    const frames = cues.length
      ? cues
      : (props.tiers ?? []).flatMap((tier) => tier.items ?? []).map((_, i) => appearAt + i * stagger);
    return frames.map((frame, i) => strike(frame, i, 0.15));
  },

  /**
   * FLOW — stages chained by a stroke. Two different events and the old
   * map heard neither: the connector DRAWS (a pen), then the box LANDS
   * (a hammer). Sounding only the box loses the causality the element
   * exists to show.
   *
   * Mirrors FlowDiagram.tsx: PRINT_FRAMES 8, CONNECT_FRAMES 14,
   * STAGE_STAGGER 52, ARRIVE_LEAD 6.
   */
  "lab:flow": (props, cues) => {
    const stages = props.stages ?? [];
    const appearAt = props.appearAt ?? 0;
    const hits = [];
    stages.forEach((_, i) => {
      const cue = cues[i] ?? appearAt + i * 52;
      // The stroke reaches the box six frames before the box prints.
      if (i > 0) hits.push({ sound: "nib", frame: Math.round(cue - 14), volume: 0.1, rate: 0.92 });
      hits.push(strike(cue, i, 0.15));
    });
    return hits;
  },

  /**
   * TIMELINE — a head travels a scale and stamps a mark at each event.
   * One `nib` per mark, at the frame the head arrives, and the HEAVY
   * events (the ones the element already draws bigger) are louder,
   * because the data already said they mattered.
   *
   * Mirrors Timeline.tsx: PARK_IN 12, HOP 54.
   */
  "lab:timeline": (props, cues) => {
    const events = props.events ?? [];
    const appearAt = props.appearAt ?? 0;
    return events.map((ev, i) => ({
      sound: "nib",
      frame: Math.round(cues[i] ?? appearAt + 12 + i * 54),
      volume: ev.heavy ? 0.2 : 0.12,
      rate: ev.heavy ? 0.9 : Number((1.02 + ((i % 3) - 1) * 0.05).toFixed(3)),
    }));
  },

  /**
   * MOLECULE — bonds drawn one after another. A pen mark per bond, and
   * the compound's receipt row lands after the last one.
   *
   * Mirrors Molecule.tsx: BOND_DRAW 7, BOND_STAGGER 8, LABEL_PRINT 5.
   */
  "lab:molecule": (props, cues) => {
    const bonds = props.bonds ?? [];
    const appearAt = cues[0] ?? props.appearAt ?? 0;
    const frames = bonds.map((_, i) => (cues[i] ?? appearAt + i * 8));
    const hits = thin(frames).map((i, k, arr) => ({
      sound: "nib",
      frame: Math.round(frames[i]),
      volume: 0.1,
      rate: rateAt(k / Math.max(1, arr.length - 1), 1.06, 0.94),
    }));
    if (props.title || props.value) {
      const last = frames[frames.length - 1] ?? appearAt;
      hits.push(strike(last + 7 + 5, 0, 0.14));
    }
    return hits;
  },

  /**
   * CALENDAR — a month's grid prints, then each day takes its beat.
   *
   * THE EXCEPTION IS THE EVENT. A month of thirty kept days is thirty
   * identical marks, which is a rattle that says nothing; the three days
   * that were MISSED are the only information on the sheet. So the kept
   * run is a low pulse thinned hard (the month going past, ~7 marks
   * whatever the month's length), and every missed day gets its own
   * `unpop` — a day leaving, the same sound a unit leaving a grid gets.
   *
   * A clean month is therefore quiet, and a bad month is audibly bad,
   * without a word being said about it. That is the element's whole
   * argument, played rather than narrated.
   *
   * THE GRID IS ONE GESTURE, NOT A RUN. Martin, hearing the first take:
   * "y'a un petit pop quand ça affiche alors que je pense il serait mieux
   * quand les cases s'enlèvent, et lors de l'affichage du calendrier
   * plutôt un swoosh léger". He is drawing the line the rest of this file
   * already draws and this element had crossed: a month's grid arrives as
   * ONE object — nobody counts thirty squares appearing — so it gets one
   * light `slide`, and the pop is kept for the only thing that is
   * genuinely per-cell, a day going out. Unlike `unitgrid`, where the
   * count IS the argument and every square is asked to land.
   *
   * Mirrors CalendarStrip.tsx: CELL_PRINT 5, CELL_STAGGER 0.7,
   * stampsAt = appearAt + 50, stampStagger 5.
   */
  "lab:calendar": (props, cues) => {
    const days = props.days ?? 30;
    const appearAt = props.appearAt ?? 0;
    const hits = [
      { sound: "slide", frame: Math.round(appearAt), volume: 0.1, rate: 1.18 },
    ];

    const stampsAt = cues[0] ?? props.stampsAt ?? appearAt + 50;
    const stagger = props.stampStagger ?? 5;
    const frameOf = (day) => stampsAt + (day - 1) * stagger;
    const missed = new Set(props.missed ?? []);

    // The days that were not kept. Every one of them, however many.
    const gone = [...missed].map((d) => frameOf(d));
    for (const frame of gone) {
      hits.push({ sound: "unpop", frame: Math.round(frame), volume: 0.18, rate: 0.95 });
    }

    // The month going past — a pulse every ~12 frames, not every day, and
    // never within a breath of a missed day: the pulse is the background
    // the exception has to stand out from, so where they collide the
    // exception keeps the frame.
    const kept = [];
    for (let d = 1; d <= days; d += 1) if (!missed.has(d)) kept.push(frameOf(d));
    hits.push(
      ...thin(kept, 12)
        .filter((i) => !gone.some((g) => Math.abs(g - kept[i]) < 4))
        .map((i, k, arr) => ({
          sound: "nib",
          frame: Math.round(kept[i]),
          volume: 0.09,
          rate: rateAt(k / Math.max(1, arr.length - 1), 0.98, 1.08),
        })),
    );
    return hits;
  },

  /**
   * RANKSHUFFLE — a board prints in one order, then re-files itself in
   * another. The re-filing is the argument, so it is the loud half: each
   * moving strip is a sheet sliding, and the board settles on a latch.
   *
   * Mirrors RankShuffle.tsx: PRINT_FRAMES 10, GROUP_STAGGER 16,
   * VALUE_LEAD 26.
   */
  "lab:rankshuffle": (props, cues) => {
    const items = props.items ?? [];
    const appearAt = props.appearAt ?? 0;
    const hits = items.map((_, i) => strike(cues[i] ?? appearAt + i * 10, i, 0.13));
    const sortAt = props.sortAt ?? (cues[cues.length - 1] ?? appearAt + items.length * 10) + 30;
    // The strips that actually move. An item that keeps its rank is
    // silent, which is the whole point of the element.
    const moved = items.filter((it, i) => (it.rankB ?? i) !== i);
    const waves = Math.max(1, Math.min(moved.length, 4));
    for (let w = 0; w < waves; w += 1) {
      hits.push({
        sound: "slide",
        frame: Math.round(sortAt + w * 16),
        volume: 0.14,
        rate: Number((1.12 - w * 0.06).toFixed(3)),
      });
    }
    hits.push({ sound: "latch", frame: Math.round(sortAt + waves * 16 + 12), volume: 0.18 });
    return hits;
  },

  /**
   * LABELANATOMY — a highlight travels down a label and a note is written
   * beside each row it stops on. A pen, once per step, and the CORRECTION
   * steps (the ones the element strikes through) take the stamp instead:
   * a struck value is a verdict, not an annotation.
   *
   * Mirrors LabelAnatomy.tsx: TRAVEL 14, STRIKE_FRAMES 10, stagger 60.
   */
  "lab:labelanatomy": (props, cues) => {
    const steps = props.steps ?? [];
    const appearAt = props.appearAt ?? 0;
    const stagger = props.stagger ?? 60;
    return steps.map((step, i) => {
      const frame = Math.round(cues[i] ?? appearAt + i * stagger);
      return step.correction != null
        ? { sound: "stamp", frame: frame + 10, volume: 0.24 }
        : { sound: "nib", frame, volume: 0.13, rate: Number((1.04 - (i % 3) * 0.05).toFixed(3)) };
    });
  },

  /**
   * DISSOLVE — one specimen becomes another. A single continuous
   * transformation, so a single continuous sound: the page turning.
   */
  "lab:dissolve": (props, cues) => [
    { sound: "flip", frame: Math.round(cues[0] ?? props.appearAt ?? 0), volume: 0.18 },
  ],

  /** BULLETS — lines of text. Lines of text are typed. */
  "lab:bullets": (props, cues) => {
    const lines = props.bullets ?? props.lines ?? [];
    const appearAt = props.appearAt ?? 0;
    const stagger = props.stagger ?? 18;
    const frames = cues.length ? cues : lines.map((_, i) => appearAt + i * stagger);
    return frames.map((frame, i) => strike(frame, i, 0.15));
  },
};

function lineEmitter(props, cues) {
  const points = props.points ?? [];
  if (!points.length) return [];
  const start = (cues[0] ?? props.drawStart ?? 15) + 12; // PARK_IN
  const frames = props.drawFrames ?? 90;
  const at = (i) => start + (i / Math.max(1, points.length - 1)) * frames;

  // One stroke for the whole line. `plotter` is 460 ms — 13.8 frames — so
  // the rate is what makes it last exactly as long as the draw does.
  const hits = [
    {
      sound: "plotter",
      frame: Math.round(start),
      rate: Number(Math.max(0.35, Math.min(2.2, 13.8 / frames)).toFixed(3)),
      volume: 0.12,
    },
  ];

  // Three marks, and the DATA picks all three.
  let hi = 0;
  let lo = 0;
  points.forEach((v, i) => {
    if (v > points[hi]) hi = i;
    if (v < points[lo]) lo = i;
  });
  const marks = [...new Set([hi, lo, points.length - 1])].sort((a, b) => a - b);
  const min = Math.min(...points);
  const span = Math.max(1e-6, Math.max(...points) - min);
  for (const i of marks) {
    hits.push({
      sound: "nib",
      frame: Math.round(at(i)),
      // The value IS the pitch: the peak marks higher than the trough.
      rate: Number((0.9 + 0.3 * ((points[i] - min) / span)).toFixed(3)),
      volume: i === points.length - 1 ? 0.16 : 0.13,
    });
  }
  return hits;
}

function pieEmitter(props, cues) {
  const slices = props.slices ?? props.segments ?? [];
  const appearAt = props.appearAt ?? 0;
  return slices.map((s, i) => ({
    sound: "slide",
    frame: cues[i] ?? appearAt + i * 20,
    // A bigger share takes longer to sweep, so it plays slower.
    rate: Number((1.35 - 0.6 * Math.min(1, s.fraction ?? 0.33)).toFixed(3)),
    volume: 0.14,
  }));
}

/**
 * A project's own emitters, one per element folder that ships an `sfx.mjs`.
 *
 * Loaded from disk rather than imported statically, for the same reason the
 * components are: core cannot know what a project built. An element with no
 * emitter is silent — which is a legitimate choice, so it is not warned about;
 * `reelkit sfx:audit` is where an emitter returning nothing gets named.
 */
const projectEmitters = await (async () => {
  const out = {};
  if (!existsSync(elementsDir)) return out;
  for (const entry of readdirSync(elementsDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith("_")) continue;
    const file = path.join(elementsDir, entry.name, "sfx.mjs");
    if (!existsSync(file)) continue;
    const mod = await import(pathToFileURL(file).href);
    const fn = mod.default ?? mod.emit;
    if (typeof fn !== "function") {
      throw Object.assign(
        new Error(
          `elements/${entry.name}/sfx.mjs must export a function (default or ` +
            `\`emit\`) taking (props, cues, fps) and returning hits.`,
        ),
        { fatal: true },
      );
    }
    out[`lab:${entry.name}`] = fn;
  }
  return out;
})();

/** Emit for one staged beat, or null when the element has no emitter. */
export const emitFor = (element, cueFrames, fps) => {
  const key = element.type === "lab" ? `lab:${element.element}` : element.type;
  // The project's emitter wins, exactly as its component wins in LAB_REGISTRY.
  const fn = projectEmitters[key] ?? EMITTERS[key];
  if (!fn) return null;
  return fn(element.props ?? element, cueFrames ?? [], fps).filter(
    (h) => h && Number.isFinite(h.frame) && h.frame >= 0,
  );
};
