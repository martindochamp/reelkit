import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { mono, mu, palettes, wordmark, type Palette } from "./tokens";

/**
 * Social slideshow slides — TikTok photo mode / IG carousel. Same receipt
 * system as the store shots: paper, ink, hairlines, uppercase mono. Every
 * slide carries the header rule and the tear-line footer so a swiped set
 * reads as one printed document.
 */

/**
 * Stamp red, verbatim from Theme.swift. Allowed here for exactly one thing:
 * depicting the app's evening verdict on a `verdict` slide. Never chrome,
 * never emphasis, never a third color anywhere else.
 */
const stampRed: Record<"light" | "dark", string> = {
  light: "#C0392B",
  dark: "#D35442",
};

export type SlideSpec =
  | { type: "hook"; text: string; kicker?: string; sub?: string }
  | { type: "statement"; label?: string; value: string; line?: string }
  | {
      type: "lines";
      title?: string;
      rows: { left: string; right: string }[];
      total?: { left: string; right: string };
      /** Marks mock data with the SPECIMEN chip, same honesty rule as onboarding. */
      specimen?: boolean;
      /**
       * Faint ASCII specimens scattered behind the list, free to bleed off the
       * slide edges — the foods the rows name, printed in hairline ink. They
       * are texture, not content: everything the reader must read is in the
       * rows, so a specimen the reel UI crops loses nothing.
       */
      around?: {
        image: string;
        /** Injected by render-slides.mjs, same as an `art` slide. */
        ascii?: string;
        cols?: number;
        cutout?: boolean;
        contrast?: number;
        gamma?: number;
        floor?: number;
        invert?: boolean;
        crop?: number[];
        /** Center of the block, as fractions of the whole slide. */
        x: number;
        y: number;
        /** Block width, as a fraction of the slide width. */
        w: number;
        /** "trace" (default, hairline) or "faded" — never "ink". */
        weight?: "trace" | "faded";
      }[];
    }
  | {
      type: "shot";
      file: string;
      caption?: string;
      /** Fraction of the screen shown from the top (0–1). Half an app is a
       *  question; a whole app is an answer — the mystery mockup uses ~0.55. */
      crop?: number;
    }
  | {
      type: "art";
      /** Source image in posts/art/ — converted by render-slides at render time. */
      image: string;
      /** The finished ASCII text, injected by render-slides.mjs. */
      ascii?: string;
      kicker?: string;
      /** Receipt row under the art: title left, value right. */
      title?: string;
      value?: string;
      /** Faded provenance line under the row — say where the number comes from. */
      line?: string;
      /** img2ascii tuning, passed through per slide. */
      cols?: number;
      contrast?: number;
      gamma?: number;
      floor?: number;
      invert?: boolean;
    }
  | { type: "verdict"; stamp?: string; day?: string }
  | { type: "cta"; lines?: string[]; button?: string }
  | {
      /** Martin's composed device mockup (posts/mockups/), anchored to the
       *  bottom edge and cropped by it — the phone sinks out of the slide,
       *  the CTA sits above. `rise` is the fraction of slide height the
       *  visible part climbs to (default 0.58). */
      type: "mockup";
      file: string;
      lines?: string[];
      button?: string;
      rise?: number;
    };

export type SlideProps = {
  slide: SlideSpec;
  /** 0-based position in the set — printed as 01 / 06 in the header. */
  index: number;
  count: number;
  theme?: "light" | "dark";
  /** Small faded line above the tear line, shared by the whole set. */
  footer?: string;
  /**
   * "tiktok" (1080×1920) keeps the body clear of the caption zone and the
   * button rail; "carousel" (1080×1350) uses the full page.
   */
  format?: "tiktok" | "carousel";
};

export const SLIDE_WIDTH = 1080;
export const TIKTOK_HEIGHT = 1920;
export const CAROUSEL_HEIGHT = 1350;

/** 1080 wide reads at roughly 2.5x — a 2px rule is the app's 1px hairline. */
const rule = 2;
const PAD_X = 84;

// Raw simulator captures are 1320×2868; crop the status bar and home
// indicator away, same numbers as StoreShot's specimen frame.
const RAW_W = 1320;
const RAW_H = 2868;
const CROP_TOP = 190;
const CROP_BOTTOM = 104;
const CROPPED_H = RAW_H - CROP_TOP - CROP_BOTTOM;

