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
