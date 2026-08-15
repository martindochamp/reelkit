#!/usr/bin/env node
// Renders post covers — the still that sells a post on a GRID.
//
//   npm run cover                 every post that can produce one
//   npm run cover creatine zn     just these
//   npm run cover -- --posted     only what is shipped or posted
//
// Output: out/covers/<post>.png at 1080×1920, plus out/covers/proof/<post>.png,
// a contact sheet showing the same file as every surface actually crops it —
// once at the device pixels a phone paints, once at the ACUITY size an eye
// actually resolves. The proof is the judgement: if the headline does not read
// on the acuity strip, the cover is not done. And _grid-N.png is the second
// judgement, the one no single tile can make — a screenful of profile, where
// twelve covers built the same way read as wallpaper.
//
// A post carries an optional `cover` block; without one the cover is derived
// from the brief and the first hook, so every post in the bank has a tile.

import { mkdirSync, readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { bundleProject } from "./bundle.mjs";
import { renderStill, selectComposition } from "@remotion/renderer";
import sharp from "sharp";
import { config } from "./project.mjs";
import { projectDir, postsDir } from "./stage.mjs";
import { glyphInk, imageToAscii } from "./img2ascii.mjs";
import {
  COVER_BOX_W,
  COVER_HEIGHT as COVER_H,
  COVER_SAFE_BOTTOM as SAFE_BOTTOM,
  COVER_SAFE_TOP as SAFE_TOP,
  COVER_WIDTH as COVER_W,
  GLYPH_ADVANCE,
  ROWS_TYPE_MIN,
  TILE_H,
  TILE_TOP,
  acuityPx,
  SPECIMEN_COLS_PROBE,
  SPECIMEN_COLS_MIN,
  SPECIMEN_COLS_MAX,
  SPECIMEN_COLS_TARGET,
  SPECIMEN_FILL_MIN,
  SPECIMEN_INK_MIN,
  SPECIMEN_GLYPH_MIN,
  SPECIMEN_GLYPH_MAX,
  figureBox,
  figureMaxH,
  headlineBudget,
  layoutCover,
  specimenCols,
  tilePt,
} from "../src/cover-fit.mjs";

const outRoot = path.join(projectDir, "out", "covers");
const proofRoot = path.join(outRoot, "proof");
const tileRoot = path.join(outRoot, "tile");
const stageDir = path.join(projectDir, "public", "covers");

/**
 * The surfaces a cover is actually judged on, and what each takes out of the
 * 1080×1920 file. `ratio` is width ÷ height; `pt` is how wide the tile stands
 * on a 390-pt handset. All CENTRE crops — measured in a headless Chrome at
 * 430×932 / DPR 3 against the live DOM, not read off a spec sheet, because
 * neither platform publishes one. Instagram paints its tiles with
 * `object-fit: cover; object-position: 50% 50%`, which settles the anchor.
 *
 * The feed is deliberately absent. In the For You feed and the Reels feed
 * the video autoplays: no click, no thumbnail, and the reel's own first
 * frame is what stops the scroll there.
 */
const COVER_CROPS = [
  // 142.7 × 189.8 measured, 120 tiles.
  { id: "tt-profile", label: "TikTok profile · 3:4", ratio: 0.7515, pt: 130 },
  // 203 × 272 measured — TWO columns, so search shows a bigger tile than
  // the grid does, and the caption sits below the artwork, not over it.
  { id: "tt-search", label: "TikTok search · 2 up", ratio: 0.7463, pt: 184 },
  // 142 × 190 measured, 84 tiles. 3:4 since Instagram left the square grid
  // in January 2025.
  { id: "ig-profile", label: "Instagram profile · 3:4", ratio: 0.7474, pt: 130 },
  // NOT MEASURED — logged-out Explore redirects to the login wall and no
  // official page states the tile. Square for years, so the square is what
  // the safe band is drawn against. This column is the worst case, and the
  // reason nothing readable sits outside rows 420–1500.
  { id: "ig-explore", label: "IG Explore · 1:1 (unverified)", ratio: 1, pt: 130 },
];

/* ── the spec ─────────────────────────────────────────────────────────── */

const firstOf = (slides, pred) => slides.find(pred);

/**
 * Lab elements that survive being a specimen: the ones whose meaning is a
 * SHAPE. A flow diagram or a comparison table is prose in boxes — scaled
 * into a cover band its own 30 px labels land near 2 pt, which is dust with
 * a border. Those elements are excellent slides and bad tiles.
 *
 * And a shape is the register that survives BEST, for a physical reason: a
 * lab element is drawn from shapes, an ASCII specimen from letterforms. A
 * solid block of ink is still a block at 4 px; a glyph at 4 px is a smudge.
 * That is why the unit grids held the contact sheet while the low-column
 * specimens collapsed, and it is why this list is consulted before the art.
 *
 * Ordered — first match wins, so this doubles as the preference. A quantity
 * made countable beats a bar pair beats a meter beats a duel.
 */
const SHAPE_ELEMENTS = [
  "unitgrid",
  "compositionbar",
  "threshold",
  "barchart",
  "simplepie",
  "pie",
  "odometer",
  "calendar",
  "sparkline",
  "linechart",
  "molecule",
];

/**
 * A cover from the post itself. The `cover` block wins; without one the
 * headline comes from the first hook (which is already the scroll-stopper,
 * written for exactly this job) and the specimen from the first figure the
 * post prints. Trimmed hard: a cover carries fewer words than a slide, so
 * a hook longer than the fitter's floor gets its first sentence only.
 */
const deriveCover = (post, name) => {
  if (post.cover) return post.cover;

  const slides = post.slides ?? [];
  const beats = post.reel?.beats ?? [];

  const hook =
    firstOf(slides, (s) => s.type === "hook") ??
    beats.map((b) => b.screen).find((s) => s?.type === "title");
  const stat =
    firstOf(slides, (s) => s.type === "statement") ??
    beats.map((b) => b.screen).find((s) => s?.type === "stat");

  let text = hook?.text ?? post.brief?.topic ?? name;
  // One sentence. A hook slide is allowed two; a tile is not.
  const stop = text.search(/[.?!]\s+\S/);
  if (stop > 20) text = text.slice(0, stop + 1);
  text = text.replace(/\s+/g, " ").trim();

  const art = firstOf(slides, (s) => s.type === "art");
  // THE POST'S OWN INSTRUMENT. A reel carries its elements as `lab` screens
  // and the slideshow carries the same ones as `element` slides — read both,
  // reel first, because the tile's job is to preview the instrument the video
  // actually runs. A cover advertising a chart the viewer never sees is a
  // promise the post does not keep.
  const ownElements = [
    ...beats
      .map((b) => b.screen)
      .filter((s) => s?.type === "lab")
      .map((s) => ({ element: s.element, props: s.props, frame: s.frame })),
    ...slides
      .filter((s) => s.type === "element")
      .map((s) => ({ element: s.element, props: s.props, frame: s.frame })),
  ];
  const element = SHAPE_ELEMENTS.flatMap((kind) =>
    ownElements.filter((e) => e.element === kind),
  )[0];
  const lines = firstOf(slides, (s) => s.type === "lines" && s.rows?.length >= 2);
  const figure = beats.map((b) => b.screen).find((s) => s?.type === "figure");

  // `cols` is deliberately NOT inherited: a slide's 72 columns resolve on a
  // full screen and dissolve into grey on a tile. The cover picks its own.
  const asArt = (s) => ({
    type: "art",
    image: s.image,
    contrast: s.contrast,
    gamma: s.gamma,
    floor: s.floor,
    invert: s.invert,
    cutout: s.cutout,
    crop: s.crop,
  });

  // Shapes before letterforms. The art register still exists and still wins
  // when a post has no instrument — but a specimen has to earn a tile, and
  // the sweep says most of the bank's photographs do not (SPECIMENS.md).
  let specimen;
  if (element) {
    specimen = {
      type: "element",
      element: element.element,
      props: element.props ?? {},
      frame: element.frame,
    };
  } else if (art) {
    specimen = asArt(art);
  } else if (figure) {
    specimen = asArt(figure);
  } else if (lines) {
    specimen = { type: "rows", rows: lines.rows.slice(0, 2) };
  }

  // One visual anchor per tile (cover-fit.mjs, layoutCover). A hero token
  // earns its place only when the headline is short enough to sit beside
  // it; otherwise the specimen carries the tile and the number goes back
  // into the prose where the post already has it.
  const bare = text.replace(/\*/g, "");
  const value = stat?.value && bare.length <= 26 ? stat.value : null;
  return {
    text,
    ...(value ? { value } : {}),
    ...(specimen && !value ? { specimen } : {}),
    ...(!specimen && !value && stat?.value ? { value: stat.value } : {}),
  };
};

/* ── the legibility audit ─────────────────────────────────────────────── */

/**
 * A cover always renders. Whether it can be READ at 128 pt is a different
 * question, and one the render cannot answer by looking — so run the same
 * arithmetic the still draws with and say so out loud, the way the tier
 * list's audit does. It warns, it never blocks: the call is a judgement.
 */
/**
 * Mean ink coverage of a finished ASCII grid, on the converter's own measured
 * scale. The single number that predicted the 1× eye test.
 */
const INK = await glyphInk();
const asciiInk = (ascii) => {
  let sum = 0;
  let n = 0;
  for (const ch of ascii) {
    if (ch === "\n") continue;
    sum += INK.get(ch) ?? 0;
    n += 1;
  }
  return n ? sum / n : 0;
};

const auditCover = (cover, name) => {
  const out = [];
  const L = layoutCover(cover);
  if (!L.fitted) {
    const words = cover.text.replace(/\*/g, "").split(/\s+/).filter(Boolean);
    const chars = cover.text.replace(/\*/g, "").length;
    const longest = Math.max(...words.map((w) => w.length));
    const budget = headlineBudget({
      boxH: L.boxH,
      maxLines: L.maxLines,
      valueRatio: cover.value ? (cover.specimen ? 1.5 : 2.1) : 0,
    });
    // Two separate ways to miss, and they take different fixes: too many
    // characters for the box, or ONE word too long for a line. The first
    // pass only ever quoted the character budget, which reads as a
    // contradiction when a 32-character headline fails a 36-character box.
    const lever =
      longest > budget.cols
        ? `"${words.find((w) => w.length === longest)}" is ${longest} ` +
          `characters and a line holds ${budget.cols} — a shorter word, ` +
          `not a shorter sentence`
        : `${words.length} words over ${L.lines.length} lines; the box ` +
          `holds ${budget.rows}. Three or four words`;
    out.push(
      `WARN  ${name} cover — headline is ${chars} characters over ` +
        `${words.length} words; the box holds ${budget.chars} in ` +
        `${budget.rows} lines of ${budget.cols}. It printed at ${L.size} px ` +
        `(${tilePt(L.size).toFixed(1)} pt on a tile) over ${L.lines.length} ` +
        `lines, ${L.maxLines} allowed.\n      ${lever}. A cover carries ` +
        `fewer words than a slide — SLIDES.md, "Covers".`,
    );
  }
  const spec = cover.specimen;
  if (spec?.type === "art" && spec.ascii) {
    const lines = spec.ascii.split("\n");
    const cols = Math.max(1, ...lines.map((l) => l.length));
    const glyph = Math.min(
      COVER_BOX_W / (cols * GLYPH_ADVANCE),
      L.figureH / lines.length,
    );
    // A cell in the device pixels a 130-pt tile is actually painted with on a
    // 3× handset — the number the 08-05 sweep was judged in.
    const dev = (px) => (px * 390) / COVER_W;
    // THE COLUMN FLOOR — the failure the first legibility pass could not see.
    // It measured the cell and the ink and passed 29 covers clean while every
    // ASCII specimen on them was unreadable, because the number that decides
    // is neither: it is how many cells the subject is drawn with.
    if (cols < SPECIMEN_COLS_MIN) {
      out.push(
        `WARN  ${name} cover — specimen is ${cols} columns ` +
          `(floor ${SPECIMEN_COLS_MIN}, target ${SPECIMEN_COLS_TARGET}). ` +
          `Under this the grid is coarser than the subject: at 130 pt a ` +
          `grid visitor reads the letters and never resolves the thing. ` +
          `The 08-05 sweep put the window at ${SPECIMEN_COLS_MIN}–` +
          `${SPECIMEN_COLS_MAX} columns — SLIDES.md, "Covers".`,
      );
    }
    if (glyph < SPECIMEN_GLYPH_MIN) {
      out.push(
        `WARN  ${name} cover — specimen glyphs at ${glyph.toFixed(1)} px ` +
          `(cell ${dev(glyph * GLYPH_ADVANCE).toFixed(1)}×${dev(glyph).toFixed(1)} ` +
          `device px on a tile, floor ${SPECIMEN_GLYPH_MIN} px). ` +
          `${cols}×${lines.length} cells in a ${L.figureH} px band. Under ` +
          `this the strokes fuse and the figure prints as one flat tone at ` +
          `its own ink coverage. Fewer columns.`,
      );
    }
    if (glyph > SPECIMEN_GLYPH_MAX) {
      out.push(
        `WARN  ${name} cover — specimen glyphs at ${glyph.toFixed(1)} px ` +
          `(cell ${dev(glyph * GLYPH_ADVANCE).toFixed(1)}×${dev(glyph).toFixed(1)} ` +
          `device px on a tile, ceiling ${SPECIMEN_GLYPH_MAX} px). ` +
          `${cols}×${lines.length} cells is coarse enough to READ: at this ` +
          `size a grid visitor sees the letters, not the subject. More ` +
          `columns.`,
      );
    }
    const ink = asciiInk(spec.ascii);
    if (ink < SPECIMEN_INK_MIN) {
      out.push(
        `WARN  ${name} cover — "${spec.image}" converts at ${ink.toFixed(2)} ` +
          `ink (floor ${SPECIMEN_INK_MIN}). At 130 pt this figure is a ` +
          `scatter of pale marks, not a silhouette. A denser subject, or a ` +
          `crop onto the solid part of this one — a bigger band will not fix ` +
          `a sparse photograph.`,
      );
    }
  }
  if (spec && spec.type !== "rows") {
    // The other half of the same failure: a figure keeps its aspect, so a
    // subject taller than the band shrinks in BOTH axes and leaves the paper
    // either side of it empty.
    const { width } = figureBox(spec, L.figureH);
    const fill = width / COVER_BOX_W;
    if (fill < SPECIMEN_FILL_MIN) {
      out.push(
        `WARN  ${name} cover — the figure fills ${(fill * 100).toFixed(0)} % ` +
          `of the box (floor ${SPECIMEN_FILL_MIN * 100} %): ` +
          `${Math.round(width)} px of ${COVER_BOX_W} in a ${L.figureH} px ` +
          `band. The subject is taller than the band — crop it wider, or ` +
          `pick a wider subject.`,
      );
    }
  }
  if (spec?.type === "rows") {
    const rowH = Math.floor(L.figureH / spec.rows.length);
    const widest = Math.max(
      ...spec.rows.map((r) => r.left.length + r.right.length + 3),
    );
    const size = Math.min(rowH * 0.52, COVER_BOX_W / (widest * 0.62));
    if (size < ROWS_TYPE_MIN) {
      out.push(
        `WARN  ${name} cover — table specimen prints at ${size.toFixed(0)} px ` +
          `(${tilePt(size).toFixed(1)} pt on a tile, floor ${ROWS_TYPE_MIN} ` +
          `px); the widest row is ${widest} characters. Shorter labels, or ` +
          `one row fewer.`,
      );
    }
  }
  return out;
};

/**
 * The one defect a single cover cannot show you. Two tiles carrying the same
 * artwork read as a duplicate post on a profile grid — the eye pairs them
 * before it reads either. Only the grid proof exposes it, so the run says it
 * out loud.
 */
const auditSet = (jobs) => {
  const seen = new Map();
  for (const job of jobs) {
    const spec = job.cover.specimen;
    const key =
      spec?.type === "art"
        ? `art:${spec.image}`
        : // Two unit grids of different counts are two different drawings;
          // it is the same drawing twice that pairs on a grid.
          spec?.type === "element"
          ? `element:${spec.element}:${JSON.stringify(spec.props ?? {})}`
          : null;
    if (!key) continue;
    if (!seen.has(key)) seen.set(key, []);
    seen.get(key).push(job.name);
  }
  return [...seen.entries()]
    .filter(([, names]) => names.length > 1)
    .map(
      ([key, names]) =>
        `WARN  ${names.join(" and ")} carry the same specimen (${key}). ` +
        `On a grid the pair reads as one post printed twice.`,
    );
};

/* ── the proof sheet ──────────────────────────────────────────────────── */

const svgLabel = (text, w, h, size, color) =>
  Buffer.from(
    `<svg width="${w}" height="${h}"><text x="0" y="${size}" ` +
      `font-family="SF Mono, Menlo, monospace" font-size="${size}" ` +
      `letter-spacing="${size * 0.12}" fill="${color}">${text}</text></svg>`,
  );

/**
 * The cover as each surface crops it, twice: at the 3× device pixels the
 * phone paints, and at the ACUITY size — what an eye actually separates at
 * arm's length, nearest-upscaled so the sheet is inspectable.
 *
 * The second row used to be drawn at the tile's POINT count, 130 px, on the
 * assumption that a point-for-pixel proof was the conservative read. It is
 * not conservative, it is wrong by 1.6× linearly, and it is what let a whole
 * bank of unreadable ASCII specimens pass a legibility audit. See
 * TILE_ACUITY_PX in cover-fit.mjs for the arithmetic and its assumptions.
 */
const proofSheet = async (coverPng, out, name, theme) => {
  // The sheet is drawn in the PROJECT's ink, not in the ink of the account
  // this file was forked from. These were the literals #EDEBE3 / #1B1A17 /
  // #8B8679 / #151412 / #F7F6F1 — Tally's palette, hardcoded — so every other
  // project's legibility proof came back on the wrong paper, which is exactly
  // the judgement a proof sheet exists to support, made wrong. Found on Papyr,
  // whose paper is pure black. (Everything else in this file already paints
  // through the bundled theme; only this SVG-composited sheet did not, because
  // sharp cannot reach `reelkit-theme`.)
  //
  // The unthemed fallback mirrors src/theme.default.ts, which this file
  // cannot import (TypeScript, from a plain .mjs) — the same mirrored-constant
  // arrangement as tier-fit.mjs and sfx-elements.mjs, and it is deliberately
  // the placeholder grey rather than anybody's brand.
  const mode = theme === "dark" ? "dark" : "light";
  const palette =
    config.theme?.palettes?.[mode] ??
    (mode === "dark"
      ? { paper: "#121214", ink: "#EDEDF0", faded: "#86868B" }
      : { paper: "#FAFAFA", ink: "#17171A", faded: "#86868B" });
  const ink = palette.ink;
  const faded = palette.faded;
  const bg = palette.paper;

  const M = 40;
  const HEAD = 64;
  const fullW = 300;
  const fullH = Math.round((fullW * COVER_H) / COVER_W);

  // Left panel: the whole 9:16, with everything outside the safe band veiled.
  const veil = Buffer.from(
    `<svg width="${fullW}" height="${fullH}">` +
      `<rect x="0" y="0" width="${fullW}" height="${(SAFE_TOP / COVER_H) * fullH}" fill="${ink}" opacity="0.55"/>` +
      `<rect x="0" y="${(SAFE_BOTTOM / COVER_H) * fullH}" width="${fullW}" height="${fullH - (SAFE_BOTTOM / COVER_H) * fullH}" fill="${ink}" opacity="0.55"/>` +
      `<rect x="0.5" y="${(SAFE_TOP / COVER_H) * fullH}" width="${fullW - 1}" height="${((SAFE_BOTTOM - SAFE_TOP) / COVER_H) * fullH}" fill="none" stroke="${ink}" stroke-width="1" stroke-dasharray="6 5"/>` +
      `</svg>`,
  );
  const fullPanel = await sharp(coverPng)
    .resize(fullW, fullH)
    .composite([{ input: veil, top: 0, left: 0 }])
    .png()
    .toBuffer();

  // One column per surface: the 3x tile, then the same tile at 1x under it.
  const cells = [];
  for (const c of COVER_CROPS) {
    const cropH = Math.min(COVER_H, Math.round(COVER_W / c.ratio));
    const cropW = Math.min(COVER_W, Math.round(COVER_H * c.ratio));
    const left = Math.round((COVER_W - cropW) / 2);
    const top = Math.round((COVER_H - cropH) / 2);
    const w3 = c.pt * 3;
    const h3 = Math.round(w3 / c.ratio);
    const wA = acuityPx(c.pt);
    const hA = Math.round(wA / c.ratio);
    const base = sharp(coverPng).extract({ left, top, width: cropW, height: cropH });
    const at3 = await base.clone().resize(w3, h3).png().toBuffer();
    // Downsample to acuity, then nearest back up: the eye's information at a
    // size a human can inspect. Resizing straight to the viewing size would
    // hand back detail the eye never gets.
    const at1 = await base
      .clone()
      .resize(wA, hA)
      .resize(wA * 2, hA * 2, { kernel: "nearest" })
      .png()
      .toBuffer();
    cells.push({ ...c, at3, w3, h3, at1, w1: wA * 2, h1: hA * 2, wA });
  }

  const colW = Math.max(...cells.map((c) => c.w3));
  const rowH3 = Math.max(...cells.map((c) => c.h3));
  const rowH1 = Math.max(...cells.map((c) => c.h1));
  const sheetW =
    M + fullW + M + cells.length * (colW + M) ;
  const sheetH = M + HEAD + Math.max(fullH, rowH3 + 30 + rowH1 + 34) + M;

  const layers = [
    { input: fullPanel, left: M, top: M + HEAD },
    {
      input: svgLabel(
        `COVER PROOF — ${name.toUpperCase()}  ·  1080×1920  ·  TILE AT DEVICE AND ACUITY`,
        sheetW,
        HEAD,
        22,
        ink,
      ),
      left: M,
      top: M + 8,
    },
    {
      input: svgLabel("SAFE BAND 444–1476", fullW + 40, 30, 15, faded),
      left: M,
      top: M + HEAD + fullH + 8,
    },
  ];

  let x = M + fullW + M;
  for (const c of cells) {
    layers.push({ input: c.at3, left: x, top: M + HEAD });
    layers.push({
      input: svgLabel(`${c.label.toUpperCase()}`, colW + 60, 30, 14, faded),
      left: x,
      top: M + HEAD + rowH3 + 8,
    });
    layers.push({ input: c.at1, left: x, top: M + HEAD + rowH3 + 38 });
    layers.push({
      input: svgLabel(`ACUITY — ${c.wA} PX, NEAREST ×2`, colW + 60, 26, 13, faded),
      left: x,
      top: M + HEAD + rowH3 + 38 + rowH1 + 6,
    });
    x += colW + M;
  }

  await sharp({
    create: {
      width: sheetW,
      height: sheetH,
      channels: 3,
      background: bg,
    },
  })
    .composite(layers)
    .png()
    .toFile(out);
};

/**
 * The profile grid itself — every cover, three across, each tile carrying
 * exactly the information an eye gets at arm's length (TILE_ACUITY_PX,
 * nearest-doubled so it is inspectable). One sheet is one screenful of
 * somebody's profile, which is the only place this artwork competes — and
 * the only place monotony is visible, since no single tile can show you that
 * the twelve around it are built the same way.
 */
const gridSheets = async (tiles, dir) => {
  const TW = acuityPx(130) * 2;
  const TH = Math.round(TW / 0.75);
  const GAP = 6;
  const M = 24;
  const COLS = 3;
  const ROWS = 4;
  const per = COLS * ROWS;
  const pages = Math.ceil(tiles.length / per);
  const out = [];
  for (let p = 0; p < pages; p += 1) {
    const page = tiles.slice(p * per, (p + 1) * per);
    const rows = Math.ceil(page.length / COLS);
    const W = M * 2 + COLS * TW + (COLS - 1) * GAP;
    const H = M * 2 + 52 + rows * (TH + GAP);
    const layers = [
      {
        input: svgLabel(
          `PROFILE GRID — ${p + 1}/${pages}  ·  130 PT TILES AT ACUITY ` +
            `(${acuityPx(130)} PX, NEAREST ×2)`,
          W,
          40,
          20,
          "#8B8679",
        ),
        left: M,
        top: M,
      },
    ];
    for (const [i, t] of page.entries()) {
      layers.push({
        input: await sharp(t.file)
          .extract({ left: 0, top: TILE_TOP, width: COVER_W, height: TILE_H })
          .resize(TW / 2, TH / 2)
          .resize(TW, TH, { kernel: "nearest" })
          .png()
          .toBuffer(),
        left: M + (i % COLS) * (TW + GAP),
        top: M + 52 + Math.floor(i / COLS) * (TH + GAP),
      });
    }
    const file = path.join(dir, `_grid-${p + 1}.png`);
    await sharp({
      create: { width: W, height: H, channels: 3, background: "#000000" },
    })
      .composite(layers)
      .png()
      .toFile(file);
    out.push(file);
  }
  return out;
};

/* ── run ──────────────────────────────────────────────────────────────── */

const args = process.argv.slice(2);
const onlyPosted = args.includes("--posted");
// Resolve every cover and run the arithmetic without spending a frame. The
// audit is the part you iterate against while writing the words; the render
// is the part that takes a minute a tile.
const auditOnly = args.includes("--audit");
const requested = args
  .filter((a) => !a.startsWith("--"))
  .map((n) => n.replace(/\.json$/, ""));

const available = readdirSync(postsDir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.replace(/\.json$/, ""))
  .filter((n) => !n.startsWith("_"));

let names = requested.length > 0 ? requested : available;
const missing = names.filter((n) => !available.includes(n));
if (missing.length > 0) {
  console.error(`no such post: ${missing.join(", ")}`);
  process.exit(1);
}

// The set worth looking at is the shipped set — the board knows it, so ask
// the board rather than keeping a second list here.
if (onlyPosted) {
  // The board is Attribura's, not this repo's — there is no second ledger to
  // ask. This flag returns when the board client lands (phase 3); refusing is
  // better than silently covering every post as if none had shipped.
  console.error(
    "--posted needs the Attribura board client, which is not wired yet.\n" +
      "Name the posts explicitly meanwhile: reelkit cover <name> [<name>…]",
  );
  process.exit(2);
}

mkdirSync(outRoot, { recursive: true });
mkdirSync(proofRoot, { recursive: true });
mkdirSync(tileRoot, { recursive: true });
mkdirSync(stageDir, { recursive: true });

// Every cover, resolved before a single pixel is drawn — an ASCII specimen
// is converted here exactly as an art slide is.
const jobs = [];
for (const name of names) {
  const post = JSON.parse(readFileSync(path.join(postsDir, `${name}.json`), "utf8"));
  const authored = Boolean(post.cover);
  const cover = deriveCover(post, name);
  if (!cover?.text) {
    console.log(`SKIP   ${name} — no hook and no cover block`);
    continue;
  }
  const spec = cover.specimen;
  if (spec?.type === "art") {
    const src = path.join(postsDir, "art", spec.image);
    if (!existsSync(src)) {
      console.log(`WARN   ${name} — art "${spec.image}" missing, cover goes bare`);
      delete cover.specimen;
    } else {
      // The COLUMN COUNT leads (SPECIMEN_COLS_TARGET) and the cell size falls
      // out of the band. So convert twice — once at the probe to learn what
      // shape the trimmed subject is, then once for real at the count that
      // shape resolves to. Before the 08-05 sweep this ran the other way
      // round and the bank shipped 12–23 columns.
      //
      // The density defaults are SLIDES.md's own advice for a pale subject
      // ("gamma ≈ 0.7 with contrast ≈ 1.8 to ink the interiors"), applied
      // here to every cover: at the default settings a low-column capsule
      // prints hollow and reads on a tile as a smudge, not a specimen.
      const opts = { gamma: 0.5, contrast: 1.1, ...spec };
      let cols = spec.cols;
      if (!cols) {
        const probe = await imageToAscii(src, {
          ...opts,
          cols: SPECIMEN_COLS_PROBE,
        });
        const rows = probe.split("\n").length;
        const aspect = (SPECIMEN_COLS_PROBE * GLYPH_ADVANCE) / rows;
        cols = specimenCols(aspect, figureMaxH(Boolean(cover.value)));
      }
      spec.ascii = await imageToAscii(src, { ...opts, cols });
    }
  }
  jobs.push({ name, cover, theme: post.theme === "dark" ? "dark" : "light" });
}

if (auditOnly) {
  let warned = 0;
  for (const line of auditSet(jobs)) {
    console.log(line);
    warned += 1;
  }
  for (const job of jobs) {
    const L = layoutCover(job.cover);
    const lines = auditCover(job.cover, job.name);
    warned += lines.length;
    const fig =
      job.cover.specimen &&
      `${job.cover.specimen.type} ${Math.round(
        figureBox(job.cover.specimen, L.figureH).width,
      )}×${L.figureH}`;
    console.log(
      `${lines.length ? "MISS" : "OK  "}  ${job.name.padEnd(18)} ` +
        `head ${String(L.size).padStart(3)} px / ${tilePt(L.size).toFixed(1)} pt ` +
        `× ${L.lines.length}` +
        (job.cover.value
          ? `  hero ${Math.round(L.valueSize)} px / ${tilePt(L.valueSize).toFixed(1)} pt`
          : "") +
        (fig ? `  fig ${fig}` : "  bare"),
    );
    for (const line of lines) console.log(line);
  }
  console.log(`AUDIT  ${jobs.length} covers, ${warned} warnings`);
  process.exit(0);
}

console.log("BUNDLE  src/index.ts");
let serveUrl = await bundleProject();

// A lab element specimen is PHOTOGRAPHED, not rebuilt: the existing
// ElementFrame composition renders its settled end state to a PNG which the
// cover then places. It lands in public/, which the bundler snapshots — so
// the staging pass runs first and the bundle is taken again after it.
const withElement = jobs.filter((j) => j.cover.specimen?.type === "element");
for (const job of withElement) {
  const spec = job.cover.specimen;
  const file = `${job.name}-specimen.png`;
  const inputProps = {
    element: spec.element,
    // Cover-only strengthening of the unit grid's unlit state — see the
    // `unlit` prop in src/lab/UnitGrid.tsx. The slides keep `trace`.
    props:
      spec.element === "unitgrid"
        ? { unlit: "faded", ...(spec.props ?? {}) }
        : (spec.props ?? {}),
    theme: job.theme,
  };
  const composition = await selectComposition({
    serveUrl,
    id: "ElementFrame",
    inputProps,
  });
  const staged = path.join(stageDir, file);
  await renderStill({
    composition,
    serveUrl,
    output: staged,
    inputProps,
    frame: spec.frame ?? 600,
  });
  // The element draws on a whole page of paper and the cover has a band.
  // Trim the empty paper off here rather than guess a crop in the layout —
  // what is left is exactly the drawing.
  const trimmed = await sharp(staged).trim({ threshold: 12 }).png().toBuffer();
  const meta = await sharp(trimmed).metadata();
  await sharp(trimmed).toFile(staged);
  spec.file = file;
  // The band is allocated from the DRAWING, so hand the allocator what the
  // drawing actually measures instead of letting it assume.
  spec.aspect = meta.width / meta.height;
}
if (withElement.length > 0) {
  console.log(`STAGE   ${withElement.length} lab specimens — re-bundling`);
  serveUrl = await bundleProject();
}

const made = [];
for (const line of auditSet(jobs)) console.log(line);
for (const job of jobs) {
  for (const line of auditCover(job.cover, job.name)) console.log(line);
  const inputProps = { cover: job.cover, theme: job.theme };
  const composition = await selectComposition({ serveUrl, id: "Cover", inputProps });
  const output = path.join(outRoot, `${job.name}.png`);
  await renderStill({ composition, serveUrl, output, inputProps });

  // The 3:4 crop, pre-cut. Instagram takes the full 9:16 and centre-crops it
  // itself, but TikTok's desktop uploader asks you to crop an uploaded cover
  // to 3:4 — so hand it the tile and there is no cropping step to get wrong.
  await sharp(output)
    .extract({ left: 0, top: TILE_TOP, width: COVER_W, height: TILE_H })
    .toFile(path.join(tileRoot, `${job.name}.png`));

  await proofSheet(output, path.join(proofRoot, `${job.name}.png`), job.name, job.theme);
  console.log(
    `COVER  ${job.name}.png  (${job.cover.specimen?.type ?? "bare"})  → proof/${job.name}.png`,
  );
  made.push({ name: job.name, file: output });
}

const sheets = await gridSheets(made, proofRoot);
console.log(
  `DONE  ${made.length} covers → ${outRoot}\n` +
    `      3:4 tiles → ${tileRoot}\n` +
    `      ${sheets.length} grid sheets → ${proofRoot}/_grid-N.png`,
);
