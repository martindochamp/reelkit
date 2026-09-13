import React from "react";
import {
  Img,
  Loop,
  OffthreadVideo,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { projectElements } from "reelkit-elements";
import { Flag } from "./Flags";
import { revealStyle } from "./lab/reveal";
import { motionStyle } from "./lab/motion.mjs";
import { mono, mu, palettes, tokens, wordmark, type Palette } from "./tokens";
import { BarChart } from "./lab/BarChart";
import { Bullets } from "./lab/Bullets";
import { CalendarStrip } from "./lab/CalendarStrip";
import { ComparisonTable } from "./lab/ComparisonTable";
import { FlowDiagram } from "./lab/FlowDiagram";
import { GlyphDissolve } from "./lab/GlyphDissolve";
import { LabelAnatomy } from "./lab/LabelAnatomy";
import { LineChart } from "./lab/LineChart";
import { Molecule } from "./lab/Molecule";
import { OdometerTally } from "./lab/OdometerTally";
import { CompositionBar, PieChart } from "./lab/PieChart";
import { PrintedSparkline } from "./lab/PrintedSparkline";
import { RankShuffle } from "./lab/RankShuffle";
import { SimplePie } from "./lab/SimplePie";
import { ThermalPrinter } from "./lab/ThermalPrinter";
import { ThresholdMeter } from "./lab/ThresholdMeter";
import { TierList, tierListParts } from "./lab/TierList";
import { Timeline } from "./lab/Timeline";
import { UnitGrid } from "./lab/UnitGrid";
import { DynamicBackground } from "./lab/DynamicBackground";
import { Footage, type FootageSpec } from "./lab/Footage";
import { Cutout } from "./lab/Cutout";

/**
 * The lab registry — every animated element the agents built, exposed to
 * the reel as `{ "type": "lab", "element": "<name>", "props": {…} }`.
 * Each entry maps the beat's [+] cue frames onto the element's own cue
 * props; an element renders full-frame (they all own their AbsoluteFill
 * and respect the caption band). Their end states double as slide stills
 * through the ElementFrame composition.
 */
const sectorCues =
  (_c: React.ComponentType<any>) =>
  (cues: number[], props: any) => {
    const n = props?.slices?.length ?? 0;
    if (cues.length === n && n > 0) return { sectorCues: cues };
    return cues.length ? { appearAt: cues[0] } : {};
  };

const CORE_REGISTRY: Record<
  string,
  {
    component: React.ComponentType<any>;
    mapCues: (cues: number[], props: any) => object;
  }
> = {
  /**
   * The ground, as an element. It is normally a beat's `field` and sits
   * UNDER everything; registering it here is what makes `reelkit lab dynbg`
   * and a backgrounds-only reel possible without a second code path.
   */
  dynbg: {
    component: DynamicBackground,
    mapCues: () => ({}),
  },
  /**
   * The footage box, as an element. Same reason as `dynbg`: it is normally a
   * beat's or shot's `{ type: "footage" }` screen, and registering it here is
   * what makes `reelkit lab footage --props '{"spec":{"preset":"card",...}}'`
   * a way to see ONE box's geometry — a preset contact sheet, no voice, no
   * post — instead of a reel that has to be written first.
   */
  footage: {
    component: Footage,
    mapCues: () => ({}),
  },
  /**
   * The cutout, as an element. It is normally a layer — `reel.cutout` or
   * `beat.cutout` — because a person sits OVER the beat's picture and an
   * element IS that picture. Registered here for the same reason `dynbg` is:
   * `reelkit lab cutout --props '{"spec":{"file":"me-matte.webm","preset":"reaction"}}'`
   * shows one placement alone, with no post to write and no staging to run.
   */
  cutout: {
    component: Cutout,
    mapCues: () => ({}),
  },
  unitgrid: {
    component: UnitGrid,
    mapCues: (c) => ({
      ...(c[0] != null ? { appearAt: c[0] } : {}),
      ...(c[1] != null ? { reduceAt: c[1] } : {}),
    }),
  },
  barchart: {
    component: BarChart,
    mapCues: (c) => (c.length ? { rowCues: c } : {}),
  },
  odometer: {
    component: OdometerTally,
    mapCues: (c) => (c[0] != null ? { countStart: c[0] } : {}),
  },
  linechart: {
    component: LineChart,
    mapCues: (c) => (c[0] != null ? { drawStart: c[0] } : {}),
  },
  sparkline: {
    component: PrintedSparkline,
    mapCues: (c) => (c[0] != null ? { drawStart: c[0] } : {}),
  },
  thermal: { component: ThermalPrinter, mapCues: () => ({}) },
  dissolve: { component: GlyphDissolve, mapCues: () => ({}) },
  comparison: {
    component: ComparisonTable,
    mapCues: (c) => (c.length ? { rowCues: c } : {}),
  },
  bullets: {
    component: Bullets,
    mapCues: (c) => (c.length ? { itemCues: c } : {}),
  },
  // Sector cues are positional: a partial list would leave later sectors
  // with an undefined frame (NaN, and the render dies). Take them only
  // when there is one marker per slice; otherwise the single marker just
  // starts the sweep.
  pie: { component: PieChart, mapCues: sectorCues(PieChart) },
  simplepie: { component: SimplePie, mapCues: sectorCues(SimplePie) },
  compositionbar: {
    component: CompositionBar,
    mapCues: sectorCues(CompositionBar),
  },
  rankshuffle: {
    component: RankShuffle,
    // One marker = the sort moment; two = appear, then sort.
    mapCues: (c) =>
      c.length === 1
        ? { sortAt: c[0] }
        : c.length >= 2
          ? { appearAt: c[0], sortAt: c[1] }
          : {},
  },
  threshold: {
    component: ThresholdMeter,
    mapCues: (c) => (c.length ? { cues: c } : {}),
  },
  labelanatomy: {
    component: LabelAnatomy,
    mapCues: (c) => (c.length ? { stepCues: c } : {}),
  },
  flow: {
    component: FlowDiagram,
    mapCues: (c) => (c.length ? { stageCues: c } : {}),
  },
  timeline: {
    component: Timeline,
    mapCues: (c) => (c.length ? { eventCues: c } : {}),
  },
  molecule: {
    component: Molecule,
    mapCues: (c) =>
      c.length === 1 ? { appearAt: c[0] } : c.length > 1 ? { cues: c } : {},
  },
  calendar: {
    component: CalendarStrip,
    mapCues: (c) =>
      c.length === 1 ? { stampsAt: c[0] } : c.length > 1 ? { cues: c } : {},
  },
  // One cue per item, in reading order across every tier — the grid is
  // already on the paper, only the items land at the word.
  tierlist: {
    component: TierList,
    mapCues: (c) => (c.length ? { itemCues: c } : {}),
  },
};

/**
 * Core's bank, plus whatever the project put in its own `elements/` folder.
 *
 * The project side wins on a name collision, deliberately: a project that
 * writes its own `tierlist` has decided the core one is wrong for it, and
 * silently ignoring that would be the worse surprise. `reelkit elements`
 * prints the merged bank and marks which side each name came from.
 */
export const LAB_REGISTRY = { ...CORE_REGISTRY, ...projectElements };

/**
 * The stage band in a reel — where every element lives, and the one place
 * the safe area is decided.
 *
 * Widened 2026-08-11 (Martin: "augmenter le padding de la safe area et
 * donc peut-être scale down certains éléments"). The old band ran
 * 210→1120 with 84 px of paper on the left and 144 on the right, which
 * put type within a thumb's width of the frame on a 393-pt handset and
 * left a figure's ASCII touching the edge. The new band is inset on every
 * side, and nothing was patched per element to pay for it: the numbers
 * below are the only source of size in this file, so widening the margin
 * shrinks the content by construction.
 *
 * The right margin stays the wider one — TikTok's action rail (heart,
 * comment, share) sits over that column and no amount of vertical
 * padding moves it.
 */
export const STAGE_TOP = 260;
export const STAGE_BOTTOM_REEL = 1080;

/**
 * Lab elements are authored against a 210→1360 band across the full
 * 1080-px width, so the reel scales them to fit ours. Anchoring matters:
 * the transform origin is the AUTHORED top, and the translate then drops
 * the scaled block onto the stage — origin-at-STAGE_TOP (what this did
 * before) left the block 36 px above its own band, which is invisible
 * until the margin gets tight, and now it is.
 *
 * One number covers both axes. A lab element's own content runs 84→996,
 * so scaling about the centre puts its edges at 540 ± 456·s: at s = 0.71
 * that is 216→864, inside the 120→890 the stage allows. The vertical
 * constraint is the binding one and always has been.
 */
const LAB_AUTHORED_TOP = 210;
const LAB_AUTHORED_BOTTOM = 1360;
const LAB_SCALE =
  (STAGE_BOTTOM_REEL - STAGE_TOP) / (LAB_AUTHORED_BOTTOM - LAB_AUTHORED_TOP);

/** A lab element rendered at one frame — the still the slideshow prints. */
export const LabFrame: React.FC<{
  element: string;
  props?: Record<string, unknown>;
  theme?: "light" | "dark";
}> = ({ element, props = {}, theme = "dark" }) => {
  const entry = LAB_REGISTRY[element];
  if (!entry) return null;
  const Comp = entry.component;
  return <Comp theme={theme} {...props} />;
};

/**
 * Reel screen elements — what the stage shows while the voice argues. Each
 * beat cuts to ONE element; its parts (a table's rows, a figure's art then
 * its row) print at the exact frame the voice reaches their word, carried
 * in `cueFrames` by render-reel.mjs.
 *
 * Three stage modes, set by the beat's background:
 * - "paper"  — no bg: the element sits on the receipt paper, full type.
 * - "photo"  — a real photograph fills the frame; the element becomes a
 *   printed CARD lying on the scene (always warm paper + ink — a receipt
 *   is physical paper, it has no dark mode), titles become boxed lines.
 * - "ink"    — solid ink; paper-colored type. The inverted beat.
 * - "bed"    — nothing at all. The reel's bed shows through.
 *
 * "bed" is the only mode that paints NOTHING. Every other mode fills the
 * frame opaquely, which is why a bed under an ordinary beat is invisible:
 * the beat covers it. A beat that wants the bed says so.
 */

export type StageMode = "paper" | "photo" | "ink" | "bed";

export type ReelElementSpec = (
  | {
      /**
       * Nothing on the stage. The background, the frame rule and the
       * caption band, and no element at all.
       *
       * Every beat used to need a real element, so a shot whose whole
       * content is "the picture behind it and the words being said" had to
       * borrow one — and the nearest borrowable thing, `title`, prints the
       * sentence a second time in a headline while the band builds it word
       * by word underneath. Two reproductions came out with that redundant
       * double text layer and both gap lists named it. This is the escape
       * hatch: a screen that draws nothing, so the beat is its ground and
       * its voice.
       *
       * One part, and nothing to print on it — a `[+]` on a blank beat is
       * a cue with no addressee.
       */
      type: "blank";
    }
  | {
      /** One typographic statement — the hook, the turn. One part. */
      type: "title";
      text: string;
      kicker?: string;
      sub?: string;
    }
  | {
      /** ASCII specimen with its receipt row. Two parts: art, then row. */
      type: "figure";
      image: string;
      /** Injected by render-reel.mjs, like an art slide. */
      ascii?: string;
      kicker?: string;
      title?: string;
      value?: string;
      line?: string;
      cols?: number;
      contrast?: number;
      gamma?: number;
      floor?: number;
      invert?: boolean;
      cutout?: boolean;
      crop?: number[];
    }
  | {
      /**
       * Animated ASCII specimen — a GIF/short clip from posts/clips/,
       * every frame converted like an art slide and looped. Two parts:
       * the clip, then the row.
       */
      type: "clip";
      file: string;
      /** Injected by render-reel.mjs: one ASCII string per source frame. */
      frames?: string[];
      clipFps?: number;
      kicker?: string;
      title?: string;
      value?: string;
      line?: string;
      cols?: number;
      contrast?: number;
      gamma?: number;
      floor?: number;
      invert?: boolean;
      crop?: number[];
    }
  | {
      /**
       * Real app footage on the paper — a screen recording from
       * posts/clips/, played as video and never converted. The moving
       * twin of `mockup`: the same real screen, with a time axis. Made by
       * tools/capture_demo.sh, which drives the actual app in the
       * simulator. Two parts: the recording, then the row.
       */
      type: "recording";
      file: string;
      /** Injected by render-reel.mjs: the take's length in reel frames. */
      loopFrames?: number;
      /** Injected by render-reel.mjs: the take's width ÷ its height. */
      aspect?: number;
      /** Replay the take until the beat ends. Default: true. */
      loop?: boolean;
      /** Playback speed — 1.5 sells a scroll a beat cannot wait out. */
      rate?: number;
      kicker?: string;
      title?: string;
      value?: string;
      line?: string;
    }
  | {
      /** Receipt table. Parts: each row, then the total if present. */
      type: "table";
      title?: string;
      rows: { left: string; right: string }[];
      total?: { left: string; right: string };
    }
  | {
      /** One hero number. One part. */
      type: "stat";
      value: string;
      label?: string;
      line?: string;
    }
  | {
      /**
       * Real footage or a real photograph, at full quality — the one
       * element in the system that is NOT converted to glyphs. Someone
       * else's interview, a lab bench, a shelf: the thing itself, when the
       * thing itself is the evidence and a specimen would only imply it.
       *
       * `credit` is required and printed. It is the courtesy that makes
       * quoting someone's video work as quoting rather than taking.
       *
       * Two parts: the media, then the receipt row under it.
       */
      type: "footage";
      /**
       * A shaped, placed window onto moving pictures — preset, ratio,
       * radius, anchor, keyframe tracks and the spill. See docs/FOOTAGE.md.
       *
       * It sits beside `media` rather than replacing it: `media` is one
       * credited excerpt drawn on the paper, this is a box that can be any
       * shape anywhere and can be animated. The overlap is deliberate and
       * `media` is the one that should eventually go.
       */
      spec: FootageSpec;
    }
  | {
      type: "media";
      /** A file in posts/media/ — .mp4/.mov, or .jpg/.png. */
      file: string;
      /**
       * "YouTube — Huberman Lab". Required in the POST — it is the row
       * that keeps posts/media/LICENSES.md honest — but off the screen
       * unless `creditOnScreen` asks for it.
       */
      credit: string;
      /** Print the credit on the frame. For quoting someone else's video. */
      creditOnScreen?: boolean;
      /** "card" (default): framed on the paper. "bleed": fills the screen. */
      fit?: "card" | "bleed";
      /** Seconds into the source file the excerpt starts / ends. */
      start?: number;
      end?: number;
      /**
       * Their own audio, 0–1. Default 0 — the narration owns the track.
       * Above 0 the beat must be silent (no `say`): two voices at once is
       * neither of them.
       */
      audio?: number;
      /** Printed in the caption band while it plays — what they are saying. */
      quote?: string[];
      kicker?: string;
      title?: string;
      value?: string;
      line?: string;
      /** Injected by render-reel.mjs. */
      kind?: "video" | "photo";
      aspect?: number;
      trimBefore?: number;
      trimAfter?: number;
    }
  | {
      /**
       * One to three national flags, redrawn in the receipt's three tones
       * (src/Flags.tsx) with a label and a number under each. The element
       * for a beat that turns on WHERE — "the US allows this, the EU does
       * not" — where two country names would cost a second the reel does
       * not have. One part per flag.
       */
      type: "flag";
      flags: { code: string; label: string; value?: string }[];
      kicker?: string;
    }
  | {
      /**
       * The sign-off. The App Store's own product row, unretouched, and
       * one line the voice never says — the eye reads it in under two
       * seconds while the last spoken beat is still decaying. One part.
       *
       * Deliberately not `cta`: that one is a wordmark and a drawn button,
       * which is an advertisement for a listing. This is the listing.
       */
      type: "endcard";
      /** "Comment PANEL for the link" — printed, never spoken. */
      line?: string;
      /** A file in posts/mockups/. Default: the real store row. */
      file?: string;
    }
  | {
      /** Sign-off: wordmark, lines, App Store chip. One part. */
      type: "cta";
      lines?: string[];
      button?: string;
    }
  | {
      /**
       * The composed device frame from posts/mockups/, alone — the
       * sign-off that carries no prose. The phone rises from the bottom
       * edge; `rise` is the fraction of the frame its top reaches.
       */
      type: "mockup";
      file: string;
      rise?: number;
    }
  | {
      /**
       * Any lab element by name (LAB_REGISTRY). The beat's [+] cues map
       * onto the element's own cue props; parts are free-form (as many
       * markers as the element's mapping accepts). Renders full-frame on
       * its own paper — combine with paper beats, not photo/ink bg.
       */
      type: "lab";
      element: string;
      props?: Record<string, unknown>;
    }
) & {
  /**
   * How the element arrives, leaves, or moves once it is there — a
   * property over a span, sampled per frame. One channel for every
   * element rather than the seventeen hand-written entrances this
   * replaces; src/lab/motion.mjs carries the axes and the reasoning.
   *
   * Absent, nothing changes: an element with no `motion` renders exactly
   * as it did before the channel existed.
   */
  motion?: import("./lab/motion.mjs").Motion;
};

/** How many cue-able parts an element exposes, in reading order. */
export const elementParts = (el: ReelElementSpec): number => {
  switch (el.type) {
    // Nothing to print, so nothing to cue: a `[+]` on a blank screen is a
    // marker with no addressee, and the count guard refuses it by arithmetic.
    case "blank":
      return 0;
    case "figure":
    case "clip":
    case "recording":
    case "media":
      return 2;
    case "table":
      return el.rows.length + (el.total ? 1 : 0);
    case "flag":
      return el.flags.length;
    case "lab":
      // `tierlist` maps one cue per item across every tier, so its part
      // count is knowable and the partial-cueing guard applies like any
      // other element. Every other lab element stays free-form: the
      // registry mapping takes as many cues as given.
      if (el.element === "tierlist") return tierListParts(el.props);
      return Number.MAX_SAFE_INTEGER;
    default:
      return 1;
  }
};

const rule = 2;
const PAD_X = 120;
const PAD_RIGHT = 190;
const STAGE_WIDTH = 1080 - PAD_X - PAD_RIGHT;
const STAGE_HEIGHT = STAGE_BOTTOM_REEL - STAGE_TOP;

/**
 * The one measurement this file can make without a browser: SF Mono's
 * advance is exactly 0.6 em at every weight, so a monospace string's width
 * is its length × 0.6 × size, and a size that fits a box is arithmetic.
 * `tier-fit.mjs` established the trick for tier chips; every element that
 * sets a font size now goes through it, which is what makes the widened
 * margin adaptive rather than a crop.
 *
 * Letter spacing is charged per character, because it is.
 */
const monoWidth = (text: string, size: number, tracking = 0) =>
  text.length * size * (0.6 + tracking);

const fitFont = (
  text: string,
  boxWidth: number,
  base: number,
  { min = 0, tracking = 0 }: { min?: number; tracking?: number } = {},
) => {
  const wanted = monoWidth(text, base, tracking);
  if (wanted <= boxWidth) return base;
  return Math.max(min, base * (boxWidth / wanted));
};

/**
 * The receipt row under a specimen, fitted to one line.
 *
 * A row is a label and a number with a gap between them, and it may not
 * wrap: "Sweet potato, baked — 1 cup" breaking after the 1 prints
 * "— 1 / CUP", which separates a number from its unit — the same defect
 * `tier-fit.mjs` exists to prevent on a tier chip. It showed up the hour
 * the safe area widened, on the first render, exactly as predicted.
 */
const fitRow = (
  left: string | undefined,
  right: string | undefined,
  boxWidth: number,
  base = 34,
) =>
  Math.round(
    fitFont(`${left ?? ""}${right ?? ""}`, boxWidth - 32, base, {
      min: 22,
      tracking: 0.05,
    }),
  );

/**
 * How tall a specimen — ASCII figure, converted clip, app recording — is
 * allowed to be. It is the stage minus whatever prints under it: a kicker
 * above, the receipt row and its line below. Derived, so widening the safe
 * area shrinks the art instead of pushing the row off the bottom edge
 * (which is what the old hardcoded 800 did the moment the band moved).
 */
const specimenHeight = (
  mode: StageMode,
  el: { kicker?: string; title?: string; value?: string; line?: string },
) => {
  const band = mode === "photo" ? STAGE_HEIGHT - 190 : STAGE_HEIGHT;
  const row = el.title || el.value ? 44 + 56 : 0;
  const line = el.line ? 24 + 34 : 0;
  return band - (el.kicker ? 92 : 0) - row - line;
};

/**
 * A part arrives at its cue; a part with no cue is on the paper from the
 * cut. The HOW lives in src/lab/reveal.ts — one definition for the whole
 * system, and since 2026-08-11 a short fade rather than the top-down
 * wipe (that file carries the reasoning and whose call it was).
 * `visibility: hidden` before the cue keeps the layout stable: parts
 * never reflow, which was always the load-bearing half of the rule.
 */
const usePrintedStyle = (cue: number | undefined): React.CSSProperties => {
  const frame = useCurrentFrame();
  if (cue === undefined || cue <= 0) return {};
  return revealStyle(frame, cue);
};

const Printed: React.FC<{
  cue: number | undefined;
  children: React.ReactNode;
}> = ({ cue, children }) => (
  <div style={usePrintedStyle(cue)}>{children}</div>
);

const Kicker: React.FC<{ text: string; palette: Palette }> = ({
  text,
  palette,
}) => (
  <div
    style={{
      fontFamily: mono,
      fontSize: 26,
      letterSpacing: "0.25em",
      textTransform: "uppercase",
      color: palette.faded,
      marginBottom: 40,
    }}
  >
    {mu(text)}
  </div>
);

// A title picks its size from its length, then gives back whatever the
// longest single word needs to survive the margin — a word cannot wrap,
// so it is the one that decides whether the block clears the edge.
const titleSize = (text: string, boxWidth = STAGE_WIDTH) => {
  const ladder = text.length <= 40 ? 84 : text.length <= 90 ? 66 : 54;
  const longest = text.split(/\s+/).reduce((a, b) => (b.length > a.length ? b : a), "");
  return Math.round(fitFont(longest, boxWidth, ladder, { min: 40, tracking: 0.05 }));
};

const hasEmphasis = (text: string) => /\*[^*]+\*/.test(text);
const richText = (text: string) =>
  text.split(/(\*[^*]+\*)/).map((part, i) =>
    part.length > 2 && part.startsWith("*") && part.endsWith("*") ? (
      <span key={i} style={{ fontWeight: 800 }}>
        {mu(part.slice(1, -1))}
      </span>
    ) : (
      mu(part)
    ),
  );

const Row: React.FC<{
  left?: string;
  right?: string;
  palette: Palette;
  heavy?: boolean;
  /** Fitted by the caller when a table's widest pair would cross the edge. */
  size?: number;
}> = ({ left, right, palette, heavy, size }) => (
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "baseline",
      gap: 24,
      padding: heavy ? "26px 0 0" : "22px 0",
      borderBottom: heavy ? undefined : `${rule}px dashed ${palette.trace}`,
      borderTop: heavy ? `${rule}px solid ${palette.ink}` : undefined,
      fontFamily: mono,
      fontWeight: heavy ? 700 : 400,
      fontSize: size ?? (heavy ? 34 : 29),
      textTransform: "uppercase",
      color: palette.ink,
    }}
  >
    <span style={{ letterSpacing: "0.06em" }}>{mu(left)}</span>
    <span style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{mu(right)}</span>
  </div>
);

