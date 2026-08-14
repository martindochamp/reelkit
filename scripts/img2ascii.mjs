#!/usr/bin/env node
// Image → ASCII for the receipt system, after alexharri.com/blog/ascii-rendering.
//
// Not a luminance ramp: every printable glyph is rasterized in the slide's own
// mono font and measured over six sampling regions (2 × 3 per cell). Each image
// cell is reduced to the same six-region darkness vector and matched to the
// nearest glyph in 6-D space — so edges pick /, \, |, _ on their own, and
// density falls out of measured ink coverage instead of a hand-ordered ramp.
//
// Darkness is ink. The same glyphs print in light and dark theme; only paper
// and ink swap, exactly like the app. Transparent pixels flatten to white.
//
// CLI preview:  node scripts/img2ascii.mjs <image> [--cols 64] [--contrast 2.5]
//               [--gamma 1] [--floor 0.08] [--invert] [--no-trim] [--cutout]
// Library:      imageToAscii(file, { cols, contrast, gamma, invert })

import { existsSync, writeFileSync } from "node:fs";
import sharp from "sharp";

// The example rembg sidecar (u2net). Decodes PNG/WebP only; nginx caps
// the body around 1 MB — sources are normalised to a ≤768 px PNG before the
// call. The result is cached next to the source as <name>.cutout.png, so the
// network is hit once per image, ever, and renders stay reproducible offline.
const REMOVE_BG_URL = `${
  process.env.BG_REMOVAL_API_URL || "https://bg.example.com"
}/api/v1/icons/remove-bg`;

export async function cutoutFile(file) {
  const cached = file.replace(/\.[^.]+$/, "") + ".cutout.png";
  if (existsSync(cached)) return cached;
  let png;
  for (const edge of [768, 640, 512, 400]) {
    png = await sharp(file)
      .resize(edge, edge, { fit: "inside", withoutEnlargement: true })
      .png({ compressionLevel: 8 })
      .toBuffer();
    if (png.length <= 900_000) break;
  }
  const res = await fetch(REMOVE_BG_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: png.toString("base64"), mime_type: "image/png" }),
  });
  if (!res.ok) throw new Error(`remove-bg ${res.status} for ${file}`);
  const { image } = await res.json();
  if (!image) throw new Error(`remove-bg returned no image for ${file}`);
  writeFileSync(cached, Buffer.from(image, "base64"));
  return cached;
}

// A char cell in the slide's SF Mono block is 0.6 em wide × 1 em tall
// (SF Mono's advance is exactly 600/1000 em), so rows are squeezed by 0.6.
const CHAR_ASPECT = 0.6;

// Sampling grid per cell — 2 columns × 3 rows, near-square subregions.
const SUB_X = 2;
const SUB_Y = 3;

// Glyph raster size. 60 × 100 keeps the 0.6 cell aspect at high resolution.
const GLYPH_W = 60;
const GLYPH_H = 100;
// Baseline sits at ~78 % of the line box for SF Mono / Menlo at 1.0 line height.
const BASELINE = 0.78;

// Printable ASCII. $ and \ need escaping nowhere here; " and & do in SVG.
const CHARSET = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i));

const svgEscape = (ch) =>
  ch === "&" ? "&amp;" : ch === "<" ? "&lt;" : ch === '"' ? "&quot;" : ch;

/** Average darkness (0..1) of each 2×3 subregion of a raster. */
const regionVector = (data, width, height) => {
  const sums = new Float64Array(SUB_X * SUB_Y);
  const counts = new Float64Array(SUB_X * SUB_Y);
  for (let y = 0; y < height; y += 1) {
    const sy = Math.min(SUB_Y - 1, Math.floor((y / height) * SUB_Y));
    for (let x = 0; x < width; x += 1) {
      const sx = Math.min(SUB_X - 1, Math.floor((x / width) * SUB_X));
      const k = sy * SUB_X + sx;
      sums[k] += 1 - data[y * width + x] / 255;
      counts[k] += 1;
    }
  }
  return Array.from(sums, (s, k) => s / counts[k]);
};

let charsetPromise;

/** Rasterize every glyph once and measure its six-region ink coverage. */
const buildCharset = () => {
  charsetPromise ??= Promise.all(
    CHARSET.map(async (ch) => {
      const svg = Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${GLYPH_W}" height="${GLYPH_H}">` +
          `<rect width="${GLYPH_W}" height="${GLYPH_H}" fill="white"/>` +
          `<text x="${GLYPH_W / 2}" y="${GLYPH_H * BASELINE}" ` +
          `font-family="SF Mono, Menlo, monospace" font-size="${GLYPH_H}" ` +
          `text-anchor="middle" fill="black">${svgEscape(ch)}</text></svg>`,
      );
      const { data } = await sharp(svg)
        .grayscale()
        .raw()
        .toBuffer({ resolveWithObject: true });
      return { ch, vector: regionVector(data, GLYPH_W, GLYPH_H) };
    }),
  ).then((glyphs) => {
    // Stretch the whole set so the densest glyph reaches 1 — image cells use
    // the full 0..1 range and tone mapping stays linear between glyphs.
    const max = Math.max(...glyphs.flatMap((g) => g.vector));
    for (const g of glyphs) g.vector = g.vector.map((v) => v / max);
    return glyphs;
  });
  return charsetPromise;
};

