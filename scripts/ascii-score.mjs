#!/usr/bin/env node
// Scores an ASCII conversion the way a human judges one — on the GRID, never
// on the photograph. The source picked for a moodboard is not the source that
// converts; the character grid is the only thing that ships, so every measure
// below is read off that grid after img2ascii has done its work.
//
//   npm run ascii:score posts/art/almond.jpg
//   node scripts/ascii-score.mjs posts/art/*.jpg --quiet     table only
//   node scripts/ascii-score.mjs <img> --cutout              score the cutout
//
// ── WHAT WAS MEASURED, AND ON WHAT ─────────────────────────────────────────
// Labelled set, 2026-08-05: positives = the 32 stills promoted into
// posts/art/ (someone shipped each one); negatives = the 435 candidates in
// posts/art/_candidates/ that were swept and dropped (exact md5 duplicates of
// promoted files removed from the negative side). Each image was converted at
// 72 cols twice: RAW, and from the cached rembg CUTOUT where one existed
// (29/32 positives, 201/435 negatives — cutouts arrive per sweep, not per
// candidate, so their presence is close to unbiased). Both matter: 43 of the
// 47 art slides ever shipped carry "cutout": true, so the cutout grid is what
// the reader actually sees, while the raw grid is what a batch sweep can
// afford to compute for free.
//
// Single-feature AUC (1.0 = every positive above every negative, 0.5 = coin):
//
//   measure       raw            cutout      keeps its place?
//   border        0.710 (inv)    0.590 (inv)  yes — the strongest raw signal
//   paper         0.670          0.491        raw only; after a cutout every
//                                             candidate has paper around it
//   separation    0.661          0.626        yes (Otsu split of the density
//                                             histogram — mush has none)
//   scale         0.617 (inv)    0.577        NO — flips sign, dropped
//   coverage      0.611 (inv)    0.613        flips sign; kept as a PEAK, not
//                                             a direction: raw walls are too
//                                             dark, cutouts too faint
//   solid         0.554          0.683        yes — best cutout signal
//   subject       0.546 (inv)    0.681        yes on cutout
//   mush          0.558 (inv)    0.680 (inv)  redundant with `solid` (mid-band
//                                             mass vs dark mass) — dropped
//   thickness     0.559 (inv)    0.614        distance-transform mean; noisy,
//                                             subsumed by `chunky` — dropped
//   chunky        0.507          0.637        perimeter/area; cutout only
//   blobs         0.494          0.566 (inv)  too coarse (p50 = 1 both sides)
//   rows          0.505          0.507        DEAD. Grid aspect says nothing.
//
// Dead ends worth not repeating: blob COUNT, grid aspect ratio, and mean ink
// thickness all look like they should work and do not. `scale` (biggest shape
// vs grid) is actively misleading — a full-bleed texture scores maximum on it.
//
// ── HOW WELL IT SEPARATES ──────────────────────────────────────────────────
// Combined score, same labelled set:
//     AUC 0.73 on raw grids (32 pos vs 434 neg)
//     AUC 0.67 on cutout grids (29 pos vs 201 neg)
// So a promoted still beats a dropped candidate about seven times in ten, and
// the pooled ranking is NOT clean: plenty of negatives outscore plenty of
// positives. Read that honestly — this is a shortlist filter, not a judge.
// Part of the gap is the labels: a "negative" is usually the runner-up of a
// sweep that only needed one winner, not a bad conversion.
//
// The number that actually decides the tool is the within-sweep rank: of the
// 10 sweeps in _candidates/ that produced a promotion, the promoted image
// ranks #1 in 8 and top-3 in 8 when scored on the cutout grid (4/10 and 7/10
// on raw — which is why the batch tool cuts out its shortlist before ranking
// it). The two misses are documented failure cases:
//   • pill-bottle.jpg  — ranked #4/4. An amber bottle is a smooth dark
//     cylinder; every measure here rewards that, and the three it lost to are
//     also fine conversions. The human picked on subject, not on conversion.
//   • capsule.jpg      — ranked #5/10. Same shape of failure: a tiny
//     high-contrast pill converts to a small dense blob, and the score cannot
//     tell a good one from nine near-identical ones.
// Both are "several equally convertible candidates, pick by meaning" — which
// is exactly the call left to the human, so the shortlist still works.
//
// ── THE MEASURES ───────────────────────────────────────────────────────────
//   ink       mean ink coverage — an empty grid and a full-bleed wall both fail
//   paper     blank cells — "the paper is the background"
//   clean     ink in the outer ring — a plain background leaves the edge clean
//   subject   ink mass in the largest connected blob — one clear silhouette
//   solid     ink mass that reads dark rather than mid-gray — mush detector
//   shape     area over perimeter — big shapes, not filigree
//   tone      Otsu separability of the density histogram — mush has none
// Combined as a weighted geometric mean, so one catastrophic failure sinks the
// candidate instead of being averaged away by six good numbers.

