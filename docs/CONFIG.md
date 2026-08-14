# reel.config.mjs — the whole surface

What a project may decide. Anything not on this list is the instrument's, and
a project that wants it different is asking for a different element rather
than a setting.

The dividing rule, and it is worth stating because it decides where every
future field goes:

> **What a render needs is a file. What a decision needs is Attribura.**

The palette, the voice sample and the gate constants are here because a render
cannot happen without them and must work with the network down. The brand
voice, the personas, the format bank, the burnt shapes, the spent keywords and
every number live on the board, because they are shared across sessions and
devices and they are what a *writer* consults, not what a renderer reads.

```js
export default {
  attribura: { project: null },

  theme: {
    brand: { wordmark: null },
    palettes: {
      light: { paper, ink, faded, trace },
      dark:  { paper, ink, faded, trace },
    },
    mono: "…",
    hairline: 3,
  },

  voice: {
    backend: "runpod",
    sample: null,
    language: "en",
    exaggeration: 0.5,
    cfg_weight: 0.5,
    temperature: 0.8,
  },

  gates: {
    seconds: { target: 35, ceiling: 40 },
    prose: 12,
    line: 7,
    kicker: 5,
    tableLabel: 34,
    tierFloorPt: 5.2,
    blank: 1.2,
  },

  endcard: { asset: null, storeUrl: null },

  captures: "captures",
};
```

## theme

| field | |
|---|---|
| `brand.wordmark` | The word the wordmark elements draw. **Unset it prints a visible defect**, not nothing — a placeholder that renders cleanly is how a post ships with the generator's leftovers on it. |
| `palettes.{light,dark}` | The four inks, both modes, all four required. The names are semantic: `paper` is whatever the page is, `ink` is whatever the type is. A dark-first project swaps the values, never the names. A missing ink is refused at bundle time, because CSS reads `undefined` as "inherit" and the frame comes out subtly wrong rather than loudly broken. |
| `mono` | A CSS font stack. Numbers live in it, so it must be monospaced. Referenced by name, never bundled. |
| `hairline` | Rule weight in canvas pixels. Every rule in the system derives from this one number. |

Pull the colours from the real product — the app, the site, the logo. A palette
invented for the videos is a second brand, and the account then argues with the
thing it is advertising.

## voice

`backend` picks the Chatterbox endpoint. `sample` is the reference voice cloned
per line — the filename in the worker image minus `-sample.wav`. The four
generation parameters are the defaults every beat inherits; a post overrides
them per beat in its own `voice` block.

## gates

Constants the audits enforce. All of them refuse **before the first TTS call**,
because all of these failures are only visible after the render is paid for.

| field | what it protects |
|---|---|
| `seconds.target` | what a script is written to |
| `seconds.ceiling` | what refuses. Two numbers, not one: the length estimate carries a ±3 s residual, so a script aimed at the ceiling ships past it |
| `prose` | words of prose allowed on one screen — the budget for everything that is a sentence rather than a reading |
| `line` | a caption under a specimen, not a second argument |
| `kicker` | a kicker is a label |
| `tableLabel` | characters in a table's left label; past that it is a claim, not a row |
| `tierFloorPt` | the legibility floor for a tier list, in points on a 393-pt handset |
| `blank` | seconds of blank paper a beat may open on before it is a defect |

**Widening `seconds` is a decision, not a setting.** Tally's band moved to
30–40 s after measuring that 40 of its 41 reels ran past 40 seconds with a
median of 60 — everything past the ceiling is spent on an audience that already
left. A project with a different format may genuinely need a different number;
say why in the commit, because the next session will read the number and assume
it was measured.

## endcard

`asset` is a PNG in `posts/mockups/` with a real alpha channel — generate it
with `reelkit mockup:alpha`, which flood-fills a UI capture's flat background
rather than running a segmentation model over it. `storeUrl` is where the post
sends people.

## captures

Where `shot` slides read their raw screen captures from, relative to the
project. An iOS app points this at its fastlane output; anything else points it
wherever its screenshots land.

## attribura

`project` names the org on the board this work belongs to. Unused until the
board client lands (phase 3); it is here now so the field does not have to be
retrofitted into every project's config later.
