# Motion — one channel, every element

The claim: everything that moves in a reel is one thing — a property, over a
span of time, sampled at a moment, written onto the element's own style. An
entrance is that. An exit is that. A move after arrival, a focus pull, a word
lighting up on its cue: the same channel, different values.

Built 2026-09-13, additive: an element with no `motion` key renders exactly as
it did before the channel existed. `src/lab/motion.mjs` is the whole of it, in
plain JS beside `field.mjs` and `footage.mjs` so a test can assert on it
without a bundler.

## The axes

| axis | key | values | default |
|---|---|---|---|
| property | the key itself | `opacity`, `scale`, `x`, `y`, `rotate`, `blur`, `brightness` | — |
| from → to | `[from, to]`, a bare number, or `{from, to}` | numbers in the property's own unit | the property's rest value |
| when | `at` | `enter` · `exit` · seconds | `enter` |
| duration | `frames` | frames | 7 |
| delay | `delay` | frames after the span's anchor | 0 |
| black time | `lead` | frames the element is not drawn at all | 0 |
| curve | `ease` | `linear` · `in` · `out` · `inout` · `{spring: {stiffness, damping}}` | `out` |
| origin | `origin` | `center`, `top`, `bottom`, `left`, `right`, or a pair — the anchor a scale or rotation grows from | `center` |

## Every property owns its own clock

A combo is not one span driving two properties. It is a short fade under a
slightly longer zoom, each starting when it wants to — and the version where
both run for the same 14 frames is the one nobody uses. So a property may be
written as an object carrying its own `frames`, `delay`, `ease` and `at`, and
falls back to the spec's where it does not:

```json
{ "opacity": { "from": 0, "to": 1, "frames": 6 },
  "scale":   { "from": 0.8, "to": 1, "frames": 14, "delay": 3 } }
```

The picture is solid a fifth of a second in and keeps settling for another
third. That is the whole reason the object form exists.

## `lead` is black time, not a delay

A `delay` holds a property at its `from` value. For a zoom with no opacity
that means the element sits there small and still, waiting — which is not an
entrance, it is a bug that happens to resolve. `lead` holds the element
**hidden** (`visibility`, so nothing under it reflows) and then runs
everything, delays included, from there.

## Where a motion is written

It cascades, in order of who knows best: **the screen, then the shot it is in,
then the beat, then the reel.** `null` at any level means "none here" and stops
the inheritance — the same three-state contract `field` uses. Resolved in
`render-reel.mjs` beside the merge that already does this for a shot's `field`
and `border`, so what reaches React is a spec that cannot half-inherit.

A reel that names one entrance therefore has one; a beat that wants another
says so; a beat that wants none says `"motion": null`.

## Every element — and how that was proven

`Stage` returns early for `blank`, `mockup`, full-bleed `media` and `lab`, and
until 2026-09-13 those returns happened BEFORE the animated node: a `motion`
on any of them rendered clean and moved nothing, which is 23 of the 26 element
types. All four now pass through `StageBox`. For a `lab` beat the paper
travels with the drawing on purpose — for that beat the screen IS the element,
and a drawing sliding off its own paper is not an entrance.

Proven by an A/B, not by reading: each element rendered twice, once with
`motion: null` and once inheriting, then the content's bounding box measured
above the caption band. Against a linear 0.6 → 1 over 30 frames, theory says
−24 % at frame 12 and −13 % at frame 20; the lab pair measured −23.5 % and
−11.8 %, footage −26.9 % and type −25.5 % at frame 10 for −26.7 % expected.

That took three attempts, and the first two were the instrument's fault, not
the engine's: the caption band's own label sat inside the measured box and the
two beats of a pair carried labels of different lengths; then the offsets fell
outside the motion entirely, because an `out` curve is front-loaded — at frame
8 of a 12-frame zoom the scale is already 0.993. **A specimen sampled outside
its own motion window measures two settled frames and says nothing.**

## The bank

`presets/` ships eleven, each usable at reel, beat or shot level, and each
differing from its neighbours by a CONSTRUCTION rather than by a number:
`arrive` (the house entrance — a short fade under a barely-there zoom),
`fade-in`, `rise`, `zoom-in`, `zoom-out`, `blur-in`, `pop`, `punch`,
`slide-in-left`, `slide-in-right`, and `leave`, the one exit, opt-in because
across both references a title goes from full to gone in a single frame.

Their numbers are the durations motion design uses at 30 fps, not measurements
off a reference, and every file says so in its own `_measured`.

## `split` and `stagger` were deleted

