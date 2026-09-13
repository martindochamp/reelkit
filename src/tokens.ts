import React from "react";
import theme from "reelkit-theme";
import type { Palette } from "./theme.types";

/**
 * Design tokens, resolved from the project's theme.
 *
 * `reelkit-theme` is a bundler alias: staging writes `<project>/.reelkit/
 * theme.ts` from `reel.config.mjs` and points the alias at it. A project that
 * has not themed anything gets `src/theme.default.ts`, which is neutral on
 * purpose.
 *
 * The export surface is deliberately unchanged from the version this was
 * forked out of (`tally/tools/store-shots/src/tokens.ts`) — every element
 * imports `tokens`, `palettes`, `mono` or `hairline` by those names, so
 * making them configurable had to cost exactly one file. See docs/TWINS.md.
 */
export type { Palette } from "./theme.types";

export const palettes: Record<"light" | "dark", Palette> = theme.palettes;

/** The light palette, for the handful of places that draw an inverted chip. */
export const tokens: Palette = theme.palettes.light;
export const darkTokens: Palette = theme.palettes.dark;

export const mono = theme.mono;

/**
 * The three faces, and the caption setting.
 *
 * `mono` above is kept and still exported: every existing element imports it
 * by that name, and the generated theme falls all three faces back to it, so
 * nothing that has not opted in changes. New work should reach for `fonts`.
 */
export const fonts = theme.fonts;
export const captionStyle = theme.captions;

/**
 * The accent, or null. Null is the honest answer for a project that has not
 * named one — an element must fall back to `ink` rather than invent a colour.
 */
export const accent = (mode: "light" | "dark"): string | null =>
  theme.palettes[mode].accent ?? null;

/**
 * The word the wordmark elements draw.
 *
 * Unset it prints a visible defect rather than nothing. A blank wordmark
 * renders as a clean slide with a hole where the brand goes, which is the
 * shape of the failure that already shipped once as an unedited `TODO`: a
 * placeholder that renders perfectly is the one nobody catches.
 */
export const wordmark = (): string =>
  theme.brand?.wordmark ?? "◻ SET brand.wordmark";
export const hairline = theme.hairline;

/**
 * The frame's margins. One variable, read by the caption band — and the
 * number the stage's own table in ReelElements.tsx should eventually be
 * derived from, which it is not yet.
 */
export const safe = theme.safe ?? { x: 84, bottom: 96 };

/**
 * CSS `text-transform: uppercase` maps the micro sign (U+00B5) to a Greek
 * capital Mu, which in a monospace face is indistinguishable from an M — so
 * "184 µg" prints as "184 MG" and the paper is wrong by a factor of 1000.
 * Shield the sign from the transform rather than fixing it per post: any
 * uppercased string that can carry a unit goes through this.
 */
export const MICRO = "µ";
export const mu = (text?: string): React.ReactNode => {
  if (!text?.includes(MICRO)) return text;
  return text.split(MICRO).flatMap((part, i) =>
    i === 0
      ? [part]
      : [
          React.createElement(
            "span",
            { key: `mu${i}`, style: { textTransform: "none" } },
            MICRO,
          ),
          part,
        ],
  );
};
