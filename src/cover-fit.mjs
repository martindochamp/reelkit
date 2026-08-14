// The cover's LAYOUT ARITHMETIC, in plain JS so both sides can run it: the
// still draws with it (src/Cover.tsx) and the renderer audits with it before
// it spends a frame (scripts/render-cover.mjs). Same contract as
// src/lab/tier-fit.mjs — one copy, because two copies drift and the second
// one is always the one that lies.
//
// Nothing here is measured. A Remotion still is rendered once and cannot ask
// the DOM how wide a line came out; SF Mono has a fixed advance, so the wrap
// and the fit are arithmetic.

export const COVER_WIDTH = 1080;
export const COVER_HEIGHT = 1920;

/**
 * The crop intersection, in canvas rows — the band every surface keeps.
 *
 * Neither platform publishes its grid geometry, so this was measured, not
 * read: a headless Chrome at 430×932 / DPR 3 with an iPhone agent, reading
 * getBoundingClientRect() off the live DOM. Every grid tile came back 3:4
 * and centre-cropped (Instagram paints its tiles with `object-fit: cover;
 * object-position: 50% 50%`, which settles the anchor outright):
 *
 *   TikTok profile grid   142.7 × 189.8   ratio 0.7515
 *   TikTok hashtag grid   143   × 190     ratio 0.7526
 *   TikTok search (2 up)  203   × 272     ratio 0.7463
 *   Instagram profile     142   × 190     ratio 0.7474
 *
 * A 3:4 tile of a 1080-wide file keeps 1440 rows, centred: 240…1680.
 *
 * Instagram Explore could not be verified — logged-out Explore redirects to
 * the login wall and no official page states the tile. It was square for
 * years, so the band is drawn against the square anyway: 1080 rows centred,
 * 420…1500. That is the number below, plus 24 rows of margin each side for
 * the rounding a device does laying a grid out in points. Everything a
 * reader must READ lives in it; the rest of the frame is bleed.
 *
 * TikTok stamps its view count over the bottom-left of a tile — canvas rows
 * 1500–1680, outside this band. Nothing to do but keep it empty, which the
 * band does for free.
 */
export const COVER_SAFE_TOP = 444;
export const COVER_SAFE_BOTTOM = 1476;
export const COVER_PAD_X = 96;

export const COVER_BOX_W = COVER_WIDTH - COVER_PAD_X * 2;
export const COVER_SAFE_H = COVER_SAFE_BOTTOM - COVER_SAFE_TOP;

/** The 3:4 tile every measured grid surface cuts out of the 9:16 file. */
export const TILE_RATIO = 3 / 4;
export const TILE_H = Math.round(COVER_WIDTH / TILE_RATIO);
export const TILE_TOP = Math.round((COVER_HEIGHT - TILE_H) / 2);

/**
 * Three tiles across a 390-pt handset, gutters near zero, is a 130-pt tile —
 * so 1080 authored pixels are shown across 130 pt, 8.3 px to the point.
 * Every legibility number below is a pt figure through this.
 */
export const TILE_PT = 130;
export const tilePt = (px) => (px * TILE_PT) / COVER_WIDTH;

/**
 * THREE tile sizes, and only one of them is the test. Getting these confused
 * is what made the first legibility pass certify unreadable covers.
 *
 *   130  is a POINT count, never a pixel count. It is how wide the tile
 *        stands, and it is the right number for type (13 pt is 13 pt). It is
 *        the WRONG number to downsample a proof to, and it was used as one.
 *        Judging a tile at 130 px throws away 1.6× linearly — that is not
 *        being conservative, it is answering a different question.
 *   390  is what the phone actually paints: 130 pt at DPR 3. The floor for
 *        real content in the file. Nothing should be rendered thinner.
 *   210  is what an EYE gets, and it is the judging size. Assumptions, stated
 *        so the next person can redo the arithmetic instead of inheriting a
 *        magic number: 35 cm viewing distance, 1 arcmin acuity → about
 *        0.10 mm resolvable on the glass; a phone display is about 65 mm
 *        wide, so ~640 resolvable lines across it; a 130-pt tile is a third
 *        of the 390-pt logical width, so it gets ~210 of them.
 *
 * Change the distance or the handset and this moves — recompute it, do not
 * argue with it.
 */