/**
 * Measured ink coverage (0..1) of every printable glyph, keyed by character —
 * the same measurement the matcher uses, exposed so a caller can read a
 * finished ASCII grid back as densities. Space is 0, `@`/`#` near 1.
 */
export async function glyphInk() {
  const glyphs = await buildCharset();
  return new Map(
    glyphs.map((g) => [g.ch, g.vector.reduce((a, b) => a + b, 0) / g.vector.length]),
  );
}

export async function imageToAscii(
  file,
  {
    cols = 64,
    contrast = 2.5,
    gamma = 1,
    floor = 0.08,
    invert = false,
    trim = true,
    cutout = false,
    crop,
  } = {},
) {
  const glyphs = await buildCharset();
  if (cutout) file = await cutoutFile(file);

  // Optional framing before anything else: crop = [x, y, w, h] as fractions
  // of the source — a busy pile becomes three clear shapes.
  let framed = sharp(file);
  if (crop) {
    const m = await framed.metadata();
    framed = framed.extract({
      left: Math.round(m.width * crop[0]),
      top: Math.round(m.height * crop[1]),
      width: Math.round(m.width * crop[2]),
      height: Math.round(m.height * crop[3]),
    });
  }

  // Crop dead margin around the subject so it fills the character grid —
  // a pile centered in a 4:3 photo would otherwise print at half width.
  // Full-bleed textures survive: trimming nothing leaves the image as is.
  let src = await framed
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .toBuffer();
  if (trim) {
    try {
      const { data, info } = await sharp(src)
        .trim({ threshold: 30 })
        .toBuffer({ resolveWithObject: true });
      if (info.width > 8 && info.height > 8) src = data;
    } catch {
      // sharp throws when the whole frame would be trimmed — keep the original.
    }
  }

  const meta = await sharp(src).metadata();
  const rows = Math.max(
    1,
    Math.round((meta.height / meta.width) * cols * CHAR_ASPECT),
  );

  const width = cols * SUB_X;
  const height = rows * SUB_Y;
  const { data } = await sharp(src)
    .resize(width, height, { fit: "fill" })
    .grayscale()
    .normalise()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Darkness per subsample, 0 paper … 1 full ink.
  // Darkness below the floor is paper — vignetting and soft shadows in the
  // source must not print; a receipt has no pale gray.
  const dark = new Float64Array(width * height);
  for (let i = 0; i < data.length; i += 1) {
    const bright = invert ? 1 - data[i] / 255 : data[i] / 255;
    const d = (1 - bright) ** gamma;
    dark[i] = d < floor ? 0 : (d - floor) / (1 - floor);
  }

  const cell = (cx, cy, sx, sy) => dark[(cy * SUB_Y + sy) * width + cx * SUB_X + sx];

  // Contrast crunch, directional: each component normalizes against the max of
  // its own cell AND the neighboring components just across the cell border,
  // so faint halos around a strong edge get crushed and silhouettes stay hard.
  const enhanced = (cx, cy) => {
    const v = [];
    let cellMax = 0;
    for (let sy = 0; sy < SUB_Y; sy += 1)
      for (let sx = 0; sx < SUB_X; sx += 1) {
        const d = cell(cx, cy, sx, sy);
        v.push(d);
        if (d > cellMax) cellMax = d;
      }
    return v.map((d, k) => {
      const sx = k % SUB_X;
      const sy = (k - sx) / SUB_X;
      let m = cellMax;
      if (sx === 0 && cx > 0) m = Math.max(m, cell(cx - 1, cy, SUB_X - 1, sy));
      if (sx === SUB_X - 1 && cx < cols - 1) m = Math.max(m, cell(cx + 1, cy, 0, sy));
      if (sy === 0 && cy > 0) m = Math.max(m, cell(cx, cy - 1, sx, SUB_Y - 1));
      if (sy === SUB_Y - 1 && cy < rows - 1) m = Math.max(m, cell(cx, cy + 1, sx, 0));
      return m > 0 ? ((d / m) ** contrast) * m : 0;
    });
  };

  const lines = [];
  for (let cy = 0; cy < rows; cy += 1) {
    let line = "";
    for (let cx = 0; cx < cols; cx += 1) {
      const v = enhanced(cx, cy);
      let best = " ";
      let bestDist = Infinity;
      for (const g of glyphs) {
        let dist = 0;
        for (let k = 0; k < v.length; k += 1) {
          const d = v[k] - g.vector[k];
          dist += d * d;
        }
        if (dist < bestDist) {
          bestDist = dist;
          best = g.ch;
        }
      }
      line += best;
    }
    lines.push(line);
  }
  return lines.join("\n");
}

const isCli = import.meta.url === `file://${process.argv[1]}`;
if (isCli) {
  const args = process.argv.slice(2);
  const num = (name, fallback) => {
    const i = args.indexOf(`--${name}`);
    return i === -1 ? fallback : Number(args[i + 1]);
  };
  const file = args.find((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));
  if (!file) {
    console.error(
      "usage: img2ascii.mjs <image> [--cols 64] [--contrast 2.5] [--gamma 1] [--floor 0.08] [--invert] [--no-trim] [--cutout]",
    );
    process.exit(1);
  }
  console.log(
    await imageToAscii(file, {
      cols: num("cols", 64),
      contrast: num("contrast", 2.5),
      gamma: num("gamma", 1),
      floor: num("floor", 0.08),
      invert: args.includes("--invert"),
      trim: !args.includes("--no-trim"),
      cutout: args.includes("--cutout"),
    }),
  );
}
