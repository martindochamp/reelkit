import React from "react";
import {
  AbsoluteFill,
  Loop,
  Audio,
  Easing,
  Img,
  interpolate,
  OffthreadVideo,
  Sequence,
  staticFile,
  useCurrentFrame,
} from "remotion";
import {
  STAGE_BOTTOM_REEL,
  Stage,
  type ReelElementSpec,
  type StageMode,
} from "./ReelElements";
import { captionStyle, fonts, mono, palettes, safe, type Palette } from "./tokens";
import { DynamicBackground, type FieldSpec } from "./lab/DynamicBackground";
import {
  bandTopPx,
  fitToBox,
  resolveBackground,
  resolveShadow,
  resolveSubtitles,
  type SubtitleSpec,
} from "./lab/subtitles.mjs";
import { footageBox, resolveFootage } from "./lab/footage.mjs";
import { Cutout, type CutoutSpec } from "./lab/Cutout";
import { resolveField } from "./lab/field.mjs";

/**
 * Reel — a spoken video written from the brief, not a slideshow with a
 * voice-over. The narration is the spine; each beat cuts to one screen —
 * a photograph, the receipt paper, or solid ink — carrying one element
 * whose parts print at the exact word the voice reaches them. Captions
 * print the spoken words on the page itself, one small group at a time.
 */

export const REEL_FPS = 30;

export type ReelWord = {
  text: string;
  /** Beat-local frame the word is spoken on. */
  startFrame: number;
  /**
   * How hard the writer hit it: the number of asterisks around the word in
   * the spoken line. `*word*` is 1, `**word**` is 2, and the SKIN says what
   * each level looks like (`theme.captions.emphasis`) — colour, size, fill.
   *
   * A boolean until 2026-09-08, which could carry a colour and nothing
   * else. One reference sentence puts a word in the accent colour and
   * another at 2.6× cap height as a hollow outline, so one level was never
   * going to be enough.
   */
  emphasis?: number;
};

export type ReelPage = {
  startFrame: number;
  words: ReelWord[];
};

/**
 * An item PLACED on a scene that outlives its own beat.
 *
 * Every beat until now owned the whole frame and gave it back at its own
 * end, so a reel was a slideshow however well each slide was drawn. The
 * reference builds instead: a brain arrives, a rule drops from it, an
 * infinity joins under the rule, a slot machine lands beside it — and none
 * of them leave. What reads as "designed" rather than "a deck" is that the
 * screen ACCUMULATES.
 *
 * So a placed item enters on its beat and stays to the end of the reel.
 * Coordinates are fractions of the frame, not pixels, because the stage is
 * a canvas here and not a column of type.
 */
export type PlacedSpec = {
  type: "place";
  /** File under posts/media/, staged to public/media/. */
  file: string;
  /** Centre, as a fraction of frame width/height. */
  x: number;
  y: number;
  /** Width, as a fraction of the frame. Height follows the image. */
  w: number;
  /** A word set above the item, the way the reference names its parts. */
  label?: string;
  /**
   * Draw a hairline from the item placed at this beat index down to this
   * one. A diagram is the lines, not the pictures.
   */
  linkFrom?: number;
  /**
   * `screen` drops the image's black to nothing — the same trick the light
   * leaks use, and the reason line-art on black needs no cut-out. It is the
   * honest fix for a sourced PNG that arrived without an alpha channel, and
   * it is also just how this look is built.
   */
  blend?: "screen" | "lighten";
  /**
   * The halo's colour, for THIS item. Filled in at staging from the image's
   * own dominant ink unless the post names one, because a white glow under
   * a red neon reads as a lit fog around it rather than as the thing
   * glowing — light comes off an object in the object's colour.
   */
  glow?: string;
  /**
   * Below 1 the item sits BEHIND the argument rather than in it — which is
   * what a giant symbol washed across the back is for. A background that
   * competes with the foreground is just clutter at full strength.
   */
  opacity?: number;
  /**
   * Several items entering on the SAME beat. A background wash is three or
   * four symbols at once, and one-item-per-beat would have forced three
   * silent beats to say nothing. The outer object keeps `type: "place"`;
   * everything else is read from each entry.
   */
  items?: Omit<PlacedSpec, "type" | "items">[];
};

/**
 * A rule drawn around the frame. `null` is not "no rule set" — it is a beat
 * or a shot saying NO rule, over whatever the reel's own chrome asks for.
 */
export type BorderSpec = { color: string; width?: number; inset?: number; radius?: number };

/**
 * One PICTURE inside a beat.
 *
 * The engine's oldest law was one beat = one screen = one spoken line: a
 * beat's length was its TTS clip, so the picture could not cut unless the
 * voice did. Four of seven independent teardowns named that as the widest
 * gap between this engine and the reels it copies (docs/REFERENCES.md) —
 * one spoken sentence runs across three shots with no seam, and one caption
 * page sits unchanged across a cut. The reels cut when the picture wants to
 * and speak when the argument wants to.
 *
 * A shot is how that is said here. The beat still owns the voice, the
 * captions and the camera — one line, one band, one continuous move — and
 * the shots divide its length between them, each with its own screen, its
 * own background and its own frame rule. Laid out by render-reel.mjs
 * (`layShots`) from `seconds` or `weight`, so they tile the beat exactly.
 */
export type ReelShot = {
  element: ReelElementSpec;
  /** Beat-local frame this picture cuts in on. */
  startFrame: number;
  durationInFrames: number;
  /** Shot-local frames each element part prints on — from the shot's `cues`. */
  cueFrames: number[];
  /** This shot's own background, same vocabulary as a beat's. */
  bg?: string;
  /**
   * This picture's ground, over the reel's `chrome.field`. A preset name,
   * a spec, or `null` for none. A shot sets its own because the ground is
   * a property of the picture and a beat can now show several.
   */
  field?: FieldSpec | string | null;
  /** This shot's frame rule, over the reel's. `null` draws none. */
  border?: BorderSpec | null;
};

export type ReelBeat = {
  /** The beat's single picture. Absent when it carries `shots` instead. */
  element?: ReelElementSpec | PlacedSpec;
  /**
   * This beat's subtitle look, over the reel's `subtitles` and the project's
   * `theme.captions`. A preset name or a spec.
   *
   * Deliberately NOT on a shot, unlike `field`: a caption page belongs to the
   * spoken line, and the line outlives the cuts inside it. The one thing that
   * DOES follow the picture across a cut is the band's colour, and that is
   * `bandsOf`'s job — legibility per frame, style per sentence.
   */
  subtitles?: SubtitleSpec | string;
  /**
   * This beat's cutout, over the reel's. `null` draws none.
   *
   * Deliberately NOT on a shot, for `subtitles`' reason rather than
   * `field`'s: a cutout is a PRESENCE, and a presence that flickers on and
   * off with the cuts inside one spoken line is not a presence. The picture
   * changes under the person; the person stays.
   */
  cutout?: CutoutSpec | string | null;
  /**
   * Several pictures, cutting on their own schedule under one spoken line.
   * Mutually exclusive with `element` — see ReelShot.
   */
  shots?: ReelShot[];
  durationInFrames: number;
  /** Beat-local frames each element part prints on — from the [+] cues. */
  cueFrames: number[];
  /**
   * This beat's frame rule, over the reel's `chrome.border`. `null` draws
   * none. The references change it per shot — a dark rule on a paper card,
   * a white one on a photograph — and one colour for a whole reel was
   * measurably wrong on every photo beat of a reproduction.
   */
  border?: BorderSpec | null;
  /**
   * What fills the frame behind the element: nothing (the receipt paper),
   * "ink" (solid ink, inverted type), or a photograph from posts/art/
   * (staged under public/bg/ by render-reel.mjs).
   */
  bg?: string;
  /**
   * This picture's ground, over the reel's `chrome.field`. A preset name,
   * a spec, or `null` for none. A shot sets its own because the ground is
   * a property of the picture and a beat can now show several.
   */
  field?: FieldSpec | string | null;
  /** Path under public/, e.g. "audio/fe-absorbed/01-ab12cd34ef.mp3". */
  audio?: string;
  /** Beat-local frame the audio starts on (the lead-in breath). */
  audioStartFrame?: number;
  /** Caption pages, beat-local frames — computed by render-reel.mjs. */
  pages?: ReelPage[];
  /**
   * Where the CAMERA sits during this beat, on the scene canvas.
   *
   * The reference does not cut between its diagram parts and it does not
   * pop them in and out: it moves. Measured over 2.8 s of it — the slot
   * machine grows while the brain drifts off the top and the infinity
   * slides out bottom-left, then the machine itself exits left as a huge
   * infinity enters from the right. Nothing appeared or vanished; the
   * viewport travelled, and the travel is what reveals the next thing.
   *
   * So a beat does not own a screen here, it owns a POINT OF VIEW.
   * `x`/`y` are the scene point to centre, in the same frame fractions
   * placed items use; `zoom` is the scale. The camera eases from the
   * previous beat's view to this one across the whole beat, which is why
   * the motion reads as continuous rather than as a series of moves.
   *
   * Omitted, a beat holds the camera where the last one left it.
   */
  view?: { x?: number; y?: number; zoom?: number };
  /**
   * A bed for THIS BEAT only — a casino floor under the casino beat, and
   * silence again after it. `music` is the reel's whole floor; this is a
   * place. Staged under public/music/ like the bed.
   */
  sound?: { file: string; volume?: number };
};

