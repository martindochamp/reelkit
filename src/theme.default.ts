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
   * The hairline, in canvas pixels. Every rule in the system is drawn from
   * this one number, so a project that renders at a different scale changes
   * its rules by changing it once.
   */
  hairline: 3,
};

export default theme;
