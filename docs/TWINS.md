# Twins — the files that exist twice

reelkit was **forked** from `tally/tools/store-shots` on 2026-08-14, not
extracted from it. Tally keeps its copy and keeps working; this repo is the
multi-project one. So most of the engine exists in two places, and a fix in one
does not reach the other.

That was Martin's call and it is the right trade for a pipeline that produces
the whole account's output. This file is the mitigation, and it is deliberately
a **list, not a tool**: nothing syncs, nothing merges, nobody is told what to
do. It exists so that a session fixing a bug in either repo knows the other one
has the same bug.

**Before you fix anything in `src/` or `scripts/`, check whether it is below.**

## Identical, or near enough that a patch applies

Every animated element, the ASCII pipeline, the sound engine, the gates, the
renderers. As of the fork these are byte-identical except where noted.

```
src/Reel.tsx              src/lab/*.tsx            scripts/render-reel.mjs
src/ReelElements.tsx      src/lab/reveal.ts        scripts/render-slides.mjs
src/Slides.tsx            src/lab/reveals.tsx      scripts/render-cover.mjs
src/Cover.tsx             src/lab/tier-fit.mjs     scripts/reel-gates.mjs
src/Flags.tsx             src/cover-fit.mjs        scripts/gates.mjs
src/AsciiClip.tsx                                  scripts/sfx.mjs
                                                   scripts/sfx-elements.mjs
                                                   scripts/sfx-audit.mjs
                                                   scripts/img2ascii.mjs
                                                   scripts/ascii-clip.mjs
                                                   scripts/ascii-score.mjs
                                                   scripts/brand-guard.mjs
                                                   scripts/clips-make.mjs
                                                   scripts/mockup-alpha.mjs
                                                   scripts/stage.mjs
```

### One of these is a bug Tally also has

`scripts/sfx-import.mjs` ran its whole CLI body at **import time**, and three
modules import it (`render-reel.mjs`, `sfx.mjs`, `sfx-audit.mjs`). With no
`posts/sfx/sourced.json` it calls `process.exit(1)` on the import, so
`reelkit reel` — or `npm run reel` — dies before reading a beat. Tally never
saw it because its register has existed for months; Papyr, scaffolded by
`reelkit init`, hit it on the first render. Fixed here by guarding the body
behind an entry-point check (phase 2, 2026-08-14). **The same latent bug is
still in `tally/tools/store-shots/scripts/sfx-import.mjs`** and will surface
there the day anyone deletes or renames that register.

## Divergent, and why

| file | how it differs here |
|---|---|
| `src/tokens.ts` | rewritten — reads the theme from `reelkit-theme` instead of holding Tally's hexes. Same export surface, so nothing downstream changed. |
| `src/ReelElements.tsx` | 3 lines: `LAB_REGISTRY` is now core's bank merged with the project's, and the wordmark comes from config. |
| `src/Slides.tsx` | 2 lines: the wordmark comes from config. |
| `src/Root.tsx` | the App Store surfaces are gone (below). |
| `scripts/stage.mjs` | paths come from `project.mjs`; the screenshot capture directory is config, not `../../fastlane`. |
| `scripts/reel-gates.mjs` | six constants read from `config.gates`. The arithmetic is untouched. |
| `scripts/render-*.mjs` | `bundle()` → `bundleProject()`, one line each. |
| `scripts/render-cover.mjs` | `--posted` refuses instead of asking a ledger this repo does not have. **Phase 2:** the proof sheet's five hexes were Tally's palette, hardcoded — now the project's. |
| `scripts/tier-legibility.mjs` | **Phase 2:** the legibility floor comes from `gates.tierFloorPt`. `src/lab/tier-fit.mjs` keeps the hardcoded 5.2 pt because it is bundled and cannot read a config. |
| `scripts/sfx-import.mjs` | **Phase 2:** the CLI body is behind an entry-point guard (above). |
| `scripts/build-demo.mjs` | **Phase 2:** the `thermal` demo's wordmark comes from `theme.brand.wordmark` instead of the literal `"Tally"`. |
| `scripts/tts.mjs`, `scripts/art-find.mjs`, `scripts/clips-find.mjs`, `scripts/art-batch.mjs` | **Phase 2:** error messages pointed at `tools/store-shots/.env` and at a VPS `ssh` line; the Openverse User-Agent said `tally-store-shots`. All now project-relative. No behaviour change. |

## Not here at all

| left in Tally | why |
|---|---|
| `scripts/nutrient-file.mjs`, `scripts/portions.mjs` | the CIQUAL generator and the portion table — Tally's data, not an engine. |
| `src/StoreShot.tsx`, `scripts/render-stills*.mjs`, `titles/`, `locales.json`, `shots.json` | the App Store screenshot compositor. Reusable across sixteen apps and worth having; a separate job from reels, deliberately deferred. |
| `src/AppPreview.tsx`, `src/TitleBlock.tsx` | an unfinished App Store preview-video placeholder, same family. |
| `scripts/ship.mjs`, `scripts/ledger.mjs`, `scripts/board-page.mjs` | the drop chain and the board. Attribura absorbs these — forking them would have built a second board on the day we decided to have one. |
| `src/lab/*-entry.tsx`, `scripts/lab/render-*.mjs` | twenty per-element harnesses, replaced by one `reelkit lab <element>` that also sees a project's own elements. |
| `DEMAND.md`, `FORMATS.md`, `SOCIAL.md`, `SPECIMENS.md`, `TIERLIST-SERIES.md`, `FOUNDER.md`, `ADS.md`, the dated audits | project doctrine. The half of it that is true everywhere lives in `docs/`; the half that is Tally's belongs to Tally and, in time, to its Attribura config. |

## The parity test

`serving-tier` rendered through both engines on 2026-08-14 produced **1722
identical frames and an identical decoded audio stream**. If you change
anything in the identical list above, that is the check worth repeating:
render the same post in both trees and compare, rather than trusting that it
built.

Tally's own stored artifacts are NOT a reference — several predate the
2026-08-11 pass and differ from what its current source produces. Render the
reference fresh, into a copy, and never into Tally's `out/`.

**Re-run 2026-08-14 after the phase-2 changes above** (`reelkit reel
serving-tier -- --long --loose`, cached voice, no TTS call): the decoded video
stream and the decoded audio stream are both **byte-identical** to the fork
reference. Parity holds.

**Re-run 2026-09-16, after the timeline work.** Same command, same fixture,
against reelkit's own 2026-09-08 artifact — copied aside first, because the
render overwrites it. Decoded video `0b59735b341cde092cfa3546131deb86` and
decoded audio `4f74d7dfaa2b0850770fe8fdf9361bde`, 1721 frames, 2693 audio
frames: **identical on both streams.**

What that covers, because it is a long list and the point of the gate is that
none of it showed: `msToFrames` and `layShots` moved into
`src/lab/timeline.mjs`; `shotProps` swapped onto the resolver
(`layoutOfBeat`); the cross-check that lays every reel out twice and throws on
a frame of disagreement; the motion channel with per-property clocks, `lead`
and anchors; the footage box drawn against the canvas instead of the type
column; and the motion cascade from reel to beat to shot. A post that asks for
none of it renders the same pixels and the same samples.

Two things worth keeping from the run. The cross-check fired on a real
production post for the first time and stayed silent, which is worth more than
it staying silent on a probe written for it. (Worth less than it looked: by
then both sides ran the same code, so silence proved nothing, and the check
left the render path later that day for `scripts/presets.test.mjs`.) And the hashes are of the DECODED
streams, not the files — a container's metadata can differ while the picture
does not, and comparing files would have produced a false alarm.