/**
 * One effect, on the frame its animation event fires. Placed by
 * scripts/sfx.mjs from the same `[+]` cues the element prints on, so the
 * sound and the thing it sounds like share a frame by construction.
 */
export type ReelSfx = {
  /** Path under public/, e.g. "sfx/print.wav". */
  file: string;
  /** Absolute frame in the reel. */
  frame: number;
  durationInFrames: number;
  /** Linear gain against a -26 LUFS file — 0.2 is 14 dB under the voice. */
  volume: number;
  /**
   * Playback rate. One click at a rising rate IS the ratchet — twenty
   * samples would be twenty files to license, store and keep in step.
   */
  rate?: number;
};

export type ReelProps = {
  beats: ReelBeat[];
  theme?: "light" | "dark";
  /** Background music, looped under the voice — staged under public/music/. */
  music?: { file: string; volume: number };
  /** Discrete effects on the animation events — staged under public/sfx/. */
  sfx?: ReelSfx[];
  /**
   * The floor under the whole track, looped. Not music and not an effect:
   * it removes the mathematical zero that the ear hears as a dropout at
   * every hard cut. ~30 dB under the voice — felt, never heard.
   */
  roomTone?: { file: string; volume: number };
  /** How a caption page plays: whole with a Heavy word, or word by word. */
  captions?: CaptionMode;
  /**
   * A presenter card pinned to the bottom of the frame, CONTINUOUS across
   * every beat — it does not belong to any one of them.
   *
   * The format it exists for holds one uncut take of a person talking for
   * the whole reel while the stage above changes under the voice. Measured
   * on the reference: the card starts at 73 % of the frame height, runs
   * 87 % of its width, and bleeds off the bottom edge. The stage already
   * ends at STAGE_BOTTOM_REEL (1080) and the caption band sits at 1180, so
   * a card from 1400 down clears both without moving anything.
   *
   * Staged under public/clips/ like a `recording`.
   */
  host?: { file: string; top?: number; radius?: number };
  /**
   * A matted person on the canvas with NOTHING behind them, continuous
   * across every beat. The reaction cutout.
   *
   * This is `host` without the box, and it is the shape the format actually
   * uses: `host` draws an opaque rounded rectangle pinned to the bottom, so
   * the presenter reads as an interview inset. A cutout has no rectangle to
   * read as anything — the person stands on the beat.
   *
   * `host` is kept because posts written before this exist and still render;
   * it is the deletion candidate the moment none do. Two differences make it
   * worth naming: `host` reads posts/clips/ and a cutout reads posts/media/
   * (the two pools docs/FOOTAGE.md already flags), and `host` is drawn over
   * the caption band while a cutout is drawn under it.
   *
   * A beat overrides it with its own `cutout`, and `null` there takes the
   * person away for that beat — the three-state contract `field` uses.
   */
  cutout?: CutoutSpec | string;
  /**
   * The frame's own treatment, independent of any beat.
   *
   * Three primitives, and three is what a frame-by-frame teardown of the
   * reference actually found — no zooms, whips, speed ramps or freezes
   * anywhere in 159 seconds. What reads as production value is a ground, a
   * halo, and the fact that things GROW instead of appearing.
   */
  /**
   * The bed — a looping video under the whole reel, on its own clock.
   *
   * Not a background. A background belongs to a beat and is repainted at
   * every cut; a bed is the GROUND, and it keeps running while beats cut
   * over it. Measured on a talking-head reference that swaps four unrelated
   * loops across 179 s and changes them mid-sentence: the picture behind
   * the speaker is not tied to what he is saying, which is the same finding
   * `shots` exists for, one layer further down.
   *
   * A beat only sees it if the beat declines to paint — `"bg": "bed"`.
   * Every other mode fills the frame opaquely and hides it.
   *
   * Staged by render-reel.mjs, which probes each file for `loopFrames` and
   * lays the spans: a bed runs until the next one starts.
   */
  bed?: {
    file: string;
    startFrame: number;
    durationInFrames: number;
    /** The asset's own length. Below this the clip repeats. */
    loopFrames: number;
    opacity?: number;
  }[];
  /** The reel's subtitle look, over the project's `theme.captions`. */
  subtitles?: SubtitleSpec | string;
  chrome?: {
    /**
     * The ground under every beat. A preset name (`"dots"`, `"blueprint"`,
     * `"graph"`, …) or a spec that names its own shape, colour, pitch,
     * drift and zoom. A beat or a shot overrides it with its own `field`,
     * and `null` there draws none — the same three-state contract `border`
     * already uses, for the same reason: the ground is a property of the
     * picture, and a beat can show two pictures.
     */
    field?: FieldSpec | string;
    /**
     * The halo every cut-out image carries. A drop-shadow, so it follows a
     * transparent PNG's alpha instead of boxing it — which is why the
     * assets have to be cut out and not merely dark.
     */
    glow?: string;
    /**
     * Elements do not print, they grow: the reference's slot machine
     * scales continuously for 0.9 s. The blur trails the scale and
     * resolves, which is what reads as the movement being soft.
     */
    entrance?: "push";
    /**
     * A rule drawn around the frame on every beat. The other reference
     * carries one on all 86 of its shots — it is what makes a pile of
     * borrowed stills read as one object instead of as a folder.
     */
    border?: { color: string; width?: number; inset?: number; radius?: number };
  };
  /**
   * Light leaks — the warm flash an old film camera makes when light hits
   * the stock. Shot on pure black and composited in `screen`, where black
   * is the identity: the leak adds light and never darkens what is under
   * it, which is why the clip's background disappears without a matte.
   *
   * Placed on the REEL's clock, in seconds, not on a beat — a leak that
   * lands on a cut is the point of one, and beats move when a script is
   * rewritten.
   */
  overlays?: {
    file: string;
    /** Seconds from the top of the reel. */
    at: number;
    /**
     * Seconds INTO THE CLIP to start from — not a refinement, a
     * requirement. Every leak sourced so far opens on black and brightens
     * later: the flash clip measures 0, 0, 161, 0 in half-second steps, so
     * playing its first second plays nothing at all. `at` says when on the
     * reel, `seek` says where in the clip the light actually is.
     */
    seek?: number;
    /** Seconds to play. Omitted plays the clip out. */
    seconds?: number;
    opacity?: number;
    /** Defaults to "screen". "lighten" is the gentler one. */
    blend?: "screen" | "lighten" | "plus-lighter";
  }[];
};

