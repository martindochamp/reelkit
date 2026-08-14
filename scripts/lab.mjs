#!/usr/bin/env node
// Preview one element, alone, in the project's own ink.
//
//   reelkit lab tierlist
//   reelkit lab tierlist --props props.json --theme light --frames 240
//
// This replaced twenty per-element harness scripts, each bundling its own
// entry file. They existed before `ElementFrame` did; now that one composition
// takes { element, props } and reads the MERGED registry, a bespoke script per
// element buys nothing and cannot see a project's own elements at all —
// which is the whole point of the extension folder.

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { bundleProject, projectElementNames } from "./bundle.mjs";
import { outDir } from "./project.mjs";

const argv = process.argv.slice(2);
const FLAGS = ["props", "theme", "frames"];
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : argv[i + 1];
};
// The first bare word that is not a flag's value.
const takenAsValue = new Set(
  FLAGS.map((f) => argv.indexOf(`--${f}`)).filter((i) => i !== -1).map((i) => i + 1),
);
const element = argv.find(
  (a, i) => !a.startsWith("--") && !takenAsValue.has(i),
);

if (!element) {
  console.error("usage: reelkit lab <element> [--props <file.json>] [--theme dark|light] [--frames N]");
  process.exit(1);
}

const propsFile = flag("props");
let props = {};
if (propsFile) {
  if (!existsSync(propsFile)) {
    console.error(`props file not found: ${propsFile}`);
    process.exit(1);
  }
  props = JSON.parse(readFileSync(propsFile, "utf8"));
}

const theme = flag("theme", "dark");
const frames = Number(flag("frames", 300));

console.log(`BUNDLE  ${element}`);
const serveUrl = await bundleProject();

const inputProps = { element, props, theme };
const composition = await selectComposition({ serveUrl, id: "ElementFrame", inputProps });

const dir = path.join(outDir, "lab");
mkdirSync(dir, { recursive: true });
const output = path.join(dir, `${element}.mp4`);

let lastPct = -1;
await renderMedia({
  composition: { ...composition, durationInFrames: frames },
  serveUrl,
  codec: "h264",
  outputLocation: output,
  inputProps,
  onProgress: ({ progress }) => {
    const pct = Math.round(progress * 20) * 5;
    if (pct === lastPct) return;
    lastPct = pct;
    console.log(`RENDER  ${element}  ${pct} %`);
  },
});

// A silent element that renders a blank frame is the commonest way a new
// element fails, and it fails without an error. Name where it came from so
// the author knows whether core or their own folder answered.
const mine = projectElementNames();
console.log(
  `LAB  ${output}  (${mine.includes(element) ? "project element" : "core element"})`,
);
