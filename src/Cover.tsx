import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { mono, mu, palettes, type Palette } from "./tokens";
import {
  COVER_BOX_W,
  COVER_HEIGHT,
  COVER_PAD_X,
  COVER_SAFE_H,
  COVER_SAFE_TOP,
  COVER_RULE,
  COVER_WIDTH,
  GLYPH_ADVANCE,
  SPECIMEN_GAP,
  SPECIMEN_RULE,
  SPECIMEN_RULE_GAP,
  layoutCover,
} from "./cover-fit.mjs";

export { COVER_WIDTH, COVER_HEIGHT };

/**
 * The cover — the still that sells the post on a GRID, not in a feed.
 *
 * In the TikTok For You feed and the Instagram Reels feed the video
 * autoplays: there is no click, no thumbnail, and the reel's own first
 * frame does the work. A cover decides where a tile sits still and waits —
 * the profile grid, search results, Explore. For an evergreen account those
 * are the long tail and the profile-visitor conversion, so a cover is
 * authored for a tile a third of a phone wide, never for a full screen.
 *
 * Two consequences run through every number here and in cover-fit.mjs.
 *
 * 1. THE CROP. Each surface takes a different rectangle out of the same 9:16
 *    file and they are all CENTER crops, so the squarest one sets the band.
 *    Everything a reader must read lives inside it; the rest of the frame is
 *    bleed — paper the tile throws away.
 * 2. THE SIZE. 1080 authored pixels are shown across ~128 pt. Authored 60 px
 *    is 7 pt on the phone: a caption, not a headline. The headline runs
 *    110–260 px and the hero token twice that.
 *
 * The house system is unchanged: paper, two inks, SF Mono, hairlines. Stamp
 * red is not imported here on purpose — the evening verdict owns it.
 */

/** 8 px, not the slides' 2. A receipt hairline is invisible on a tile. */
const rule = COVER_RULE;

export type CoverSpec = {
  /**
   * The headline — THREE OR FOUR WORDS. `*…*` prints Heavy against Regular,
   * the same emphasis grammar as a `hook` slide and the only weight contrast
   * on the page. Two lines of a tile is the reading budget once a figure is
   * under it: roughly 24 characters. The fitter states the budget when a
   * line misses it.
   */
  text: string;
  /**
   * The hero token above the headline — a number, a unit, a verdict word.
   * This is the SIZE contrast, and it is the one thing still legible when
   * the tile is a thumbnail of a thumbnail.
   */
  value?: string;
  /** Tiny uppercase label over everything — series, file number, source. */
  kicker?: string;
  /** One faded line under the headline. A full-size detail, not a tile one. */
  line?: string;
  /** The specimen under the type — ASCII, a lab element, or a small table. */
  specimen?: CoverSpecimen;
  /**
   * Print the whole tile in solid ink with paper type. Two inks give exactly
   * one way to be the loudest thing in a grid of twenty tiles, and this is
   * it — the reel's `ink` stage, standing still. Use it sparingly: a profile
   * grid where every tile is inverted is a grid with no contrast again.
   */
  invert?: boolean;
};

export type CoverSpecimen =
  | {
      /** ASCII figure from posts/art/, converted by the render script. */
      type: "art";
      image: string;
      /** Injected by render-cover.mjs, exactly like an `art` slide. */
      ascii?: string;
      cols?: number;
      contrast?: number;
      gamma?: number;
      floor?: number;
      invert?: boolean;
      cutout?: boolean;
      crop?: number[];
      /** "ink" (default) prints it solid; "faded" holds the specimen back. */
      weight?: "ink" | "faded" | "trace";
    }
  | {
      /**
       * A lab element's settled end state. render-cover.mjs renders it
       * through the existing ElementFrame composition and trims the paper
       * off — the elements are photographed, never rebuilt.
       */
      type: "element";
      element: string;
      props?: Record<string, unknown>;
      frame?: number;
      /** Injected by render-cover.mjs: the staged file under public/covers/. */
      file?: string;
      /** Injected too — width ÷ height of the trimmed still, so the band
       *  allocator can size the figure from the drawing, not from a guess. */
      aspect?: number;
    }
  | {
      /** A receipt tape cut to what survives a tile: two rows, three at most. */
      type: "rows";
      rows: { left: string; right: string }[];
    };

export type CoverProps = {
  cover: CoverSpec;
  theme?: "light" | "dark";
};

/* ── the specimen ─────────────────────────────────────────────────────── */