export const reelDurationInFrames = (beats: ReelBeat[]) =>
  Math.max(1, beats.reduce((sum, b) => sum + b.durationInFrames, 0));

/**
 * A photograph fills the frame with a slow push — in on even beats, out on
 * odd ones — under a flat scrim that keeps every mode of type readable.
 */
const PhotoBackground: React.FC<{
  file: string;
  durationInFrames: number;
  index: number;
}> = ({ file, durationInFrames, index }) => {
  const frame = useCurrentFrame();
  const scale = interpolate(
    frame,
    [0, durationInFrames],
    index % 2 === 0 ? [1.04, 1.14] : [1.14, 1.04],
  );
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Img
        src={staticFile(`bg/${file}`)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${scale})`,
        }}
      />
      <AbsoluteFill style={{ backgroundColor: "rgba(10, 9, 7, 0.38)" }} />
    </AbsoluteFill>
  );
};

/**
 * Spoken captions — a band above the platform caption zone, painted in
 * the beat's own page colour so it reads as words on the page rather
 * than as a plate laid over it. One page of at most three words. Three
 * ways to play a page, differing only in what the page looks like BEFORE
 * its last word is spoken; the band, the type and every word's position
 * are identical in all three, which is the whole point of setting them
 * from one layout.
 *
 * - "page" (default) — the page appears WHOLE the moment its first word
 *   lands, and the word being said prints Heavy. SF Mono keeps its advance
 *   across weights, so the highlight never moves the text.
 * - "words" — the page is laid out whole and invisible, and each word
 *   ARRIVES on its own word, at once. No Heavy pass — the arrival is the
 *   emphasis.
 * - "bump" — "words", plus a very light scale on landing. The transform
 *   is paint-only on an inline-block, so it cannot move the word beside
 *   it; the line is as fixed as in the other two.
 *
 * **No fades.** A first version cross-faded each word up from zero over
 * three frames and Martin killed it (2026-08-11: *"je ne veux pas
 * d'animation concernant l'opacité — ça apparaît en delay mais d'un
 * coup"*). Everything else in this system prints — a hard 7-frame wipe
 * with no ramp — and a caption that dissolves in is the one element that
 * would have been doing something else.
 */
export type CaptionMode = "page" | "words" | "bump";

/**
 * The bump: the word arrives SMALL, overshoots, settles.
 *
 * It shipped backwards for one render — 1.10 easing down to 1, which is
 * a zoom OUT (Martin: *"le zoom doit être contraire, genre un léger zoom
 * in rebond pas zoom out"*). The two look similar in a still and read as
 * opposites in motion: a word shrinking into place has already happened
 * by the time you notice it, a word growing into place is arriving. The
 * rebound is what makes it land rather than merely stop.
 */
const BUMP_FROM = 0.86;
/** The overshoot. 1.06 is felt; past ~1.12 it is a mobile game. */
const BUMP_OVER = 1.06;
/** Frames to the overshoot, then frames from there to rest. */
const BUMP_RISE = 3;
const BUMP_SETTLE = 4;

/**
 * What a marked word looks like, for the level the writer hit it at.
 *
 * The skin decides, the writer only says how hard (`*word*` is 1,
 * `**word**` is 2). A skin that names no `emphasis` list falls back to
 * `emphasisColor` for every level, which is exactly what every project had
 * before the list existed — so nothing about an existing reel moves.
 *
 * `scale` is a font size and not a transform: a scaled glyph would ride
 * over its neighbours, while a bigger font makes the line box grow around
 * it, which is what the reference's 2.6× word actually does.
 */
const emphasisStyle = (
  level: number | undefined,
  look: typeof captionStyle,
): React.CSSProperties | null => {
  if (!level) return null;
  const list = look.emphasis;
  const style = list?.length
    ? list[Math.min(level, list.length) - 1]
    : look.emphasisColor
      ? { color: look.emphasisColor }
      : null;
  if (!style) return null;
  const { color, scale, outline } = style as any;
  return {
    ...(outline
      ? {
          // A hollow glyph: the stroke carries the colour and the fill is
          // gone. `color: transparent` rather than a paper-coloured fill —
          // the words sit over pictures as often as over a flat page.
          WebkitTextStrokeWidth: `${outline}px`,
          WebkitTextStrokeColor: color ?? "currentColor",
          color: "transparent",
        }
      : color
        ? { color }
        : {}),
    ...(scale ? { fontSize: `${scale}em` } : {}),
  };
};

/**
 * Text measurement, for the fit.
 *
 * One canvas for the whole render, because creating one per frame is the
 * cheapest way to make a render slow. `ctx.font` carries family, weight and
 * size but NOT letter-spacing, so that is added per gap — at `-0.01em` on a
 * 96 px caption it is 1 px a character, which over sixteen characters is the
 * difference between fitting and not.
 *
 * The transform matters as much: a band set to `uppercase` draws wider than
 * the string it was given, and measuring the untransformed text is how a fit
 * passes and the frame still overflows.
 */
let ctx: CanvasRenderingContext2D | null = null;
const measurer = (family: string, weight: number, spacing: string, upper: boolean) => {
  ctx = ctx ?? document.createElement("canvas").getContext("2d");
  return (text: string, size: number) => {
    if (!ctx) return text.length * size * 0.55;
    ctx.font = `${weight} ${size}px ${family}`;
    const t = upper ? text.toUpperCase() : text;
    const em = /em$/.test(spacing) ? parseFloat(spacing) * size : parseFloat(spacing) || 0;
    return ctx.measureText(t).width + em * Math.max(0, t.length - 1);
  };
};

/**
 * How the band is painted under ONE picture: which pair it borrows, and
 * whether there are pictures behind the words at all.
 */
type CaptionBand = { startFrame: number; overArt: boolean; palette: Palette };

const Captions: React.FC<{
  pages: ReelPage[];
  mode: CaptionMode;
  /**
   * One entry per picture the beat shows, in order.
   *
   * The band follows what is actually UNDER it rather than the beat as a
   * whole. A beat-wide answer sounds tidier — the band belongs to the
   * sentence, and the sentence outlives the cuts in it — but there is no
   * single colour that reads over a white page AND over a photograph, which
   * is the whole reason a plate exists. Taking one for the beat put white
   * words on a white page the moment a beat mixed the two: the same defect
   * `plate:false` used to ship, arriving by a different door. Legibility at
   * every frame wins over continuity across a cut.
   */
  bands: CaptionBand[];
  /**
   * The resolved look for THIS beat — theme, then preset, then the beat's own
   * keys. Passed in rather than read from the module, which is what makes a
   * per-beat subtitle style possible at all: `captionStyle` is one object for
   * the whole project and a beat cannot vary it.
   */
  style: typeof captionStyle;
}> = ({ pages, mode, bands, style }) => {
  const frame = useCurrentFrame();
  const page = [...pages].reverse().find((p) => frame >= p.startFrame);
  const band = [...bands].reverse().find((b) => frame >= b.startFrame) ?? bands[0];
  const { overArt, palette } = band;
  if (!page) return null;
  const said = page.words.filter((w) => frame >= w.startFrame).length;

  // The ink was already expanded into `color` / `strokeColor` /
  // `emphasisColor` by the resolver, at the layer that named it — which is
  // the only place the precedence can be got right. Here there is just a
  // fill, and the page's own ink when nothing named one.
  const fill = style.color ?? (overArt ? "#FFFFFF" : palette.ink);

  // THE FIT. The pagination caps are proxies — they count words and
  // characters, and what leaves the frame is a WIDTH. So the band measures
  // itself against the safe box and comes down two pixels at a time until it
  // is inside it, or stops at its floor and overflows visibly. `safe.x` is
  // the number that used to be `left: 84, right: 84` written here.
  const bandTop = bandTopPx(style, 1920);
  // The band's own box, if it paints one. Its padding comes out of the fit's
  // room — a plate is the tightest place a caption can sit, and it was also
  // the one the fit forgot when it was only a boolean.
  const bg = resolveBackground(style, palette.paper);
  const box = {
    w: 1080 - 2 * safe.x - 2 * (bg?.px ?? 0),
    h: Math.max(120, 1920 - bandTop - safe.bottom - 2 * (bg?.py ?? 0)),
  };
  const scaleOf = (level?: number) => {
    if (!level) return 1;
    const l = style.emphasis?.[Math.min(level, style.emphasis.length) - 1];
    return (l as { scale?: number } | undefined)?.scale ?? 1;
  };
  const fit = fitToBox(
    page.words.map((w) => ({ text: w.text, scale: scaleOf(w.emphasis) })),
    { fontSize: style.fontSize, lineHeight: 1.35, floor: style.floor },
    box,
    measurer(
      style.fontFamily ?? fonts.caption,
      style.fontWeight,
      style.letterSpacing,
      style.textTransform === "uppercase",
    ),
  );

  return (
    <div
      style={{
        position: "absolute",
        // Symmetric: the band centres on the frame (540), not on the
        // text column — otherwise it sits 30 px left of the mockup and
        // every other centred element, and the eye catches it.
        //
        // `safe.x` was the literal 84 twice. It is a theme variable now so a
        // project rendering for a platform with different chrome moves both
        // edges, and the fit above, with one number.
        left: safe.x,
        right: safe.x,
        // 1180 — the caption band sits at 61 % of the frame, well clear of
        // TikTok's bottom chrome, which creeps higher than the published
        // safe-area tables admit. The stage shrinks to match (STAGE_BOTTOM),
        // so nothing ever competes with the words.
        top: bandTop,
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          // The band is the PAGE, not a plate on it (Martin, 2026-08-11:
          // "je voudrais que l'encadré des sous-titres soit de la même
          // couleur que le fond"). On a paper or ink beat it therefore
          // disappears and only the words are left, which is the whole
          // idea — the box existed to guarantee contrast, and against
          // the page's own colour there is nothing to guarantee.
          //
          // On a PHOTO beat there is no flat background to borrow, so
          // the caller hands over the light pair the printed cards use
          // and the band stays a physical object lying on the scene.
          // `plate: false` drops the band's own ground so the words sit
          // straight on the page — what a full-bleed skin needs and what
          // the receipt look must never do.
          backgroundColor: bg?.color ?? "transparent",
          // The radius the plate never had. `chip` is the look it exists
          // for — a caption shaped like a UI element rather than one
          // floating over the picture, measured twice in the teardowns.
          borderRadius: bg?.radius ?? 0,
          // The plate WAS the contrast guarantee: words on a flat colour of
          // their own can borrow the page's ink and always read. Drop the
          // plate and that guarantee goes with it — on a saturated
          // full-bleed image the borrowed light ink came out grey on pink
          // and was unreadable. A plateless caption therefore carries its
          // own: white, over a shadow, whatever is under it. Which is what
          // every reference does, and why none of them needs a plate.
          // The ink, ALWAYS — never a literal colour. Hardcoding white here
          // (added defensively after a caption came out grey on a saturated
          // image) made every caption on a PAPER beat white-on-white and
          // completely invisible. The palette already knows which way round
          // the page is, including on an inverted `ink` beat, so asking it is
          // the only thing that works in both directions.
          // Over a flat page, the page's own ink. Over PICTURES, white — no
          // palette can know what an arbitrary image is doing behind a word,
          // so the caption stops borrowing and carries its own.
          // The look may name the fill outright. Without this the band always
          // borrows the page's ink, which is right for a caption that belongs
          // to the page and wrong for the outlined one: the platform look is
          // a WHITE fill with a black stroke whatever is behind it, and over
          // a paper beat the borrowed ink made it black-on-black.
          color: fill,
          // Without a plate the words carry their own separation, and it is
          // the PAGE's colour spread behind them — dark on a dark page, light
          // on a light one — so it works whatever the beat is.
          // A stroke replaces the spread: the three references that outline
          // their captions (ad-2, speechify-ad, design-tips) all measure NO
          // shadow beyond it, and a glow under a hard black edge only muddies
          // it. Otherwise the words carry the page's own colour spread.
          // The soft separation, named. This was two string literals chosen
          // by `overArt`, with nothing able to disagree with them; `"auto"`
          // is those two literals and stays the default, so a project that
          // has not asked renders the frame it rendered yesterday.
          textShadow: bg
            ? undefined
            : resolveShadow(style.shadow, {
                paper: palette.paper,
                overArt,
              }),
          // THE PLATFORM CAPTION: a solid fill with a stroke around it,
          // measured at ~3 px black on three independent references. It is
          // the opposite construction to `emphasis[].outline`, which hollows
          // the glyph out and drops the fill — and `paint-order` is what
          // keeps the two apart: without it the stroke is painted over the
          // fill and eats half the letterform's weight.
          ...(style.stroke
            ? {
                WebkitTextStrokeWidth: `${style.stroke}px`,
                WebkitTextStrokeColor: style.strokeColor ?? palette.paper,
                paintOrder: "stroke fill",
              }
            : null),
          padding: bg ? `${bg.py}px ${bg.px}px` : "0",
          // A preset may name the face. Without this a caption look could
          // change everything about the type except the letterform it is
          // recognised by — `fonts.caption` is one stack per project.
          fontFamily: style.fontFamily ?? fonts.caption,
          fontSize: fit.fontSize,
          fontWeight: style.fontWeight,
          lineHeight: 1.35,
          letterSpacing: style.letterSpacing,
          textTransform: style.textTransform,
          textAlign: "center",
        }}
      >
        {page.words.map((w, i) => {
          // A word is either there or it is not — `visibility` rather than
          // opacity, so there is no intermediate state to animate and the
          // space is still held either way.
          const here = frame >= w.startFrame;
          const bump =
            mode === "bump" && here
              ? interpolate(
                  frame,
                  [
                    w.startFrame,
                    w.startFrame + BUMP_RISE,
                    w.startFrame + BUMP_RISE + BUMP_SETTLE,
                  ],
                  [BUMP_FROM, BUMP_OVER, 1],
                  {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                    easing: Easing.out(Easing.quad),
                  },
                )
              : 1;
          return (
            // The separating space is a SIBLING of the word, never inside
            // it: `inline-block` collapses its own trailing whitespace, so
            // a space inside a bumped span would close the gap and the
            // three modes would no longer share one layout.
            <React.Fragment key={i}>
              <span
                style={
                  mode === "page"
                    ? {
                        // What was here: `fontWeight: said ? 800 : 400`. Two
                        // literals, and they threw the theme's own weight
                        // away — a project that measured 700 rendered every
                        // word at 400 with one at 800, which is the thin
                        // caption every page-mode reel has had. The band's
                        // own `fontWeight` now stands, and the said word is
                        // lifted only if the look names a `saidWeight`.
                        //
                        // Off by default because no reference does it:
                        // Peterson holds one weight across ~40 cards and
                        // story-88-95's whole band is uniform. And on a
                        // PROPORTIONAL face a weight change alters the
                        // glyph's advance, so the centred line shifts under
                        // every word — invisible where this was written,
                        // because that face was SF Mono.
                        ...(style.saidWeight != null && i === Math.max(0, said - 1)
                          ? { fontWeight: style.saidWeight }
                          : null),
                        ...(emphasisStyle(w.emphasis, style) ?? {}),
                      }
                    : {
                        // `dim` set: the line stands from the first frame and
                        // each word LIGHTS UP. Unset: it arrives. Both hold
                        // their space, so the line never reflows either way.
                        ...(style.dim != null
                          ? { opacity: here ? 1 : style.dim }
                          : { visibility: here ? "visible" : "hidden" }),
                        ...(emphasisStyle(w.emphasis, style) ?? {}),
                        ...(mode === "bump"
                          ? {
                              display: "inline-block",
                              transform: `scale(${bump})`,
                              transformOrigin: "50% 60%",
                            }
                          : {}),
                      }
                }
              >
                {w.text}
              </span>
              {i < page.words.length - 1 ? " " : ""}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

/** What a background string means for the stage under it. */
const modeOf = (bg?: string): StageMode =>
  bg === "ink" ? "ink" : bg === "bed" ? "bed" : bg ? "photo" : "paper";

/**
 * Are PICTURES behind the words? `mode` alone does not know: a full-bleed
 * media screen carries no `bg`, so it reads as paper and the caption borrows
 * a flat colour that is not what is actually behind it.
 */
const shotOverArt = (bg?: string, element?: { type?: string; fit?: string }) =>
  modeOf(bg) === "photo" ||
  // A bed is a moving picture, so the caption band has to treat it as one.
  // Reading it as paper would borrow a flat colour that is nowhere on
  // screen — the same defect `plate:false` produced on a white page.
  modeOf(bg) === "bed" ||
  (element?.type === "media" && element?.fit === "bleed");

/**
 * How the caption band is painted under each picture a beat shows.
 *
 * Exactly the rule the stage uses for its elements, and for the same reason:
 * the band belongs to the page it is lying on. A photo has no flat colour to
 * vanish into, so it borrows the light pair a printed card uses. A beat with
 * one picture yields one entry and nothing about it has changed.
 */
/**
 * Relative luminance of a `#rgb` / `#rrggbb`, or null for anything else.
 *
 * Only hex, deliberately: every ground in the field bank is one, and a
 * half-working `rgba()` parser that returned a confident wrong number would
 * be worse than an honest null — null means "I do not know what is behind
 * the words", which is exactly when the old behaviour is the safe one.
 */
const luminanceOf = (c?: string | null): number | null => {
  if (!c || c[0] !== "#") return null;
  const h = c.length === 4 ? c[1] + c[1] + c[2] + c[2] + c[3] + c[3] : c.slice(1, 7);
  if (h.length !== 6 || /[^0-9a-f]/i.test(h)) return null;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/**
 * The caption band's colour, per picture.
 *
 * TWO THINGS DECIDE IT AND BOTH ARE THE PICTURE'S, not the beat's: what
 * ground is painted, and whether a photograph covers the words.
 *
 * The GROUND now includes `field`. A ground is a colour a project chose, and
 * `graph` or `board` under a dark skin puts a white caption on a white page —
 * measured on a render, invisible except for its shadow. So a field that
 * names its own ground decides the band from that ground's luminance rather
 * than from the skin, which is the same rule the engine already wrote down:
 * ask what is actually behind the words, never a beat-wide assumption.
 *
 * The FOOTAGE BOX is the second half. `shotOverArt` knew about `media` and
 * `bed` and not about the box, so a full-bleed take was read as paper and the
 * caption borrowed a flat colour that was nowhere on screen. A box counts as
 * art only if it actually covers the band — a circle in the top corner does
 * not, and treating it as one would force white words onto the page below it.
 *
 * "Covers" is an OVERLAP ON BOTH AXES, and it respects the radius. Two
 * versions of this were wrong on a render before it was right:
 *
 * 1. Asking whether the box contained `bandTop` — the top edge of the band's
 *    box, which sits ABOVE every glyph in it. A 16:9 box ending 37 px below
 *    that line claimed the words while the words were on the page underneath.
 * 2. Asking for a vertical overlap against the box's RECTANGLE. A `circle`
 *    is a rectangle with a radius of half its side, and at the band's rows it
 *    is far narrower than its bounding box — so a circle whose corners were
 *    nowhere near the words still claimed them.
 *
 * 3. Asking whether the box was WIDE ENOUGH at that row. The circle passed by
 *    23 px — wide, but off to one side, while the caption is centred. Width
 *    was never the question.
 *
 * So: the box must span most of the band's height, AND its real extent at the
 * band's middle row must CONTAIN the middle of the caption column — because
 * the band is centre-justified, and a picture that covers the right half of
 * the frame does not cover words that start on the left.
 *
 * This took three renders to get right and none of the three wrong versions
 * was visible in the source. Whatever is left is a real ambiguity rather than
 * a bug: a box that covers half the words cannot be answered with one colour
 * for the band, which is the rule the engine already wrote down.
 */
const bandsOf = (
  beat: ReelBeat,
  theme: "light" | "dark",
  palette: Palette,
  reelField?: FieldSpec | string | null,
  bandTop = 1180,
  bandHeight = 96,
): CaptionBand[] => {
  const paint = (
    bg?: string,
    element?: { type?: string; fit?: string; spec?: unknown },
    field?: FieldSpec | string | null,
  ) => {
    const mode = modeOf(bg);
    const ground = field === undefined ? reelField : field;
    const lum = mode === "paper" && ground ? luminanceOf(resolveField(ground).ground) : null;
    const boxed =
      element?.type === "footage" &&
      (() => {
        const b = footageBox(resolveFootage(element.spec as never), 0, 1080, 1920);
        const over =
          Math.min(b.top + b.height, bandTop + bandHeight) - Math.max(b.top, bandTop);
        if (over <= bandHeight * 0.6) return false;
        // The rounded box's real horizontal extent at the band's middle row.
        // Outside the corner arcs it is the full width; inside one, the arc
        // pulls the edge in by `r - sqrt(r² - (r-d)²)`.
        const y = bandTop + bandHeight / 2;
        const d = Math.min(y - b.top, b.top + b.height - y);
        const inset =
          d >= b.radius
            ? 0
            : b.radius - Math.sqrt(Math.max(b.radius ** 2 - (b.radius - d) ** 2, 0));
        const [l, r] = [b.left + inset, b.left + b.width - inset];
        // The band is laid out between the 84 px gutters and centre-justified,
        // so the words live around the middle. Ask for that middle, not for a
        // width: a wide box off to one side covers no words at all.
        const half = ((1080 - 168) * 0.6) / 2;
        return l <= 540 - half && r >= 540 + half;
      })();
    return {
      overArt: shotOverArt(bg, element) || Boolean(boxed),
      palette:
        mode === "photo"
          ? palettes.light
          : mode === "ink"
            ? palettes[theme === "dark" ? "light" : "dark"]
            : lum != null
              ? palettes[lum > 0.5 ? "light" : "dark"]
              : palette,
    };
  };
  if (!beat.shots) {
    return [{ startFrame: 0, ...paint(beat.bg, beat.element, beat.field) }];
  }
  return beat.shots.map((s) => ({
    startFrame: s.startFrame,
    ...paint(s.bg, s.element, s.field),
  }));
};


/**
 * The frame rule over time, or `null` when nothing overrides the reel's.
 *
 * `null` is the answer for every post written before per-beat rules existed
 * and for every one that does not want them, and it is what makes those
 * render byte-for-byte as they did: one `<FrameBorder>`, no Sequence, no
 * spans. Only a post that actually names a `border` on a beat or a shot pays
 * for the machinery.
 */
const borderRuns = (beats: ReelBeat[], reelBorder?: BorderSpec) => {
  const overridden = beats.some(
    (b) => b.border !== undefined || b.shots?.some((s) => s.border !== undefined),
  );
  if (!overridden) return null;
  const spans: {
    startFrame: number;
    durationInFrames: number;
    border: BorderSpec | null;
  }[] = [];
  let at = 0;
  for (const b of beats) {
    const beatBorder = b.border !== undefined ? b.border : (reelBorder ?? null);
    if (b.shots) {
      for (const s of b.shots) {
        spans.push({
          startFrame: at + s.startFrame,
          durationInFrames: s.durationInFrames,
          border: s.border !== undefined ? s.border : beatBorder,
        });
      }
    } else {
      spans.push({
        startFrame: at,
        durationInFrames: b.durationInFrames,
        border: beatBorder,
      });
    }
    at += b.durationInFrames;
  }
  return spans;
};

/**
 * ONE picture: its ground, the dot field on that ground, and the element.
 *
 * The whole of what a beat used to draw, now a component because a beat can
 * carry several of them. A beat with no `shots` renders exactly this tree
 * with no Sequence around it, which is why nothing about an existing post
 * moves by a frame.
 */
const ShotLayer: React.FC<{
  element?: ReelElementSpec | PlacedSpec;
  cueFrames: number[];
  bg?: string;
  /** This picture's ground, over the reel's. `null` draws none. */
  field?: FieldSpec | string | null;
  durationInFrames: number;
  /** Which way the photo push runs — alternating, so two cuts never match. */
  index: number;
  theme: "light" | "dark";
  chrome: ReelProps["chrome"];
  palette: Palette;
}> = ({ element, cueFrames, bg, field, durationInFrames, index, theme, chrome, palette }) => {
  const mode = modeOf(bg);
  // undefined means "the reel's"; null means "none on this picture".
  const ground = field === undefined ? chrome?.field : field;
  return (
    <>
      {mode === "photo" ? (
        <PhotoBackground
          file={bg as string}
          durationInFrames={durationInFrames}
          index={index}
        />
      ) : mode === "ink" ? (
        // The turn beat inverts the POST's skin, not the light one.
        // Hardcoding tokens.ink (#1B1A17) made this a no-op on a dark
        // post — the "inverted" beat landed within 6 units of the dark
        // paper (#151412) and nobody could see the turn. Inverting
        // against the theme keeps the jolt in both skins.
        <AbsoluteFill
          style={{ backgroundColor: palettes[theme === "dark" ? "light" : "dark"].paper }}
        />
      ) : mode === "bed" ? (
        // Nothing. The reel's bed is already drawn under every beat; a beat
        // that paints its own paper would cover it, so this one does not
        // paint. It is the whole mechanism — there is no bed compositing
        // step, only a beat that declines to hide what is already there.
        null
      ) : (
        <AbsoluteFill style={{ backgroundColor: palette.paper }} />
      )}
      {/* The ground sits ON the beat's background and UNDER its
          element — the reference's own glow tints the dots nearest
          it, which only happens in that order. */}
      {ground ? (
        <DynamicBackground field={ground} durationInFrames={durationInFrames} />
      ) : null}
      {/* A placed item is not drawn here — it belongs to the scene
          layer, which outlives this Sequence. Drawing it in both
          would make it flash off at its own beat's end, which is
          the exact behaviour it exists to remove. */}
      {!element || element.type === "place" ? null : (
        <Entrance
          kind={chrome?.entrance}
          glow={chrome?.glow}
          durationInFrames={durationInFrames}
        >
          <Stage
            element={element as ReelElementSpec}
            cueFrames={cueFrames}
            theme={theme}
            mode={mode}
            life={durationInFrames}
          />
        </Entrance>
      )}
    </>
  );
};

export const Reel: React.FC<ReelProps> = ({
  beats,
  theme = "light",
  music,
  sfx,
  roomTone,
  captions = "page",
  host,
  cutout,
  bed,
  subtitles,
  chrome,
  overlays,
}) => {
  const palette = palettes[theme];

  // The scene, resolved once: which beat each placed item enters on, and
  // how long the reel runs. Placed items are collected here rather than in
  // the beat loop because they have to outlive it.
  let clock = 0;
  const placed: (PlacedSpec & { index: number; startFrame: number })[] = [];
  // The camera path, resolved as a list of legs. A beat with no `view`
  // inherits the last one, so a script only names the shots that move.
  const legs: Camera[] = [];
  let held = { x: 0.5, y: 0.5, zoom: 1 };
  for (const [i, b] of beats.entries()) {
    if (b.element?.type === "place") {
      const spec = b.element as PlacedSpec;
      // `index` stays the BEAT's index for every item it brings, because
      // `linkFrom` names a beat. The first item of a beat is the one a
      // connector attaches to.
      for (const it of spec.items ?? [spec]) {
        placed.push({ ...(it as PlacedSpec), index: i, startFrame: clock });
      }
    }
    const next = {
      x: b.view?.x ?? held.x,
      y: b.view?.y ?? held.y,
      zoom: b.view?.zoom ?? held.zoom,
    };
    legs.push({
      startFrame: clock,
      durationInFrames: b.durationInFrames,
      from: held,
      to: next,
    });
    held = next;
    clock += b.durationInFrames;
  }
  const moves = legs.some(
    (l) => l.from.x !== l.to.x || l.from.y !== l.to.y || l.from.zoom !== l.to.zoom,
  );

  // The frame rule, resolved into spans — but ONLY when something disagrees
  // with the reel's own. Nothing does in most posts, and `null` here means
  // "draw the one rule, exactly as before", which is what keeps every
  // existing post rendering frame for frame.
  const borderSpans = borderRuns(beats, chrome?.border);

  let from = 0;
  return (
    <AbsoluteFill style={{ backgroundColor: palette.paper }}>
      {/* The bed, before everything, so everything is over it.
          `layout="none"` on both wrappers for the reason the light leaks
          give: a Sequence's default layout is an AbsoluteFill and its own
          stacking context. The bed does not blend, but a wrapper here would
          also isolate anything a future bed wanted to do, and the cost of
          the correct spelling is zero.
          A bed shorter than its span repeats — `Loop` rather than a `loop`
          prop, which OffthreadVideo does not have in this Remotion. Make the
          asset seamless before it gets here: a hard loop shows a seam every
          cycle, and ping-ponging the clip removes it by construction. */}
      {bed?.map((b, i) => (
        <Sequence
          key={`bed${i}`}
          layout="none"
          from={b.startFrame}
          durationInFrames={b.durationInFrames}
        >
          <Loop layout="none" durationInFrames={b.loopFrames}>
            <OffthreadVideo
              src={staticFile(`beds/${b.file}`)}
              muted
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                opacity: b.opacity ?? 1,
                pointerEvents: "none",
              }}
            />
          </Loop>
        </Sequence>
      ))}
      {music ? (
        <Audio loop src={staticFile(music.file)} volume={music.volume} />
      ) : null}
      {/* First, and under everything — including the silent endcard, which
          is where a zero floor is most obvious. */}
      {roomTone ? (
        <Audio loop src={staticFile(roomTone.file)} volume={roomTone.volume} />
      ) : null}
      {/* Effects sit OUTSIDE the beat sequences, on absolute frames: a
          beat's own audio is its narration and nothing else, and an
          effect that fires on the last frame of a beat must not be cut
          by that beat's end. */}
      {(sfx ?? []).map((s, i) => (
        <Sequence
          key={`sfx-${i}`}
          from={s.frame}
          durationInFrames={s.durationInFrames}
        >
          <Audio
            src={staticFile(s.file)}
            volume={s.volume}
            playbackRate={s.rate ?? 1}
          />
        </Sequence>
      ))}
      {beats.map((beat, i) => {
        const start = from;
        from += beat.durationInFrames;
        return (
          <Sequence
            key={i}
            from={start}
            durationInFrames={beat.durationInFrames}
          >
            {/* One picture, or several cutting under one line.

                The single form is NOT routed through the shot list: a
                Sequence's default layout wraps its children in an
                AbsoluteFill, which is a stacking context and silently kills
                `mix-blend-mode` — the trap this file was caught by three
                times in one day. So a beat that has not asked for shots
                renders exactly the tree it always did, and a beat that has
                gets `layout="none"` wrappers, which add no such context. */}
            {beat.shots ? (
              beat.shots.map((shot, k) => (
                <Sequence
                  key={`shot${k}`}
                  layout="none"
                  from={shot.startFrame}
                  durationInFrames={shot.durationInFrames}
                >
                  <ShotLayer
                    element={shot.element}
                    cueFrames={shot.cueFrames}
                    bg={shot.bg}
                    field={shot.field}
                    durationInFrames={shot.durationInFrames}
                    index={i + k}
                    theme={theme}
                    chrome={chrome}
                    palette={palette}
                  />
                </Sequence>
              ))
            ) : (
              <ShotLayer
                element={beat.element}
                cueFrames={beat.cueFrames}
                bg={beat.bg}
                field={beat.field}
                durationInFrames={beat.durationInFrames}
                index={i}
                theme={theme}
                chrome={chrome}
                palette={palette}
              />
            )}
            {/* The person, over the picture and under the words.

                `null` on the beat takes the reel's cutout away for this
                beat; anything else replaces it. A cutout the beat wrote
                starts on the beat (offset 0); the REEL's is one continuous
                take, so it carries this beat's start frame and both its
                seek and its tracks read the reel's clock instead of
                restarting at every cut — the failure `host` avoids by being
                drawn once, and pays for by sitting over the captions. */}
            {(() => {
              const c = beat.cutout === null ? null : beat.cutout ?? cutout;
              if (!c) return null;
              const own = beat.cutout != null;
              return <Cutout spec={c} offsetFrames={own ? 0 : start} />;
            })()}
            {beat.audio ? (
              <Sequence from={beat.audioStartFrame ?? 0}>
                <Audio src={staticFile(beat.audio)} />
              </Sequence>
            ) : null}
            {beat.sound ? (
              <Audio
                loop
                src={staticFile(`music/${beat.sound.file}`)}
                volume={beat.sound.volume ?? 0.14}
              />
            ) : null}
            {beat.pages?.length ? (
              (() => {
                // theme → the reel's preset → the beat's own keys. Resolved
                // here rather than once for the reel, because the whole point
                // is that one beat can look different from its neighbours.
                const st = resolveSubtitles(
                  beat.subtitles ?? subtitles,
                  captionStyle,
                ) as typeof captionStyle & { mode?: CaptionMode };
                return (
                  <Captions
                    pages={beat.pages}
                    // An explicit `--captions` flag still wins over everything:
                    // it exists to audition a mode without editing a file.
                    mode={captions ?? st.mode ?? "page"}
                    bands={bandsOf(
                      beat,
                      theme,
                      palette,
                      chrome?.field,
                      bandTopPx(st, 1920),
                      // The band's own height, so "the box covers the words"
                      // is asked about the words. Line box plus the plate's
                      // padding when there is one.
                      st.fontSize * 1.4 + (st.plate ? 40 : 0),
                    )}
                    style={st}
                  />
                );
              })()
            ) : null}
          </Sequence>
        );
      })}
      {/* Last, and over every beat: the card is one continuous take and a
          hard cut in the stage above must not touch it. Muted — the beat's
          narration is the only voice — and looped, because a take shorter
          than the reel would otherwise freeze on its last frame. */}
      {/* The scene: above every beat's own background, because it is not
          any beat's — it is what the beats have built so far. */}
      {placed.length ? (
        <SceneLayer
          items={placed}
          palette={palette}
          glow={chrome?.glow}
          legs={moves ? legs : null}
        />
      ) : null}
      {host ? <HostCard {...host} /> : null}
      {/* Over everything, including the presenter card — a frame that a
          beat could paint over is not a frame.

          Drawn ONCE for the whole reel when nothing disagrees with it, which
          is the shape it has always had. Where a beat or a shot names its own
          `border` the rule becomes a run of spans instead: the references put
          a dark rule on a paper card and a white one on a photograph, and one
          colour for a whole reel measured barely readable on every photo beat
          of a reproduction. `null` on a beat draws no rule at all. */}
      {borderSpans === null
        ? chrome?.border
          ? <FrameBorder {...chrome.border} />
          : null
        : borderSpans.map((span, i) =>
            span.border ? (
              <Sequence
                key={`border${i}`}
                layout="none"
                from={span.startFrame}
                durationInFrames={span.durationInFrames}
              >
                <FrameBorder {...span.border} />
              </Sequence>
            ) : null,
          )}
      {/* Above the border too. A leak is light in the room, not a layer in
          the artwork — it falls on the frame and everything inside it. */}
      {overlays?.map((o, i) => (
        // `layout="none"` is load-bearing, not tidiness. Sequence's default
        // layout wraps its children in an AbsoluteFill, and that wrapper is
        // its own stacking context — so `mix-blend-mode: screen` blends the
        // leak against the empty wrapper instead of against the frame, and
        // 90 %-opacity fire renders as a faint warm tint. With no wrapper the
        // video is a sibling of the beats and blends against them.
        <Sequence
          key={`leak${i}`}
          layout="none"
          from={Math.round(o.at * REEL_FPS)}
          durationInFrames={
            o.seconds ? Math.max(1, Math.round(o.seconds * REEL_FPS)) : undefined
          }
        >
          <OffthreadVideo
            src={staticFile(`overlays/${o.file}`)}
            muted
            trimBefore={o.seek ? Math.round(o.seek * REEL_FPS) : undefined}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              mixBlendMode: o.blend ?? "screen",
              opacity: o.opacity ?? 1,
              pointerEvents: "none",
            }}
          />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

const FrameBorder: React.FC<{
  color: string;
  width?: number;
  inset?: number;
  radius?: number;
}> = ({ color, width = 4, inset = 26, radius = 10 }) => (
  <AbsoluteFill
    style={{
      top: inset,
      left: inset,
      right: inset,
      bottom: inset,
      width: "auto",
      height: "auto",
      border: `${width}px solid ${color}`,
      borderRadius: radius,
      pointerEvents: "none",
    }}
  />
);

/**
 * The scene — every placed item, each entering on its own beat and none of
 * them leaving.
 *
 * One `<Sequence>` per item with no `durationInFrames`, so it runs from its
 * entry to the end of the composition. The connector is drawn in the SAME
 * Sequence as the item it points AT, which is what makes a line arrive with
 * the thing it explains rather than before it.
 */
type Camera = {
  startFrame: number;
  durationInFrames: number;
  from: { x: number; y: number; zoom: number };
  to: { x: number; y: number; zoom: number };
};

/**
 * The camera, evaluated for the current frame.
 *
 * Each leg eases across its WHOLE beat rather than snapping at the start,
 * so the move never stops — which is the difference between a slideshow
 * that pans and a shot that travels. `inOut` on both ends keeps the joins
 * between legs from reading as a jolt.
 */
const cameraAt = (legs: Camera[], frame: number) => {
  const leg =
    [...legs].reverse().find((l) => frame >= l.startFrame) ?? legs[0];
  const t = Math.min(
    1,
    Math.max(0, (frame - leg.startFrame) / Math.max(1, leg.durationInFrames)),
  );
  const e = Easing.inOut(Easing.cubic)(t);
  return {
    x: leg.from.x + (leg.to.x - leg.from.x) * e,
    y: leg.from.y + (leg.to.y - leg.from.y) * e,
    zoom: leg.from.zoom + (leg.to.zoom - leg.from.zoom) * e,
  };
};

/**
 * The camera moves POSITIONS, not a wrapper.
 *
 * A wrapping layer with a transform is a stacking context, and that put the
 * brain's black plate back on screen the moment the camera shipped: an item
 * asking to composite in `screen` had the camera layer behind it instead of
 * the frame. Same trap as the light leaks and as the placed images before
 * them — the third time, so the rule is now structural rather than
 * remembered. Nothing wraps the scene; each item resolves where the camera
 * puts it and stays a direct child.
 *
 * A scene point x lands at 0.5 + (x - camera.x) * zoom.
 */
const project = (
  c: { x: number; y: number; zoom: number },
  x: number,
  y: number,
) => ({ sx: 0.5 + (x - c.x) * c.zoom, sy: 0.5 + (y - c.y) * c.zoom });

const SceneLayer: React.FC<{
  items: (PlacedSpec & { index: number; startFrame: number })[];
  palette: Palette;
  glow?: string;
  legs: Camera[] | null;
}> = ({ items, palette, glow, legs }) => {
  const byIndex = new Map<number, (typeof items)[number]>();
  for (const it of items) if (!byIndex.has(it.index)) byIndex.set(it.index, it);
  const frame = useCurrentFrame();
  const cam = legs ? cameraAt(legs, frame) : { x: 0.5, y: 0.5, zoom: 1 };
  return (
    // The scene's canvas is the STAGE, not the frame. Authoring y as a
    // fraction of the whole 1920 let a zoomed-in item drift down into the
    // caption band and sit on the words — which it did. Bounding the layer
    // at STAGE_BOTTOM_REEL makes that impossible by construction instead of
    // by remembering to keep y small, and it is the same line every element
    // in the bank already respects.
    <AbsoluteFill style={{ pointerEvents: "none", height: STAGE_BOTTOM_REEL }}>
      {items.map((it, k) => {
        const source =
          it.linkFrom !== undefined ? byIndex.get(it.linkFrom) : undefined;
        return (
          <Sequence key={`place${it.index}-${k}`} from={it.startFrame} layout="none">
            {source ? (
              <Connector from={source} to={it} palette={palette} cam={cam} />
            ) : null}
            <PlacedItem item={it} palette={palette} glow={glow} cam={cam} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

/** Frames an item takes to arrive. Short — it lands, it does not travel. */
const PLACE_RISE = 9;

const PlacedItem: React.FC<{
  item: PlacedSpec;
  palette: Palette;
  glow?: string;
  cam: { x: number; y: number; zoom: number };
}> = ({ item, palette, glow, cam }) => {
  const frame = useCurrentFrame();
  const t = Math.min(1, frame / PLACE_RISE);
  const eased = Easing.out(Easing.cubic)(t);
  const { sx, sy } = project(cam, item.x, item.y);
  return (
    <div
      style={{
        position: "absolute",
        left: `${sx * 100}%`,
        top: `${sy * 100}%`,
        // The zoom is in the WIDTH, not in a transform — a transform here
        // would isolate the blend again.
        width: `${item.w * cam.zoom * 100}%`,
        // Its own centre is the anchor, so x/y read as "where the thing
        // is" and not "where its corner is".
        transform: `translate(-50%, -50%) scale(${(0.84 + 0.16 * eased).toFixed(4)})`,
        // A glow follows the ALPHA. An image that arrived without one has a
        // rectangular alpha, so glowing it draws a glowing rectangle — which
        // is exactly the box that showed around the brain. An item composited
        // in `screen` needs no halo anyway: against black, screen IS the
        // glow. So the two are mutually exclusive, by rule and not by taste.
        // The item's own ink first, the reel's default second. A red neon
        // glows red; a gold machine glows gold.
        filter:
          (item.glow ?? glow) && !item.blend
            ? `drop-shadow(0 0 11px ${item.glow ?? glow}) drop-shadow(0 0 34px ${item.glow ?? glow})`
            : undefined,
        // The blend belongs HERE, not on the <Img>. This div already carries
        // a transform and a filter, and each of those makes it a stacking
        // context — so a child that asks to blend has nothing behind it but
        // its own parent and the black box stays a black box. The container
        // itself, though, still composites against the frame.
        mixBlendMode: item.blend ?? undefined,
        opacity: item.opacity ?? 1,
      }}
    >
      {item.label ? (
        <div
          style={{
            fontFamily: fonts.body,
            fontSize: 30,
            letterSpacing: "0.06em",
            color: palette.faded,
            textAlign: "center",
            marginBottom: 14,
          }}
        >
          {item.label}
        </div>
      ) : null}
      {/* A placed item can be footage as well as a drawing — a roulette
          wheel spinning belongs on the scene exactly the way a symbol
          does. Chosen by extension, because an <Img> handed an mp4 fails
          at render with "the source image cannot be decoded" and says
          nothing about which file it was. */}
      {VIDEO_FILE.test(item.file) ? (
        <OffthreadVideo
          src={staticFile(`media/${item.file}`)}
          muted
          style={{ width: "100%", display: "block" }}
        />
      ) : (
        <Img src={staticFile(`media/${item.file}`)} style={{ width: "100%" }} />
      )}
    </div>
  );
};

const VIDEO_FILE = /\.(mp4|mov|m4v|webm)$/i;

/**
 * The hairline between two placed items. Drawn from the lower edge of the
 * upper one to the upper edge of the lower one, and it GROWS — a line that
 * simply appears reads as a border, a line that draws itself reads as a
 * connection being made.
 */
const Connector: React.FC<{
  from: PlacedSpec;
  to: PlacedSpec;
  palette: Palette;
  cam: { x: number; y: number; zoom: number };
}> = ({ from, to, palette, cam }) => {
  const frame = useCurrentFrame();
  const grow = Math.min(1, frame / PLACE_RISE);
  const a = project(cam, from.x, from.y);
  const b = project(cam, to.x, to.y);
  const x1 = a.sx * 100;
  const y1 = a.sy * 100;
  const y2 = b.sy * 100;
  return (
    <div
      style={{
        position: "absolute",
        left: `${x1}%`,
        top: `${y1}%`,
        width: 2,
        height: `${(y2 - y1) * grow}%`,
        marginLeft: -1,
        backgroundColor: palette.faded,
        opacity: 0.55,
      }}
    />
  );
};

/**
 * The entrance. Scale and blur move together over the first third of the
 * beat and resolve — a thing arriving, not a thing appearing.
 *
 * No opacity ramp. Everything in this system prints rather than fades
 * (Martin, 2026-08-11), and that rule survives the new look: what changes
 * here is that the arrival has SIZE, not that it has a dissolve.
 */
const PUSH_FROM = 0.9;
const PUSH_BLUR = 8;
/** ~0.3 s. Long enough to be a movement, short enough not to be a wait. */
const ENTRANCE_FRAMES = 9;

const Entrance: React.FC<{
  kind?: "push";
  glow?: string;
  durationInFrames: number;
  children: React.ReactNode;
}> = ({ kind, glow, durationInFrames, children }) => {
  const frame = useCurrentFrame();
  // A FIXED landing, not a fraction of the beat. Scaling the entrance to
  // the beat meant a 4.5 s title spent 1.5 s blurred — Martin: "le titre
  // prend trop de temps avec le blur". The reference settles every arrival
  // in about a third of a second whatever the beat around it is doing.
  const settleAt = Math.min(ENTRANCE_FRAMES, Math.max(1, durationInFrames));
  const t = kind === "push" ? Math.min(1, frame / settleAt) : 1;
  const eased = Easing.out(Easing.cubic)(t);
  const scale = PUSH_FROM + (1 - PUSH_FROM) * eased;
  const blur = PUSH_BLUR * (1 - eased);
  // A bloom is LAYERED. One wide soft shadow spreads the light so thin over
  // a letter's stem that it disappears — measured on the first render: a
  // single 46 px drop-shadow at 30 % white left the title visually
  // untouched, while the reference's glow clearly lights the dot field
  // above its own headline. Two passes, one tight and one wide, is what
  // reads as light coming off the type.
  const filters = [
    kind === "push" && blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : null,
    glow ? `drop-shadow(0 0 11px ${glow})` : null,
    glow ? `drop-shadow(0 0 34px ${glow})` : null,
  ].filter(Boolean);
  if (!filters.length && kind !== "push") return <>{children}</>;
  return (
    <AbsoluteFill
      style={{
        transform: kind === "push" ? `scale(${scale.toFixed(4)})` : undefined,
        filter: filters.length ? filters.join(" ") : undefined,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

/**
 * The presenter card. Geometry is measured, not invented: 1400/1920 = 73 %
 * down, 940/1080 = 87 % wide, bleeding off the bottom edge.
 */
const HostCard: React.FC<{ file: string; top?: number; radius?: number }> = ({
  file,
  top = 1400,
  radius = 28,
}) => {
  return (
    <div
      style={{
        position: "absolute",
        top,
        left: 70,
        width: 940,
        bottom: 0,
        borderRadius: radius,
        overflow: "hidden",
      }}
    >
      <OffthreadVideo
        src={staticFile(`clips/${file}`)}
        muted
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
      />
    </div>
  );
};
