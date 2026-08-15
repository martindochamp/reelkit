#!/usr/bin/env node
// Give a black-background screenshot a real alpha channel.
//
//   npm run mockup:alpha posts/mockups/appstore-row.jpg
//
// WHY NOT rembg
//
// `art:find`'s cutout endpoint is a SEGMENTATION model: it decides what
// the subject is. That is the right tool for a photograph of a mussel and
// the wrong one for a UI capture, and the App Store row shows exactly how
// it fails — it dropped "In-App Purchases" and the share icon (low
// contrast, so "not the subject"), left them behind as ghosts at alpha
// under 6 %, and the surviving ink then read 156 px left of frame centre
// because the canvas still counted the empty right third.
//
// A UI capture needs no judgement. Its background is a FLAT COLOUR that
// touches the border, so the background is exactly "the near-black region
// connected to the edge" — a flood fill, not a model. Everything else
// stays, at full fidelity, including the disclosure text.
//
// WHY NO FEATHERING, WHICH IS NORMALLY WRONG
//
// A hard key leaves the anti-aliased ring opaque, and re-compositing that
// ring over a DIFFERENT colour is what makes a bad cut-out look bad. Here
// the source page is #000 and the destination paper is #151412 — both
// near-black, ~21 units apart. The fringe is the source background
// blending into content, so on our paper it is invisible by construction.
// **If a light-paper reel ever needs this, the fringe WILL show and this
// script is the wrong tool.** Every reel is dark today (43 of 43).

import { execFileSync } from "node:child_process";
import path from "node:path";
import { projectDir } from "./stage.mjs";

/** A pixel this dark, reached from the border, is the page. */
const BLACK = 12;

const src = process.argv[2];
if (!src) {
  console.error("usage: reelkit mockup:alpha <file>  (writes <file>.png beside it)");
  process.exit(1);
}
const abs = path.isAbsolute(src) ? src : path.join(process.cwd(), src);
const out = abs.replace(/\.(jpe?g|png)$/i, "") + ".png";

const probe = execFileSync(
  "ffprobe",
  ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0:s=x", abs],
  { encoding: "utf8" },
).trim();
const [W, H] = probe.split("x").map(Number);

const rgb = execFileSync(
  "ffmpeg",
  ["-v", "error", "-i", abs, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
  { maxBuffer: 1 << 28 },
);

const luma = new Uint8Array(W * H);
for (let i = 0; i < W * H; i += 1) {
  luma[i] = Math.round(
    0.2126 * rgb[i * 3] + 0.7152 * rgb[i * 3 + 1] + 0.0722 * rgb[i * 3 + 2],
  );
}

// Flood fill the page from every border pixel. Interior black — the
// barcode inside the app icon — is never reached, which is the whole
// reason this is a fill and not a threshold: a global luma cut would
// punch the barcode straight out of the icon.
const bg = new Uint8Array(W * H);
const stack = [];
const push = (x, y) => {
  const i = y * W + x;
  if (!bg[i] && luma[i] <= BLACK) {
    bg[i] = 1;
    stack.push(i);
  }
};
for (let x = 0; x < W; x += 1) {
  push(x, 0);
  push(x, H - 1);
}
for (let y = 0; y < H; y += 1) {
  push(0, y);
  push(W - 1, y);
}
while (stack.length) {
  const i = stack.pop();
  const x = i % W;
  const y = (i - x) / W;
  if (x > 0) push(x - 1, y);
  if (x < W - 1) push(x + 1, y);
  if (y > 0) push(x, y - 1);
  if (y < H - 1) push(x, y + 1);
}

// Crop to the ink, so the element centres on what is actually visible
// rather than on a canvas with an empty third.
let x0 = W;
let x1 = -1;
let y0 = H;
let y1 = -1;
for (let y = 0; y < H; y += 1) {
  for (let x = 0; x < W; x += 1) {
    if (bg[y * W + x]) continue;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
}
const cw = x1 - x0 + 1;
const ch = y1 - y0 + 1;

const rgba = Buffer.alloc(cw * ch * 4);
for (let y = 0; y < ch; y += 1) {
  for (let x = 0; x < cw; x += 1) {
    const s = (y + y0) * W + (x + x0);
    const d = (y * cw + x) * 4;
    rgba[d] = rgb[s * 3];
    rgba[d + 1] = rgb[s * 3 + 1];
    rgba[d + 2] = rgb[s * 3 + 2];
    rgba[d + 3] = bg[s] ? 0 : 255;
  }
}

execFileSync(
  "ffmpeg",
  [
    "-hide_banner", "-loglevel", "error", "-y",
    "-f", "rawvideo", "-pix_fmt", "rgba", "-s", `${cw}x${ch}`, "-i", "pipe:0",
    "-frames:v", "1", out,
  ],
  { input: rgba, stdio: ["pipe", "pipe", "inherit"] },
);

const kept = cw * ch - rgba.filter((_, i) => i % 4 === 3).length;
let opaque = 0;
for (let i = 3; i < rgba.length; i += 4) if (rgba[i]) opaque += 1;
console.log(
  `ALPHA ${path.relative(projectDir, out)}  ${W}x${H} → ${cw}x${ch} ` +
    `(cropped ${W - cw} x ${H - ch} of page), ` +
    `${((100 * opaque) / (cw * ch)).toFixed(1)} % opaque`,
);