import path from "node:path";
import { glyphInk, imageToAscii } from "./img2ascii.mjs";

/** 72 columns is the validated sweet spot — score what ships. */
export const SCORE_COLS = 72;

let inkPromise;
const inkMap = () => (inkPromise ??= glyphInk());

/** Ink cells are cells a reader sees as mark rather than paper. */
const INK = 0.08;
/** Above this a cell reads as dark, not as gray filler. */
const SOLID = 0.34;

/**
 * Reads a finished ASCII grid back as densities and measures it.
 * Every number below comes from the grid; the source photo is never touched.
 */
export async function asciiFeatures(text) {
  const ink = await inkMap();
  const rows = text.split("\n").filter((l) => l.length);
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const d = rows.map((r) =>
    Array.from({ length: w }, (_, x) => ink.get(r[x] ?? " ") ?? 0),
  );
  const cells = w * h;

  let total = 0;
  let solidMass = 0;
  let blank = 0;
  const vals = [];
  for (let y = 0; y < h; y += 1)
    for (let x = 0; x < w; x += 1) {
      const v = d[y][x];
      total += v;
      vals.push(v);
      if (v >= SOLID) solidMass += v;
      if (v < 0.02) blank += 1;
    }

  // Outer ring: the margin a receipt reads as paper. Ink here means the
  // background came along for the ride.
  const ring = Math.max(1, Math.round(Math.min(w, h) * 0.06));
  let ringSum = 0;
  let ringCount = 0;
  for (let y = 0; y < h; y += 1)
    for (let x = 0; x < w; x += 1)
      if (y < ring || x < ring || y >= h - ring || x >= w - ring) {
        ringSum += d[y][x];
        ringCount += 1;
      }

  // Largest connected blob of ink, 8-connected, weighted by ink mass — one
  // subject that holds together beats the same ink scattered as confetti.
  const isInk = (y, x) => y >= 0 && x >= 0 && y < h && x < w && d[y][x] >= INK;
  const seen = new Uint8Array(cells);
  const stack = [];
  let biggest = 0;
  let inkCells = 0;
  for (let y0 = 0; y0 < h; y0 += 1)
    for (let x0 = 0; x0 < w; x0 += 1) {
      if (seen[y0 * w + x0] || !isInk(y0, x0)) continue;
      let mass = 0;
      stack.length = 0;
      stack.push(y0 * w + x0);
      seen[y0 * w + x0] = 1;
      while (stack.length) {
        const k = stack.pop();
        const x = k % w;
        const y = (k - x) / w;
        mass += d[y][x];
        inkCells += 1;
        for (let dy = -1; dy <= 1; dy += 1)
          for (let dx = -1; dx <= 1; dx += 1) {
            const ny = y + dy;
            const nx = x + dx;
            if (!isInk(ny, nx)) continue;
            const nk = ny * w + nx;
            if (seen[nk]) continue;
            seen[nk] = 1;
            stack.push(nk);
          }
      }
      if (mass > biggest) biggest = mass;
    }

  // Perimeter share: filigree is nearly all edge, a big shape is not.
  let perim = 0;
  for (let y = 0; y < h; y += 1)
    for (let x = 0; x < w; x += 1) {
      if (!isInk(y, x)) continue;
      if (!isInk(y - 1, x) || !isInk(y + 1, x) || !isInk(y, x - 1) || !isInk(y, x + 1))
        perim += 1;
    }

  // Tonal separation — the best two-class split of the density histogram, as a
  // share of total variance. A mid-gray mush cannot be split.
  const mean = total / cells;
  const varTotal = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / cells;
  let bestSplit = 0;
  for (let t = 0.05; t < 0.9; t += 0.05) {
    let nLo = 0;
    let sLo = 0;
    for (const v of vals)
      if (v < t) {
        nLo += 1;
        sLo += v;
      }
    const nHi = cells - nLo;
    if (!nLo || !nHi) continue;
    const bcv = ((nLo * nHi) / cells ** 2) * (sLo / nLo - (total - sLo) / nHi) ** 2;
    if (bcv > bestSplit) bestSplit = bcv;
  }

  return {
    cols: w,
    rows: h,
    coverage: total / cells,
    paper: blank / cells,
    border: ringCount ? ringSum / ringCount : 0,
    subject: total ? biggest / total : 0,
    solid: total ? solidMass / total : 0,
    chunky: inkCells ? 1 - perim / inkCells : 0,
    separation: varTotal ? bestSplit / varTotal : 0,
  };
}

