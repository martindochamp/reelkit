#!/usr/bin/env node
// Animated specimen from a still we already license — the first-party
// answer to clips-find.mjs. A `clip` beat never ships a source pixel:
// render-reel.mjs runs every frame through imageToAscii and prints the
// result in Tally's own font, so a clip only has to hold a readable
// SILHOUETTE IN MOTION. Photographic fidelity is thrown away by the
// converter, which is exactly why generating our own is cheap — and why
// the provenance comes for free: the source is a row in
// posts/art/LICENSES.md and nothing else enters the pipeline.
//
//   npm run clips:make "capsule"
//   npm run clips:make "capsule" -- --motion bob --cutout
//   npm run clips:make "duck" -- --motion spin --frames 25 --fps 12.5 --out duck-turn
//
// Motions, all one full period long so frame N meets frame 0 with no seam:
//   sway   a slow rock, ±12°              — tips the whole outline, keeps
//                                           the subject the right way up
//   spin   one full turn                  — moves most, but the subject
//                                           spends half the loop inverted
//   bob    a float, ±10 % of the long edge — the clearest translation, and
//                                           the only one that adds height
//   push   a push-in and back, +22 %      — the mass breathes; no drift
//
// Measured after conversion on a dumbbell (64 cols, 25 frames): sway moves
// the ink box ±3-4 cells, spin ±11-13, bob ±7 rows, push holds the box and
// swings the ink mass by ±231 glyphs. All four beat the Giphy stickers they
// replace, which move ±1 cell or less once converted.
//
// The judgment happens on the converted result, never on the GIF: the
// frames printed here are the real conversion, and the numbers under them
// say whether the motion survived it.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { cutoutFile, imageToAscii } from "./img2ascii.mjs";
import { postsDir } from "./stage.mjs";

const args = process.argv.slice(2);
const name = args.find((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));
if (!name) {
  console.error(
    'usage: clips-make.mjs "<art name>" [--motion sway|spin|bob|push] [--frames 25]\n' +
      "       [--fps 12.5] [--amount <n>] [--size 480] [--cols 64] [--cutout] [--out <name>]",
  );
  process.exit(1);
}
const num = (key, dflt) => {
  const i = args.indexOf(`--${key}`);
  return i === -1 ? dflt : Number(args[i + 1]);
};
const str = (key, dflt) => {
  const i = args.indexOf(`--${key}`);
  return i === -1 ? dflt : args[i + 1];
};

// One full period at 12.5 fps is exactly 2 s and exactly 8 centiseconds a
// frame — GIF delays are integer centiseconds, so an fps that does not
// divide 100 is rounded by the muxer and the loop drifts.
const motion = str("motion", "sway");
const frames = num("frames", 25);
const fps = num("fps", 12.5);
const size = num("size", 480);
const cols = num("cols", 64);
const cutout = args.includes("--cutout");
const out = str("out", `${name}-${motion}`);

// Each motion is a function of the loop phase p ∈ [0,1) returning the
// frame's transform. One full period, so frame N would be frame 0 again.
// `dy` is a fraction of the subject's long edge; the canvas is measured
// from the extremes below, never assumed square.
const MOTIONS = {
  sway: {
    amount: 12, // degrees
    at: (p, a) => ({ rotate: a * Math.sin(2 * Math.PI * p) }),
  },
  spin: {
    amount: 360,
    at: (p, a) => ({ rotate: a * p }),
  },
  bob: {
    amount: 0.1, // of the subject's long edge
    at: (p, a) => ({ dy: a * Math.sin(2 * Math.PI * p) }),
  },
  push: {
    amount: 0.22,
    at: (p, a) => ({ scale: 1 + (a * (1 - Math.cos(2 * Math.PI * p))) / 2 }),
  },
};
if (!MOTIONS[motion]) {
  console.error(`unknown motion "${motion}" — one of ${Object.keys(MOTIONS).join(", ")}`);
  process.exit(1);
}
const spec = MOTIONS[motion];
const amount = num("amount", spec.amount);

// The source is a licensed still in posts/art/ — by bare name, by file
// name, or by path. --cutout takes the rembg derivative img2ascii already
// caches next to it (<name>.cutout.png), which is what puts paper around
// the subject instead of a photographed table.
let src = existsSync(name) ? name : path.join(postsDir, "art", name);
if (!existsSync(src)) src = path.join(postsDir, "art", `${name}.jpg`);
if (!existsSync(src)) {
  console.error(`still "${name}" not found in posts/art/`);
  process.exit(1);
}
if (cutout) src = await cutoutFile(src);

// Paper around the subject, the same bar as an art slide: the widest
// frame of the cycle still leaves a margin.
const FILL = 0.92;