export const TILE_DEVICE_PX = 390;
export const TILE_ACUITY_PX = 210;
/** The same acuity ratio for a tile of any point width (search is 184 pt). */
export const acuityPx = (pt) => Math.round((pt * TILE_ACUITY_PX) / TILE_PT);

/**
 * The headline floor: 13 pt on a tile — over the 11 pt where type stops
 * being read at arm's length, under the 14 pt that is comfortable. A cover
 * below it still renders; it just stops doing the one job it has.
 */
export const HEADLINE_MIN = 110;

/**
 * A hairline dies on a grid. 1080 design px across 130 pt at DPR 3 is 0.36
 * device px per design px, so the receipt's 2–3 px rule lands under one
 * device pixel and renders as grey haze. On a cover a rule is 8 px or it is
 * not a rule. The one place this system does not copy the slides.
 */
export const COVER_RULE = 8;
/** The hero token is the one thing that must survive a thumbnail of a tile. */
export const VALUE_MIN = 200;

/* ── the specimen ─────────────────────────────────────────────────────── */

/**
 * THE COLUMN COUNT LEADS. The glyph size follows.
 *
 * The first pass had it the other way round: it fixed the cell at ~52 px and
 * took whatever column count fit the band. The count is the variable a reader
 * actually sees, so leaving it free is how the bank came to ship specimens at
 * 12, 16 and 23 columns — a pill bottle drawn with twelve letters across is
 * twelve letters, not a bottle.
 *
 * The count is measured, not chosen. Sweep 2026-08-05 (proof sheets in
 * out/covers/proof/_sweep-*.png): five specimens rendered through this
 * pipeline at 12·18·24·34·48·72·96·128 columns, each cut to the 3:4 tile.
 * Judged at TILE_ACUITY_PX — `_sweep-acuity210.png`. The first read of the
 * same sweep was made at 130 px and is kept only as the cautionary strip:
 * it reached the same target for a reason that turned out to be wrong.
 *
 *   UNDER 34 — you read the glyphs and no shape. At the counts that shipped,
 *              a capsule was the word QQQQQQQ under a rule. This is the fatal
 *              end and it survives the correction untouched: 210 px does not
 *              rescue 12, 16 or 23 columns. A tile that spells nothing beats
 *              a tile that spells "Q".
 *   34       — the subject arrives, and at 210 px it arrives COMFORTABLY,
 *              not marginally: the orange has a stem, the bottle has a neck.
 *              Hence the floor.
 *   48       — the target. Every subject resolves as its own silhouette AND
 *              the letterforms are still visible as letterforms. That second
 *              half is the whole reason to draw a specimen in type instead of
 *              printing the photograph, and it is what the 130-px test could
 *              not see: at 130 the texture is already gone by 34, so the
 *              choice looked like "the coarsest count that still resolves".
 *   72       — cleanest silhouettes, and at 210 px they do NOT dissolve. The
 *              cap is not an acuity limit, it is a register one: the texture
 *              goes fine enough that the figure reads as a low-resolution
 *              photograph rather than as a specimen.
 *   96+      — one flat tone at the subject's own ink coverage. Gone.
 *
 * Note what this is NOT: the grey-dissolve ceiling everyone assumed sat just
 * over the shipping counts is nowhere near them. The whole measured window
 * was above what the bank was drawing.
 */
export const SPECIMEN_COLS_TARGET = 48;
export const SPECIMEN_COLS_MIN = 34;
export const SPECIMEN_COLS_MAX = 72;
/** The probe conversion, only ever read for the subject's aspect ratio. */
export const SPECIMEN_COLS_PROBE = 24;

