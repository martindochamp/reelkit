# The cutout

A matted person on the canvas with **nothing behind them**. The reaction
cutout: over the beat's picture, under the words, standing on the frame.

```
reel.cutout    one continuous take under every beat
beat.cutout    this beat's, over the reel's; `null` takes the person away
```

A value is either a preset name or a spec. Keys set beside a preset win — the
contract `field` and `footage` already use, deliberately, one idea learned
once.

```json
{ "cutout": "reaction" }
{ "cutout": { "file": "me-matte.webm", "preset": "reaction", "width": 0.62 } }
{ "cutout": null }
```

## Why it is not a footage box with `spill`

`spill` (docs/FOOTAGE.md) draws a matte OUTSIDE a box so a head can break the
frame it sits in. It needs the box: the matte is drawn at the size
`object-fit: cover` would have produced, which is why staging probes the
source with ffprobe and writes `srcW`/`srcH` into the spec. **Take the box
away and there is nothing to align to.**

So this is the other half of the same idea, and the two now share their one
piece of drawing code — `MatteLayer` in `src/lab/Cutout.tsx`. Before that
there were going to be two places to remember `transparent`, and forgetting
that flag costs a render every time.

## Why there is no `y`

A cutout is placed by an **edge**: `x` and `width` need only the canvas, and
the source's own aspect ratio decides the height in the browser
(`height: auto` on the video). Nothing in the engine, and nothing at staging,
ever has to know how tall the person is.

A centre would need that height, and the probe with it. Every placement this
device actually uses is an edge anyway — feet on the bottom of the frame, head
hanging from the top — so `bottom` and `top` say it directly. `footage` keeps
its `y` because a box's height comes from a ratio the post wrote down.

The consequence worth knowing: **`reelkit lab cutout` works with no staging at
all**, because there is nothing to measure.

```
reelkit lab cutout --props '{"spec":{"file":"me-matte.webm","preset":"aside"}}' --frames 30
```

## The bank

| preset | what it is |
|---|---|
| `reaction` | bottom-right corner, feet on the frame's edge. The default device |
| `stage` | centred and large, standing in front of whatever the beat shows |
| `aside` | small, left, lifted off the floor — commenting beside the content |
| `peek` | half out of frame at the left edge: the body that just walked in |

Four, and each is a different **intention** rather than a different number. A
placement here is two numbers, and a name that saves two numbers is not worth
a lookup unless it carries a device — the footage bank learned that the other
way round, where five of its twelve entries are a width and a `y` apart.

## The spec

| key | what it is |
|---|---|
| `file` | the matte, under `posts/media/`. VP9 webm **with an alpha channel** |
| `width` | fraction of the canvas width. Takes a track |
| `x` | centre, fraction of the canvas width. Takes a track |
| `bottom` | the cutout's BOTTOM edge, fraction up from the floor. A track |
| `top` | its TOP edge instead, fraction down from the ceiling. A track |
| `flip` | mirror it — a person shot facing left, placed on the right |
| `opacity` | for a ghost. Takes a track |
| `from` | seconds into the source |

`bottom: 0` is the default, and it is *stated* rather than implied: a cutout
with no vertical word is standing on the bottom of the frame, because that is
the device. `top` and `bottom` are exclusive — naming `top` drops the
inherited `bottom`, since a box pinned to both edges is the one thing this
geometry cannot draw without a height.

**`x`, `width`, `bottom`, `top` and `opacity` all take a track**, which is what
lets the person arrive:

```json
"x": [{ "at": 0, "to": 0.15 }, { "at": 1.6, "to": 0.85 }]
```

`at` is seconds into the beat — or into the REEL, for a `reel.cutout`, which
is the same clock its seek reads. See below.

## Where it sits, and the one clock question

Over the beat's picture and under the caption band. A person who covers the
sentence is a bug, not a look.

A `beat.cutout` starts on its beat. A `reel.cutout` is **one continuous
take**: mounted per beat it would restart at every cut, so it carries the
beat's own start frame as an offset and both its seek and its tracks read the
reel's clock. This is the thing `host` avoids by being drawn once — and pays
for by sitting over the captions.

## `host` is the deletion candidate

`reel.host` is this, with a box: an opaque rounded rectangle pinned to the
bottom of the frame (`src/Reel.tsx`, `HostCard`). It reads as an interview
inset, which is exactly what the references do NOT do. It stays because posts
written before this exist and still render — `story-casino` is one — and it
goes the moment none do. Two differences, both accidental rather than
designed: `host` reads `posts/clips/` while a cutout reads `posts/media/` (the
two pools docs/FOOTAGE.md already flags), and `host` draws over the caption
band.

## Making a matte

`RobustVideoMatting` on `--device mps`, recipe in
`research/2026-09-08/matting/MATTING.md`, including its two one-line PyAV
patches. Roughly a minute for six seconds at 720p on an M4.

Two traps, both already paid for:

1. **ffprobe reports `pix_fmt=yuv420p` on a VP9 file that HAS alpha.** The
   alpha rides in a WebM side channel; the tag to read is `alpha_mode=1`
   (`ffprobe -show_entries stream_tags`). A file that looks wrong by pix_fmt
   is usually fine.
2. **Reading one back with ffmpeg needs the decoder named** —
   `ffmpeg -c:v libvpx-vp9 -i person_alpha.webm …` — or the alpha is silently
   dropped on the way in, and every re-encode flattens it.

And the framing is decided at capture, not here: a take cropped at the chest
has no legs to place, however the cutout is placed.