// The mask IS the subject. rembg does not return a clean cut: around
// test-tube.cutout.png it left a shadow smear at alpha 13–91 beside a
// tube at alpha 254, and every ordinary trim keeps it, because it is
// neither transparent nor white. That smear cost half the canvas and put
// the tube a quarter-frame right of centre — and a subject centred on
// its own shadow also rotates off-axis. So cut the alpha at 50 %: below
// that is not coverage, it is a halo. The hard edge costs nothing, since
// what ships is 20 to 72 glyphs a line.
//
// A source with no alpha (a plain .jpg, no --cutout) has no mask to cut,
// and falls back to the converter's own paper threshold — anything paler
// than `floor` is what imageToAscii would print as paper anyway.
const ALPHA = 128;
const PAPER = Math.round(255 * (1 - 0.08));
const hasAlpha = (await sharp(src).metadata()).hasAlpha;

// Done on the raw pixels, not through a chain of sharp operators: the
// obvious spelling (removeAlpha().joinChannel(mask)) hands back three
// channels with the mask filed as COLOUR, which flattens to a solid
// rectangle — and a solid rectangle converts to a perfectly plausible
// block of glyphs, so it does not announce itself.
const { data: rgba, info } = await sharp(src)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const flatData = Buffer.alloc(info.width * info.height * 3, 255);
let top = info.height, bottom = -1, left = info.width, right = -1;
for (let y = 0; y < info.height; y += 1) {
  for (let x = 0; x < info.width; x += 1) {
    const p = (y * info.width + x) * info.channels;
    const a = hasAlpha ? rgba[p + 3] : 255;
    const q = (y * info.width + x) * 3;
    if (a >= ALPHA) {
      // Over paper, so a soft edge stays soft instead of fringing dark.
      for (let c = 0; c < 3; c += 1) {
        flatData[q + c] = Math.round((rgba[p + c] * a + 255 * (255 - a)) / 255);
      }
    }
    const inked = hasAlpha ? a >= ALPHA : rgba[p] < PAPER;
    if (!inked) continue;
    if (y < top) top = y;
    if (y > bottom) bottom = y;
    if (x < left) left = x;
    if (x > right) right = x;
  }
}
const flat = sharp(flatData, {
  raw: { width: info.width, height: info.height, channels: 3 },
});
const base =
  right - left > 8 && bottom - top > 8
    ? await flat
        .extract({ left, top, width: right - left + 1, height: bottom - top + 1 })
        .png()
        .toBuffer()
    : await flat.png().toBuffer();
const meta = await sharp(base).metadata();

// The canvas is measured from the cycle, not guessed: every frame's
// bounding box is known in closed form, so the widest and tallest moment
// of the motion sets the frame — a square canvas would spend half the
// character grid on paper for a wide subject. Every frame keeps the same
// geometry, which is what stops the specimen from trembling once
// render-reel converts it with trim off.
const steps = Array.from({ length: frames }, (_, i) => spec.at(i / frames, amount));
const box = ({ rotate = 0, scale = 1, dy = 0 }) => {
  const r = Math.abs((rotate * Math.PI) / 180);
  const w = meta.width * scale;
  const h = meta.height * scale;
  return {
    w: w * Math.abs(Math.cos(r)) + h * Math.abs(Math.sin(r)),
    h: h * Math.abs(Math.cos(r)) + w * Math.abs(Math.sin(r)) + 2 * Math.abs(dy) * Math.max(meta.width, meta.height),
  };
};
const boxes = steps.map(box);
const spanW = Math.max(...boxes.map((b) => b.w)) / FILL;
const spanH = Math.max(...boxes.map((b) => b.h)) / FILL;
const k = size / Math.max(spanW, spanH);
const canvasW = Math.round(spanW * k);
const canvasH = Math.round(spanH * k);
const fitted = await sharp(base)
  .resize(Math.round(meta.width * k), Math.round(meta.height * k))
  .png()
  .toBuffer();

console.log(
  `CLIPS:MAKE  ${path.relative(process.cwd(), src)} → ${motion} ${amount}` +
    `  ${canvasW}×${canvasH}  ${frames} frames @ ${fps} fps  (${(frames / fps).toFixed(2)}s loop)`,
);

