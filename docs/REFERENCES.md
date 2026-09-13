# What two references actually do

Measured 2026-09-08 by seven independent frame-by-frame teardowns of two
reels — an English one (107 s, "How to make your storytelling addictive")
and a French one (159 s, "Conseil de Chad #9"). Seven 7-second windows,
seven agents, no shared notes. Everything below is a measurement with a
frame number behind it, in `scratchpad/teardowns/*/TEARDOWN.md`.

Read this before adding a feature. Most of what looks like an effect is not
one, and the engine already refuses several things the references do.

## The finding that matters most

**Visual cuts and speech are two independent tracks.** One spoken sentence
runs across three shots with no seam; one caption page sits unchanged across
a shot cut. The reels cut when the picture wants to and speak when the
argument wants to.

reelkit fuses them: one beat = one screen = one spoken line. Every other
structural complaint below is that same fact seen from a different angle —
a wordless shot cannot be held, a scene cannot be retired, and 86 shots in
159 s is unreachable. Four of the seven gap lists name it.

## There are no effects

Across 159 s of the French reel: no zoom, no whip pan, no speed ramp, no
freeze frame. None. What reads as production value is a ground, a halo, a
border, a continuous audio bed, and the fact that things GROW instead of
appearing.

## The no-fades rule, corrected

Hard cuts everywhere — backgrounds, caption swaps, title exits (255 to gone
in one frame), numerals (blank to legible in one frame). The doctrine holds.

Three measured exceptions, all on TYPE or COLOUR, never on a picture:
- title text ENTERS soft (opacity, staggered per line or per word) and
  LEAVES hard. Entrances ramp; exits never do.
- the French reel cross-fades its caption LAYER around a cut: the old phrase
  lingers ~4 frames after, the new one starts ~2-3 frames before.
- a decaying full-frame colour tint (~30 frames), plus a single-frame red
  strobe synced to one spoken word.

Two agents disagree on the title's entrance — blur+opacity per word over
15-25 frames, versus pure opacity per line over 7-8 frames, glyphs sharp at
partial brightness. Different title instances; unresolved. Measure again
before building it.

## Numbers you can build against

| | measured |
|---|---|
| dot field | 10 px pitch, ~2 px dots @720 → 15 px / 1.5 px @1080 |
| host card | top 73.1-73.4 %, width 87.1-87.4 %, radius ~30 px @1080, bleeds off bottom |
| host card edge | hard, ~2 px antialiasing, no rim light, no feather |
| border (FR) | 8 px stroke, radius **0**, inset ~70 px sides / ~82 px top-bottom (asymmetric) |
| accent | `#FAE6A0` — the caption emphasis and the border are the SAME swatch |
| caption band | 46 % (no host card) to 63-66 % (with one) of frame height |
| caption cap height | 38 px @720 |
| audio floor | never below −25 dBFS; range 9-13 dB; a 40/80/120 Hz stack under the voice |
| shot length (FR) | median 1.48 s; opening accelerates 2.60 → 0.76 s; last third ~1.83 s |
| word rate | ~150 ms/word, speech-driven, never metronomic |

## Captions: two systems, one idea

**Dim-and-light.** The whole line stands from the first frame at **0.42**
brightness; each word snaps to full white on its cue, in one frame. The line
never reflows, so the viewer can read ahead. A growing line pins to a fixed
LEFT margin (x≈133 @720) — it does not recentre on every new word.

**Hand-picked accent.** Exactly two colours ever appear: white and the gold
above. The gold is not the current word and not a fixed vocabulary — the same
word is gold in one sentence and plain in the next. It follows the voice's
stress, so it is the writer's call. It PERSISTS once printed, same size, same
weight, colour only.

Some captions carry no shadow, no stroke and no plate at all, verified over
both black and a busy image. Contrast comes from a white word being large on
a mostly dark frame, not from a scrim.

**The same idea appears outside the caption band**: a numbered item sits at
RGB(129,123,123) and flashes to (253,252,253) over ~230 ms when the camera
arrives on it. Posted grey, lit on cue — one mechanic, two places.

## Motion

- **Elements grow, they do not appear.** A compound scale + brightness ramp
  over ~7 frames (61 → 151 brightness while 101×119 → 134×180 px).
- **The camera travels a canvas.** An element leaves the frame because the
  viewport moved, not because it was removed — that travel is what reveals
  the next thing.
- **An item moves after it has arrived**: 316 px vertically over 2.4 s while
  its neighbours hold within ±20 px. Not a camera pan — a per-item move.
- **Paths draw themselves**: a curve grows 0 → 11,376 px over 61 frames; an
  icon traces its outline in ~52 frames.
- **Reveal order is a crisscross**, not clockwise: TL → BR → TR → BL, each
  label on its own spoken word.
- Some shots are genuinely, deliberately static. The longest shot measured
  (2.56 s) has no move at all.

## Two glow languages

A broad achromatic bloom, ~100-150 px, on the white line art. A tight
saturated neon, ~20-25 px, on the red icon. Both exist in the same 7 seconds,
so a glow needs a RADIUS, not only a colour. And it takes the object's own
colour — light comes off a thing in the colour of the thing.

## Assets

The French reel's shots are **video, not stills** — faces change expression,
people turn around. Its continuous audio floor is those clips' own sound, not
a music bed. So the cost of that genre is 86 short clips, not 86 photos.

SVG beats raster decisively: already cut out, monochrome, tintable, and the
glow-from-colour extraction then works for free. A raster brain sourced for
this exercise turned out to be 1-bit monochrome and cost three renders.

`screen` blending is the universal solvent for this look — line art on black,
light leaks, symbols all composite with no matte. But **anything that needs
to blend must not be wrapped**: a parent carrying `transform`, `filter` or
`opacity` is a stacking context and silently kills the blend. That trap was
hit three times in one day (light leaks, placed images, the camera). The
camera therefore projects positions instead of wrapping the scene.

A glow follows the ALPHA. An image with no alpha has a rectangular one, so
glowing it draws a glowing rectangle. Glow and `screen` are mutually
exclusive by rule.

Light-leak clips OPEN ON BLACK. One measures 0, 0, 161, 0 in half-second
steps — playing its first second plays nothing. Seek to the light.

## What the engine still cannot do, by weight of evidence

1. Decouple shots from spoken lines (4 lists)
2. Drop or change the host card per beat (3 lists)
3. Change a placed item after it arrives — move, retire, swap, activate (3)
4. The `title` element: two faces, mixed case, centred, staggered entrance,
   glow on one line only (3)
5. A glow radius, per item (1, but decisive — two languages in 7 s)
6. Procedural path draw-on (1)
7. A real recorded voice with forced alignment. Narration is TTS-only, and
   the host card is hard-muted, so the format these references actually
   use — a real presenter, natural cadence — cannot be reproduced, only
   restated in a synthetic voice.

Built on 2026-09-08 and no longer missing: per-word dim and accent, the
camera, the persistent scene, per-item glow colour, light-leak overlays,
the dot field, the frame border, per-beat sound, video as a placed item.
