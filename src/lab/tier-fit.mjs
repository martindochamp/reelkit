// The tier list's LAYOUT ARITHMETIC, in plain JS so both sides can run it:
// the element draws with it (src/lab/TierList.tsx) and the renderers audit
// with it before they spend a frame (scripts/tier-legibility.mjs). One copy,
// because two copies drift and the second one is always the one that lies.
//
// Everything here is computed, never measured: a Remotion frame is rendered
// once and cannot ask the DOM how tall a name came out. SF Mono is a fixed
// advance, so the wrap and the fit are arithmetic — see LABEL_ADVANCE.

export const rule = 2;
const PAD_X = 84;
const PAD_RIGHT = 144; // content ends at x = 936

export const ROW_GAP = 20;
export const CELL_GAP = 26; // tier cell → items
export const CHIP_GAP = 14;
export const CHIP_PAD_X = 18;
export const CHIP_PAD_Y = 12;
export const CHIP_TEXT_GAP = 6; // label block → value line
export const LABEL_LINE = 1.2;
export const VALUE_LINE = 1.2;

/** The zone's own width — PAD_X and PAD_RIGHT off the 1080 canvas. */
export const CONTENT_W = 1080 - PAD_X - PAD_RIGHT;

/**
 * Band height by tier count — the tier cell is a square of this side and
 * the chips stand exactly as tall, so a row is one block. Six rows plus
 * their notes still clear the subtitle band at 1360.
 */
export const bandHeight = (n) => (n >= 6 ? 106 : n >= 5 ? 132 : 158);

/**
 * Chip type at its widest, by the row's load: four across still holds its
 * letterforms. This is the CEILING — `fitLabel` takes the name down from
 * here whenever the column is too narrow for it.
 */
export const chipType = (n) => {
  if (n <= 2) return { label: 28, value: 32 };
  if (n === 3) return { label: 24, value: 28 };
  if (n === 4) return { label: 20, value: 24 };
  return { label: 17, value: 20 };
};

/**
 * SF Mono advances 0.6 em a glyph and the chip's tracking rides on top,
 * so one character costs this much of the column. That fixed metric is
 * what lets the wrap below be COMPUTED rather than measured.
 *
 * The figures carry ~3 % over the nominal 0.64/0.62: measured against the
 * real render, the browser broke a nine-character word the arithmetic
 * said would fit. An estimate that runs one character LONG costs a point
 * of type; one that runs short costs a clipped number.
 */
export const LABEL_ADVANCE = 0.66;
export const VALUE_ADVANCE = 0.64;

/** The name never prints smaller than this; below it, nothing reads. */
export const MIN_LABEL = 11;

/**
 * Authored px → points on a 393-pt handset, through the reel.
 * The scale mirrors ReelElements.tsx `LAB_SCALE`, which owns it:
 * (STAGE_BOTTOM_REEL − STAGE_TOP) / (1360 − 210). The carousel is a wider
 * surface (no caption band, full 1080), so a size that reads on the reel
 * reads everywhere — judge here.
 *
 * **This number moved on 2026-08-11** when the safe area widened: the
 * stage band went 210→1120 to 260→1080, so the scale went 0.791 to 0.713.
 * Keep it in step with ReelElements.tsx by hand — the .tsx cannot be
 * imported from a plain .mjs, which is the whole reason this constant is
 * duplicated and the whole reason it is worth a comment.
 */
const REEL_LAB_SCALE = (1080 - 260) / (1360 - 210);
const HANDSET_PT_PER_PX = 393 / 1080;
export const reelPt = (px) => px * REEL_LAB_SCALE * HANDSET_PT_PER_PX;

/**
 * The size a fitted name must still reach to be READ rather than
 * recognised, in AUTHORED px. The real floor is the POINT size on the
 * handset — 5.2 pt, already half iOS's smallest standard style (11 pt)
 * and the point past which letters are texture — so the authored floor is
 * derived from it rather than typed, and it tracks the scale
 * automatically. It was 18 px at scale 0.791; the widened safe area makes
 * the same 5.2 pt cost 20 px.
 *
 * MIN_LABEL is the element's own overflow floor and guarantees nothing
 * legible (11 px is 3.2 pt). This is the number a writer is warned
 * against, not the number the element clamps to.
 */
export const LEGIBLE_PT = 5.2;
export const LEGIBLE_MIN = Math.ceil(LEGIBLE_PT / (REEL_LAB_SCALE * HANDSET_PT_PER_PX));

const NBSP = "\u00A0";

/**
 * Whitespace the wrap may break on — every kind EXCEPT U+00A0, which is
 * the whole point of a non-breaking space and which the browser honours.
 * `String.trim()` would eat one, so the trim is spelled out too.
 */
