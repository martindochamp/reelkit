# reelkit — architecture

The video/slideshow engine extracted from `tally/tools/store-shots`, made
multi-project, with Attribura as the board.

Written 2026-08-14, from five decisions (Martin):

1. The engine is **store-shots**. `attribura/content` is not the base.
2. It lives in its **own repo**, pulled by each project, so a discovery made
   on one project reaches the others.
3. The core carries **what is possible**; each project owns a folder the core
   **never overwrites**, where its Claude adds elements and themes. Tally's
   receipt look belongs to Tally.
4. **Attribura absorbs the board.** `tally-board` is retired.
5. **Tally is not touched.** `tools/store-shots` keeps working exactly as it
   does, nothing is deleted from it, and it does **not** become a consumer of
   reelkit. The other projects — Papyr first — are the consumers. The single
   exception is the board (decision 4).

### What decision 5 costs, written down once

reelkit is a **fork**, not an extraction. Two copies of the engine exist from
day one, and a fix in one does not reach the other. That is the accepted
price of not disturbing a live pipeline that produces the account's whole
output. Two things keep it honest:

- `docs/TWINS.md` in reelkit lists every file that has a twin in
  `tally/tools/store-shots`, so a session fixing a bug in either knows the
  other exists. It is a list, not a sync tool — nothing is automated.
- Tally may become a consumer later, once reelkit has proven itself on a
  second project. That is a decision to take with evidence, not now.

---

## 1. Why an extraction is cheap

Measured on 2026-08-14 across the 24 000 lines of `tools/store-shots`: the
string `tally` appears in **five files that matter** — `nutrient-file.mjs`
(12, the CIQUAL generator, which does not move), `ship.mjs` (5, the VPS host),
`board-page.mjs` (3), `tokens.ts` (2, the palette), `Slides.tsx` (2).

`ReelElements.tsx` (1 453 lines), all of `src/lab/` (28 elements),
`render-reel.mjs`, `sfx-elements.mjs`, `tts.mjs`, `reel-gates.mjs` carry **no
brand coupling at all**. The generic engine already exists; nobody separated
it. The extraction is plumbing, not a rewrite.

## 2. The two halves

```
reelkit/                      the repo — updated, pulled, never edited per project
  src/                        engine + generic elements
  scripts/                    render, gates, tts, sfx, ship, board
  skills/                     the Claude skills, shipped with the engine
  docs/                       the doctrine that is true everywhere
  package.json                remotion, sharp, the whole dependency wall

<project>/content/            in the project's own repo — never overwritten
  reel.config.ts              theme, voice, gate constants, paths
  elements/                   this project's own animated elements
  posts/                      the specs
  art/ clips/ media/ sfx/     the assets and their LICENSES.md
  package.json                { "dependencies": { "reelkit": "github:…" } }
```

Two repos rather than one monorepo with `projects/` inside it, for one
reason: **`npm update reelkit` can never touch a file the project owns**, and
a project's assets never land in the engine's git history. The "sub-folder
that does not get overwritten" is a different repo, which is the only version
of that promise a merge cannot break.

`npx reelkit <command>` is run from `<project>/content/`. The engine resolves
`reel.config.ts` upward from cwd, exactly as a bundler finds its config.

### What the config holds, and what it does not

**Rule: what a *render* needs is a file. What a *decision* needs is
Attribura.**

`reel.config.ts` (local, versioned with the project, works offline):

```ts
export default {
  theme:    { paper, ink, faded, trace, mono, hairline },   // palettes light/dark
  stage:    { width, height, fps, safeArea, captionBand },
  voice:    { backend: "runpod" | "lambda", sample: "tiktok-male", defaults },
  gates:    { seconds: [30, 40], prose: 12, line: 7, kicker: 5, tierFloorPt: 5.2 },
  endcard:  { asset: "appstore-row.png", storeUrl },
  elements: "./elements",                                   // the extension folder
  attribura:{ project: "tally" },                           // which org on the board
}
```

Attribura (queried through the MCP, shared across sessions and devices):
brand voice, the avoid-list, personas, the money event, the format bank, the
mechanic bank and its burnt shapes, the spent-keyword registry, the idea
bank, the demand bank, posted marks and every number.

