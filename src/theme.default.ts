/**
 * The default theme — deliberately neutral.
 *
 * A project supplies its own by exporting `theme` from `reel.config.mjs`;
 * staging writes `<project>/.reelkit/theme.ts` from it and the bundler
 * aliases `reelkit-theme` there. This file is what a project gets before it
 * has decided anything, and it is not anyone's brand: the greys are chosen
 * to be obviously placeholder, so an unthemed render reads as unfinished
 * rather than as somebody else's house style.
 *
 * The four ink names are the contract every element is written against, and
 * they are semantic rather than descriptive — `paper` is whatever the page
 * is, `ink` is whatever the type is. A dark-first project swaps the values,
 * never the names.
 */
import type { ThemeModule } from "./theme.types";
import { CAPTION_DEFAULTS, CAPTION_FACE, SAFE_DEFAULTS } from "./lab/subtitles.mjs";

const theme: ThemeModule = {
  brand: { wordmark: null },
  palettes: {
    light: {
      paper: "#FAFAFA",
      ink: "#17171A",
      faded: "#86868B",
      trace: "#E2E2E4",
    },
    dark: {
      paper: "#121214",
      ink: "#EDEDF0",
      faded: "#86868B",
      trace: "#2A2A2E",
    },
  },
  /**
   * Referenced by name, never bundled — the SF license permits use, not
   * redistribution. Off a machine that has it, the stack falls through to
   * the closest monospace and the layout survives because every element
   * measures in advance ratios, not in pixels.
   */
  mono: '"SF Mono", "SFMono-Regular", ui-monospace, Menlo, Monaco, monospace',
  /**
   * All three faces are `mono` here, which is exactly what the engine did
   * when `mono` was the only face there was. A skin that wants a display
   * face and a caption face that disagree names them; one that does not
   * gets the old single-face behaviour, unchanged.
   */
  fonts: {
    display: '"SF Mono", "SFMono-Regular", ui-monospace, Menlo, Monaco, monospace',
    body: '"SF Mono", "SFMono-Regular", ui-monospace, Menlo, Monaco, monospace',
    // The caption band alone leaves the monospace. The measured look is a
    // sans at 700, and the receipt idiom lives in the ELEMENTS, not in the
    // words the voice is saying — those are read, not printed.
    caption: CAPTION_FACE,
  },
  /**
   * MEASURED, not chosen (Martin, 2026-09-09: "les soustitres avec la police
   * espacements positions et autres est parfaite, ça devrait être celle de
   * défaut"), then CORRECTED on the Caption Floor, 2026-09-16: sans, 66/700
   * on every word — no per-word weight change — a soft shadow, no stroke,
   * mixed case, tight tracking, no plate. `CAPTION_DEFAULTS` carries the
   * values, not a copy of them, so this file cannot drift from
   * `scripts/bundle.mjs`'s own copy the way the two disagreed for a day.
   *
   * Two more of the 2026-09-16 rulings live inside `CAPTION_DEFAULTS` itself:
   * no colour by default ("par défaut il ne faudrait pas de couleur") and
   * `bump` as the default mode ("par rebond je trouve est meilleur par
   * défaut"). See `src/lab/subtitles.mjs` for both, in full.
   *
   * What this REPLACED was the receipt look — 48/400, `0.08em`, uppercase,
   * plate on, 3 words. That was Tally's, it was never fitted to anything, and
   * it came over with the fork. It is now written out explicitly in
   * `.parity/reel.config.mjs`, which is where it belongs: that fixture asserts
   * reelkit renders a TALLY post like Tally, so it has to carry Tally's look
   * rather than inherit whatever the engine defaults to.
   */
  captions: { ...CAPTION_DEFAULTS } as ThemeModule["captions"],

  /** The frame's margins. 84 px was the caption band's own literal. */
  safe: { ...SAFE_DEFAULTS },

  /**
   * The hairline, in canvas pixels. Every rule in the system is drawn from
   * this one number, so a project that renders at a different scale changes
   * its rules by changing it once.
   */
  hairline: 3,
};

export default theme;
