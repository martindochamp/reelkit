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
    fonts: { display: null, body: null, caption: null },
    captions: {
      fontSize: 48, fontWeight: 400, letterSpacing: "0.08em",
      textTransform: "uppercase", plate: true,
      maxWords: 3, maxChars: 20,
      dim: null, bandTop: 1180,
      emphasisColor: null,
      emphasis: null,
    },
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
| `brand.wordmark` | The word the wordmark elements draw. **Unset it prints a visible defect**, not nothing — a placeholder that renders cleanly is how a post ships with the generator's leftovers on it. Written as the product writes it; the elements uppercase it themselves. |
| `palettes.{light,dark}` | The four inks, both modes, all four required. The names are semantic: `paper` is whatever the page is, `ink` is whatever the type is. A dark-first project swaps the values, never the names. A missing ink is refused at bundle time, because CSS reads `undefined` as "inherit" and the frame comes out subtly wrong rather than loudly broken. |
| `mono` | A CSS font stack. Numbers live in it, so it must be monospaced. Referenced by name, never bundled. |
| `fonts.{display,body,caption}` | The three faces — headlines and numerals, running text, the spoken band. Each falls back to `mono`, so a project that sets none renders exactly as it did before they existed. One face cannot carry a display line and a caption at once, which is why a project could change its colours and still look like the one it was forked from. |
| `captions` | How the spoken band is set. See below. |
| `hairline` | Rule weight in canvas pixels. Every rule in the system derives from this one number. |

### theme.captions — the skin's loudest single decision

| field | |
|---|---|
| `fontSize` / `fontWeight` / `letterSpacing` / `textTransform` | The band's type. The defaults are the receipt look: 48 px, tracked, uppercase. |
| `plate` | Draw the band's own ground, or let the words sit on the page alone. Plateless words carry their own separation — the page's colour spread behind them over a flat page, a dark shadow over pictures — and they take the page's own ink, never a literal white. Hardcoding white here once made every caption on a paper beat invisible. |
| `maxWords` / `maxChars` | How much of the sentence stands at once. `1` is the one-word-at-a-time reference; `8`/`44` is the long accreting line. |
| `dim` | Brightness of a word not yet spoken, 0–1. Unset, an unspoken word is invisible but holds its space and the sentence assembles itself. Set (0.42 measured) and the whole line stands from the first frame, dimmed, each word lighting up on its cue — which lets the viewer read ahead. |
| `bandTop` | Where the band sits, in canvas pixels. 1180 of 1920 clears a presenter card and the platform's own bottom chrome; a reel with no card puts its captions much higher (46 % measured). |
| `emphasisColor` | The colour of a word marked `*like this*`. Covers one level and nothing else. |
| `emphasis` | What each level of emphasis LOOKS like, indexed by asterisk count: `[{color, scale, outline}, …]`. `*word*` takes the first entry, `**word**` the second; a level past the end clamps to the last. `scale` is a real font size, so the line box grows around the word instead of the glyph riding over its neighbours; `outline` is a stroke width in pixels with a transparent fill. Unset, every marked word gets `emphasisColor`, which is what every project had before this list existed. |

Pull the colours from the real product — the app, the site, the logo. A palette
invented for the videos is a second brand, and the account then argues with the
thing it is advertising.

**Four inks and no accent.** This is the honest limit of the theme channel, and
it bit on the first project outside the one the engine was written in: Papyr's
brand is a *tint* — Emerald-Teal, locked in its own design-system file and
carried on every surface it ships — and there is nowhere here to put it, so its
reels are Papyr's shape in nobody's colour. A fifth ink is not the fix. The
twenty core elements each decide their own ink per part, so an accent that
nothing reads is worse than none; making the bank accent-aware is a pass over
every element, and it should be judged as that job, not smuggled in as a
setting.

A dark-first product is already handled and needs no special case: fill both
palettes and set `"theme": "dark"` on the post. `light` is still required —
`bg: "ink"` inverts against the *other* palette, so an absent one makes the
turn beat a no-op rather than an error.

## voice

> **NOT WIRED — as of 2026-08-14 nothing reads this block.** `scripts/tts.mjs`
> has its own `DEFAULT_VOICE` and `render-reel.mjs` passes only the POST's
> `reel.voice` over it, so a project that names a cloned `sample` here ships in
> the endpoint's default voice and is told nothing. `backend: "lambda"` is
> likewise documented and unimplemented; there is one path and it is RunPod.
> Found on Papyr. It is not a one-line fix: `tts.mjs` keys its audio cache on
> the voice object, so merging this block re-keys every cached line in every
> project and a cache miss is a paid call per sentence. It needs a cache
> migration, which is a decision rather than a patch. Until then, set the voice
> per post in the spec's `reel.voice`.

`backend` picks the Chatterbox endpoint. `sample` is the reference voice cloned
per line — the filename in the worker image minus `-sample.wav`. The four
generation parameters are the defaults every beat inherits; a post overrides
them per beat in its own `voice` block.

## gates

Constants the audits enforce. All of them refuse **before the first TTS call**,
because all of these failures are only visible after the render is paid for.

> **Every default in this block is one account's measurement.** 30/40 s, 12
> words of prose, 7 on a line, 5 in a kicker, 34 characters in a row label,
> 5.2 pt on a tier chip — all of them were measured on Tally's 41 reels, and
> `scripts/project.mjs` ships them as the engine's defaults. So a project that
> writes nothing inherits somebody else's numbers **silently**, which reads as
> "the engine says 40 seconds" rather than "Tally measured 40 seconds". Until
> the per-project half of this moves to Attribura: if you keep a number, say in
> the config that you kept it and that it is not yours; if you change one, say
> what you measured.

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