/**
 * The printed card an element becomes when it lies on a photograph — warm
 * paper, ink type, a hairline. A receipt is physical; it has no dark mode.
 */
const Card: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      backgroundColor: tokens.paper,
      border: `${rule}px solid ${tokens.ink}`,
      padding: "44px 52px",
      width: "100%",
      boxSizing: "border-box",
    }}
  >
    {children}
  </div>
);

/** Title lines boxed in ink over a photograph — readable on anything. */
const BoxedTitle: React.FC<{ element: Extract<ReelElementSpec, { type: "title" }> }> = ({
  element,
}) => (
  <div style={{ textAlign: "center" }}>
    {element.kicker ? (
      <div style={{ marginBottom: 36 }}>
        <span
          style={{
            backgroundColor: tokens.ink,
            color: tokens.faded,
            padding: "10px 22px",
            fontFamily: mono,
            fontSize: 26,
            letterSpacing: "0.25em",
            textTransform: "uppercase",
          }}
        >
          {mu(element.kicker)}
        </span>
      </div>
    ) : null}
    <span
      style={{
        backgroundColor: tokens.ink,
        color: tokens.paper,
        boxDecorationBreak: "clone",
        WebkitBoxDecorationBreak: "clone",
        padding: "10px 28px",
        fontFamily: mono,
        fontWeight: hasEmphasis(element.text) ? 400 : 700,
        // The ink box eats 28 px of padding a side and the card another 52.
        fontSize: titleSize(element.text.replace(/\*/g, ""), STAGE_WIDTH - 160),
        lineHeight: 1.62,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
      }}
    >
      {richText(element.text)}
    </span>
  </div>
);