/**
 * The cell the count produces, in canvas px, for the audit to fire on. These
 * are a BACKSTOP now, not the driver: the count is set first and the cell is
 * only allowed to pull it when the subject's own aspect drives the cell out
 * of what the sweep could still read.
 *
 * The ceiling is the one this system was missing entirely — it carried a
 * floor of 44 px, above the whole legible window, so the audit certified
 * exactly the covers whose specimens read as typing. A floor that cannot fire
 * is worse than no floor; a floor on the wrong side of the answer is worse
 * still.
 *
 * The floor moved down to where the sweep actually shows dissolve rather than
 * where the first pass guessed it: a tall subject at 48 columns lands a 12 px
 * cell (the pill bottle) and reads perfectly, because a narrow figure fits its
 * columns into less width by construction. 9 px is the knee — the multivitamin
 * at 72 columns, the last count still holding structure at TILE_DEVICE_PX.
 */
export const SPECIMEN_GLYPH_MIN = 9;
export const SPECIMEN_GLYPH_MAX = 32;

/**
 * And the other half of the same failure. A figure keeps its source's aspect,
 * so a subject taller than the band shrinks in BOTH axes: the artichoke came
 * out 232 px wide inside an 888 px band — a quarter of the paper, centred,
 * with dead space either side. Under this share of the box the specimen is
 * not a specimen, it is a stain, and the answer is a wider subject or a crop.
 */
export const SPECIMEN_FILL_MIN = 0.3;

/**
 * What actually decides whether an ASCII figure survives 130 pt, measured by
 * downsampling finished tiles to the pixel size a real grid gives them and
 * looking: mean ink coverage of the glyphs, on the converter's own scale
 * (space 0, `@` near 1). A capsule at 0.51 and an orange at 0.44 read as
 * shapes; spinach at 0.36 and a dumbbell at 0.28 read as nothing at all.
 *
 * Size was never the variable — a sparse subject drawn twice as large is
 * still a scatter of pale marks on a tile. Density is, and it is a property
 * of the PHOTOGRAPH, so the fix is always a different subject or a tighter
 * crop, never a bigger band.
 *
 * Twice confirmed by the 08-05 sweep, and both halves are worth keeping.
 * Ink does not move with the column count — 0.45…0.55 across the whole
 * 12→128 range — which is why it cannot be the number that decides whether a
 * tile reads; that is the glyph size above. And it does not move with the
 * CONVERSION either: gamma 0.50→0.22 with contrast 1.1→2.2 shifted a scallop
 * from 0.46 to 0.47 and changed nothing on the tile, because the converter
 * already normalises each cell against its own neighbourhood. There is no
 * knob. A grey specimen is a grey photograph.
 */
export const SPECIMEN_INK_MIN = 0.42;

/** One receipt row of a table specimen. Two rows is the shape that reads. */
export const ROWS_ROW_H = 190;
/** Under 10 pt a table specimen is texture. Short labels or fewer rows. */
export const ROWS_TYPE_MIN = 70;

export const SPECIMEN_GAP = 36;
export const SPECIMEN_RULE = COVER_RULE;
/** Air under the specimen's rule, before the figure starts. */
export const SPECIMEN_RULE_GAP = 28;
export const SPECIMEN_CHROME = SPECIMEN_GAP + SPECIMEN_RULE + SPECIMEN_RULE_GAP;

/**
 * The figure's ceiling before the artwork gets a say — a share of the safe
 * band, and the only place a cover's three registers trade against each
 * other. Derived, not chosen: a hero token at 1.45× the headline plus two
 * headline lines plus the specimen's own chrome leaves 43 % of the band; a
 * cover with no token leaves 56 %.
 */
export const figureMaxH = (hasValue) =>
  Math.round(COVER_SAFE_H * (hasValue ? 0.43 : 0.56));

/**
 * How many columns this subject is drawn at. The answer is the target for
 * every subject the sweep covers; the aspect ratio only gets a say when the
 * cell that falls out of it leaves the window the sweep could still read —
 * a figure the band makes very wide would print letters you can name, a very
 * narrow one would print mush. Even then the count moves, never the priority.
 */
