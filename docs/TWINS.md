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
src/AsciiClip.tsx                                  scripts/tts.mjs
                                                   scripts/sfx.mjs
                                                   scripts/sfx-elements.mjs
                                                   scripts/sfx-import.mjs
                                                   scripts/sfx-audit.mjs
                                                   scripts/img2ascii.mjs
                                                   scripts/ascii-clip.mjs
                                                   scripts/ascii-score.mjs
                                                   scripts/art-find.mjs
                                                   scripts/art-batch.mjs
                                                   scripts/brand-guard.mjs
                                                   scripts/clips-find.mjs
                                                   scripts/clips-make.mjs
                                                   scripts/mockup-alpha.mjs
                                                   scripts/build-demo.mjs
                                                   scripts/stage.mjs
                                                   scripts/tier-legibility.mjs
```

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
| `scripts/render-cover.mjs` | `--posted` refuses instead of asking a ledger this repo does not have. |

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
