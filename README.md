# reelkit

The engine that turns a written script into a reel: the narration is the spine,
the screen is a stage, and each part of an element prints at the exact word the
voice reaches it. Plus the slideshow renderer, the ASCII pipeline, the sound
design that comes out of the data, and the gates that refuse a bad script
before the voice is billed.

Forked from `tally/tools/store-shots` on 2026-08-14 and made multi-project.
Tally keeps its own copy — see [docs/TWINS.md](docs/TWINS.md).

## The two halves

The engine is a dependency. Everything a project decides lives in the project's
own repository, where an update to reelkit cannot touch it.

```
reelkit/                     this repo — pulled, updated, never edited per project
  src/                       the renderer and the core element bank
  scripts/                   render, gates, tts, sfx, ascii, art
  docs/                      the doctrine that is true everywhere

<project>/content/           the project's repo — reelkit never writes here
  reel.config.mjs            theme, voice, gate constants
  elements/                  this project's own animated elements
  posts/                     the specs, and the asset registers
  out/                       renders (gitignored)
```

Two repositories rather than one, deliberately: "the folder core never
overwrites" is a promise a merge can break, and a separate repository is the
only version of it that cannot.

## Start a project

```sh
mkdir -p myapp/content && cd myapp/content
npm init -y && npm i github:martindochamp/reelkit
npx reelkit init
```

Then, in order:

1. `reel.config.mjs` — the palette and the wordmark. Pull them from the real
   product; a palette invented for the videos is a second brand.
2. `npx reelkit elements` — what the bank already draws.
3. `posts/<name>.json` — the first spec. Grammar: [docs/REELS.md](docs/REELS.md).
4. `npx reelkit gates <name>` — the audits, before any voice is billed.
5. `npx reelkit reel <name>`.

## Commands

```
reelkit init                    scaffold a project here
reelkit elements                the merged bank, core + project
reelkit reel <post>             render the reel
reelkit slides <post>           render the slideshow
reelkit cover <post>            render the grid cover
reelkit lab <element>           preview one element, alone, in your ink
reelkit gates [word]            the keyword registry
reelkit sfx                     synthesize the sound kit, print its levels
reelkit ascii <image>           judge an ASCII conversion before promoting it
reelkit art:find "<query>"      sweep for a specimen
reelkit clips:make "<still>"    animate a still you already license
```

Every command resolves the project by walking up from the working directory to
`reel.config.mjs`. The engine holds no state.

## Adding an element

The extension folder. One directory per element under `<project>/elements/`,
the folder name being the element's name in a post spec:

```
elements/myelement/
  index.tsx     exports `component` and `mapCues`
  sfx.mjs       exports the emitter: (props, cues, fps) → hits
```

`mapCues` maps the beat's `[+]` markers onto the element's own cue props — it
is what makes a row print on the word that names it. The emitter is what makes
the element sound its own motion, out of its own data, rather than firing one
generic click per marker.

Read [docs/ELEMENTS.md](docs/ELEMENTS.md) before writing one: the contracts
that get missed are the cue count rule, the density cap, and the fact that a
`.mjs` emitter cannot import the `.tsx` component's timing constants and so
mirrors them.

## What is not here

- **Publishing.** The board — what is drafted, posted, what the numbers say —
  is Attribura's. This repo renders and stops.
- **The App Store screenshot compositor.** Still in Tally; reusable, and a
  separate job.
- **Real-footage editing.** There is `media` (one excerpt per reel, on purpose)
  and `recording` (a driven simulator capture). No facecam, no montage, and no
  caption path for a voice the TTS did not speak.