/** The animated specimen: plays the converted frames at the clip's own
 *  rate (30 = REEL_FPS, hardcoded to avoid a circular import), looping. */
const AsciiFrames: React.FC<{
  frames: string[];
  clipFps: number;
  fontSize: number;
  ink: string;
}> = ({ frames, clipFps, fontSize, ink }) => {
  const frame = useCurrentFrame();
  const idx = Math.floor((frame * clipFps) / 30) % Math.max(1, frames.length);
  return (
    <div
      style={{
        fontFamily: mono,
        fontSize,
        lineHeight: 1,
        whiteSpace: "pre",
        color: ink,
      }}
    >
      {frames[idx] ?? ""}
    </div>
  );
};

const Element: React.FC<{
  element: ReelElementSpec;
  cueFrames: number[];
  palette: Palette;
  mode: StageMode;
}> = ({ element, cueFrames, palette, mode }) => {
  switch (element.type) {
    case "title": {
      if (mode === "photo") {
        return (
          <Printed cue={cueFrames[0]}>
            <BoxedTitle element={element} />
          </Printed>
        );
      }
      return (
        <Printed cue={cueFrames[0]}>
          {element.kicker ? (
            <Kicker text={element.kicker} palette={palette} />
          ) : null}
          <div
            style={{
              fontFamily: mono,
              fontWeight: hasEmphasis(element.text) ? 400 : 700,
              fontSize: titleSize(element.text.replace(/\*/g, "")),
              lineHeight: 1.28,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              color: palette.ink,
            }}
          >
            {richText(element.text)}
          </div>
          {element.sub ? (
            <div
              style={{
                marginTop: 48,
                fontFamily: mono,
                fontSize: 30,
                lineHeight: 1.5,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: palette.faded,
              }}
            >
              {mu(element.sub)}
            </div>
          ) : null}
        </Printed>
      );
    }

    case "figure": {
      // Same metric contract as the art slide: SF Mono, 0.6 em advance,
      // 1.0 line height — anything else and the aspect drifts.
      const artLines = (element.ascii ?? "").split("\n");
      const artCols = Math.max(1, ...artLines.map((l) => l.length));
      const innerW = mode === "photo" ? STAGE_WIDTH - 104 : STAGE_WIDTH;
      const maxArtH = specimenHeight(mode, element);
      const fontSize = Math.min(
        innerW / (artCols * 0.6),
        maxArtH / artLines.length,
      );
      return (
        <div style={{ width: "100%" }}>
          <Printed cue={cueFrames[0]}>
            {element.kicker ? (
              <Kicker text={element.kicker} palette={palette} />
            ) : null}
            <div style={{ display: "flex", justifyContent: "center" }}>
              <div
                style={{
                  fontFamily: mono,
                  fontSize,
                  lineHeight: 1,
                  whiteSpace: "pre",
                  color: palette.ink,
                }}
              >
                {artLines.join("\n")}
              </div>
            </div>
          </Printed>
          <Printed cue={cueFrames[1]}>
            {element.title || element.value ? (
              <div style={{ marginTop: 44 }}>
                <Row
                  left={element.title}
                  right={element.value}
                  palette={palette}
                  heavy
                  size={fitRow(element.title, element.value, innerW)}
                />
              </div>
            ) : null}
            {element.line ? (
              <div
                style={{
                  marginTop: 24,
                  fontFamily: mono,
                  fontSize: 24,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: palette.faded,
                }}
              >
                {mu(element.line)}
              </div>
            ) : null}
          </Printed>
        </div>
      );
    }

    case "clip": {
      // Same metric contract as the still figure; frames are converted
      // with trim: false so every frame shares one geometry — measure the
      // first and the block never breathes.
      const clipLines = (element.frames?.[0] ?? "").split("\n");
      const clipCols = Math.max(1, ...clipLines.map((l) => l.length));
      const innerW = mode === "photo" ? STAGE_WIDTH - 104 : STAGE_WIDTH;
      const maxClipH = specimenHeight(mode, element);
      const clipFont = Math.min(
        innerW / (clipCols * 0.6),
        maxClipH / clipLines.length,
      );
      return (
        <div style={{ width: "100%" }}>
          <Printed cue={cueFrames[0]}>
            {element.kicker ? (
              <Kicker text={element.kicker} palette={palette} />
            ) : null}
            <div style={{ display: "flex", justifyContent: "center" }}>
              <AsciiFrames
                frames={element.frames ?? []}
                clipFps={element.clipFps ?? 12}
                fontSize={clipFont}
                ink={palette.ink}
              />
            </div>
          </Printed>
          <Printed cue={cueFrames[1]}>
            {element.title || element.value ? (
              <div style={{ marginTop: 44 }}>
                <Row
                  left={element.title}
                  right={element.value}
                  palette={palette}
                  heavy
                  size={fitRow(element.title, element.value, innerW)}
                />
              </div>
            ) : null}
            {element.line ? (
              <div
                style={{
                  marginTop: 24,
                  fontFamily: mono,
                  fontSize: 24,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: palette.faded,
                }}
              >
                {mu(element.line)}
              </div>
            ) : null}
          </Printed>
        </div>
      );
    }

    case "recording": {
      // The app itself, running. Framed like a specimen taped to the
      // sheet: a hairline rule around it and nothing else — no rounded
      // corners, no shadow, no device chrome. `mockup` does the same for
      // a still, full-bleed at the bottom edge; here the paper stays
      // visible around the frame because a row usually follows.
      const innerW = mode === "photo" ? STAGE_WIDTH - 104 : STAGE_WIDTH;
      const maxRecH = specimenHeight(mode, element);
      const rate = element.rate ?? 1;
      // A take shorter than its beat replays: the flow reads twice rather
      // than freezing on its last frame. `Loop` wants the length in reel
      // frames, so the take's own length is divided by the playback rate.
      const loopFrames = Math.max(
        1,
        Math.round((element.loopFrames ?? 0) / rate),
      );
      // The frame is measured, not fitted: the take fills the stage's
      // width until it would outgrow its height, and the hairline hugs
      // the footage instead of boxing paper around it.
      const aspect = element.aspect ?? 1;
      const recW = Math.min(innerW, maxRecH * aspect);
      const recH = recW / aspect;
      const media = (
        <OffthreadVideo
          src={staticFile(`clips/${element.file}`)}
          playbackRate={rate}
          muted
          style={{ display: "block", width: recW, height: recH }}
        />
      );
      return (
        <div style={{ width: "100%" }}>
          <Printed cue={cueFrames[0]}>
            {element.kicker ? (
              <Kicker text={element.kicker} palette={palette} />
            ) : null}
            <div style={{ display: "flex", justifyContent: "center" }}>
              <div
                style={{
                  border: `1px solid ${palette.trace}`,
                  backgroundColor: palette.paper,
                  lineHeight: 0,
                }}
              >
                {/* layout="none": a Sequence fills its parent absolutely
                    by default, which would lift the take out of the
                    column and print the row underneath it. */}
                {(element.loop ?? true) && element.loopFrames ? (
                  <Loop durationInFrames={loopFrames} layout="none">
                    {media}
                  </Loop>
                ) : (
                  media
                )}
              </div>
            </div>
          </Printed>
          <Printed cue={cueFrames[1]}>
            {element.title || element.value ? (
              <div style={{ marginTop: 44 }}>
                <Row
                  left={element.title}
                  right={element.value}
                  palette={palette}
                  heavy
                  size={fitRow(element.title, element.value, innerW)}
                />
              </div>
            ) : null}
            {element.line ? (
              <div
                style={{
                  marginTop: 24,
                  fontFamily: mono,
                  fontSize: 24,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: palette.faded,
                }}
              >
                {mu(element.line)}
              </div>
            ) : null}
          </Printed>
        </div>
      );
    }

    case "table": {
      // A row is one line or it is two, and two is where a table stops
      // reading as an instrument. The widest pair in the table decides the
      // size for all of them — a table with one long label prints small
      // and even rather than ragged, which is the receipt's own habit.
      const innerW = (mode === "photo" ? STAGE_WIDTH - 104 : STAGE_WIDTH) - 24;
      const pairs = [
        ...element.rows.map((r) => `${r.left}${r.right}`),
        ...(element.total ? [`${element.total.left}${element.total.right}`] : []),
      ];
      const widest = pairs.reduce((a, b) => (b.length > a.length ? b : a), "");
      const rowSize = Math.round(
        fitFont(widest, innerW, 29, { min: 20, tracking: 0.03 }),
      );
      return (
        <div style={{ width: "100%" }}>
          {element.title ? (
            <div
              style={{
                fontFamily: mono,
                fontSize: 26,
                letterSpacing: "0.25em",
                textTransform: "uppercase",
                color: palette.faded,
                marginBottom: 30,
              }}
            >
              {mu(element.title)}
            </div>
          ) : null}
          {element.rows.map((row, i) => (
            <Printed key={i} cue={cueFrames[i]}>
              <Row
                left={row.left}
                right={row.right}
                palette={palette}
                size={rowSize}
              />
            </Printed>
          ))}
          {element.total ? (
            <Printed cue={cueFrames[element.rows.length]}>
              <div style={{ marginTop: 10 }}>
                <Row
                  left={element.total.left}
                  right={element.total.right}
                  palette={palette}
                  heavy
                  size={Math.round(rowSize * 1.17)}
                />
              </div>
            </Printed>
          ) : null}
        </div>
      );
    }

    case "stat": {
      // The hero number is the one element that cannot wrap and cannot be
      // abbreviated, so it is the first thing a narrower stage breaks.
      // 170 px holds seven characters; past that it comes down to fit.
      const statSize = Math.round(
        fitFont(
          element.value,
          (mode === "photo" ? STAGE_WIDTH - 104 : STAGE_WIDTH),
          170,
          { min: 84 },
        ),
      );
      return (
        <Printed cue={cueFrames[0]}>
          {element.label ? (
            <Kicker text={element.label} palette={palette} />
          ) : null}
          <div
            style={{
              fontFamily: mono,
              fontWeight: 700,
              fontSize: statSize,
              lineHeight: 1,
              color: palette.ink,
            }}
          >
            {element.value}
          </div>
          {element.line ? (
            <div
              style={{
                marginTop: 44,
                fontFamily: mono,
                fontSize: 34,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: palette.ink,
              }}
            >
              {mu(element.line)}
            </div>
          ) : null}
        </Printed>
      );
    }

    case "footage":
      // The box owns the whole frame and places itself inside it — it does
      // not sit on the stage's column like the drawn elements do, because a
      // "full" box has to reach the canvas edge and the stage's margins
      // exist to stop type from doing that.
      return <Footage spec={element.spec} />;

    case "media": {
      // Everything else on this stage is 48 to 72 glyphs a line. This one
      // is the real thing at full resolution, and the contrast is the
      // point — a photograph among specimens reads as evidence, a reel of
      // photographs reads as anybody's.
      const innerW = mode === "photo" ? STAGE_WIDTH - 104 : STAGE_WIDTH;
      const maxH = specimenHeight(mode, element);
      const aspect = element.aspect ?? 16 / 9;
      const mW = Math.min(innerW, maxH * aspect);
      const mH = mW / aspect;
      const shown =
        element.kind === "video" ? (
          <OffthreadVideo
            src={staticFile(`media/${element.file}`)}
            trimBefore={element.trimBefore}
            trimAfter={element.trimAfter}
            muted={!element.audio}
            volume={element.audio ?? 0}
            style={{ display: "block", width: mW, height: mH }}
          />
        ) : (
          <Img
            src={staticFile(`media/${element.file}`)}
            style={{ display: "block", width: mW, height: mH, objectFit: "cover" }}
          />
        );
      return (
        <div style={{ width: "100%" }}>
          <Printed cue={cueFrames[0]}>
            {element.kicker ? (
              <Kicker text={element.kicker} palette={palette} />
            ) : null}
            <div style={{ display: "flex", justifyContent: "center" }}>
              <div style={{ border: `1px solid ${palette.trace}`, lineHeight: 0 }}>
                {shown}
              </div>
            </div>
            {/* The credit is OFF the frame unless the beat asks for it
                (Martin, 2026-08-11: "pas besoin de citer la source
                d'images"). A stock still we hold a licence to owes nobody
                a line on screen — the row in posts/media/LICENSES.md is
                the record, and THAT one is not optional. `creditOnScreen`
                is for the case that genuinely needs it: quoting somebody
                else's footage, where the visible attribution is what
                makes it a quote rather than a lift. */}
            {element.creditOnScreen ? (
              <div
                style={{
                  marginTop: 16,
                  textAlign: "right",
                  fontFamily: mono,
                  fontSize: 20,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: palette.faded,
                }}
              >
                {mu(element.credit)}
              </div>
            ) : null}
          </Printed>
          <Printed cue={cueFrames[1]}>
            {element.title || element.value ? (
              <div style={{ marginTop: 28 }}>
                <Row
                  left={element.title}
                  right={element.value}
                  palette={palette}
                  heavy
                  size={fitRow(element.title, element.value, innerW)}
                />
              </div>
            ) : null}
            {element.line ? (
              <div
                style={{
                  marginTop: 24,
                  fontFamily: mono,
                  fontSize: 24,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: palette.faded,
                }}
              >
                {mu(element.line)}
              </div>
            ) : null}
          </Printed>
        </div>
      );
    }

    case "flag": {
      const n = Math.max(1, element.flags.length);
      const gap = 56;
      const cellW = Math.min(340, (STAGE_WIDTH - gap * (n - 1)) / n);
      // The label is the identification, so it is the thing that must fit:
      // two tricolours are one drawing and two different words.
      const longest = element.flags.reduce(
        (a, f) => (f.label.length > a.length ? f.label : a),
        "",
      );
      const labelSize = Math.round(
        fitFont(longest, cellW, 27, { min: 17, tracking: 0.1 }),
      );
      return (
        <div style={{ width: "100%" }}>
          {element.kicker ? (
            <Kicker text={element.kicker} palette={palette} />
          ) : null}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "flex-start",
              gap,
            }}
          >
            {element.flags.map((f, i) => (
              <Printed key={i} cue={cueFrames[i]}>
                <div style={{ width: cellW }}>
                  <div style={{ border: `${rule}px solid ${palette.ink}`, lineHeight: 0 }}>
                    <Flag code={f.code} id={`f${i}-${f.code}`} />
                  </div>
                  <div
                    style={{
                      marginTop: 22,
                      fontFamily: mono,
                      fontSize: labelSize,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: palette.faded,
                    }}
                  >
                    {mu(f.label)}
                  </div>
                  {f.value ? (
                    <div
                      style={{
                        marginTop: 14,
                        fontFamily: mono,
                        fontWeight: 700,
                        fontSize: Math.round(
                          fitFont(f.value, cellW, 62, { min: 34 }),
                        ),
                        lineHeight: 1.1,
                        color: palette.ink,
                      }}
                    >
                      {mu(f.value)}
                    </div>
                  ) : null}
                </div>
              </Printed>
            ))}
          </div>
        </div>
      );
    }

    case "endcard":
      return (
        <Printed cue={cueFrames[0]}>
          <div style={{ width: "100%", textAlign: "center" }}>
            {/* No frame, and no background either.

                First: a hairline around it is a white rectangle drawn
                around nothing (Martin, 2026-08-11: "pas besoin de mettre
                des bordures blanches car ça a le même fond").

                Then the same argument one level down. The screenshot's
                own page is PURE BLACK and our dark paper is #151412 —
                21 units apart, which is a visible rectangle, the exact
                defect that made `bg: "ink"` a no-op at six units. So the
                default is now the CUT-OUT row: alpha instead of a black
                plate, and the icon, the title and the button sit
                straight on our paper. Its edge is its own shape. */}
            <Img
              src={staticFile(`mockups/${element.file ?? "appstore-row.png"}`)}
              style={{ display: "block", width: STAGE_WIDTH }}
            />
            {element.line ? (
              <div
                style={{
                  marginTop: 44,
                  fontFamily: mono,
                  fontWeight: 700,
                  fontSize: Math.round(
                    fitFont(element.line, STAGE_WIDTH, 38, { min: 24, tracking: 0.1 }),
                  ),
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: palette.ink,
                }}
              >
                {mu(element.line)}
              </div>
            ) : null}
          </div>
        </Printed>
      );

    case "cta":
      return (
        <Printed cue={cueFrames[0]}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontFamily: mono,
                fontWeight: 700,
                fontSize: 100,
                letterSpacing: "0.3em",
                paddingLeft: "0.3em",
                textTransform: "uppercase",
                color: palette.ink,
              }}
            >
              {wordmark()}
            </div>
            <div
              style={{
                marginTop: 48,
                width: 140,
                height: rule,
                backgroundColor: palette.trace,
              }}
            />
            {(element.lines ?? []).map((line, i) => (
              <div
                key={i}
                style={{
                  marginTop: i === 0 ? 48 : 24,
                  fontFamily: mono,
                  fontSize: 28,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: palette.faded,
                }}
              >
                {mu(line)}
              </div>
            ))}
            <div
              style={{
                marginTop: 72,
                border: `${rule}px solid ${palette.ink}`,
                padding: "24px 48px",
                fontFamily: mono,
                fontWeight: 600,
                fontSize: 28,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: palette.ink,
              }}
            >
              {mu(element.button ?? "On the App Store")}
            </div>
          </div>
        </Printed>
      );
  }
};

