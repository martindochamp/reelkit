import React from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { Stage, type ReelElementSpec, type StageMode } from "./ReelElements";
import { mono, palettes, type Palette } from "./tokens";

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
};

export type ReelPage = {
  startFrame: number;
  words: ReelWord[];
};

export type ReelBeat = {
  element: ReelElementSpec;
  durationInFrames: number;
  /** Beat-local frames each element part prints on — from the [+] cues. */
  cueFrames: number[];
  /**
   * What fills the frame behind the element: nothing (the receipt paper),
   * "ink" (solid ink, inverted type), or a photograph from posts/art/
   * (staged under public/bg/ by render-reel.mjs).
   */
  bg?: string;
  /** Path under public/, e.g. "audio/fe-absorbed/01-ab12cd34ef.mp3". */
  audio?: string;
  /** Beat-local frame the audio starts on (the lead-in breath). */
  audioStartFrame?: number;
  /** Caption pages, beat-local frames — computed by render-reel.mjs. */
  pages?: ReelPage[];
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

const Captions: React.FC<{
  pages: ReelPage[];
  mode: CaptionMode;
  /** The pair the beat's own page is painted in — the band borrows it. */
  palette: Palette;
}> = ({ pages, mode, palette }) => {
  const frame = useCurrentFrame();
  const page = [...pages].reverse().find((p) => frame >= p.startFrame);
  if (!page) return null;
  const said = page.words.filter((w) => frame >= w.startFrame).length;
  return (
    <div
      style={{
        position: "absolute",
        // Symmetric: the band centres on the frame (540), not on the
        // text column — otherwise it sits 30 px left of the mockup and
        // every other centred element, and the eye catches it.
        left: 84,
        right: 84,
        // 1180 — the caption band sits at 61 % of the frame, well clear of
        // TikTok's bottom chrome, which creeps higher than the published
        // safe-area tables admit. The stage shrinks to match (STAGE_BOTTOM),
        // so nothing ever competes with the words.
        top: 1180,
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
          backgroundColor: palette.paper,
          color: palette.ink,
          padding: "20px 34px",
          fontFamily: mono,
          fontSize: 48,
          lineHeight: 1.35,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
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
                    ? { fontWeight: i === Math.max(0, said - 1) ? 800 : 400 }
                    : {
                        visibility: here ? "visible" : "hidden",
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

export const Reel: React.FC<ReelProps> = ({
  beats,
  theme = "light",
  music,
  sfx,
  roomTone,
  captions = "page",
}) => {
  const palette = palettes[theme];
  let from = 0;
  return (
    <AbsoluteFill style={{ backgroundColor: palette.paper }}>
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
        const mode: StageMode =
          beat.bg === "ink" ? "ink" : beat.bg ? "photo" : "paper";
        return (
          <Sequence
            key={i}
            from={start}
            durationInFrames={beat.durationInFrames}
          >
            {mode === "photo" ? (
              <PhotoBackground
                file={beat.bg as string}
                durationInFrames={beat.durationInFrames}
                index={i}
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
            ) : (
              <AbsoluteFill style={{ backgroundColor: palette.paper }} />
            )}
            <Stage
              element={beat.element}
              cueFrames={beat.cueFrames}
              theme={theme}
              mode={mode}
            />
            {beat.audio ? (
              <Sequence from={beat.audioStartFrame ?? 0}>
                <Audio src={staticFile(beat.audio)} />
              </Sequence>
            ) : null}
            {beat.pages?.length ? (
              <Captions
                pages={beat.pages}
                mode={captions}
                // Exactly the rule the stage uses for its elements, and
                // for the same reason: the band belongs to the page it
                // is on. A photo has no flat colour to vanish into, so
                // it borrows the light pair a printed card uses.
                palette={
                  mode === "photo"
                    ? palettes.light
                    : mode === "ink"
                      ? palettes[theme === "dark" ? "light" : "dark"]
                      : palette
                }
              />
            ) : null}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