## 3. The extension folder — the part that makes it generalisable

A project's Claude adds an element by writing three files under
`content/elements/<name>/`:

| file | what it is |
|---|---|
| `<Name>.tsx` | the component — `useCurrentFrame()`, cue props, never a CSS transition |
| `entry.tsx` | the lab demo entry, so `npx reelkit lab <name>` renders it alone |
| `sfx.mjs` | the emitter: `(props, cues, fps) → hits`, the sound coming out of the data |

The engine discovers them at bundle time; nothing is registered by hand in
core. A skill (`new-element`) scaffolds the three files with the conventions
already in place, because the non-obvious contracts — the cue count rule, the
`MIN_GAP` thinning, `progressFrames` for ticks, the mirrored constants
problem between `.tsx` and `.mjs` — are exactly what a fresh session gets
wrong.

**On the aesthetic.** The palette, the type and the hairline weight are
config, so a project changes its colours in a line. The *idiom* — things
print, hairlines, no gradients, ASCII specimens — is the core's character,
and a project that wants a different idiom writes its own elements in
`elements/`. That is honest about the work: making 28 elements idiom-agnostic
is a rewrite; making them palette-driven is an afternoon.

## 4. What is doctrine, and where each piece goes

`REELS.md` is 1 310 lines and about half of it is universal. The split:

