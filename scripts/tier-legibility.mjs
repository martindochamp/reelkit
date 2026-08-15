// The tier list's legibility audit — the one layout guarantee the element
// cannot make for itself.
//
// `fitLabel` guarantees that nothing overflows a chip: the names shrink
// until they clear the value's band. That is a geometry promise, not a
// reading one, so a board can be perfectly laid out and completely
// unreadable — six tiers carrying values fit their names at 15 px, which
// on a reel is 4.3 pt of grey texture. Nothing in the render said so; the
// frame came out clean and the writer found out on the phone.
//
// So the renderers run the element's own arithmetic first (one copy,
// src/lab/tier-fit.mjs) and print a line naming the post, the tier and the
// size. It WARNS, it never throws: the call is a judgement — a board of
// famous one-word foods reads at 15 px where a board of USDA descriptions
// does not — and a checker that blocks a render gets worked around.

import { LEGIBLE_PT, illegibleRows, reelPt } from "../src/lab/tier-fit.mjs";
import { config } from "./project.mjs";

/**
 * The legibility floor, in AUTHORED px, derived from the project's own point
 * floor.
 *
 * `tier-fit.mjs` exports LEGIBLE_MIN derived from a hardcoded 5.2 pt, and it
 * has to stay hardcoded there: TierList.tsx imports that file, so it is
 * BUNDLED and cannot reach project.mjs (node fs, a config on disk). But
 * `gates.tierFloorPt` was documented in CONFIG.md and defaulted in
 * project.mjs, so a project setting it moved nothing — the number the writer
 * is warned against is a WARNING, which is script-side, so this is where the
 * config belongs. Found on Papyr; the value the fixture ships is still 5.2.
 */
const floorPt = config.gates.tierFloorPt ?? LEGIBLE_PT;
const LEGIBLE_MIN = Math.ceil(floorPt / (reelPt(1) || 1));

/**
 * Warning lines for one tierlist spec — empty when every row reads.
 * `where` places it in the render log the way the author reads it:
 * "beat 4" on a reel, "slide 4" in a slideshow.
 */
export const tierListWarnings = (props, { post, where }) => {
  const tiers = props?.tiers ?? [];
  return illegibleRows(tiers, LEGIBLE_MIN).map((row) => {
    // Say which of the two levers to pull, and which way. Row load first:
    // it is the one the writer chose last and the one that costs the most.
    const fix =
      row.count > 2
        ? `${row.count} items in that row — take it to 2, or drop a tier`
        : tiers.length > 3
          ? `${tiers.length} tiers${row.valued ? " with values" : ""} — ` +
            `take the board to ${tiers.length - 1}`
          : `nothing left to drop — split the board, or shorten the names`;
    return (
      `WARN  ${post} ${where} · tierlist ${row.tier} — names fitted to ` +
      `${row.labelSize} px, ${reelPt(row.labelSize).toFixed(1)} pt on a reel ` +
      `(floor ${LEGIBLE_MIN} px / ${reelPt(LEGIBLE_MIN).toFixed(1)} pt).\n` +
      `      ${fix}. A tier list is judged on the reel — SLIDES.md, "Tier lists".`
    );
  });
};

/** Print them. Same stream as the render log — a warning nobody sees is none. */
export const warnTierList = (props, at) => {
  for (const line of tierListWarnings(props, at)) console.log(line);
};