const BREAKABLE = /[^\S\u00A0]+/u;
/** Same rule, capturing \u2014 `split` keeps the gaps so `knit` can retype one. */
const BREAKABLE_SPLIT = /([^\S\u00A0]+)/u;
const trimBreakable = (text) =>
  String(text ?? "").replace(/^[^\S\u00A0]+|[^\S\u00A0]+$/gu, "");

/**
 * What may be tied to the number in front of it: a word of letters — up
 * to twelve, one optional trailing period or comma — another run of
 * digits (a "1 000" thousands space), or a bare % / °.
 *
 * Twelve letters, not a list of units. The boards already serve cup, tsp,
 * tbsp, oz, g, mg, mcg, µg, ml, piece and container, and the next one
 * will serve something nobody listed; twelve reaches every unit written
 * out in full — tablespoons, milliliters, kilocalories — and a list would
 * have to be maintained by the same person this whole change exists to
 * stop relying on. Measured against every tierlist in `posts/`: ten and
 * fourteen fit the identical type size, so the width of the window costs
 * nothing here and the wider one covers more.
 */
const UNIT = /^(?:\p{L}{1,12}[.,]?|\d+|[%°])$/u;

/**
 * A NUMBER AND ITS UNIT ARE ONE WORD.
 *
 * The wrap is greedy, so "KALE, COOKED — 1 CUP" in an 18-column chip ends
 * a line on the 1 and opens the next one with CUP. On a nutrition board a
 * quantity separated from its unit is the one break that cannot ship. The
 * writer used to answer it by typing a non-breaking space between the
 * digit and the unit — invisible, effective, and a rule every chip of
 * every future board depended on someone remembering.
 *
 * So the element ties the knot itself: a breakable space becomes U+00A0
 * when the run before it ENDS IN A DIGIT and the token after it passes
 * `UNIT` — and only while the tied run still FITS the column. A tied run
 * wider than the chip is guillotined mid-word by `overflow-wrap`
 * ("1 CONTAINE / R"), which is worse than the orphan it was avoiding, so
 * below that width the pair stays breakable and the board reads as it did
 * before.
 *
 * Idempotent, so a label that already carries a hand-typed U+00A0 renders
 * exactly as it always did — the knot is simply already tied.
 *
 * What it does NOT protect:
 * - a unit written before its number ("mg 400", "$ 12");
 * - a unit longer than twelve letters, or one carrying punctuation of its
 *   own ("3 oz-cups");
 * - a mixed fraction: "2 1/2 cups" ties "1/2 cups" and leaves the whole
 *   number loose, because "1/2" is not a word;
 * - a pair too wide for the column — see above, it lets that one break;
 * - the *meaning* of the word it ties: it cannot tell "3 cups" from
 *   "3 greens" and ties both. Tying a noun to its count is harmless; it
 *   can cost an earlier wrap, never a wrong reading;
 * - a range typed with spaces around its dash ("88 – 90"), and nothing at
 *   all on the spoken lines. "A number never leaves its unit" still
 *   governs the script and every other element — this only makes the
 *   tierlist chip keep the promise on its own.
 */
export const knit = (text, cols = Infinity) => {
  const parts = String(text ?? "").split(BREAKABLE_SPLIT);
  let out = parts[0] ?? "";
  // The characters since the last breakable space — the unbreakable run
  // the browser would have to fit on one line.
  let run = out;
  for (let i = 1; i < parts.length; i += 2) {
    const word = parts[i + 1] ?? "";
    if (
      /\d$/u.test(run) &&
      UNIT.test(word) &&
      run.length + 1 + word.length <= cols
    ) {
      out += NBSP + word;
      run += NBSP + word;
    } else {
      out += parts[i] + word;
      run = word;
    }
  }
  return out;
};

/**
 * Lines a mono string takes in a column `cols` characters wide: wraps on
 * breakable spaces, and breaks INSIDE a word only when the word alone is
 * wider than the column — which is exactly `overflow-wrap: break-word`,
 * the rule the chips carry. (`anywhere` would let the browser split a
 * word that fits on the next line, and printed "COLLARDS / , COOKED".)
 *
 * `knit` runs first, with the same `cols`, so the count is taken over the
 * string the element actually prints.
 */
export const wrapLines = (text, cols) => {
  if (cols < 1) return { lines: 1, split: true };
  let lines = 1;
  let used = 0;
  let split = false;
  for (const word of trimBreakable(knit(text, cols)).split(BREAKABLE)) {
    let w = word.length;
    if (used > 0) {
      if (used + 1 + w <= cols) {
        used += 1 + w;
        continue;
      }
      lines += 1;
      used = 0;
    }
    while (w > cols) {
      // The word is wider than the column: the browser guillotines it.
      split = true;
      lines += 1;
      w -= cols;
    }
    used = w;
  }
  return { lines, split };
};

