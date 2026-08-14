#!/usr/bin/env node
// Builds posts/_demo.json — every screen element in the system, in order,
// each one held for a beat with its parts printing and the sound design
// over the top.
//
//   npm run demo:build     regenerate the spec from the bank
//   npm run reel _demo     render it (no TTS: every beat is a silent hold)
//
// TWO JOBS, and the second is the one that pays.
//
// 1. A reference you WATCH. The still contact sheets (out/flags-*.png,
//    out/lab/*.mp4) show one thing at a time; this shows the bank as a
//    sequence, at reel scale, with the effects on the same frames a real
//    reel would put them. Deciding "which instrument carries this beat"
//    is a question about motion and sound, and it was previously only
//    answerable by reading twenty files.
//
// 2. A minimal working example of every element, as DATA. `_demo.json` is
//    an ordinary post file, so anything in it can be copied into a real
//    one. REELS.md sends writers to "read its file header in src/lab/",
//    which is a TypeScript prop type — this is the same information in
//    the shape they actually have to type.
//
// PROPS ARE HARVESTED, NOT INVENTED. Where an element has ever appeared
// in a shipped reel, the demo takes that usage verbatim: a hand-written
// example drifts from what the element really wants, and this file would
// be the last place anyone noticed. Only the five elements that have
// never been used anywhere carry props written here, and they say so.

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { postsDir } from "./stage.mjs";

/** Order to show them in: our own first, then the lab, ending on the ask. */
const ORDER = [
  "figure", "clip", "media", "flag", "table", "stat",
  "lab:thermal", "lab:dissolve", "lab:unitgrid", "lab:barchart", "lab:odometer",
  "lab:linechart", "lab:sparkline", "lab:comparison", "lab:pie", "lab:simplepie",
  "lab:compositionbar", "lab:rankshuffle", "lab:threshold", "lab:labelanatomy",
  "lab:flow", "lab:timeline", "lab:molecule", "lab:calendar", "lab:tierlist",
  "lab:bullets", "mockup", "endcard",
];

/**
 * Seconds each beat holds. Long enough to finish its own animation —
 * which is not a matter of taste: `npm run sfx:audit` reports every
 * effect that lands past its beat, and each one of those is an animation
 * being cut off mid-motion as well. Five of these numbers were raised the
 * first time that check ran.
 */
const HOLD = {
  "lab:thermal": 5.5,
  "lab:dissolve": 6.0,
  "lab:unitgrid": 5.0,
  "lab:calendar": 7.5,
  "lab:rankshuffle": 6.0,
  "lab:odometer": 5.0,
  "lab:linechart": 4.5,
  "lab:sparkline": 4.5,
  "lab:molecule": 4.0,
  endcard: 2.0,
  default: 3.5,
};

/**
 * No reaction stings on this sheet.
 *
 * The first version put `cave` on `threshold`, on the reasoning that its
 * job is "a limit was crossed". Martin: "threshold wtf le son" — and he
 * was right. A sting is a REACTION to a fact; this element is the
 * INSTRUMENT that establishes the fact, and the two cannot be the same
 * sound without the instrument losing its authority. The stings live on
 * beats (`beat.sound`), which is where a reaction belongs, and the demo
 * sheet is the argument for restraint rather than an advert for them.
 */
const SOUND = {};

const keyOf = (el) => (el.type === "lab" ? `lab:${el.element}` : el.type);

/** One real usage of each element, oldest-file-wins for stability. */
const harvest = () => {
  const found = new Map();
  for (const file of readdirSync(postsDir).sort()) {
    if (!file.endsWith(".json") || file === "ledger.json" || file === "_demo.json") continue;
    let spec;
    try {
      spec = JSON.parse(readFileSync(path.join(postsDir, file), "utf8"));
    } catch {
      continue;
    }
    for (const beat of spec.reel?.beats ?? []) {
      const el = beat.screen;
      if (!el?.type) continue;
      const key = keyOf(el);
      if (found.has(key)) continue;
      found.set(key, {
        screen: el,
        cues: ((beat.say ?? "").match(/\[\+\]/g) ?? []).length,
        from: file.replace(/\.json$/, ""),
      });
    }
  }
  return found;
};

/**
 * The five that have never appeared in a reel, so there is nothing to
 * harvest. Four of them are the lab elements REELS.md keeps listing as
 * unused; `dissolve` in particular could not be used until today, because
 * its props want pre-converted ASCII and nothing converted it.
 */
