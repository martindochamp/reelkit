/**
 * The theme contract. A project's `reel.config.mjs` supplies these values as
 * a plain object; staging generates a typed module from it, so a malformed
 * theme fails at bundle time rather than as a missing colour in frame 400.
 */

/** The four inks every element is drawn with. Semantic, not descriptive. */
export type Palette = {
  /** The page itself. */
  paper: string;
  /** Type, bars, fills — whatever is printed on the page. */
  ink: string;
  /** Labels, units, the not-yet-done. */
  faded: string;
  /** Hairlines and dashed rules. */
  trace: string;
};

export type Brand = {
  /**
   * The word the wordmark element draws. There is no sensible default: a
   * placeholder that renders cleanly is exactly how a post ships with the
   * generator's leftovers on it, so an unset wordmark prints as a visible
   * defect instead of as nothing.
   */
  wordmark: string | null;
};

export type ThemeModule = {
  palettes: Record<"light" | "dark", Palette>;
  brand: Brand;
  /** A CSS font stack. Numbers live in it, so it must be monospaced. */
  mono: string;
  /** Rule weight in canvas pixels. */
  hairline: number;
};