const pad2 = (n: number) => String(n).padStart(2, "0");

const Header: React.FC<{ index: number; count: number; palette: Palette }> = ({
  index,
  count,
  palette,
}) => (
  <div>
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        fontFamily: mono,
        textTransform: "uppercase",
      }}
    >
      <span
        style={{
          fontWeight: 700,
          fontSize: 30,
          letterSpacing: "0.28em",
          color: palette.ink,
        }}
      >
        {wordmark()}
      </span>
      <span
        style={{ fontSize: 24, letterSpacing: "0.2em", color: palette.faded }}
      >
        {pad2(index + 1)} / {pad2(count)}
      </span>
    </div>
    <div style={{ marginTop: 32, height: rule, backgroundColor: palette.trace }} />
  </div>
);

const Footer: React.FC<{ footer?: string; palette: Palette }> = ({
  footer,
  palette,
}) => (
  <div>
    <div style={{ borderTop: `${rule}px dashed ${palette.trace}` }} />
    {footer ? (
      <div
        style={{
          marginTop: 28,
          fontFamily: mono,
          fontSize: 21,
          letterSpacing: "0.3em",
          textTransform: "uppercase",
          textAlign: "center",
          color: palette.faded,
        }}
      >
        {mu(footer)}
      </div>
    ) : null}
  </div>
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
      marginBottom: 44,
    }}
  >
    {mu(text)}
  </div>
);

const hookSize = (text: string) =>
  text.length <= 40 ? 84 : text.length <= 90 ? 66 : 54;

/**
 * `*…*` marks emphasis inside a hook: marked spans print Heavy, the rest
 * drops to Regular — weight is the only contrast, size never changes.
 * A hook without markers keeps the original uniform Bold.
 */
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


/**
 * The faint specimens behind a `lines` slide. Positioned against the whole
 * slide rather than the text column, so a block is free to run off the edge —
 * a cropped specimen is still texture, and nothing readable lives out there.
 */
