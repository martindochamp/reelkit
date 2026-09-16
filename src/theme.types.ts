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
  /**
   * The one colour that is not a grey on the page — a neon, a highlight, a
   * brand tint. OPTIONAL, and absent means absent: an element that wants an
   * accent and does not get one must fall back to `ink`, never invent one.
   *
   * This slot exists because its absence was already written down as a
   * defect. Papyr's own reel.config.mjs says it: "reelkit's theme channel is
   * four monochrome inks with no accent slot, so the reels render Papyr's
   * shape without Papyr's colour. That is a gap in the engine."
   */
  accent?: string;
};

/**
 * The faces a skin draws with.
 *
 * `mono` was the whole typographic surface until 2026-09-08, and every
 * component said `fontFamily: mono` — which is why a project could change
 * its colours but never stop looking like the one it was forked from. One
 * face cannot carry a display line and a caption at once.
 *
 * All three fall back to `mono`, so a project that sets nothing renders
 * exactly as it did before.
 */
export type Fonts = {
  /** Headlines and numerals — the face that carries size. */
  display: string;
  /** Labels, table cells, running text. */
  body: string;
  /** The spoken word band. */
  caption: string;
};

/** How the caption band is set. A skin's loudest single decision. */
export type CaptionStyle = {
  /**
   * `page` | `words` | `bump`. Default `bump` (rebound arrival) since
   * 2026-09-16 — Martin's ruling on the Caption Floor: "par rebond je trouve
   * est meilleur par défaut". A theme is now allowed to set this like any
   * other axis, which it was not before: the mode used to live only in a
   * preset or in `reel.subtitles`/`beat.subtitles`, never in the base.
   */
  mode?: "page" | "words" | "bump";
  fontSize: number;
  fontWeight: number;
  letterSpacing: string;
  textTransform: "uppercase" | "none";
  /** Draw the band's plate, or let the words sit on the page alone. */
  plate: boolean;
  /**
   * How much of the sentence stands on the page at once. The default 3/20
   * is the receipt look; 1 word is the one-word-at-a-time reference, and
   * 8/44 is the long accreting line. Read by paginate() in render-reel.mjs.
   */
  maxWords: number;
  maxChars: number;
  /**
   * Brightness of a word NOT YET SPOKEN, 0-1, or `null` to refuse the mode
   * entirely.
   *
   * Unset, an unspoken word is `visibility: hidden` — it holds its space so
   * the line never reflows, but it is invisible, so the sentence assembles
   * itself in front of the viewer. Set it and the whole line stands from the
   * first frame, dimmed, and each word LIGHTS UP on its cue.
   *
   * Measured at 0.42 on the reference that does this — one account's system,
   * not the engine's: the default is `null` because `dim`'s mere PRESENCE
   * switches word-arrival into dim-and-light, and that is not what the
   * casino default does.
   */
  dim?: number | null;
  /**
   * The colour of a word marked `*like this*` in the spoken line, or `null`
   * for none.
   *
   * Measured on the reference: exactly two colours ever appear, white
   * (254,252,251) and gold (249,237,164), and the gold is not the current
   * word nor a fixed vocabulary — the same word is gold in one sentence and
   * white in another. It follows the VOICE's stress, so it is the writer's
   * call, not the engine's — which is also why the default is `null` rather
   * than a colour (Martin, 2026-09-16: "par défaut il ne faudrait pas de
   * couleur"): a `*marked*` word stays the fill's own colour until a look
   * names one.
   */
  emphasisColor?: string | null;
  /**
   * What each level of `*emphasis*` LOOKS like — colour, size, fill.
   *
   * `emphasisColor` above covers the first level and nothing else, and one
   * reference sentence needs two: a word held in the accent colour, and a
   * word at 2.6× the surrounding cap height rendered as a hollow outline —
   * measured 117 px against a 45 px body line at 720 wide, in the same
   * caption band, in the same reel. A colour swap could not say either the
   * size or the fill.
   *
   * The list is indexed by how many asterisks the writer used: `*word*`
   * takes the first entry, `**word**` the second, and a level past the end
   * of the list clamps to the last one. A skin that names nothing here
   * keeps the old behaviour exactly — `emphasisColor` on every marked word.
   */
  emphasis?: {
    /** The word's own colour. With `outline`, the colour of the stroke. */
    color?: string;
    /**
     * Multiplier on the band's font size. The word is genuinely bigger, so
     * the line box grows with it — a transform would scale the glyph over
     * its neighbours instead of making room for it.
     */
    scale?: number;
    /** Hollow: stroke width in pixels, with nothing inside it. */
    outline?: number;
  }[];
  /**
   * Where the caption band sits, in canvas pixels from the top.
   *
   * 1180 of 1920 (61 %) is the receipt default, chosen to clear a presenter
   * card AND the platform's own bottom chrome. A reel with no card puts its
   * captions much higher — 46 % measured — and two independent teardowns
   * called this "not fixable from a project", correctly: it was a literal.
   */
  bandTop?: number;

  /**
   * The weight of the word being said, in `page` mode only. Absent means
   * the line does not change as the voice moves through it.
   *
   * It replaced two literals in Reel.tsx — `800` for the said word, `400`
   * for the rest — which threw `fontWeight` away entirely, so a theme that
   * measured 700 rendered at 400 with one word at 800. That is the "thin
   * captions" every page-mode reel had.
   *
   * Only safe on a MONOSPACED caption face: in a proportional one a weight
   * change alters the glyph's advance and the whole centred line shifts as
   * each word is spoken. Tally's face is mono, which is why the hack was
   * invisible where it was written. The references measure no such
   * behaviour anywhere — Peterson's 40 cards and story-88-95's whole band
   * are one uniform weight — so it is off unless a project asks.
   */
  saidWeight?: number;
  /**
   * The colour of the word being said, in every mode — the highlight that
   * walks the page with the voice. Beats a `*marked*` word's colour.
   */
  saidColor?: string;
  /** `"italic"` for a slanted face. Measured as italic by the fit. */
  fontStyle?: "normal" | "italic";
  /**
   * A stroke around the glyphs, in canvas px, with a SOLID fill kept
   * (`paint-order: stroke fill`). The platform-caption look: white fill,
   * black outline, no plate.
   *
   * Measured on three independent references (ad-2 System A ≈3 px black,
   * speechify-ad System A ≈2-4 px, design-tips ≈"hard black outline"). The
   * key was declared in the SubtitleSpec typedef and never read by anything
   * — a post could write it and get silence. `emphasis[].outline` is the
   * OPPOSITE construction: it hollows the glyph out and drops the fill.
   */
  stroke?: number;
  /** The stroke's colour. Defaults to the page's own paper. */
  strokeColor?: string;
  /**
   * The band's own box: a colour, a corner radius, and the padding between
   * the two. `plate: true` is the same thing said the old way — the receipt
   * plate, in the page's own paper, square-cornered — and a `background`
   * written beside it wins.
   *
   * The radius is what `plate` never had, and it is the difference between a
   * caption lying on the picture and one shaped like a piece of UI. Measured
   * twice: speechify-ad's white rounded-rect plate with plain black text, and
   * the korean hook's boxes at ≈15 px on a 720-wide canvas.
   */
  background?: {
    color?: string;
    radius?: number;
    /** One number, or `[vertical, horizontal]`. */
    padding?: number | number[];
  };
  /**
   * The separation: a soft one. A name from `SHADOW_PRESETS` (`spread`,
   * `contact`, `drop`, `hard`), `"none"`, a `{x, y, blur, color}` spec, or a
   * list of them. Absent means `"auto"` — the page's own colour over a flat
   * beat and its own halo over pictures, which is what shipped.
   *
   * A stroke and a shadow are two devices for one job and a look normally
   * picks one: `beast` is 16 px of stroke and no shadow, the engine default
   * (the casino replica) is a soft shadow and no stroke.
   */
  shadow?: string | object | object[] | null;
  /**
   * A named colour set from `CAPTION_INKS` — `{fill, stroke, emphasis}` as
   * three ROLES rather than three decorations. `color`, `strokeColor` and
   * `emphasisColor` written beside it win, and every set in the bank clears
   * a contrast floor that `scripts/presets.test.mjs` refuses to let slip.
   */
  ink?: string | { fill?: string; stroke?: string; emphasis?: string };
  /**
   * How far the fit may shrink, as a fraction of the named `fontSize`.
   * Default 0.66. Below it the band stops shrinking and overflows visibly
   * rather than clipping — a caption that silently loses its last word is
   * worse than one that is obviously too big.
   */
  floor?: number;
  /**
   * The band's own typeface, overriding `theme.fonts.caption`.
   *
   * The hole this fills: a preset could restyle the size, the weight, the
   * case, the tracking, the colour, the stroke and the pagination — and not
   * the LETTERFORM, which is the thing a caption look is actually recognised
   * by. `fonts.caption` is one stack per project, so `beast` and `whisper`
   * were the same face at different sizes.
   */
  fontFamily?: string;
  /**
   * The fill. Absent, the band borrows the page's ink — white over pictures,
   * the palette's ink over a flat page, which is what a caption belonging to
   * the page should do. The outlined look does not belong to the page: it is
   * a white fill with a black stroke whatever is behind it, so it names both.
   */
  color?: string;
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
  /** The three faces. Each defaults to `mono`. */
  fonts: Fonts;
  /** How the spoken band is set. */
  captions: CaptionStyle;
  /** Rule weight in canvas pixels. */
  hairline: number;
  /** The frame's own margins, in canvas px. See `Safe`. */
  safe: Safe;
};

/**
 * THE SAFE BOX, as one variable instead of numbers in two files.
 *
 * `x` was `left: 84, right: 84` written into the caption band, and the stage
 * has its own table in ReelElements.tsx (widened 2026-08-11 on Martin's ask,
 * and derived there from one pair of numbers rather than patched per
 * element). `bottom` is new and load-bearing: the band measures itself
 * against `1920 - bandTop - safe.bottom` and comes down a size at a time
 * until it fits, so a long line shrinks instead of running off the frame.
 *
 * Changing `x` moves both edges of the band and nothing else, which is the
 * point of it being a variable: a project that renders to a platform with
 * different chrome changes one number.
 */
export type Safe = {
  /** Inset from both side edges. */
  x: number;
  /** The floor the caption band may not cross. */
  bottom: number;
};
