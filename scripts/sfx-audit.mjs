#!/usr/bin/env node
// What each element in a post actually SOUNDS, without rendering it.
//
//   npm run sfx:audit            the demo sheet — every element, in order
//   npm run sfx:audit -- <post>  one post
//   npm run sfx:audit -- --kit   the kit itself: file, length, level
//
// WHY THIS EXISTS
//
// The sound design is now computed from each element's animation timeline
// and data (scripts/sfx-elements.mjs), which means a wrong constant is a
// sound landing NEXT to its animation rather than on it — inaudible in a
// description and obvious in a render. A render of the demo sheet is
// three minutes; this is a second, and it catches the three failures that
// actually happen:
//
//   1. an emitter returning nothing (a typo in a prop name, silently)
//   2. a run so dense it is a buzz, or so sparse it is two disconnected
//      clicks (the 14-unit grid that printed in four frames)
//   3. a hit landing outside its own beat, which plays over the next one
//
// It reports hits per element, the span they cover, and the tightest gap
// between two of them, which is the number that decides 1-3.

import { readFileSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { postsDir, projectDir } from "./stage.mjs";
import { emitFor } from "./sfx-elements.mjs";
import { DEFAULT_MAP, KIT } from "./sfx.mjs";
import { readRegister } from "./sfx-import.mjs";

const FPS = 30;

const argv = process.argv.slice(2);

if (argv.includes("--kit")) {
  const dir = path.join(projectDir, "posts", "sfx", "sourced");
  const rows = readRegister();
  console.log(`\nSOURCED — ${rows.length} takes\n`);
  for (const row of rows) {
    const file = path.join(dir, `${row.name}.wav`);
    let ms = "—";
    try {
      ms = `${Math.round(
        Number(
          execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], {
            encoding: "utf8",
          }),
        ) * 1000,
      )} ms`;
    } catch {
      ms = "NOT IMPORTED";
    }
    console.log(`  ${row.name.padEnd(10)} ${ms.padStart(12)}   ${row.what ?? ""}`);
  }
  const synthOnly = Object.keys(KIT).filter((k) => !rows.some((r) => r.name === k));
  console.log(`\nSYNTHESIZED ONLY — ${synthOnly.length}: ${synthOnly.join(", ")}\n`);
  process.exit(0);
}

const name = argv.find((a) => !a.startsWith("--")) ?? "_demo";
const spec = JSON.parse(readFileSync(path.join(postsDir, `${name}.json`), "utf8"));
const beats = spec.reel?.beats ?? [];

const key = (el) => (el.type === "lab" ? `lab:${el.element}` : el.type);

let total = 0;
const tally = new Map();
const problems = [];

console.log(`\nSFX AUDIT — ${name}\n`);
beats.forEach((beat, b) => {
  const el = beat.screen;
  if (!el?.type) return;
  const durationInFrames = Math.round((beat.hold ?? 3.5) * FPS);
  const cueFrames = (beat.cues ?? []).map((s) => Math.round(s * FPS));

  const k = key(el);
  let hits = emitFor(el, cueFrames, FPS);
  let via = "emitter";
  if (!hits) {
    const fn = DEFAULT_MAP[k];
    hits = fn ? fn(cueFrames, el).filter(Boolean).map((h) => ({ ...h, frame: h.frame })) : [];
    via = fn ? "map" : "silent";
  }

  const frames = hits.map((h) => h.frame).sort((a, b2) => a - b2);
  const span = frames.length ? frames[frames.length - 1] - frames[0] : 0;
  let tightest = Infinity;
  for (let i = 1; i < frames.length; i += 1) tightest = Math.min(tightest, frames[i] - frames[i - 1]);

  const counts = {};
  for (const h of hits) counts[h.sound] = (counts[h.sound] ?? 0) + 1;
  for (const [s, n] of Object.entries(counts)) tally.set(s, (tally.get(s) ?? 0) + n);
  total += hits.length;

  const over = frames.filter((f) => f >= durationInFrames).length;
  if (over) problems.push(`${k}: ${over} hit(s) land past the beat's ${durationInFrames} frames`);
  if (hits.length === 0 && via !== "silent") problems.push(`${k}: ${via} returned nothing`);
  if (tightest < 2) problems.push(`${k}: two hits ${tightest} frame(s) apart — one gesture, two sounds`);

  console.log(
    `${String(b).padStart(2)}  ${k.padEnd(20)} ${String(hits.length).padStart(3)} hits  ` +
      `${String(span).padStart(4)}f span  ` +
      `${(Number.isFinite(tightest) ? `min gap ${tightest}f` : "—").padEnd(14)} ` +
      `${via.padEnd(8)} ${JSON.stringify(counts)}`,
  );
});

console.log(
  `\n${total} hits · ` +
    `${[...tally.entries()].sort((a, b) => b[1] - a[1]).map(([s, n]) => `${n}× ${s}`).join(", ")}`,
);
if (problems.length) {
  console.log(`\n${problems.length} PROBLEM(S)`);
  for (const p of problems) console.log(`  ${p}`);
} else {
  console.log(`\nno hit lands outside its beat, no emitter is silent.`);
}
console.log();