const Scatter: React.FC<{
  items: NonNullable<Extract<SlideSpec, { type: "lines" }>["around"]>;
  palette: Palette;
}> = ({ items, palette }) => (
  <AbsoluteFill style={{ overflow: "hidden" }}>
    {items.map((it, i) => {
      const lines = (it.ascii ?? "").split("\n");
      const cols = Math.max(1, ...lines.map((l) => l.length));
      // Same metric contract as an art slide: SF Mono, 0.6 em advance, 1.0
      // line height — anything else and the specimen's aspect ratio drifts.
      const fontSize = (it.w * SLIDE_WIDTH) / (cols * 0.6);
      return (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${it.x * 100}%`,
            top: `${it.y * 100}%`,
            transform: "translate(-50%, -50%)",
            fontFamily: mono,
            fontSize,
            lineHeight: 1,
            whiteSpace: "pre",
            color: it.weight === "faded" ? palette.faded : palette.trace,
          }}
        >
          {lines.join("\n")}
        </div>
      );
    })}
  </AbsoluteFill>
);

const Body: React.FC<{
  slide: SlideSpec;
  palette: Palette;
  theme: "light" | "dark";
  format: "tiktok" | "carousel";
}> = ({ slide, palette, theme, format }) => {
  switch (slide.type) {
    case "hook":
      return (
        <div>
          {slide.kicker ? <Kicker text={slide.kicker} palette={palette} /> : null}
          <div
            style={{
              fontFamily: mono,
              fontWeight: hasEmphasis(slide.text) ? 400 : 700,
              fontSize: hookSize(slide.text.replace(/\*/g, "")),
              lineHeight: 1.28,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              color: palette.ink,
            }}
          >
            {richText(slide.text)}
          </div>
          {slide.sub ? (
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
              {mu(slide.sub)}
            </div>
          ) : null}
        </div>
      );

    case "statement":
      return (
        <div>
          {slide.label ? <Kicker text={slide.label} palette={palette} /> : null}
          <div
            style={{
              fontFamily: mono,
              fontWeight: 700,
              fontSize: 170,
              lineHeight: 1,
              color: palette.ink,
            }}
          >
            {slide.value}
          </div>
          {slide.line ? (
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
              {mu(slide.line)}
            </div>
          ) : null}
        </div>
      );

    case "lines":
      return (
        <>
          {slide.around?.length ? <Scatter items={slide.around} palette={palette} /> : null}
        <div style={{ width: "100%" }}>
          {slide.title || slide.specimen ? (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 36,
              }}
            >
              {slide.title ? (
                <span
                  style={{
                    fontFamily: mono,
                    fontSize: 26,
                    letterSpacing: "0.25em",
                    textTransform: "uppercase",
                    color: palette.faded,
                  }}
                >
                  {mu(slide.title)}
                </span>
              ) : (
                <span />
              )}
              {slide.specimen ? (
                <span
                  style={{
                    fontFamily: mono,
                    fontSize: 20,
                    letterSpacing: "0.25em",
                    textTransform: "uppercase",
                    color: palette.faded,
                    border: `${rule}px solid ${palette.trace}`,
                    padding: "8px 16px",
                  }}
                >
                  Specimen
                </span>
              ) : null}
            </div>
          ) : null}
          {slide.rows.map((row, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: 24,
                padding: "22px 0",
                borderBottom: `${rule}px dashed ${palette.trace}`,
                fontFamily: mono,
                fontSize: 29,
                textTransform: "uppercase",
                color: palette.ink,
              }}
            >
              <span style={{ letterSpacing: "0.06em" }}>{mu(row.left)}</span>
              <span style={{ fontWeight: 700, whiteSpace: "nowrap" }}>
                {mu(row.right)}
              </span>
            </div>
          ))}
          {slide.total ? (
            <div
              style={{
                marginTop: 10,
                borderTop: `${rule}px solid ${palette.ink}`,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: 24,
                padding: "26px 0 0",
                fontFamily: mono,
                fontWeight: 700,
                fontSize: 36,
                textTransform: "uppercase",
                color: palette.ink,
              }}
            >
              <span style={{ letterSpacing: "0.08em" }}>{mu(slide.total.left)}</span>
              <span style={{ whiteSpace: "nowrap" }}>{mu(slide.total.right)}</span>
            </div>
          ) : null}
        </div>
        </>
      );

    case "shot":
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            width: "100%",
            minHeight: 0,
            flex: 1,
          }}
        >
          <div
            style={{
              flex: 1,
              minHeight: 0,
              aspectRatio: `${RAW_W} / ${CROPPED_H * (slide.crop ?? 1)}`,
              maxWidth: "100%",
              border: `${rule}px solid ${palette.ink}`,
              boxSizing: "border-box",
              overflow: "hidden",
            }}
          >
            <Img
              src={staticFile(
                `${theme === "dark" ? "raw-dark" : "raw"}/${slide.file}`,
              )}
              style={{
                display: "block",
                width: "100%",
                marginTop: `-${(CROP_TOP / RAW_W) * 100}%`,
              }}
            />
          </div>
          {slide.caption ? (
            <div
              style={{
                marginTop: 40,
                fontFamily: mono,
                fontSize: 26,
                lineHeight: 1.5,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                textAlign: "center",
                color: palette.faded,
              }}
            >
              {mu(slide.caption)}
            </div>
          ) : null}
        </div>
      );

    case "art": {
      // The converter assumes SF Mono's 0.6 em advance at 1.0 line height —
      // render with exactly those metrics or the image aspect drifts.
      const artLines = (slide.ascii ?? "").split("\n");
      const artCols = Math.max(1, ...artLines.map((l) => l.length));
      const contentW =
        SLIDE_WIDTH - PAD_X - (format === "tiktok" ? PAD_X + 60 : PAD_X);
      const maxArtH = (format === "tiktok" ? 960 : 670) - (slide.kicker ? 90 : 0);
      const fontSize = Math.min(
        contentW / (artCols * 0.6),
        maxArtH / artLines.length,
      );
      return (
        <div style={{ width: "100%" }}>
          {slide.kicker ? <Kicker text={slide.kicker} palette={palette} /> : null}
          {/* A tall, narrow subject (an artichoke with its stem) is scaled by
              HEIGHT, so the glyph block ends up narrower than the column and
              would sit flush left. Center the block, not the text inside it —
              the ASCII is a bitmap and its own left margin is meaningful. */}
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
          {slide.title || slide.value ? (
            <div
              style={{
                marginTop: 48,
                borderTop: `${rule}px solid ${palette.ink}`,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: 24,
                padding: "26px 0 0",
                fontFamily: mono,
                fontWeight: 700,
                fontSize: 36,
                textTransform: "uppercase",
                color: palette.ink,
              }}
            >
              <span style={{ letterSpacing: "0.08em" }}>{mu(slide.title)}</span>
              <span style={{ whiteSpace: "nowrap" }}>{mu(slide.value)}</span>
            </div>
          ) : null}
          {slide.line ? (
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
              {mu(slide.line)}
            </div>
          ) : null}
        </div>
      );
    }

    case "verdict": {
      const red = stampRed[theme];
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 64,
          }}
        >
          <div
            style={{
              transform: "rotate(-6deg)",
              border: `6px solid ${red}`,
              padding: "28px 56px",
              fontFamily: mono,
              fontWeight: 700,
              fontSize: 110,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: red,
            }}
          >
            {slide.stamp ?? "Kept"}
          </div>
          {slide.day ? (
            <div
              style={{
                fontFamily: mono,
                fontSize: 28,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: palette.faded,
              }}
            >
              {slide.day}
            </div>
          ) : null}
        </div>
      );
    }

    case "cta":
      return (
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
              // Trailing tracking would off-center the word — pad it back.
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
          {(slide.lines ?? []).map((line, i) => (
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
            {mu(slide.button ?? "On the App Store")}
          </div>
        </div>
      );

    case "mockup": {
      // 1080×1920 canvas: at width 700 a 1350×2760 frame stands 1431 tall —
      // top anchored so the visible part fills `rise` of the slide and the
      // rest drowns below the bottom edge. The CTA is bottom-anchored to the
      // phone's top edge, so the pair stays glued whatever `rise` says.
      const width = 700;
      const rise = slide.rise ?? 0.58;
      return (
        <>
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: `${rise * 100}%`,
              paddingBottom: 44,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
            }}
          >
            {(slide.lines ?? []).map((line) => (
              <div
                key={line}
                style={{
                  marginTop: 20,
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
            {slide.button ? (
              <div
                style={{
                  marginTop: 48,
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
                {mu(slide.button)}
              </div>
            ) : null}
          </div>
          <Img
            src={staticFile(`mockups/${slide.file}`)}
            style={{
              position: "absolute",
              left: "50%",
              transform: "translateX(-50%)",
              top: `${(1 - rise) * 100}%`,
              width,
            }}
          />
        </>
      );
    }
  }
};

export const Slide: React.FC<SlideProps> = ({
  slide,
  index,
  count,
  theme = "light",
  footer,
  format = "tiktok",
}) => {
  const palette = palettes[theme];
  // The 9:16 formats live inside the reel UI on both platforms. Worst-case
  // overlays across TikTok (top 150, right 140, bottom ~320 organic) and
  // IG Reels (top 200, right 120, bottom ~400): top 210, bottom 400 and
  // right 144 clear all of them. No footer — the caption zone owns the
  // bottom of the frame.
  const padTop = format === "tiktok" ? 210 : 96;
  const padBottom = format === "tiktok" ? 400 : 96;
  const padRight = format === "tiktok" ? PAD_X + 60 : PAD_X;
  // A receipt is a left-aligned document; only the stamp and the sign-off
  // sit centered on the page.
  const centered =
    slide.type === "verdict" || slide.type === "cta" || slide.type === "mockup";

  return (
    <AbsoluteFill
      style={{
        backgroundColor: palette.paper,
        display: "flex",
        flexDirection: "column",
        paddingTop: padTop,
        paddingBottom: padBottom,
        paddingLeft: PAD_X,
        paddingRight: padRight,
        boxSizing: "border-box",
      }}
    >
      {/* Header dropped 2026-08-01 — the paper speaks without a letterhead. */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          // The mockup slide pins its CTA high — the phone owns the rest.
          justifyContent: slide.type === "mockup" ? "flex-start" : "center",
          alignItems: centered ? "center" : "stretch",
          paddingTop: 56,
          paddingBottom: 56,
        }}
      >
        <Body slide={slide} palette={palette} theme={theme} format={format} />
      </div>
      {format === "carousel" ? <Footer footer={footer} palette={palette} /> : null}
    </AbsoluteFill>
  );
};
