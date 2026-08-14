# Writing an element

The extension folder — the part of a project reelkit never overwrites, because
it lives in the project's own repository.

```
<project>/elements/<name>/
  index.tsx     the component, and how the beat's cues map onto it
  sfx.mjs       the emitter: what the element SOUNDS, out of its own data
```

The folder name is the element's name in a post spec. Rename the folder and you
rename the element; there is no second place to keep in step.

```json
{ "type": "lab", "element": "<name>", "props": { … } }
```

`reelkit elements` prints the merged bank and marks which side each name came
from. A project name shadows a core name deliberately — a project that writes
its own `tierlist` has decided the core one is wrong for it, and silently
ignoring that would be the worse surprise.

## index.tsx

Two exports.

```tsx
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { mono, palettes, wordmark } from "reelkit/tokens";

export const component: React.FC<Props> = ({ theme = "dark", rows = [], rowCues = [] }) => {
  const frame = useCurrentFrame();
  const palette = palettes[theme];
  …
};

/** One `[+]` per row — the bar starts filling on the word that names it. */
export const mapCues = (cues: number[], props: any) =>
  cues.length ? { rowCues: cues } : {};
```

**`component`** owns its full frame (`AbsoluteFill`) and takes `theme`. It
draws with `palettes[theme]` and `mono` from `reelkit/tokens` — never with a
literal colour, because the whole point of the theme channel is that the same
element renders in every project's ink.

**`mapCues`** turns the beat's `[+]` markers into the element's own cue props.
This is the thing that makes the system what it is: a part prints at the exact
word the voice reaches it, and the writer marks the word rather than counting
frames.

### The cue contract, which is where authors get caught

- **Cue every part or none.** A partial cueing prints out of order, and the
  renderer refuses it rather than shipping the wrong order. If your element has
  N parts, `mapCues` either takes N frames or ignores what it got.
- **Positional cues need a length check.** Feeding a short list into positional
  props leaves later parts with an undefined frame — `NaN` — and the render
  dies mid-way. Core's `pie` shows the pattern: take the list only when there
  is one marker per slice, otherwise treat the single marker as "start".
- **The first cue usually gates the WHOLE screen**, not the first row. On an
  element that has no frame of its own, a marker placed after the first
  sentence plays the beat over blank paper until the voice reaches it. Measured
  once at 9 of 35 seconds on an empty sheet. `reelkit reel` prints `BLANK` for
  a beat that opens on more than `gates.blank` seconds of nothing.

### Authoring size

Core elements are authored against a **210→1360 band across the full 1080-px
width**, and the reel scales that into its stage. So the size you author is not
the size the phone shows — the current factor is ×0.713. Anything you can
barely read in the lab is illegible in a reel.

The floor that matters is **5.2 pt on a 393-pt handset**. Judge an element on
the reel, never on a still: whatever reads in a reel reads in a carousel, and
the reverse is not true.

## sfx.mjs

One function, `(props, cues, fps) → hits`. Optional: an element with no
`sfx.mjs` is silent, which is a legitimate choice.

```js
export default (props, cues, fps) =>
  (props.rows ?? []).map((row, i) => ({
    frame: cues[i] ?? i * 20,
    sound: "ratchet",
    volume: 0.16,
    rate: 1 + (row.value / 100) * 0.4,
  }));
```

**The sound comes out of the data, not out of the cue.** A cue is a word the
writer marked; an emitter reads the element's real animation timeline. That
distinction is the whole reason this file exists rather than a type→sound map:
under the old map, eleven of fourteen effects on the demo sheet were the same
`print`, because a marker is not a thing the element did.

Four rules keep it from becoming noise, and they are the same four core's
emitters obey:

- **Density is capped.** A hundred units over thirty frames is a rattle, not a
  hundred events. Thin to about 3.2 frames between hits, keeping the first and
  the last — and thin **greedily on frames**, not by sampling one index in
  three, which leaves the crowded end of an eased curve crowded.
- **Below about 8 frames, a run is one gesture.** Fourteen prints in four
  frames is a single `slide`, not fourteen pops. Two sounds describing what the
  eye saw as one fill is worse than one honest sound.
- **Rate carries the shape, not extra samples.** An accelerating ratchet is ONE
  click at a rising `playbackRate`. Twenty samples would be twenty files to
  license, store and keep in step.
- **Ticks go at equal PROGRESS, through the ease's inverse.** Feeding the tick
  index straight into the easing looks right and is backwards: it shipped once
  as an odometer with its last three teeth on a single frame.

The kit is a short list of real objects — `type` `type2` `ratchet` `detent`
`nib` `plotter` `slide` `shutter` `flip` `stamp` `print` `cut` `latch`
`popsoft` `unpop` `tear` `click`. **Every voice names an object, not a
moment**: reach for the one your element physically is, and if none of them is
it, the element is probably silent.

### The mirrored constants, and the one bug they cause

A `.mjs` emitter cannot import its `.tsx` component's timing constants. So an
emitter that places a hit on a bar's fill has to repeat the fill's duration,
its stagger and its easing — and when the component changes and the emitter
does not, the symptom is **a sound landing beside its animation instead of on
it**.

There is no way around it today. What there is:

```
reelkit sfx:audit
```

It prints hits, span and tightest gap per element, and names three failures —
an emitter returning nothing, two hits inside one gesture, and a hit landing
past its beat, which also means the animation is being cut off. It found eight
on its first run in Tally, three of them real bugs. Run it after touching
either half.

## Previewing

```
reelkit lab <name> --props props.json --frames 240
reelkit lab <name> --theme light
```

Renders the element alone, in the project's own ink, through the same
`ElementFrame` composition the slideshow uses for a settled still. It reads the
merged bank, so it sees your element and core's alike, and it says which one
answered.

## Before you write one at all

Check `reelkit elements` first. Twenty elements already exist, and four of them
(`sparkline`, `thermal`, `dissolve`, `pie`) had never appeared in a single one
of Tally's 41 reels — the bank was under-used long before it was insufficient.
A new element is right when the argument genuinely has a shape none of them
draw; it is wrong when what you actually needed was a `flow` instead of a
table.