Both were on the type, both were sampled here, and neither was ever passed an
index: the two call sites hand over `{ life }` and nothing else, so every part
was part zero. The measurement behind them is real — a title's words arrive one
after another — but nothing SPLITS an element into parts yet, so the axis
described a capability the engine does not have. It returns the day something
produces an index.

## What an anchor is measured against

`origin` decides where a scale grows from, and the trap is that a CSS
`transform-origin` is relative to **the node carrying the transform**, which
is not the same thing as the element you can see.

Measured 2026-09-13 on frames: `origin: "top"` on a footage card did not grow
it from its own top edge, it dragged the whole card toward the top of the
**screen** — because the animated node was a canvas-sized layer and the card
merely sits inside it. An anchor nobody can predict is worse than no anchor.

So for footage the keyword is resolved by `originPx()` against the card's own
box, in canvas pixels, and the layer stays canvas-sized on purpose: `spill`
draws the subject outside the box, and animating the box alone would leave a
head behind while the card moved.

**Type is not fixed and the asymmetry is deliberate for now.** A stage element
animates on `StageBox`, the type column, so `left` anchors the column's edge
rather than the glyphs'. Pinning an anchor to the painted text needs a node
that shrink-wraps it, which changes the layout of every stage element — a job
to judge on its own rather than smuggle in behind an anchor.

## `motionEnd` — what a specimen is measured against

`motionEnd(m)` returns the frame the last *arriving* span finishes. It exists
so a sheet can hold a clip exactly one second past its effect instead of four,
and so that number is computed by the engine rather than typed beside it.
Exits do not count towards it: they end when the element does.

## Three rules that decide whether this works

1. **No wrapper.** The style goes onto the element itself. A parent carrying
   `transform`, `filter` or `opacity` is a stacking context and kills
   `mix-blend-mode` silently — hit three times in one day. `StageBox` is that
   node for stage elements, which is also why it is a component: a hook
   cannot follow a conditional return.
2. **Anchored on the element's lifetime, not the beat's `Sequence`.** An exit
   is meaningless for something that dies at the cut, and captions and shots
   will stop being beat-bound later.
3. **Unknown keys refused.** The moment every element takes a `motion`, a
   `motion` in the wrong place renders clean and does nothing. That failure
   has already cost two sessions a render (`moveTo`, `hideHost`,
   `reel.theme`). **Done 2026-09-16:** `scripts/post-keys.mjs` refuses a key
   nothing reads, anywhere from the post down to a motion property, before
   the first gate. A lab element's `props` are still unchecked.

## What it replaces, and has not yet

One sampler and one style function against 17 local `PRINT_FRAMES` at five
different durations, `revealStyle`'s `print` mode that no caller ever passes,
and the hand-written entrances — the beat `push`, the caption `bump`, the
placed-item rise, the Ken Burns, ThermalPrinter's sweep, GlyphDissolve.

**None of them is migrated yet.** The channel exists beside them.

## The presets this is for

Two vocabularies meet here and both belong in the bank.

**Measured off the references** — each carries a `_measured` line saying where
its numbers came from:

| name | what it is |
|---|---|
| `grow` | scale and brightness together over ~7 frames |
| `type-in` | blur and opacity, split by word or line, staggered |
| `lit` | brightness 0.42 → 1 on a cue, ~230 ms |
| `bump` | 0.86 → 1.06 → 1, already in the caption band |

**The working set** — fade, slide from each side, zoom in, zoom out, blur, and
the combos of them, each with its in and its out. These are not measured off a
reference; they are what editing actually uses, and their defaults are what
the effects sheet exists to settle: for each one, the duration, the curve and
the amount that are right often enough to need no configuring. Industry
timings at 30 fps, for reference: 150 ms is 5 frames, 250 ms is 8, 400 ms is
12, 600 ms is 18.

## What is deliberately absent

- **No fade-out preset by default.** Across both references a title goes from
  full to gone in one frame. Two things ramp out, neither an element: a colour
  tint over ~30 frames, and the caption layer lingering ~4 frames past a cut —
  and that second one is lifetime, not motion. The channel can express an
  exit; whether one ships as a preset is a decision, not an oversight.
- **No `bounce` preset.** It is a damping number on the curve axis. Below
  ~2·√stiffness a spring overshoots; above it, it does not.

## How it gets proven

1. `reelkit lab <element>` — 30 frames in ~20 s, one element alone.
2. A generated specimen sheet: one beat per axis value, every value rendered
   on **both** vehicles — type and a footage card — because the same numbers
   do not read the same on a word and on a moving picture.
3. A parity render last: a post that asks for nothing must come out identical.