/** 0 at `at0`, 1 at `at1`, linear between — no plateau, so ranks stay distinct. */
const ramp = (x, at0, at1) => Math.max(0, Math.min(1, (x - at0) / (at1 - at0)));
const peak = (x, ideal, width) => Math.exp(-(((x - ideal) / width) ** 2));

const WEIGHTS = {
  ink: 1,
  paper: 0.8,
  clean: 1.2,
  subject: 1,
  solid: 1.2,
  shape: 0.8,
  tone: 0.8,
};

/** 0..100. Weighted geometric mean — one part near zero sinks the whole. */
export function scoreFeatures(f) {
  const parts = {
    ink: peak(Math.min(f.coverage, 0.45), 0.26, 0.16),
    paper: ramp(f.paper, 0.02, 0.2) * (1 - 0.6 * ramp(f.paper, 0.8, 0.95)),
    clean: 1 - ramp(f.border, 0.05, 0.45),
    subject: ramp(f.subject, 0.35, 0.92),
    solid: ramp(f.solid, 0.35, 0.85),
    shape: ramp(f.chunky, 0.55, 0.88),
    tone: ramp(f.separation, 0.68, 0.9),
  };
  let logSum = 0;
  let weightSum = 0;
  for (const k of Object.keys(parts)) {
    logSum += WEIGHTS[k] * Math.log(Math.max(parts[k], 0.02));
    weightSum += WEIGHTS[k];
  }
  return { score: Math.round(100 * Math.exp(logSum / weightSum)), parts };
}

/** Convert once at 72 cols, then measure and score what came out. */
export async function scoreImage(file, opts = {}) {
  const text = await imageToAscii(file, { cols: SCORE_COLS, ...opts });
  const features = await asciiFeatures(text);
  const { score, parts } = scoreFeatures(features);
  return { file, text, features, parts, score };
}

/** One line on why a grid scored what it scored. */
export const explain = (f, parts) =>
  [
    parts.ink < 0.6 && (f.coverage < 0.2 ? "too faint" : "too dark — reads as a wall"),
    parts.clean < 0.6 && "busy background — ink runs off the edge",
    parts.subject < 0.6 && "no single silhouette — ink is scattered",
    parts.solid < 0.6 && "mid-gray mush — nothing reads as dark",
    parts.tone < 0.6 && "no tonal separation",
    parts.shape < 0.6 && "filigree, not shapes",
    parts.paper < 0.6 && (f.paper > 0.8 ? "mostly empty paper" : "little paper left"),
  ]
    .filter(Boolean)
    .join("; ") || "clean silhouette on paper";

const isCli = import.meta.url === `file://${process.argv[1]}`;
if (isCli) {
  const args = process.argv.slice(2);
  const quiet = args.includes("--quiet");
  const cutout = args.includes("--cutout");
  const files = args.filter((a) => !a.startsWith("--"));
  if (!files.length) {
    console.error("usage: ascii-score.mjs <image…> [--quiet] [--cutout]");
    process.exit(1);
  }
  const rows = [];
  for (const file of files) {
    try {
      const r = await scoreImage(file, { cutout });
      rows.push(r);
      if (!quiet) {
        console.log(`\n─── ${path.basename(file)}  score ${r.score}`);
        console.log(`    ${explain(r.features, r.parts)}`);
        console.log(r.text);
      }
    } catch (e) {
      console.error(`${file}: ${e.message}`);
    }
  }
  rows.sort((a, b) => b.score - a.score);
  console.log("\nSCORE  ink   papr  bord  subj  soli  chnk  tone  file");
  for (const r of rows) {
    const f = r.features;
    console.log(
      `${String(r.score).padStart(5)}  ` +
        [f.coverage, f.paper, f.border, f.subject, f.solid, f.chunky, f.separation]
          .map((v) => v.toFixed(2))
          .join("  ") +
        "  " +
        path.basename(r.file),
    );
  }
}