/** The wrap a name actually prints, line by line — same rule as above. */
export const wrapText = (text, cols) => {
  const out = [];
  let line = "";
  for (const word of trimBreakable(knit(text, cols)).split(BREAKABLE)) {
    let w = word;
    if (line) {
      if (line.length + 1 + w.length <= cols) {
        line = `${line} ${w}`;
        continue;
      }
      out.push(line);
      line = "";
    }
    while (w.length > cols) {
      out.push(w.slice(0, cols));
      w = w.slice(cols);
    }
    line = w;
  }
  if (line) out.push(line);
  return out.length ? out : [""];
};

/**
 * The largest size at which EVERY name in the row still clears the band
 * reserved for its number.
 *
 * The number never shrinks — a nutrition board is read for its numbers,
 * and a value that changed size row to row would be unreadable as a
 * column. The name gives way instead, one point at a time, and the whole
 * row moves together so the chips keep one type size and the floors stay
 * level. This is the guarantee the format lives on: a value is pinned to
 * the chip's floor, so it can only stay there if the name above it is
 * known to fit.
 */
export const fitLabel = (labels, base, innerW, availH) => {
  const at = (size) => {
    const cols = Math.floor(innerW / (size * LABEL_ADVANCE));
    const wrapped = labels.map((l) => wrapLines(l, cols));
    return {
      ok:
        Math.max(1, ...wrapped.map((w) => w.lines)) * size * LABEL_LINE <=
        availH,
      clean: !wrapped.some((w) => w.split),
    };
  };

  let best = MIN_LABEL;
  for (let size = base; size >= MIN_LABEL; size -= 1) {
    if (at(size).ok) {
      best = size;
      break;
    }
  }
  // Then trade a point or two for a clean wrap: "COLLARDS, / COOKED —"
  // reads, "COLLARDS / , COOKED" does not. Never more than a fifth of the
  // size, and never when the word is simply longer than any column it
  // could get (a chemical name has to be cut somewhere).
  const floorSize = Math.max(MIN_LABEL, Math.round(best * 0.8));
  for (let size = best; size >= floorSize; size -= 1) {
    const r = at(size);
    if (r.ok && r.clean) return size;
  }
  return best;
};

/**
 * The whole board, measured before it is drawn: band height, the width the
 * chips get, and per row the type size the names were fitted to. The
 * element renders from this and the renderers audit it — same numbers, so
 * a warning can never disagree with the frame it warned about.
 */
export const layout = (tiers = []) => {
  // A list with no values anywhere holds one line per chip, so the whole
  // grid stands shorter — a tall box around a single word is air, not
  // emphasis.
  const priced = tiers.some((t) => (t.items ?? []).some((it) => it.value));
  const bandH = Math.round(bandHeight(tiers.length) * (priced ? 1 : 0.8));
  // The tier cell is a bandH square, so what is left for the chips is
  // known before a single one is laid out — which is how the type below
  // can be fitted to the column instead of overflowing it.
  const itemsW = CONTENT_W - bandH - CELL_GAP;
  const chipInnerH = bandH - 2 * CHIP_PAD_Y - 2 * rule;

  const rows = tiers.map((row) => {
    const items = row.items ?? [];
    const type = chipType(items.length);
    // A row whose items carry values pins the label to the top and the
    // value to the floor, so the numbers line up across the band whatever
    // a label's wrap does. A labels-only row centers.
    const valued = items.some((it) => it.value);
    const colW =
      (itemsW - (items.length - 1) * CHIP_GAP) / Math.max(1, items.length);
    const chipInnerW = colW - 2 * CHIP_PAD_X - 2 * rule;
    const valueCols = Math.floor(chipInnerW / (type.value * VALUE_ADVANCE));
    const valueH = valued
      ? Math.max(
          1,
          ...items.map((it) =>
            it.value ? wrapLines(it.value, valueCols).lines : 1,
          ),
        ) *
        type.value *
        VALUE_LINE
      : 0;
    const labelSize = fitLabel(
      items.map((it) => it.label),
      // A labels-only row has nothing else to hold, so the name starts
      // from the value's size.
      valued ? type.label : type.value,
      chipInnerW,
      chipInnerH - (valued ? valueH + CHIP_TEXT_GAP : 0),
    );
    return {
      tier: row.tier,
      count: items.length,
      valued,
      valueSize: type.value,
      labelSize,
      /** Characters a name gets per line at the fitted size. */
      labelCols: Math.floor(chipInnerW / (labelSize * LABEL_ADVANCE)),
      /** Characters a number gets — the value's size never moves. */
      valueCols,
      labels: items.map((it) => it.label),
    };
  });

  return { priced, bandH, letterSize: Math.round(bandH * 0.48), itemsW, chipInnerH, rows };
};

/**
 * The rows whose names were fitted under the legible floor — what the
 * renderers warn about. Empty is the normal answer.
 */
export const illegibleRows = (tiers = [], min = LEGIBLE_MIN) =>
  layout(tiers)
    .rows.map((row, index) => ({ ...row, index, tiers: tiers.length }))
    .filter((row) => row.count > 0 && row.labelSize < min);