const WRITTEN = {
  "lab:thermal": {
    cues: 0,
    screen: {
      type: "lab", element: "thermal",
      props: {
        lines: [
          { kind: "wordmark", text: "Tally" },
          { kind: "meta", text: "Day receipt — N° 214" },
          { kind: "rule" },
          { kind: "row", left: "Protein", right: "184 g" },
          { kind: "row", left: "Fibre", right: "31 g" },
          { kind: "total", left: "Target 180 g", right: "Met" },
          { kind: "tear" },
        ],
        stamp: { text: "Kept" },
      },
    },
  },
  "lab:dissolve": {
    cues: 0,
    screen: {
      type: "lab", element: "dissolve",
      props: {
        a: { image: "spinach.jpg", cols: 56, cutout: true, label: "Spinach, raw — 1 cup", value: "30 mg" },
        b: { image: "kale.jpg", cols: 56, cutout: true, label: "Kale, cooked — 1 cup", value: "177 mg" },
      },
    },
  },
  "lab:sparkline": {
    cues: 1,
    screen: {
      type: "lab", element: "sparkline",
      props: {
        kicker: "Protein — last 14 days",
        points: [126, 148, 152, 141, 133, 158, 149, 145, 96, 151, 162, 147, 155, 168],
        yMax: 200, yMin: 0,
        target: 140, targetLabel: "Target 140 g",
        xLabels: ["Jul 19", "Aug 01"],
        rowLabel: "Days at target",
      },
    },
  },
  "lab:pie": {
    cues: 3,
    screen: {
      type: "lab", element: "pie",
      props: {
        kicker: "Where the day's calories came from",
        slices: [
          { label: "Carbohydrate", value: "48 %", fraction: 0.48 },
          { label: "Fat", value: "31 %", fraction: 0.31 },
          { label: "Protein", value: "21 %", fraction: 0.21 },
        ],
      },
    },
  },
  // `recording` needs a take in posts/clips/ (gitignored, made by
  // tools/capture_demo.sh). Left out rather than faked: a demo sheet that
  // lies about one row is worse than one that is missing it.
};

/**
 * Props patched onto a harvested usage so the element actually DOES its
 * thing on the sheet.
 *
 * This is the one narrow exception to "props are harvested, not
 * invented", and it earns its place: the bank's only `calendar` is
 * `metformin-b12`, a perfect 30/30 month. That is the element's
 * DEGENERATE case — nothing is missed, so nothing is marked, so the sheet
 * shows a grid printing and stops. A reference sheet whose job is
 * "decide which instrument carries this beat" has to show the instrument
 * under load, and the sound design makes that literal: a clean month is
 * deliberately quiet and the missed days are the only events in it.
 *
 * The patch is per-KEY and shallow, and every entry says what it exists
 * to expose. If a real post ever uses the element properly, delete the
 * entry — the harvest is always the better source.
 */
const EXERCISE = {
  // Three missed days, so the `unpop` per lost day is audible and the
  // ghosted numbers are visible. Martin, 2026-08-11: the pop belongs on
  // "quand les cases s'enlèvent", and the sheet could not show it.
  "lab:calendar": { missed: [7, 8, 19] },
};

const bank = harvest();
const beats = [];
const missing = [];

for (const key of ORDER) {
  const entry = bank.get(key) ?? WRITTEN[key];
  if (!entry) {
    missing.push(key);
    continue;
  }
  const hold = HOLD[key] ?? HOLD.default;
  // Cues spread across the front two thirds, so the last part still has
  // room to be read before the cut.
  const n = entry.cues ?? 0;
  const cues =
    n > 0
      ? Array.from({ length: n }, (_, i) =>
          Number((0.35 + (i * (hold * 0.62)) / Math.max(1, n)).toFixed(2)),
        )
      : [];

  const screen = EXERCISE[key]
    ? { ...entry.screen, props: { ...entry.screen.props, ...EXERCISE[key] } }
    : entry.screen;

  beats.push({
    hold,
    ...(cues.length ? { cues } : {}),
    ...(SOUND[key] ? { sound: SOUND[key] } : {}),
    // The caption band is already the place words live; borrowing it to
    // name the element costs no new chrome and keeps the sheet legible.
    label: key.toUpperCase(),
    screen,
    _from:
      (entry.from ?? "written here — never used in a reel") +
      (EXERCISE[key] ? ` (props patched to exercise it: ${Object.keys(EXERCISE[key]).join(", ")})` : ""),
  });
}

const post = {
  theme: "dark",
  brief: {
    topic: "_demo",
    mechanic: "the bank, in order, at reel scale, with the sound on it",
    DO_NOT_SHIP: "a reference sheet, not a post — regenerate with npm run demo:build",
  },
  reel: { captions: "page", sfx: true, roomtone: true, beats },
};

writeFileSync(
  path.join(postsDir, "_demo.json"),
  `${JSON.stringify(post, null, 2)}\n`,
);

console.log(
  `DEMO  ${beats.length} elements · ` +
    `${beats.reduce((s, b) => s + b.hold, 0).toFixed(0)} s · ` +
    `${beats.filter((b) => b._from?.startsWith("written")).length} written here, ` +
    `${beats.filter((b) => !b._from?.startsWith("written")).length} harvested`,
);
if (missing.length) console.log(`SKIP  no props anywhere for: ${missing.join(", ")}`);
console.log(`      posts/_demo.json → npm run reel _demo`);
