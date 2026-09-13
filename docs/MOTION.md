# Motion — one channel, every element

**Nothing here is built yet.** This is the surface to agree on before a line
moves, written 2026-09-13 against what the tree actually does today.

The claim: everything that moves in a reel is one thing — a property, over a
span of time, sampled at a moment, written onto the element's own style. An
entrance is that. An exit is that. A move after arrival, a path drawing
itself, a word lighting up on its cue: all the same channel, with different
values.

## What exists today

- **`trackAt` is already that channel**, and it is the only implementation in
  the repo: `Track = number | {at, to, ease}[]` (`src/lab/footage.mjs:17`),
  sampled by `trackAt(v, t, fallback)` (`:191`), `at` in seconds, four curves
  (`in`, `out`, `inout`, `linear`). It serves the footage box (`width`,
  `height`, `x`, `y`, `radius`, `focus.zoom`) and the cutout (`width`, `x`,
  `top`, `bottom`). Nothing else.
- **Everything else is hardcoded.** 17 files under `src/` carry their own
  `PRINT_FRAMES`, at five different durations (7, 8, 10, 12, 14).
  `revealStyle` (`src/lab/reveal.ts:47`) offers `fade` (4 frames), `print` (7)
  and `cut` — and no caller ever passes a mode, so every element in the bank
  is stuck on the 4-frame fade and `print` is dead code.
- **The entrances that do exist were each written once, by hand**: the beat
  `push` (scale 0.9 → 1 with an 8 px blur, the only value `chrome.entrance`
  accepts), the caption `bump` (0.86 → 1.06 → 1), the placed-item rise
  (0.84 → 1 over 9 frames), the photo background's Ken Burns, ThermalPrinter's
  sweep, GlyphDissolve's decay.
- There is **no `spring()` anywhere in `src/`**.
- **A post cannot ask for any of it.** Motion is the one axis of the look that
  is unreachable from JSON, which is why a preset can never carry it.

## The axes

| axis | key | values | default |
|---|---|---|---|
| property | the key itself | `opacity`, `scale`, `x`, `y`, `rotate`, `blur`, `brightness`, `reveal` | — |
| from → to | `[from, to]`, or a full track | numbers in the property's own unit | the element's static value |
| when | `at` | `enter` · `exit` · `cue:<n>` · seconds | `enter` |
| duration | `frames` | frames | 7 |
| curve | `ease` | `linear` · `in` · `out` · `inout` · `spring {stiffness, damping}` | `out` |
| split | `split` | `none` · `line` · `word` · `char` | `none` |
| stagger | `stagger` | frames between parts | 2 |
| origin | `origin` | a transform origin | `center` |

`enter` and `exit` are sugar: a track anchored on the element's own arrival or
departure. Anything more complicated stays a track with explicit seconds,
which is what footage and cutout already write.

## Three rules that decide whether this works

1. **No wrapper.** The style goes onto the element itself. A parent carrying
   `transform`, `filter` or `opacity` is a stacking context and kills
   `mix-blend-mode` silently — hit three times in one day, and the reason
   `push` already skips placed items and the camera projects positions instead
   of wrapping the scene.
2. **Anchored on the element's lifetime, not the beat's `Sequence`.** An exit
   is meaningless for something that dies at the cut, and captions and shots
   will stop being beat-bound later. Anchor it right once.
3. **Unknown keys refused.** The moment every element takes an `enter`, an
   `enter` in the wrong place renders clean and does nothing. That failure has
   already cost two sessions a render (`moveTo`, `hideHost`, `reel.theme`).
   Nothing outside `scripts/presets.mjs` validates keys today.

## What it replaces

One sampler and one style function, against: 17 local `PRINT_FRAMES`, the dead
`print` mode, and the hand-rolled entrances above. `chrome.entrance: "push"`
survives as a preset name, not as code.

## The presets that follow

Each one is a JSON file in `presets/` — the resolver already exists, so a
preset costs no runtime. Each carries `_measured` saying where its numbers
came from.

| name | what it is | where the numbers come from |
|---|---|---|
| `grow` | scale + brightness over ~7 frames | REFERENCES.md, "elements grow, they do not appear" |
| `type-in` | opacity (± blur), split by word or line, staggered | REFERENCES.md, title entrances |
| `lit` | brightness 0.42 → 1 on a cue, ~230 ms | REFERENCES.md, the numbered item |
| `print` | the house wipe, 7 frames | the engine's own |
| `fade` | opacity over 4 frames | the engine's own |
| `bump` | 0.86 → 1.06 → 1 | already in the caption band |
| `draw` | a path revealing itself | REFERENCES.md — waits for the `reveal` property |

## What is deliberately absent

- **No fade-out preset.** Measured across both references: a title goes from
  full to gone in one frame, and every content change is a hard cut. Two
  things ramp out, neither of them an element — a colour tint decaying over
  ~30 frames, and the caption layer lingering ~4 frames past a cut. That
  second one is lifetime, not motion, and it belongs to the beat model.
- **No `slide` or `bounce` vocabulary.** They are values on the property and
  curve axes — a `y` track, a spring with low damping. Naming them as presets
  before anything measured asks for them is how a preset bank stops measuring
  anything.

## How it gets proven

1. `reelkit lab <element>` — 30 frames in ~20 s, one element alone.
2. The standing caption sheet in the probe project: 34 beats covering every
   look at once, so a change is checked against everything it can break.
3. A parity render last: a post that asks for nothing must come out identical.
