# The footage box

A shaped, placed window onto moving pictures. `{ "type": "footage", "spec": {…} }`
on a beat or a shot.

**Why the name.** `media`, `clip` and `recording` are already three element
types and each means something narrower — one credited excerpt drawn on the
paper, an ASCII specimen, an app capture. This is the general case: a box of
any ratio, anywhere on the canvas, any corner radius, that can move. Film
calls that footage. `media` is the one that should eventually go.

## The default is the whole frame

A footage box that names nothing fills the canvas. A `ratio` alone narrows it
to a **full-width band**, not a centred card:

```json
{ "file": "x.mp4" }                    // the whole canvas
{ "file": "x.mp4", "ratio": "16:9" }   // 1080 x 608, full width, centred
{ "file": "x.mp4", "ratio": "16:9", "width": 0.86 }   // now it has margins
```

Ask for a smaller box by saying `width`. `full` is kept as a name for the
floor because `"preset": "full"` reads as an intention and `{}` does not.

## Margins — the box model

`width` + `x` cannot say "the same gutter on both sides". That is a
subtraction from the canvas, and saying it as a fraction means recomputing two
numbers by hand every time the gutter changes — and getting an asymmetric
result the moment the arithmetic drifts. So a box can be given margins
instead, CSS-shaped:

```json
{ "margin": 84 }                                  // 84 all round
{ "margin": [0, 84] }                             // [vertical, horizontal]
{ "margin": [40, 84, 120] }                       // [top, horizontal, bottom]
{ "margin": { "left": 84, "right": 84, "bottom": 140 } }
```

`"auto"` means "whatever is left", and **a side nobody names is auto**. Two
autos on an axis centre the box; one auto absorbs the remainder and pins the
named edge. `padding` is a synonym — a video frame has no border and no
content box, so the distinction CSS draws would be a distinction without a
difference here.

When `margin` is present it decides the box and `x` / `y` / `anchor` are not
consulted.

**Over-constraint.** `{ "margin": 84, "ratio": "16:9" }` names four margins
AND a height that the width already decided. CSS drops a margin; here both are
kept and the box is centred in the band they leave, because "84 all round with
a 16:9" plainly means a symmetric result. Filling the span instead produced a
16:9 box 1752 px tall, which is how this was found.

## A preset is a class

Same contract as the ground (`docs/GROUND.md`), deliberately — one idea,
learned once. A preset sets some keys; **any key written beside it wins.**

```json
{ "preset": "circle" }
{ "preset": "circle", "width": 0.4, "x": 0.28 }
{ "ratio": "5:4", "width": 0.8, "radius": 24 }
```

`circle` is the proof it works: it is `square` plus `radius: "50%"` and it
carries no drawing code of its own.

| preset | what it is |
|---|---|
| `full` | fills the canvas |
| `half-top` · `half-middle` · `half-bottom` | half the frame, pinned to that edge |
| `square` `portrait` `landscape` `story` `academy` | 1:1 · 4:5 · 16:9 · 9:16 · 4:3, centred |
| `circle` | `square` + a radius of half the short side |
| `card` | 4:5, soft corners, low on the frame — the reference's host card |
| `pill` | 21:9 fully rounded on the short side |

## The spec

| key | what it is |
|---|---|
| `file` | under `posts/media/` |
| `ratio` | `"16:9"`, a number, or `null` to use `height` instead |
| `width` `height` | fraction of the frame, **both default to 1** — no padding, no inset. `ratio` wins over `height` |
| `margin` `padding` | canvas px from each edge, CSS-shaped, `"auto"` supported. Decides the box when present — see above |
| `x` `y` | centre, fraction of the frame |
| `anchor` | `top` · `middle` · `bottom` — which edge the box sits against **when `y` is absent** |
| `radius` | canvas px, or `"50%"` of the short side. Clamped to half the short side |
| `fit` | `cover` (default) · `contain` |
| `focus` | `{x, y, zoom}` — where in the SOURCE the box looks. This is the shoulder crop |
| `from` | seconds into the source |
| `spill` | `{ matte }` — see below |

**`x`, `y`, `width`, `radius` and `focus.zoom` all take a track**, which is
what lets a box move after it arrives:

```json
"x":      [{ "at": 0, "to": 0.25 }, { "at": 3.2, "to": 0.75 }],
"radius": [{ "at": 0, "to": 180 },  { "at": 3.2, "to": 16 }]
```

