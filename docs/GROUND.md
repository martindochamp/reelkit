# The ground

The layer under everything and over the beat's paper. It was fifteen lines of
hardcoded radial gradient called `DotField`, reachable only through
`chrome.field: "dots"` — and a check across every post that exists (the parity
fixture, Papyr's two, Tally's hundred) found **not one that set it**. So the
engine had exactly one ground, and nothing used it.

It is now `src/lab/DynamicBackground.tsx` plus `src/lab/field.mjs`, and the
old dot field is one preset among eight.

## Where it goes

```
reel.chrome.field   the reel's ground
beat.field          this beat's, over the reel's
shot.field          this picture's, over the beat's
```

`null` at any level draws none. The three-state contract is `border`'s, for
the same reason: **the ground is a property of the picture, and a beat can
show several pictures.** A shots beat that cuts from a blueprint to a
photograph has two grounds inside one spoken line, and a beat-wide answer
would be wrong for one of them.

A value is either a preset name or a spec. Keys set beside a preset win:

```json
{ "field": "blueprint" }
{ "field": { "preset": "blueprint", "drift": { "x": -18, "y": -18 } } }
{ "field": { "shape": "cross", "color": "#C8A24A", "pitch": 52, "size": 9 } }
{ "field": null }
```

## The spec

| key | what it is |
|---|---|
| `preset` | a name from the bank below |
| `shape` | `dot` · `grid` · `cross` · `diagonal` · `rings` · `checker` |
| `ground` | colour painted under the pattern. `null` lets the beat's paper through |
| `color` | the pattern's ink |
| `pitch` | cell size, canvas px |
| `size` | dot radius, stroke width, or arm length — the shape decides |
| `major` | `grid` only: every Nth line drawn heavier. This is what reads as a blueprint |
| `majorColor` `majorSize` | that heavier line |
| `angle` | `diagonal` only, and it picks a direction, not a degree: under 90 the stripe runs `/`, 90 or over it runs `\` |
| `drift` | `{x, y}` in canvas px per second. The infinite travel |
| `zoom` | `{from, to}` multiplier on `pitch`, eased across the shot |

## The bank

| preset | what it is |
|---|---|
| `dots` | the ground the engine already had — 15 px pitch, 1.5 px dots at `#373737` |
| `dots-wide` | the same, wider and dimmer, for a busy foreground |
| `blueprint` | squared paper on deep navy, a heavy line every fifth cell |
| `graph` | the same construction, white. Engineering paper |
| `crosshatch` | register marks, sparse enough to read as a surface |
| `carbon` | machined diagonal, close pitch, low contrast |
| `sonar` | big rings on cool ink — the one that wants a drift under it |
| `board` | two-tone checker, light |

## Three decisions worth disagreeing with

**1. Every shape is a `background-image`, never an SVG node in the tree.**
That buys three things at once: the tile repeats to any canvas with no asset,
`background-position` gives a seamless infinite drift (a tiled image has no
edge to reach, so there is no wrap and no reset), and `background-size` gives
a zoom that costs **no `transform`**. That last one is not a preference — a
transform is a stacking context, and this engine has been bitten three times
by one silently killing `mix-blend-mode` on the layer above. The two shapes a
gradient cannot draw arrive as an inline SVG data URI, so they travel the same
three CSS properties as the rest and the drift/zoom code has one branch.

**2. The diagonal is drawn corner to corner, not as a repeating gradient.**
The first version used `repeating-linear-gradient` and it looked like noise on
the render: the gradient repeats on its own period, so tiling it at the pitch
cut every stripe. A line from one corner of a tile to the other is seamless by
construction, because the tiles join at the corners. This is why `angle` picks
a direction rather than a degree — an arbitrary angle was promised by the
first draft and never worked.

**3. The arithmetic is in `.mjs`, the clock is in `.tsx`.** `field.mjs` is a
pure function of a spec: shape in, CSS layers out, no frame and no React. It
is testable without a bundler, which is how `scripts/presets.test.mjs` can
assert that `dots` still emits the exact string the deleted `DotField` did.
Same arrangement as `src/lab/tier-fit.mjs`, for the same reason — two copies
drift, and the second one is always the one that lies.

## The zoom is softer than the still, and that is not compression

Measured on the same preset, same crop, edge strength as the 99.5th percentile
of the image gradient:

| | edge strength |
|---|---|
| `blueprint`, held still | **109** |
| `blueprint`, mid-zoom | **~77** — 71 % of it |

The codec is not the cause: the frames carry no blocking and no ringing, and
the loss is the same at any bitrate. The cause is that a tile drawn at a
fractional `background-size` cannot land its lines on pixel boundaries, so
every edge is antialiased across two columns at partial strength. The same
thing happens under `drift`, more mildly, for the same reason.

**Scaling the stroke with the cell does not fix it.** That change is in, and
it is right on its own merits — a grid whose cell grows while its line stays
1 px changes weight mid-move — but rendered both ways and compared at matched
frames, the edge strength is identical. This is recorded because the first
version of this file claimed otherwise before it was measured.

**Rounding the pitch to whole pixels does fix it, and costs the move:**

| | edge strength kept | frames identical to the one before |
|---|---|---|
| fractional (what ships) | 71 % | 0 % |
| rounded to the pixel | **97 %** | **46 %** |

At 30 fps a zoom that can only advance when the rounded pitch changes runs at
about 16. Crispness and smoothness are genuinely opposed here and there is no
third answer, so the current default is the smooth one and the trade is
written down rather than decided quietly.

## Known, and not fixed

**FIXED 2026-09-09.** The caption band did not know about the ground: `graph`
or `board` under a dark skin put a white caption on a white field, visible
only as its own shadow. A field that names a ground now decides the band from
that ground's luminance rather than from the skin. See `docs/SUBTITLES.md`,
"The band now knows what is behind it".