export const specimenCols = (aspect, maxH) => {
  const h = Math.min(maxH, COVER_BOX_W / aspect);
  const width = Math.min(COVER_BOX_W, h * aspect);
  const glyphAt = (cols) => width / (cols * GLYPH_ADVANCE);
  let cols = SPECIMEN_COLS_TARGET;
  if (glyphAt(cols) > SPECIMEN_GLYPH_MAX) {
    cols = Math.ceil(width / (SPECIMEN_GLYPH_MAX * GLYPH_ADVANCE));
  }
  if (glyphAt(cols) < SPECIMEN_GLYPH_MIN) {
    cols = Math.floor(width / (SPECIMEN_GLYPH_MIN * GLYPH_ADVANCE));
  }
  return Math.max(
    SPECIMEN_COLS_MIN,
    Math.min(SPECIMEN_COLS_MAX, Math.round(cols)),
  );
};

/** SF Mono advances 0.6 em; a figure is drawn at 1.0 line height. */
export const GLYPH_ADVANCE = 0.6;

/**
 * The figure's own width ÷ height, from the artwork rather than from a
 * guess. An ASCII grid states it outright; a photographed lab element has it
 * injected by the renderer once the staged PNG is trimmed; a table fills the
 * box by construction and has no aspect at all.
 */
export const specimenAspect = (spec) => {
  if (!spec) return 0;
  if (spec.type === "rows") return null;
  if (spec.type === "art") {
    if (!spec.ascii) return 1.6;
    const lines = spec.ascii.split("\n");
    const cols = Math.max(1, ...lines.map((l) => l.length));
    return (cols * GLYPH_ADVANCE) / lines.length;
  }
  return spec.aspect ?? 1.6;
};

/** What a figure of this aspect measures once it is laid in the band. */
export const figureBox = (spec, figureH) => {
  const aspect = specimenAspect(spec);
  if (aspect === null) return { width: COVER_BOX_W, height: figureH };
  const width = Math.min(COVER_BOX_W, figureH * aspect);
  return { width, height: Math.min(figureH, COVER_BOX_W / aspect) };
};

/* ── the headline ─────────────────────────────────────────────────────── */

/** SF Mono advances 0.6 em; the headline tracks +0.05 em. */
export const ADVANCE = 0.65;
export const LINE_HEIGHT = 1.16;

/** `*…*` marks Heavy. Everything else prints Regular — the only contrast. */
export const tokenize = (text) =>
  text
    .split(/(\*[^*]+\*)/)
    .filter(Boolean)
    .flatMap((part) => {
      const heavy =
        part.length > 2 && part.startsWith("*") && part.endsWith("*");
      const body = heavy ? part.slice(1, -1) : part;
      return body
        .split(/\s+/)
        .filter(Boolean)
        .map((word) => ({ text: word, heavy }));
    });

export const wrap = (tokens, cols) => {
  const lines = [];
  let line = [];
  let width = 0;
  for (const tok of tokens) {
    const cost = tok.text.length + (line.length ? 1 : 0);
    if (line.length && width + cost > cols) {
      lines.push(line);
      line = [tok];
      width = tok.text.length;
      continue;
    }
    line.push(tok);
    width += cost;
  }
  if (line.length) lines.push(line);
  return lines;
};

/**
 * The largest size at which the headline fits its box in at most `maxLines`.
 * Steps down 2 px from the ceiling; a cover has half a dozen words on it, so
 * the search is over in a few dozen turns.
 *
 * `valueRatio` folds the hero token into the same box instead of reserving a
 * band for it: the token is sized off the headline, so reserving a fixed
 * fraction either starved the headline or left a gap. `fitted` is false when
 * even the floor could not hold — the render still happens, and the caller
 * warns.
 */
export const fitHeadline = (
  text,
  { boxW, boxH, maxLines, ceiling, floor = HEADLINE_MIN, valueRatio = 0 },
) => {
  const tokens = tokenize(text);
  const longest = Math.max(...tokens.map((t) => t.text.length));
  for (let size = ceiling; size >= floor; size -= 2) {
    const cols = Math.floor(boxW / (size * ADVANCE));
    if (cols < 4 || longest > cols) continue;
    const lines = wrap(tokens, cols);
    if (lines.length > maxLines) continue;
    if (size * valueRatio + lines.length * size * LINE_HEIGHT > boxH) continue;
    return { size, lines, fitted: true };
  }
  const cols = Math.max(4, Math.floor(boxW / (floor * ADVANCE)));
  return { size: floor, lines: wrap(tokens, cols), fitted: false };
};