`at` is seconds into the shot. Before the first key it holds the first value,
after the last it holds the last — a track that ran off its end and snapped to
zero is the failure this replaces, not one it should introduce. Default easing
is `inout`; `in`, `out` and `linear` are available per key.

This is gap 3 in `docs/REFERENCES.md` — *"change a placed item after it
arrives — move, retire, swap, activate"*, named by three independent teardowns
and previously unexpressible anywhere in the engine.

## The spill — a head that breaks its own frame

A box clips its contents; that is what a box is for. So a subject cannot leave
it. `spill` names a **matte** — the same take with its background removed —
and draws it as a second layer, outside the clip, aligned to the same box.
The box shows the shot; the matte shows the person; the person is drawn over
the edge.

```json
{ "ratio": "5:4", "width": 0.8, "y": 0.58, "radius": 24,
  "focus": { "x": 0.7, "y": 0.85 },
  "spill": { "matte": "me-matte.webm" } }
```

**Two things that are not obvious and both cost a render.**

1. The matte must be drawn at the size `object-fit: cover` **would have
   produced**, not at the box's size. Drawn at the box's size it is cropped
   identically and nothing escapes. So staging probes the matte's pixel size
   with ffprobe (`spill.srcW/srcH`, never written by a post) — a component
   rendering one frame cannot ask a video how big it is.
2. `OffthreadVideo` needs `transparent`. Without it the alpha channel is
   dropped and the matte paints its own background opaque; RVM leaves
   arbitrary colour wherever alpha is 0, so the failure is loud.

**Which way it spills, and how far.** `object-fit: cover` crops exactly ONE
axis — whichever the box is tighter on. So a box wider than the source crops
vertically and can only spill up and down; a box narrower than the source
crops horizontally and can only spill left and right. There is no setting that
gives all four, because there is no fourth crop to escape from. `focus.y`
decides how the vertical crop splits: at `0` almost all of it is below the box
(the subject spills downward, over the bottom corners), at `1` almost all of
it is above (the head rises past the top edge).

And the spill can only draw what the **source** contains. A tight crop that
cuts the subject at the chest has nothing left to paint below the box, however
the focus is set — that is a framing decision at capture, not a parameter.

**Framing it.** The head only breaks the top edge if the box's top edge cuts
across the head, so `focus.y` has to push the view far enough down. The slack
available is `(coveredHeight − boxHeight)`, which is why a box near the
source's own aspect gives a subtle break and a much wider box makes the
subject tower over a small window instead. Adjust `focus.y` per clip; there is
no universal value and there should not be one.

## What the references actually do, and what this is not

Worth writing down because it cuts against the obvious assumption. The
Peterson teardown checked the top edge of its talking-head band at 4x zoom
and found a dead-straight horizontal line crossing the man's OWN red curtain:
*"This is not a person-matte."* The whole rectangular interview frame — him
and his curtain — is one opaque rectangle inset into the vertical canvas,
razor-hard edge, no halo. The same is true of every reel reelkit rendered on
2026-09-08: `story-casino`, `story-scene`, `story-move`, `story15`, `chad15`
all put the presenter in an opaque rectangle bleeding off the bottom.

`person_alpha.webm` was produced that day and the recipe was written down —
and **no render ever composited it**. The spill above is the first time a
matte reaches a frame in this engine. So this is not a reproduction of a
measured device; it is a capability the references did not use, added because
it was asked for. Recorded as such rather than dressed up as a finding.

## Two things found by rebuilding an old reel on this

`story-casino.json` was written before any of this existed and was rebuilt on
it (`work/casino/proj/posts/casino-v2.json`). Two things surfaced:

- **`footage` reads `posts/media/` only.** The reel's presenter clip lived in
  `posts/clips/`, because that is where the older `host` key looks. Real
  footage in two pools by accident of which key was written first; not fixed,
  written down.
- **`host` is a continuous layer and a footage box is per-beat.** The old key
  runs one take under every beat; reproducing that with boxes means repeating
  the spec and restarting the clip on each cut. The box is the better shape
  for a picture that changes; `host` is still the only way to say "one take,
  under everything".

## Making a matte

`RobustVideoMatting` on `--device mps`, the recipe in
`research/2026-09-08/matting/MATTING.md`, which still applies including its two
one-line PyAV patches. Roughly a minute for six seconds at 720p on an M4.