/**
 * The stage: one element, centered in the zone above the caption band.
 * The mode decides what the element is made of: type on paper, a printed
 * card on a photograph, paper type on ink.
 */
/**
 * The stage box every ordinary element sits in — and, when the beat asks
 * for one, the element's own motion.
 *
 * It is a component rather than a few lines inside `Stage` for one
 * reason: `Stage` returns early for blank, mockup, bleed media and lab
 * elements, so a `useCurrentFrame()` in its tail would be a hook after a
 * conditional return. This is also the honest place for the style —
 * the box IS the element's node here, not a wrapper thrown around it, so
 * a transform on it cannot cut a blended layer off its backdrop.
 */
const StageBox: React.FC<{
  motion?: import("./lab/motion.mjs").Motion;
  life?: number;
  centered: boolean;
  children: React.ReactNode;
}> = ({ motion, life, centered, children }) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        position: "absolute",
        top: STAGE_TOP,
        bottom: 1920 - STAGE_BOTTOM_REEL,
        left: PAD_X,
        right: PAD_RIGHT,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: centered ? "center" : "stretch",
        ...motionStyle(motion, frame, { life }),
      }}
    >
      {children}
    </div>
  );
};

export const Stage: React.FC<{
  element: ReelElementSpec;
  cueFrames: number[];
  theme: "light" | "dark";
  mode: StageMode;
  /** The beat's whole span in frames — what an `at: "exit"` hangs off. */
  life?: number;
}> = ({ element, cueFrames, theme, mode, life }) => {
  // Nothing on the stage. Not a no-op with a placeholder in it and not an
  // empty card: no node at all, so the beat's ground, its frame rule and
  // its caption band are the whole picture.
  if (element.type === "blank") return null;

  // The mockup owns the whole frame and says nothing — it rises from the
  // bottom edge while the voice delivers the ask.
  if (element.type === "mockup") {
    const rise = element.rise ?? 0.62;
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: palettes[theme].paper,
        }}
      >
        <Img
          src={staticFile(`mockups/${element.file}`)}
          style={{
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            top: `${(1 - rise) * 100}%`,
            width: 660,
          }}
        />
      </div>
    );
  }

  // Full-bleed media owns the frame the way a photo bg does — no paper, no
  // card, no margin. Reserved for the shot that IS the beat (the person
  // saying the thing, the shelf, the bench); anything with a number under
  // it belongs in a card, where the paper can hold the number.
  if (element.type === "media" && element.fit === "bleed") {
    const light = palettes.light;
    return (
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", backgroundColor: palettes[theme].paper }}>
        {element.kind === "video" ? (
          <OffthreadVideo
            src={staticFile(`media/${element.file}`)}
            trimBefore={element.trimBefore}
            trimAfter={element.trimAfter}
            muted={!element.audio}
            volume={element.audio ?? 0}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <Img
            src={staticFile(`media/${element.file}`)}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        )}
        {/* Only when the beat asks. On footage it is a boxed line, bottom
            left, clear of the action rail and of the caption band. */}
        {element.creditOnScreen ? (
          <div
            style={{
              position: "absolute",
              left: PAD_X,
              top: STAGE_BOTTOM_REEL - 44,
              backgroundColor: light.ink,
              color: light.paper,
              padding: "10px 18px",
              fontFamily: mono,
              fontSize: 20,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
            }}
          >
            {mu(element.credit)}
          </div>
        ) : null}
      </div>
    );
  }

  // Lab elements own their whole frame — paper, layout, motion. The [+]
  // cues flow into their own cue props through the registry mapping.
  if (element.type === "lab") {
    const entry = LAB_REGISTRY[element.element];
    if (!entry) {
      throw new Error(`unknown lab element "${element.element}"`);
    }
    const Comp = entry.component;
    const paper = palettes[theme].paper;
    return (
      <div style={{ position: "absolute", inset: 0, backgroundColor: paper }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            transform: `translateY(${STAGE_TOP - LAB_AUTHORED_TOP}px) scale(${LAB_SCALE})`,
            transformOrigin: `50% ${LAB_AUTHORED_TOP}px`,
          }}
        >
          <Comp
            theme={theme}
            {...(element.props ?? {})}
            {...entry.mapCues(cueFrames, element.props ?? {})}
          />
        </div>
      </div>
    );
  }
  // A card is physical paper — always light. The ink beat inverts the
  // POST'S OWN skin (dark post → light beat, light post → dark beat), so
  // the turn reads as a jolt in either theme; the paper beat follows the
  // post's theme. Inverting a fixed light pair made the beat invisible on
  // a dark post, which is every reel we ship.
  const palette: Palette =
    mode === "photo"
      ? palettes.light
      : mode === "ink"
        ? palettes[theme === "dark" ? "light" : "dark"]
        : palettes[theme];

  const centered =
    element.type === "cta" ||
    element.type === "endcard" ||
    (element.type === "title" && mode === "photo");
  const body = (
    <Element
      element={element}
      cueFrames={cueFrames}
      palette={palette}
      mode={mode}
    />
  );
  return (
    <StageBox motion={element.motion} life={life} centered={centered}>
      {mode === "photo" && element.type !== "title" ? (
        <Card>{body}</Card>
      ) : (
        body
      )}
    </StageBox>
  );
};
