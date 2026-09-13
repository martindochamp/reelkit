# Presets

A preset is a named JSON fragment merged **under** the node that names it.
That is the whole mechanism. There is no preset runtime, no template
engine and no second plugin system — `scripts/presets.mjs` is 150 lines and
everything downstream of it sees one plain spec.

    { "preset": "photo-card", "screen": { "type": "blank" }, "bg": "street.jpg" }

`reelkit presets` prints the merged bank and marks which side each name came
from, exactly as `reelkit elements` does for components.

## What is a preset and what is not

Seven reference reels were torn down frame by frame on 2026-09-08. The
devices they produced fall into two kinds, which read alike in a list and
are nothing alike to build:

| | example | where it lives |
|---|---|---|
| a thing that does not exist | a swipe carousel, a hand holding a phone, a ✗/✓ badge pair | `<project>/elements/<name>/` — ELEMENTS.md |
| a named set of values on things that do | a border of that weight, a camera at that zoom | `presets/<name>.json` — here |

**Most of what those teardowns found is the first kind.** The honest count
after the first pass is two presets and a long list of missing components,
and that is the useful finding: the gap between reelkit and the references
it studies is mostly things that do not exist yet, not settings nobody has
bundled. A preset bank that swelled past that count would be measuring
nothing.

## The rules

- **The node's own keys always win.** A preset is a floor, never a ceiling.
  That is what makes one adaptable per post instead of a second place to
  look for the truth.
- **Objects merge, arrays and scalars replace.** A preset carrying `beats`
  and a post carrying `beats` are two versions of one list, not two halves
  of one; interleaving them would produce a reel neither file describes.
- **`extends` gives you a base adapted by style.** A cycle is refused by
  name.
- **A list applies left to right**, later winning over earlier, and the node
  still wins over all of them.
- **An unknown name is refused, not ignored.** A name that silently does
  nothing renders a post that looks finished and is not — this codebase's
  oldest failure shape.
- **A preset may not set `say`.** It styles a beat; it does not write it.
  The words are a decision, and the writing gates exist because they are.
- **`_level` declares where a preset belongs** — `reel`, `beat`, `shot`, or
  a list — and applying one elsewhere is refused. Levels name different
  keys: a reel preset sets `chrome.border`, a beat preset sets `border`.
  Without the check, the wrong one merges a key nothing reads at that level
  and the post renders looking finished with the preset having done nothing.
  This rule exists because the first two presets ever written made exactly
  that mistake.
- **Leading-underscore keys are annotations about the preset** — where it
  was measured, why it exists — and never travel into the spec.

## Banks

Core presets ship in `reelkit/presets/`; a project's own live in
`<project>/presets/`. A project name shadows a core name deliberately: a
project that writes its own `hard-card` has decided the core one is wrong
for it, and silently ignoring that would be the worse surprise. Same rule as
the element bank, for the same reason.

## Writing one

One file, named for the preset. Say where the numbers came from — a preset
whose values nobody can trace is a style opinion wearing a measurement's
clothes.

```json
{
  "_level": ["beat", "shot"],
  "_measured": "research/…/TEARDOWN.md §3 — sampled RGB(250-254), opaque.",
  "border": { "color": "#FCFCFC", "width": 12, "inset": 105, "radius": 0 }
}
```

## Proven by a render, not only by a test

The resolver was rendered before it was believed — `_presets.json` in the
2026-09-08 probe project, four beats each asking one question, with the left
rule sampled at the pixel on the finished MP4:

| beat | declared | measured on the file |
|---|---|---|
| 1 — reel names `hard-card` | `#252525` | (35.7, 35.7, 35.7) |
| 2 shot 1 — shot names `photo-card` | `#FCFCFC` | (250.3, 249.8, 251.2) |
| 2 shot 2 — same preset, node overrides the colour | `#FF2D55` | (255, 66, 82) |
| 3 — names nothing | inherits the reel's | (34.7, 34.7, 34.7) |
| 4 — `"border": null` | no rule | (0, 0, 0), the page itself |

Differences are h.264 chroma rounding, largest on the saturated red where
4:2:0 subsampling costs most. Beat 3 is the one that matters most: a beat
naming no preset renders exactly as it did before any of this existed.

`node scripts/presets.test.mjs` (or `npm test`) covers the merge rules, the
refusals and the shipped bank. It is the only automated test in this repo,
because the resolver decides what a spec MEANS before any gate reads it or
any line is billed, and the standing regression gate is a full `.parity`
render — too expensive to run against every edge of a merge rule.