const Specimen: React.FC<{
  spec: CoverSpecimen;
  palette: Palette;
  ink: string;
  width: number;
  figureH: number;
}> = ({ spec, palette, ink, width, figureH }) => {
  const height = figureH;
  if (spec.type === "art") {
    const lines = (spec.ascii ?? "").split("\n");
    const cols = Math.max(1, ...lines.map((l) => l.length));
    // The converter's own metric contract: 0.6 em advance, 1.0 line height.
    // Anything else and the specimen's aspect ratio drifts.
    const size = Math.min(width / (cols * GLYPH_ADVANCE), height / lines.length);
    const color =
      spec.weight === "trace"
        ? palette.trace
        : spec.weight === "faded"
          ? palette.faded
          : ink;
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          width,
          height,
        }}
      >
        <div
          style={{
            fontFamily: mono,
            fontSize: size,
            lineHeight: 1,
            whiteSpace: "pre",
            color,
          }}
        >
          {lines.join("\n")}
        </div>
      </div>
    );
  }

  if (spec.type === "element") {
    // The staged still is trimmed to its own ink, so it just fits the band.
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          width,
          height,
        }}
      >
        <Img
          src={staticFile(`covers/${spec.file}`)}
          style={{ maxWidth: width, maxHeight: height, objectFit: "contain" }}
        />
      </div>
    );
  }

  // A table specimen is TYPE, so it is sized like type: the row height it was
  // given, capped by the widest row. 54 px looked right on the 1080 page and
  // printed at 6 pt on a tile — a receipt nobody can read is decoration, and
  // this system does not do decoration. The cap is a SHARE of the row rather
  // than a fixed pad, so the type grows with the band instead of against it.
  const rowH = Math.floor(figureH / spec.rows.length);
  const widest = Math.max(
    ...spec.rows.map((r) => r.left.length + r.right.length + 3),
  );
  const size = Math.min(rowH * 0.52, width / (widest * 0.62));
  return (
    <div style={{ width }}>
      {spec.rows.map((row, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 32,
            height: rowH,
            boxSizing: "border-box",
            borderBottom:
              i === spec.rows.length - 1
                ? "none"
                : `${rule}px dashed ${palette.trace}`,
            fontFamily: mono,
            fontSize: size,
            textTransform: "uppercase",
            color: ink,
          }}
        >
          <span style={{ letterSpacing: "0.04em" }}>{mu(row.left)}</span>
          <span style={{ fontWeight: 700, whiteSpace: "nowrap" }}>
            {mu(row.right)}
          </span>
        </div>
      ))}
    </div>
  );
};

/* ── the page ─────────────────────────────────────────────────────────── */

export const Cover: React.FC<CoverProps> = ({ cover, theme = "light" }) => {
  const base = palettes[theme];
  // The inverted register swaps the two inks and nothing else — same paper,
  // same hairlines, read from the other side.
  const palette: Palette = cover.invert
    ? { ...base, paper: base.ink, ink: base.paper, trace: base.faded }
    : base;
  const ink = palette.ink;

  // Every band comes from the one allocator, so the audit the renderer
  // prints is measuring the page that actually gets drawn.
  const { size, lines, specimenH, valueSize, figureH } = layoutCover(cover);

  return (
    <AbsoluteFill style={{ backgroundColor: palette.paper }}>
      <div
        style={{
          position: "absolute",
          top: COVER_SAFE_TOP,
          left: COVER_PAD_X,
          width: COVER_BOX_W,
          height: COVER_SAFE_H,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        {cover.kicker ? (
          <div
            style={{
              flexShrink: 0,
              fontFamily: mono,
              fontSize: 36,
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              color: palette.faded,
              marginBottom: 38,
            }}
          >
            {mu(cover.kicker)}
          </div>
        ) : null}

        {cover.value ? (
          <div
            style={{
              flexShrink: 0,
              fontFamily: mono,
              fontWeight: 700,
              fontSize: valueSize,
              lineHeight: 1,
              letterSpacing: "-0.01em",
              whiteSpace: "nowrap",
              color: ink,
              marginBottom: 26,
            }}
          >
            {mu(cover.value)}
          </div>
        ) : null}

        <div
          style={{
            flexShrink: 0,
            fontFamily: mono,
            fontWeight: lines.some((l) => l.some((t) => t.heavy)) ? 400 : 700,
            fontSize: size,
            lineHeight: 1.16,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            color: ink,
          }}
        >
          {lines.map((line, i) => (
            <div key={i} style={{ whiteSpace: "pre" }}>
              {line.map((tok, j) => (
                <span key={j} style={tok.heavy ? { fontWeight: 800 } : undefined}>
                  {j > 0 ? " " : ""}
                  {mu(tok.text)}
                </span>
              ))}
            </div>
          ))}
        </div>

        {cover.line ? (
          <div
            style={{
              flexShrink: 0,
              marginTop: 34,
              fontFamily: mono,
              fontSize: 40,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: palette.faded,
            }}
          >
            {mu(cover.line)}
          </div>
        ) : null}

        {cover.specimen ? (
          // flexShrink: 0 everywhere above and here. Every block on this page
          // is sized by the allocator, so a headline that misses its box must
          // overflow VISIBLY rather than quietly squash the figure out of the
          // safe band, where the crop eats it and the proof sheet looks fine.
          <div
            style={{
              flexShrink: 0,
              marginTop: SPECIMEN_GAP,
              height: specimenH - SPECIMEN_GAP,
            }}
          >
            <div
              style={{
                height: SPECIMEN_RULE,
                backgroundColor: palette.trace,
                marginBottom: SPECIMEN_RULE_GAP,
              }}
            />
            <Specimen
              spec={cover.specimen}
              palette={palette}
              ink={ink}
              width={COVER_BOX_W}
              figureH={figureH}
            />
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
