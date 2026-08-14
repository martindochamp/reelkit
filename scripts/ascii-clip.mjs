#!/usr/bin/env node
// Animated ASCII specimen — a GIF or short video run frame by frame
// through the same converter as the art slides, rendered as an MP4 to
// judge the effect. Exploration tool; what ships rides the reel pipeline.
//
//   node scripts/ascii-clip.mjs ~/Downloads/duck\ gif.gif
//   node scripts/ascii-clip.mjs clip.gif --cols 72 --gamma 0.8 --loops 6 --theme light
//
// trim is forced OFF: every frame must keep the same geometry or the
// specimen trembles. Frame the subject in the source clip instead.

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { bundleProject } from "./bundle.mjs";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { imageToAscii } from "./img2ascii.mjs";
import { projectDir } from "./stage.mjs";

const args = process.argv.slice(2);
const input = args.find((a) => !a.startsWith("--"));
if (!input) {
  console.error("usage: ascii-clip.mjs <gif|video> [--cols 72] [--contrast 2.5] [--gamma 1] [--floor 0.08] [--invert] [--loops 4] [--theme dark]");
  process.exit(1);
}
const num = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? dflt : Number(args[i + 1]);
};
const str = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? dflt : args[i + 1];
};
const cropArg = str("crop", null);
const opts = {
  cols: num("cols", 72),
  contrast: num("contrast", 2.5),
  gamma: num("gamma", 1),
  floor: num("floor", 0.08),
  invert: args.includes("--invert"),
  trim: false,
  cutout: false,
  ...(cropArg ? { crop: cropArg.split(",").map(Number) } : {}),
};
const loops = num("loops", 4);
const theme = str("theme", "dark");

const probe = (entries, file) =>
  execFileSync(
    "ffprobe",
    ["-v", "error", "-select_streams", "v", "-show_entries", entries, "-of", "csv=p=0", file],
    { encoding: "utf8" },
  ).trim();

const nbFrames = Number(probe("stream=nb_frames", input));
const durationS = Number(
  execFileSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", input],
    { encoding: "utf8" },
  ).trim(),
);
const clipFps = nbFrames > 0 && durationS > 0 ? nbFrames / durationS : 12;

const tmp = mkdtempSync(path.join(os.tmpdir(), "ascii-clip-"));
execFileSync("ffmpeg", ["-i", input, "-vsync", "0", path.join(tmp, "f_%04d.png"), "-loglevel", "error"]);
const pngs = readdirSync(tmp).filter((f) => f.endsWith(".png")).sort();
console.log(`FRAMES ${pngs.length} @ ${clipFps.toFixed(1)} fps · cols ${opts.cols}`);

const frames = [];
for (const f of pngs) {
  frames.push(await imageToAscii(path.join(tmp, f), { ...opts }));
}
rmSync(tmp, { recursive: true, force: true });

console.log("BUNDLE  src/index.ts");
const serveUrl = await bundleProject();
const inputProps = { frames, clipFps, theme, loops };
const composition = await selectComposition({ serveUrl, id: "AsciiClip", inputProps });
const outDir = path.join(projectDir, "out", "reels");
mkdirSync(outDir, { recursive: true });
const output = path.join(
  outDir,
  `ascii-${path.basename(input).replace(/\.[^.]+$/, "").replace(/\s+/g, "-")}.mp4`,
);
await renderMedia({ composition, serveUrl, codec: "h264", outputLocation: output, inputProps });
console.log(`CLIP  ${output}  ${(asciiSeconds()).toFixed(1)}s`);
function asciiSeconds() {
  return (frames.length * loops) / clipFps;
}