| stays in core `docs/` | moves to Attribura, per project |
|---|---|
| the beat/cue contract, `[+]` semantics | the length ceiling (30–40 s is Tally's) |
| the caption modes and why no fades | the register and the kill-list |
| the words-per-second fit, the two-parameter model | the format bank: allowed / refused |
| the sound kit and the emitter rules | the mechanic bank and the burnt shapes |
| loudness, room tone, the levels contract | the demand bank |
| the ten recurring traps (writer defects) | the spent-keyword registry |
| the gates and what each one protects | the honesty rules that are domain-specific |

The `reel-script-critic` agent splits the same way: the universal ear
(passive voice, AI mannerisms, one idea per sentence, name the subject inside
two beats, a number with no noun) ships with core; the kill-list, the burnt
shapes and the spine come from the project's config at run time.

## 5. Attribura absorbs the board

The tables already exist. The mapping:

| tally-board | Attribura |
|---|---|
| `posts/<name>.json` exists → DRAFT | `creatives` row, `status='draft'` |
| RENDERED → SHIPPED | `push_creative` / `push_slideshow`, `status='ready'` |
| POSTED (platform, date) | `distributions` (channel, `source='manual'`) |
| stats typed by hand | `content_reach`, **imported** from IG/YT |
| `brief` (topic, mechanic, demand, turn) | `creatives.meta` jsonb — already free-form |
| the idea bank | a `content_ideas` table (new) |
| the keyword registry | `dm_rules.keyword`, unique per org |
| drop page + QR | `/library` on the phone |

`posts/ledger.json`, the standalone SQLite board service, the phone board page
and the drop pages all retire. The one capability worth keeping
from the drop chain is the **QR handoff** (Mac renders, phone publishes) —
it becomes a QR on the `/library` detail view.

### The loop the board could never close

Tally reserves a keyword per post (`Comment "HEME" for the link`) and calls
it "the only attribution the account has" — then a human reads the comments.
Attribura has `dm_rules`: keyword → automatic DM → tracked link → click →
install → revenue.

Same chain, cut in the middle. So the keyword stops being a `grep` over
`posts/*.json` and becomes an API call:

```
reserve_keyword(project, "HEME", creative_id)
  → 409 if spent
  → else: creates the dm_rule on the connected IG account,
          returns the tracked link to put in the DM body,
          and the word the endcard must print
```

The endcard prints what the API returned, the caption repeats it, the DM
answers it, and the click carries the `creative_id`. **That is the first
complete content → revenue loop in Attribura**, and Tally is the dogfood.

### Closing creative → distribution

An IG/YT post arrives through the connector with its caption and timestamp.
The creative we pushed carries the caption we wrote. Match on caption prefix
plus a posting-window, propose the link, let a human confirm the ambiguous
ones. Until that runs, `mark_posted` writes the link by hand — the same tap
the board page does today, in a different place.

## 6. The MCP surface

Extend the existing server (19 tools). New:

| tool | why |
|---|---|
| `get_content_config` | brand + personas + banks + burnt shapes + spent keywords, one call |
| `check_shape` | "this mechanic has run 12 of 16 times" — the fatigue gate, server-side |
| `reserve_keyword` | atomic: reserve + dm_rule + tracked link |
| `mark_posted` | a distribution row per platform |
| `link_creative` | close creative ↔ distribution |
| `list_ideas` / `claim_idea` | the idea bank, claimed before drafting |

`push_creative`, `push_slideshow`, `get_context`, `get_performance`,
`list_distributions` already exist and are reused unchanged.

## 7. What is dropped from `attribura/content`, and what should be salvaged

Dropped: the templates, the themes, the loop, the `create-content` skill.

Worth porting into core **when a project needs it**, not before:

- **whisper.cpp word-level captions.** store-shots derives caption timing from
  the TTS's own per-sentence timings, so it has **no caption path for a real
  recorded voice**. The day you film yourself, this is the missing piece.
- **facecam / montage / multicam.** Same gap: store-shots cannot cut real
  footage. It has `media` (one excerpt per reel, deliberately) and
  `recording` (the app, driven by idb), and nothing else.
- **`clip-fetch` (yt-dlp) and `meme-fetch` (imgflip).**

Also unify the TTS: store-shots calls the RunPod Chatterbox endpoint,
`content/` calls a Chatterbox Lambda. Core takes a **backend adapter**, the
config picks one.

## 8. Order of work

**Phase 1 — reelkit exists, and is faithful. DONE 2026-08-14.** Copy the engine into the new
repo, leave Tally alone, lift the Tally specifics out of the copy (the CIQUAL
generator, the portion table, the receipt palette, the App Store screenshot
compositor all stay behind), introduce `reel.config.ts` and the `elements/`
resolution. *Acceptance test: render a Tally post through reelkit with a
receipt-shaped config and **diff the frames** against Tally's own render of
the same post. Not "it builds" — the same pixels.* The parity fixture is
local and gitignored; it carries licensed assets.

> Result: `serving-tier` rendered through both engines produced **1722
> identical frames and an identical decoded audio stream**. The reference was
> rendered fresh into a copy — Tally's stored artifacts predate the 2026-08-11
> pass and are not a reference — and Tally's own tree was never written to.

**Phase 2 — Papyr is the first consumer.** `papyr/content/` with its own
config, its own theme, its own elements if it needs any, and one real reel
rendered end to end. **Every place core has to change is a discovery and
belongs to core.** With Tally out of the consumer list this phase is no
longer a victory lap — it is the only evidence that any of this generalised.

**Phase 3 — the board moves.** Import `GET /export` from tally-board into
Attribura (creatives, distributions, stats, ideas). Add the MCP tools.
Repoint Tally's `ledger.mjs` / `board-page.mjs` / `recordShip` at the
Attribura API — **the one edit decision 5 allows.** Retire the SQLite
service only once both sides report the same numbers.

**Phase 4 — the keyword loop.** `reserve_keyword` → dm_rule → tracked link →
endcard. Then creative ↔ distribution matching.

Phases 1–2 and phase 3 are independent: the board absorption touches
Attribura and Tally, and never touches reelkit.

**Phase 5, candidate.** The App Store screenshot compositor (`StoreShot.tsx`,
`render-stills*.mjs`, `titles/`, `locales.json` — 39 store locales, RTL
handled) is genuinely reusable across sixteen apps and is deliberately left
out of phase 1 to keep the surface small. It is a separate job from reels and
should be judged on its own.

## 9. Open, on purpose

- **The repo name.** `reelkit` is a placeholder.
- **Posts: files or Attribura?** They stay files in phase 1 (the render needs
  them, and a spec belongs in a diff). Whether a spec should eventually live
  on the board is a real question, not answered here.
- **Does the demand bank generalise?** `DEMAND.md` is 943 lines of researched
  nutrition queries. The *method* (autocomplete sweep + verification + a
  verdict on whether our own data can settle it) generalises; the file does
  not. Whether the sweep becomes a script in core is unsettled.