const tmp = mkdtempSync(path.join(os.tmpdir(), "clips-make-"));
for (const [i, step] of steps.entries()) {
  const { rotate = 0, scale = 1, dy = 0 } = step;
  let layer = sharp(fitted);
  if (scale !== 1) {
    const m = await sharp(fitted).metadata();
    layer = layer.resize(Math.round(m.width * scale), Math.round(m.height * scale));
  }
  if (rotate !== 0) {
    layer = layer.rotate(rotate, { background: { r: 255, g: 255, b: 255 } });
  }
  const buf = await layer.png().toBuffer();
  const lm = await sharp(buf).metadata();
  await sharp({
    create: {
      width: canvasW,
      height: canvasH,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite([
      {
        input: buf,
        left: Math.round((canvasW - lm.width) / 2),
        top: Math.round(
          (canvasH - lm.height) / 2 + dy * Math.max(meta.width, meta.height) * k,
        ),
      },
    ])
    .png()
    .toFile(path.join(tmp, `f_${String(i + 1).padStart(4, "0")}.png`));
}

// Two-pass palette so the silhouette edge stays hard — a global palette
// banded the subject into the paper on the first try. Bayer at a fine
// scale keeps the dither under the converter's 2 × 3 subsampling.
mkdirSync(path.join(postsDir, "clips"), { recursive: true });
const gif = path.join(postsDir, "clips", `${out}.gif`);
const palette = path.join(tmp, "palette.png");
execFileSync("ffmpeg", [
  "-i", path.join(tmp, "f_%04d.png"),
  "-vf", "palettegen=stats_mode=diff",
  "-y", palette,
  "-loglevel", "error",
]);
execFileSync("ffmpeg", [
  "-framerate", String(fps),
  "-i", path.join(tmp, "f_%04d.png"),
  "-i", palette,
  "-lavfi", "paletteuse=dither=bayer:bayer_scale=5",
  "-loop", "0",
  "-y", gif,
  "-loglevel", "error",
]);

// Verify on the real path, not on the GIF: extract exactly the way
// render-reel.mjs does and convert with trim off, as the clip beat does.
const check = mkdtempSync(path.join(os.tmpdir(), "clips-make-check-"));
execFileSync("ffmpeg", ["-i", gif, "-vsync", "0", path.join(check, "c_%04d.png"), "-loglevel", "error"]);
const shots = readdirSync(check).filter((f) => f.endsWith(".png")).sort();
const ascii = [];
for (const f of shots) {
  ascii.push(await imageToAscii(path.join(check, f), { cols, trim: false, cutout: false }));
}
rmSync(tmp, { recursive: true, force: true });
rmSync(check, { recursive: true, force: true });

// How much of the grid actually moves — and two numbers, because they
// are not the same thing. GLYPHS counts every cell that swapped
// character: a subject can churn 20 % of its interior between two frames
// and read as a still specimen boiling in place, which is worse than no
// motion at all. EDGE counts cells that crossed between ink and paper —
// the silhouette moving, which is the only motion that survives the
// converter. Judge on EDGE.
const changed = (a, b, mask) => {
  let n = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
    if (mask ? (a[i] === " ") !== (b[i] === " ") : a[i] !== b[i]) n += 1;
  }
  return n;
};
const cells = ascii[0].replace(/\n/g, "").length;
const deltas = ascii.map((f, i) => changed(f, ascii[(i + 1) % ascii.length]));
const edges = ascii.map((f, i) => changed(f, ascii[(i + 1) % ascii.length], true));
const mean = deltas.reduce((s, d) => s + d, 0) / deltas.length;
const edge = edges.reduce((s, d) => s + d, 0) / edges.length;
// The last delta IS the loop point. A sine takes its biggest step at the
// zero crossing, which is where the loop sits — so the seam is judged
// against the largest ordinary step, never against the mean.
const seam = deltas[deltas.length - 1];
const worst = Math.max(...deltas.slice(0, -1));

console.log(`\nFRAME 1/${ascii.length}\n${ascii[0]}`);
const mid = Math.floor(ascii.length / 2);
console.log(`\nFRAME ${mid + 1}/${ascii.length}\n${ascii[mid]}`);
// The grid shape is the one number the reel cares about. ReelElements
// sizes a clip at min(stageWidth / cols, maxHeight / rows), so a block
// taller than the stage is height-bound at EVERY cols — and since rows
// scale with cols, the type only gets bigger as cols comes down. A
// slender subject therefore wants a LOW cols in the beat, not a high
// one. Rotation is the other lever, and it cuts the other way: it
// squares the canvas up, which fixes the row count but spends the new
// width on paper. Keep the canvas shaped like the subject.
const gridRows = ascii[0].split("\n").length;
const suggest = Math.round(40 / ((gridRows / cols) || 1));
console.log(
  `\nGRID    ${cols} × ${gridRows} cells` +
    `${gridRows > 45 ? `  — tall; the beat wants about "cols": ${suggest}, not ${cols}` : ""}` +
    `\nGLYPHS  ${mean.toFixed(0)} of ${cells} change per frame ` +
    `(${((mean / cells) * 100).toFixed(1)} %)` +
    `\nEDGE    ${edge.toFixed(0)} cross ink↔paper (${((edge / cells) * 100).toFixed(1)} %)` +
    `${edge / cells < 0.01 ? "  — under 1 %, the silhouette sits still" : ""}` +
    `\nSEAM    ${seam} across the loop point, largest ordinary step ${worst}` +
    `${seam <= worst * 1.15 ? " — no jump" : "  — JUMP, the loop will tick"}`,
);
console.log(
  `\nCLIP  ${path.relative(process.cwd(), gif)}\n` +
    `Provenance: the source still's row in posts/art/LICENSES.md covers it — ` +
    `nothing third-party entered.\n` +
    `In a beat: { "type": "clip", "file": "${out}.gif", "cols": ${cols}, … }`,
);