/**
 * THE SHAPE OF A COVER.
 *
 * A hero token, three or four words, and a specimen. The token is read, the
 * figure is recognised, and they do not compete because they answer different
 * questions — which is why a purely typographic grid of twenty tiles has no
 * silhouette and every tile looks like the tile beside it.
 *
 * The bands are allocated by which registers a cover actually uses, and the
 * specimen's share now comes from the ARTWORK: a wide subject asks for a
 * short band and gets it, a square one asks for more. The first pass fixed
 * the band at 46 % of the safe area regardless, so a wide subject printed
 * small inside a band it could not fill and a tall one printed tiny inside a
 * band the wrong shape entirely.
 *
 * Every consumer runs this — the still draws with it, the renderer audits
 * with it.
 */
export const layoutCover = (cover) => {
  const hasValue = Boolean(cover.value);
  const spec = cover.specimen;
  const hasSpecimen = Boolean(spec);
  const kickerH = cover.kicker ? 78 : 0;
  const lineH = cover.line ? 92 : 0;

  // The ceiling on the figure, not its size: a cover that also carries a
  // number gives the figure a shorter band, and one that does not lets the
  // figure run to over half the paper.
  const figureMax = hasSpecimen ? figureMaxH(hasValue) : 0;
  let figureH = 0;
  if (spec?.type === "rows") {
    figureH = Math.min(figureMax, spec.rows.length * ROWS_ROW_H);
  } else if (hasSpecimen) {
    figureH = Math.min(figureMax, Math.round(COVER_BOX_W / specimenAspect(spec)));
  }
  const specimenH = hasSpecimen ? figureH + SPECIMEN_CHROME : 0;

  // Two lines is the reading budget of a tile once a figure is on it. Without
  // a figure the type is the whole page and can run longer — four lines is
  // not a paragraph when each one is three words wide.
  const maxLines = hasSpecimen ? 2 : hasValue ? 3 : 4;
  const valueRatio = hasValue ? (hasSpecimen ? 1.45 : 2.1) : 0;
  // The specimen brings its own gap, so a cover carrying one does not also
  // reserve the bare cover's breathing room.
  const gaps = (hasSpecimen ? 30 : 60) + (hasValue ? 26 : 0);
  const boxH = COVER_SAFE_H - specimenH - kickerH - lineH - gaps;
  const fit = fitHeadline(cover.text, {
    boxW: COVER_BOX_W,
    boxH,
    maxLines,
    ceiling: hasValue ? 190 : hasSpecimen ? 220 : 260,
    valueRatio,
  });
  // The hero token never wraps: "6,000 mg" breaking after the comma reads as
  // two numbers. Size it against its FULL length, spaces included — dropping
  // them was what let it overflow and wrap in the first place.
  const valueSize = hasValue
    ? Math.min(fit.size * valueRatio, COVER_BOX_W / (cover.value.length * 0.62))
    : 0;
  return {
    ...fit,
    specimenH,
    kickerH,
    lineH,
    boxH,
    maxLines,
    valueSize,
    /** What the specimen's own figure gets, once its rule and gaps are off. */
    figureH,
  };
};

/**
 * How many characters the headline box can actually carry — the honest word
 * budget, and the number to quote at a writer whose cover does not fit.
 */
export const headlineBudget = ({ boxH, maxLines, valueRatio = 0 }) => {
  const cols = Math.floor(COVER_BOX_W / (HEADLINE_MIN * ADVANCE));
  const rows = Math.floor(
    (boxH - HEADLINE_MIN * valueRatio) / (HEADLINE_MIN * LINE_HEIGHT),
  );
  return {
    chars: cols * Math.max(1, Math.min(maxLines, rows)),
    cols,
    rows: Math.max(1, Math.min(maxLines, rows)),
  };
};
