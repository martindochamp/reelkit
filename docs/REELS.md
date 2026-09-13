# Reels — written for the ear, printed for the eye

> **Read this first.** This file arrived whole from `tally/tools/store-shots`
> and has not been split yet. About half of it is the **instrument** — the beat
> and cue contract, the element table, the caption modes, the sound engine, the
> loudness contract, the words-per-second fit. That half is true in every
> project and belongs here.
>
> The other half is **Tally's doctrine**: the 30–40 s band, the nutrient spine,
> the burnt sentence shapes and their counts, the register, the honesty rules
> about portions and upper limits, the specimen sourcing bar. Those are one
> project's decisions, measured on one account, and they are wrong for the next
> project by default. They are being moved to per-project configuration served
> by Attribura; until that lands, read them as **an example of what a project
> must decide**, never as this engine's rules.
>
> Where a number in here is configurable, `reel.config.mjs` owns it —
> [CONFIG.md](CONFIG.md) is the list.

A reel is **not the slideshow with a voice-over**. It is its own script,
written from the brief (demand / turn / proof / ask — `SLIDES.md`), where
the narration is the spine and the screen is a stage: each beat cuts to one
element — a typographic title, a table, an ASCII figure — whose parts print
at the exact word the voice reaches them. The slideshow argues in swipes;
the reel argues in seconds.

## Workflow

```
# 1. Write the script — a `reel` block in the post spec
posts/<name>.json

# 2. Render
npm run reel <name>             # real voice, needs the RunPod keys
npm run reel <name> -- --mock   # macOS draft voice, no network — judge the cut

# 3. Post
out/reels/<name>.mp4 → AirDrop / ship to the phone, post as a video
```

The mock render writes `<name>.mock.mp4` and says so on the console — for
judging **layout**, never for shipping, and **never for judging timing**:
the macOS draft voice runs slower than Chatterbox (the same 100-word
script came back 34 s real, 42 s mock), so a mock file's duration is not
the reel's duration. The two voices do not share a cache.

Every flag, and what each one is for:

| flag | |
|---|---|
| `--mock` | draft voice, no network |
| `--captions page\|words\|fill` | audition a caption mode the post has not asked for |
| `--sfx` / `--no-sfx` | audition the sound kit / render the silent A/B |
| `--revoice [2,5]` | drop the cached take for every beat, or these ones |
| `--long` | ship a script past the 40-second ceiling, loudly |
| `--loose` | downgrade the prose gate to warnings — for re-rendering old posts |

Three gates run **before the first TTS call**, because all three failures
are only visible after the render is paid for: `BUDGET` (the script is too
long), `PROSE` (the screen carries words the voice already says) and
`SHAPE` (the reel is built like the last eleven). Each has its own section
below.

## The demo sheet — the whole bank, in order, with the sound on it

```
npm run demo:build        regenerate posts/_demo.json from the bank
npm run reel _demo        render it — no TTS, every beat is a silent hold
```

`out/reels/_demo.mp4` is every screen element the system has, one after
another, each held long enough to finish its own animation, with the
default sound map over the top and the room tone under it. **28 elements,
about 105 seconds.**

It answers a question the still contact sheets cannot. `out/lab/*.mp4`
shows one element at a time and `out/flags-dark.png` is a page of
drawings; "which instrument carries this beat" is a question about motion
and sound in sequence, and until now it could only be answered by reading
twenty prop types.

**The props are harvested, not invented.** Where an element has appeared
in a shipped reel, the demo copies that usage verbatim — a hand-written
example drifts from what the element really wants and this file would be
the last place anyone noticed. Only the elements that have never been used
carry props written in `scripts/build-demo.mjs`, and each says so in its
own `_from` field. So `_demo.json` doubles as **a minimal working example
of every element, as data**: copy a beat out of it into a real post.

One narrow exception, `EXERCISE` in the same file: a harvested usage that
happens to be the element's DEGENERATE case gets a shallow prop patch so
the sheet shows it under load. The bank's only `calendar` is a perfect
30/30 month, which prints a grid and stops — and the sound design makes
that literal, since a clean month is deliberately quiet. Every entry names
what it exposes and appears in the beat's `_from`; delete it the day a
real post uses the element properly.

Three mechanics it needed, all of them generally useful:

- **`cues` on a silent beat** — seconds into the hold, since there are no
  spoken words to hang a `[+]` on. Any beat that prints without narration
  can choreograph now.
- **Art inside a lab element's `props`** — any object carrying an `image`
  gets an `ascii` beside it, converted with its own tuning. This is what
  finally makes **`dissolve` reachable**: its props want two
  pre-converted specimens, nothing converted them, and that is most of
  why it sat unused in the registry from the day it was built.
- **`_name` is a probe** — the three writing gates are skipped on an
  underscore file (the same convention `gates.mjs` already reads as "can
  never ship"). They protect a published reel; on a reference sheet they
  only refuse to render the thing you built them to inspect.

**A voiceless probe is not normalized to -14 LUFS.** That target assumes a
narration to measure: with only effects and a bed in the file the pass
measured -49 and lifted everything 35 dB, so the sheet played its clicks
at the level a shipped reel plays a spoken word — exactly the judgement
the sheet exists to support, made wrong. It gets the fixed **+13 dB** a
real reel's voice track receives instead, so every effect sits where it
sits in a finished file.

`recording` is the one element missing from the sheet: it needs a take in
`posts/clips/` (gitignored, made by `tools/capture_demo.sh`). Left out
rather than faked — a reference that lies about one row is worse than one
with a hole in it.

## The script — beats

A `reel` block rides in the same post JSON as the slides (one topic, one
file, one brief), but the text is written fresh:

```json
"reel": {
  "voice": { "exaggeration": 0.5 },
  "beats": [
    {
      "say": "No package prints this column. [+]Meat gives you 25 to 30 percent. [+]Plants, 3 to 10.",
      "bg": "cocoa-powder.jpg",
      "screen": {
        "type": "table",
        "title": "Absorbed, not eaten",
        "rows": [
          { "left": "Red meat, fish — heme", "right": "25–30 %" },
          { "left": "Cocoa, lentils, spinach", "right": "3–10 %" }
        ]
      }
    }
  ]
}
```

- **One beat = one spoken line + one screen.** Beats cut hard — the cut
  is the transition, nothing slides or fades.
- **`bg` sets what fills the frame.** Nothing → the receipt paper.
  `"ink"` → solid ink, inverted type (the turn beat). A filename → a
  full-bleed photograph from `posts/art/`, with a slow push and a scrim;
  elements become **printed cards** and titles become ink-boxed lines.
  **The house look is glyphs, not photographs** (Martin, 2026-08-02):
  ASCII specimens, clips, grids and charts carry the visuals; reach for
  a photo bg only when a beat genuinely needs the real thing. Vary the
  paper/ink rhythm instead — six identical backgrounds is a slideshow
  again.
- **`[+]` marks a print cue.** Each marker fires when the word right after
  it is spoken, and prints the element's next part. Cue **every** part or
  **none** (none = the whole element is on the paper from the cut); a
  partial cueing would print out of order and the renderer refuses it.
- **`hold` is silent frames after the voice stops**, in seconds. On a
  beat with no `say` that is the whole beat (default 2 — 1.5 for an
  `endcard`, and the trimmed length of an unmuted `media` excerpt). On a
  beat that DOES speak it is added after the line lands, so a shot can
  sit on its last word. The references spend most of each card's screen
  time exactly there: a faithful reproduction of a 7.0 s reference ran
  14.8 s, 2.1× over, because every silent hold it uses was unexpressible.
  A hold costs the budget the same as spoken seconds, and the audit
  counts it.
- **The voice never stops.** Beat length is derived: the line starts on
  the cut and the beat ends 0.2 s after its last syllable (plus any
  `hold`), so beats read as one continuous stream. A second of unasked
  silence between beats is where viewers leave — only widen the tail for
  a beat that genuinely needs the air, and say why.

### `shots` — several pictures under one spoken line

One beat = one spoken line. It does **not** have to be one picture. A
beat with `shots` instead of `screen` cuts its stage on its own schedule
while the line, the caption band and the camera run underneath, unbroken:

```json
{
  "say": "Do not assume. Try it first, then write it off.",
  "shots": [
    { "screen": { "type": "media", "file": "bar.mp4", "fit": "bleed" }, "seconds": 1.2 },
    { "screen": { "type": "blank" }, "bg": "street.jpg",
      "border": { "color": "#FFFFFF", "width": 8, "inset": 70, "radius": 0 } },
    { "screen": { "type": "stat", "value": "3" }, "border": null, "weight": 2 }
  ]
}
```

- A shot takes `seconds` for an exact length, or `weight` for a share of
  whatever the voice leaves (default 1 — three plain shots are thirds).
  The shots **tile the beat exactly**: the last weighted one absorbs the
  rounding. Asking for more seconds than the beat runs is refused, and so
  is a shot that would land under one frame.
- A shot carries its own `screen`, its own `bg` and its own `border`.
  The beat keeps `say`, `hold`, `sound` and `view` — the camera move is
  continuous across the cuts, which is the point of it.
- **`[+]` does not work on a shots beat** and is refused: a marker prints
  a part of *the* screen and there are several. A shot names its own
  `cues` instead, in **seconds into that shot**, exactly as a silent beat
  does.
- `place` is never a shot. A placed item outlives its beat by definition;
  a shot ends at the next cut. It stays a beat of its own.
- The caption band follows the picture actually under it, so a beat that
  mixes a white page and a photograph stays readable across the cut.

### `bed` — the ground the reel sits on

A looping video under everything, on its own clock. Not a background: a
background belongs to a beat and is repainted at every cut, and a bed keeps
running while beats cut over it.

```json
"bed": [
  { "file": "mesh.mp4", "at": 0 },
  { "file": "filaments.mp4", "at": 6 }
]
```

Files live in `posts/beds/`. Each entry names the second it takes over at; a
bed runs until the next one starts, and the last to the end of the reel.
`opacity` is optional. A single object works where there is only one.

**A beat only sees it by declining to paint: `"bg": "bed"`.** Every other
mode fills the frame opaquely and hides it, which is the one way a bed fails
silently — so a staged bed that no beat asks for prints a warning.

Two things about the asset, both measured rather than assumed:

- **Make it seamless before it gets here.** A hard loop shows a seam every
  cycle; the best candidate tested differed by 29 mean luma between its last
  frame and its first. Ping-ponging the clip (forward, then reversed)
  removes the seam by construction and doubles the usable length.
- **Check it does not open on black and is not a still.** One candidate was
  5 s long, frozen after 2 s, and opened on a black frame, so every loop
  restart flashed. `research/2026-09-08/backgrounds/bed-screen.py` screens a
  candidate on duration, motion, first frame, loop seam and its luminance
  profile; `BEDS.md` beside it says why grading cannot rescue a wrong clip.

The bed exists because a talking-head reference swaps four unrelated loops
across 179 s and changes them **mid-sentence** — the picture behind a
speaker is not tied to what he is saying, which is the same finding `shots`
exists for, one layer further down.

### `preset` — a named fragment merged under a node

A reel, a beat or a shot may name one: `"preset": "photo-card"`, or a list.
The named fragment merges UNDER the node, so the node's own keys always win.
`reelkit presets` prints the bank. PRESETS.md owns the rules — including why
a preset can never write `say`, and why most of what the reference teardowns
found belongs in `elements/` instead.

### `border` — the frame rule, per beat or per shot

`chrome.border` draws one rule around the whole reel. A beat or a shot may
disagree: `"border": {…}` overrides it, `"border": null` draws none. The
references change it per shot — a dark rule on a paper card, a white one
on a photograph — and one colour for a whole reel measured barely legible
on every photo beat of a reproduction. A post that names no override
renders exactly as it did before this existed.

### Screen elements and their parts

| type | fields | parts (in cue order) |
|---|---|---|
| `blank` | — | 0 — nothing to print, so nothing to cue |
| `title` | `text` (`*…*` = Heavy), `kicker?`, `sub?` | 1 — the whole block |
| `figure` | `image` + img2ascii tuning, `kicker?`, `title?`, `value?`, `line?` | 2 — the art, then the row |
| `clip` | `file` (posts/clips/), same tuning + `crop?`, same row fields | 2 — the clip, then the row |
| `recording` | `file` (posts/clips/), `loop?`, `rate?`, same row fields | 2 — the take, then the row |
| `media` | `file` (posts/media/), `credit` **required**, `fit?`, `start?`/`end?`, `audio?`, `quote?`, same row fields | 2 — the media, then the row |
| `table` | `title?`, `rows[{left,right}]`, `total?` | one per row, then the total |
| `flag` | `flags[{code,label,value?}]`, `kicker?` | one per flag |
| `stat` | `value`, `label?`, `line?` | 1 |
| `endcard` | `line?`, `file?` | 1 — and the beat is silent |
| `cta` | `lines?`, `button?` | 1 |
| `lab` | `element` + `props` — see below | free-form (except `tierlist`: one per item) |

**The lab** (`src/lab/`, demos in `out/lab/`): every animated element the
agent waves built, exposed as
`{ "type": "lab", "element": "<name>", "props": { … } }`. The beat's `[+]`
cues flow into the element's own cue props (rows pour, sectors sweep,
stamps land — at the word). Names: `unitgrid barchart odometer linechart
sparkline thermal dissolve comparison bullets pie simplepie
compositionbar rankshuffle threshold labelanatomy flow timeline molecule
calendar tierlist`. Props are each element's own schema — read its file
header in `src/lab/`. Lab beats own their full frame (paper bg) — don't
combine with `bg`. **Static use in a slideshow:** slide
`{ "type": "element", "element": "<name>", "props": { … }, "frame"?: N }`
renders the settled end state as the slide (default frame 600).

**`media`** — real footage or a real photograph, at full quality, and the
only thing on this stage that is not redrawn. Everything else is 48 to 72
glyphs a line or two inks and a hairline; a `media` beat puts the thing
itself on the screen. That contrast is the whole value: one photograph
among specimens reads as evidence, and six photographs read as anybody's
account. **One per reel, at most.**

```json
{ "type": "media", "file": "shelf.jpg", "credit": "Pexels — A. Name",
  "title": "What crosses a border", "value": "940 mg" }
```

- `credit` is **required in the post** — the render refuses without it —
  and is **off the screen by default**. A stock still we hold a licence to
  owes nobody a line on the frame (Martin, 2026-08-11: *"pas besoin de
  citer la source d'images"*); the row in `posts/media/LICENSES.md` is the
  record, and that one is not optional. Set `"creditOnScreen": true` for
  the case that genuinely needs it — quoting somebody else's footage,
  where the visible attribution is what makes it a quote rather than a
  lift. Name the channel and the person: `"YouTube — Huberman Lab"`,
  never `"YouTube"`.
- `fit: "bleed"` fills the frame instead of sitting in a card, and the
  credit becomes a boxed line on the footage. For the shot that IS the
  beat; anything with a number under it belongs in a card, where the
  paper can hold the number.
- **Video**: `start` / `end` in seconds trim it. Muted by default.
  `"audio": 0.9` plays their own voice, and then the beat may not carry a
  `say` — two voices at once is neither of them, and the renderer says so.
  An unmuted excerpt sets its own hold from the trimmed length, so the
  person finishes their sentence and the reel cuts.
- `quote: ["they never test", "the finished bottle"]` prints their words
  in the caption band across the hold — how a muted excerpt still speaks.
- **Someone else's video is quoted, not taken.** Short, answered by our
  own argument, credited on the frame. The pipeline reads
  `posts/media/<file>` and fetches nothing: **getting the file is
  Martin's step**, and every file needs its row in
  `posts/media/LICENSES.md` before it ships.

**`flag`** — one to three national flags, redrawn in the receipt's three
tones (`src/Flags.tsx`): paper, a 45° ink hatch, solid ink. For the beat
that turns on WHERE, where two country names cost a second the reel does
not have. One `[+]` per flag.

```json
{ "type": "flag", "kicker": "The same 940 milligrams", "flags": [
  { "code": "US", "label": "United States", "value": "20 %" },
  { "code": "EU", "label": "European Union", "value": "47 %" } ] }
```

Twenty-six codes are drawn; an unknown one prints as a hairline box with
the code in it, so a render never dies over a country nobody drew. Two
things follow from monochrome and are not defects: **France and Italy
come out as the same drawing** (both vertical tricolours — the LABEL is
the identification, and that is why it is not optional), and **every flag
prints 3:2** because a row of true ratios is a ragged row. Switzerland
keeps its square field inside the cell.

**`endcard`** — the sign-off, and the replacement for eight seconds of
phone. The App Store's own product row, unretouched and **unframed**,
with one line the voice never says.

No hairline, and no plate either — the same argument twice. A hairline
around it is a white rectangle drawn around nothing (Martin, 2026-08-11);
and the capture's own page is **pure black** against our dark paper's
`#151412`, 21 units apart, which printed as a visible rectangle — the
same gap that once made `bg: "ink"` a no-op at six. So the default is
`appstore-row.png`, the row with a real alpha channel, and its edge is
its own shape.

That file is generated, not hand-cut:

```
npm run mockup:alpha posts/mockups/appstore-row.jpg
```

**Do not reach for the rembg cutout here.** That endpoint is a
segmentation model — right for a photograph of a mussel, wrong for a UI
capture. On this row it dropped "In-App Purchases" and the share icon as
"not the subject", left them as ghosts under 6 % alpha, and the surviving
ink then sat 156 px left of frame centre because the canvas still counted
the empty third. A UI capture needs no judgement: its background is a
flat colour touching the border, so the background is a **flood fill**,
everything else survives at full fidelity, and the result is cropped to
the ink so it centres on what you can actually see. Keeping the
disclosure text is not a layout question — it is true, and it is on the
real row.

The script leaves the anti-aliased fringe opaque on purpose. Source page
and destination paper are both near-black, so re-compositing it is
invisible by construction — **on a light-paper reel it would show, and
this script would be the wrong tool.** All 43 reels are dark today.

```json
{ "hold": 1.5, "screen": { "type": "endcard",
  "line": "Comment BASIS for the link" } }
```

The beat carries **no `say`**: the eye reads seven words in well under a
second while the last spoken beat is still decaying, and the reel gets
that whole second back for the argument. Default hold 1.5 s, hard ceiling
2 s — past that it stops being the last frame of a video and starts being
an advertisement at the end of one. It sounds a `tear` on the cut. The
older `cta` element (a drawn wordmark and a drawn button) is an
advertisement for a listing; this is the listing.

**`tierlist`** — the ranking format, printed instead of colored, and the
one lab element whose cue count is fixed: **one `[+]` per item**, in
reading order (tier 0's items, then tier 1's, …). Cue every item or none;
the renderer counts them and refuses a partial cueing exactly like it does
for a `table`. The empty grid — title, letters, notes, rows — is on the
paper from the cut. Only the items print, into the row they belong to,
at the word that names them: the row stands there waiting and the food
lands in it.

```json
{ "type": "lab", "element": "tierlist", "props": {
  "title": "Magnesium, ranked by one realistic serving",
  "unit": "mg per serving",
  "tiers": [
    { "tier": "S", "note": "80 mg+", "items": [
      { "label": "Pumpkin seeds", "value": "156 mg" },
      { "label": "Dark chocolate", "value": "91 mg" } ] },
    { "tier": "A", "items": [{ "label": "Almonds", "value": "77 mg" }] },
    { "tier": "D", "note": "under 15 mg", "items": [
      { "label": "White rice", "value": "9 mg" } ] }
  ] } }
```

`title`, `unit`, a tier's `note` and an item's `value` are optional; 3 to
6 tiers, 1 to 4 items a row. Write the full name of a food — the element
measures each row against its column and takes the NAME's type down until
it clears the value's band, so the numbers stay on the chip floors and
nothing crosses an edge. The number itself never shrinks. Tiers print in
the order given — the element never sorts. The
ranking is drawn in one ink: S a solid block, each tier below it the same
ink at a lower alpha, the last one an outline. No color band, no stamp
red. Full schema and the honesty notes: `SLIDES.md`, "Tier lists".

**The reel is where a tier list is judged.** Lab elements are authored
against the 210→1360 band and the reel scales them into the stage —
**×0.713 since the safe area widened on 2026-08-11**, down from ×0.791 —
so the authored size is not what the phone shows: on a 393-pt handset
25 px is 6.5 pt, 19 px is 4.9 pt, 15 px is 3.9 pt of grey. Whatever reads
here reads in the carousel; the reverse is not true, so never sign a
board off on the stills. `npm run reel` measures each row before it
renders and warns when one falls under the floor:

```
WARN  serving-tier beat 4 · tierlist S — names fitted to 15 px, 3.9 pt on a reel (floor 21 px / 5.4 pt).
      6 tiers with values — take the board to 5. A tier list is judged on the reel — SLIDES.md, "Tier lists".
```

The floor is **5.2 pt on the handset**, and the authored-px number is
derived from it (`LEGIBLE_PT` in `src/lab/tier-fit.mjs`) rather than
typed — so it followed the scale down on its own, from 18 px to 21 px.
The three rules below were measured at the old scale: they are now
**conservative**, not generous. A board that was borderline at 0.791 is
under the floor at 0.713.

Three rules keep it quiet (measured 2026-08-04, the `serving-tier` board):

- **Values plus six tiers: do not.** Six banded rows carrying numbers fit
  real food names at 15 px. Five tiers still lands at 24 px; six is fine
  **labels only**, where the same board recovers to 23 px.
- **Two items a row** for anything that must be read. Three is the
  ceiling, and only on the carousel. Four is a table, not a ranking:
  19 px, every name a four-line stack.
- **The name is not the problem — row load and tier count are.** A row is
  fitted to its longest name, so shortening one chip buys nothing:
  "Orange juice, fortified — 1 cup" (31 characters) and the abbreviation
  "OJ, calcium-added" both print at 25 px beside the same yogurt chip.
  Keep the full name, and write the serving the plain way: **the chip
  keeps a number with its unit on its own** (`tier-fit.mjs`, `knit` — a
  space goes unbreakable when a digit ends the run before it and letters,
  up to twelve, follow), so "Kale, cooked — 1 cup" can no longer print
  "— 1 / CUP". Never type a non-breaking space. It cannot help a pair
  wider than the column itself — there the number does land alone, and
  the answer is fewer chips in the row, not different words. **A number
  never leaves its unit** still governs the `say` lines and every other
  element; only the tierlist chip enforces it for you.

A `clip` is the animated specimen: a GIF/short clip from `posts/clips/`
(gitignored), every frame through the art converter, looped at its own
frame rate. `trim` is forced off so the geometry holds between frames —
frame the subject with `crop` instead. Sourcing:
`npm run clips:find "<query>"` sweeps Giphy (key in `.env`), drops
candidates into `posts/clips/_candidates/` and previews each one's
middle frame AS ASCII — judge the conversion, never the gif; the art
bar applies in motion (one subject, big shapes, paper around them).
Standalone test render: `npm run ascii:clip <file>`.

**Make the clip before you go looking for one** (2026-08-04).
`npm run clips:make "<a still in posts/art/>"` animates a photo we already
license into `posts/clips/<still>-<motion>.gif` — 25 frames at 12.5 fps,
one full period, so the loop closes with no seam. Four motions: `sway`
(a ±12° rock), `spin` (one full turn), `bob` (a ±10 % float) and `push`
(a +22 % push-in and back). Add `--cutout` to animate the rembg
derivative rather than the photographed table. It prints two converted
frames and three numbers — GRID, GLYPHS, EDGE — and EDGE is the one that
matters: cells crossing between ink and paper, the silhouette actually
moving. A subject can churn 20 % of its interior and read as a still
specimen boiling in place.

The clip only has to survive the converter, and the converter throws
photographic fidelity away — 48 to 72 glyphs a line is all that ships.
So a generated clip reads as well as a sourced one and arrives with its
provenance already written: the source still's row in
`posts/art/LICENSES.md` is the whole chain. Measured on a dumbbell,
`sway` moves the ink box ±3–4 cells and `spin` ±11–13, against ±1 cell
for the Giphy sticker it replaces. **Choose the motion against the
subject's shape**: `bob` reads clearest but adds height, and the reel
sizes a clip at `min(width / cols, maxHeight / rows)` — so on a tall
subject (a bottle, a tube) `bob` starves the type and `push`, which
holds the box, does not. Reach for `clips:find` only when a subject
genuinely needs motion no still can imply.

**Search the STICKER catalog, not the GIF one** (2026-08-03). `clips:find`
now queries both and labels each hit `[stickers]` / `[gifs]`; `--stickers`
and `--gifs` force one. A sticker has a transparent background, so the
subject arrives already cut out and `imageToAscii` flattens the alpha to
white — which is exactly the art bar. The `/gifs` catalog is where the
memes live: dark plates, full-bleed video, faces mid-motion, and Giphy's
relevance there is so loose that unrelated queries return the same
handful of reaction gifs. Three writers in a row swept it for food
subjects and promoted nothing; the sticker catalog answered the same
queries on the first try. If a subject still will not convert, use a
still `figure` from `posts/art/` rather than shipping a bad specimen.

A `recording` is the app itself, running. Same pool (`posts/clips/`),
opposite treatment: the file is **played as video**, never converted, and
sits inside a hairline frame on the paper — the moving twin of `mockup`,
which already puts a real screenshot on the sheet. It is measured, not
fitted: `render-reel.mjs` reads the take's length and shape off the file,
the frame fills the stage's width until it would outgrow its height, and
the take replays until the beat ends (`loop: false` holds the last frame
instead; `rate` speeds a scroll a short beat cannot wait out).

Takes are made by `tools/capture_demo.sh <panel|log|verify>`, which boots
the simulator, seeds the specimen day, drives the real UI with idb and
writes `posts/clips/<flow>.mp4` — light theme, ~12 fps, already cropped to
the screen's working area. **Nothing about a recording is composited.** If
a flow cannot be driven it is not shipped: there is no `scan` take,
because a simulator has no camera (`verify` records the screen a scan
lands on, and says so). A demo beat is the strongest thing this format
has — the viewer believes what they watch run — so reach for `recording`
when the point IS the product, and for `clip` when the point is a
specimen.

Parts print with a 0.33 s top-down wipe — the paper printing, the only
motion in the system. `figure` art goes through the same converter and the
same sourcing rules as the slides (`SLIDES.md`, ASCII art).

### Captions

The spoken words print above the platform caption zone — uppercase mono,
one page of at most three words (~20 characters), never across a sentence
boundary. Timing comes from the TTS's own sentence timings, interpolated
per word.

**The band is painted in the beat's own page colour** (Martin, 2026-08-11:
*"je voudrais que l'encadré des sous-titres soit de la même couleur que le
fond"*), so on a paper or ink beat it disappears and only the words are
left. The box existed to guarantee contrast; against the page's own colour
there is nothing to guarantee. A **photo** beat has no flat colour to
vanish into, so there the band borrows the same warm-paper-and-ink pair
the printed cards use and stays a physical object lying on the scene —
the same rule the stage already applies to its elements.

**Three ways to play a page**, and they differ only in what the page looks
like before its last word is spoken. The band, the type and every word's
position are identical in all three — one layout, one number changed —
which is what makes them worth A/B-ing rather than redesigning.

| `captions` | before the word is said | when it is said |
|---|---|---|
| `"page"` (default) | the whole page is already there | it turns Heavy |
| `"words"` | invisible, holding its space | it appears, at once |
| `"bump"` | invisible, holding its space | it arrives from 0.86, overshoots to 1.06, settles — 7 frames |

**The bump grows, it does not shrink.** It shipped once as 1.10 easing
down to 1, which is a zoom OUT, and Martin caught it immediately
(*"le zoom doit être contraire, genre un léger zoom in rebond pas zoom
out"*). The two look almost identical in a still and read as opposites in
motion: a word shrinking into place has already happened by the time you
notice it; a word growing into place is arriving. The overshoot is what
makes it land rather than merely stop.

```json
"reel": { "captions": "words", … }
```

**`*emphasis*` — how hard the writer hit the word.** Marking a word in the
spoken line paints it in the skin's accent colour; the asterisks are
stripped before the voice ever sees them. The COUNT is a level: `*word*`
is 1, `**word**` is 2, `***word***` is 3, and a level past the end of the
skin's list clamps to the last one. What each level looks like is the
skin's call, not the writer's (`theme.captions.emphasis` — CONFIG.md):
colour, `scale` (a real font size, so the line box grows around the word
rather than the glyph riding over its neighbours) and `outline` (a hollow
glyph, stroke only). Measured need: one reference sentence holds a word in
gold and another at 2.6× cap height as an outline, in the same band. A
run spans words — `*two words*` marks both.

The choice follows the VOICE's stress, so it is the writer's: the same
word is gold in one sentence and plain in the next, and no rule can infer
that.

```
npm run reel <post> -- --captions bump    # audition, the post is untouched
npm run reel <post> -- --gates            # the five audits, then stop
```

`--gates` is the loop to write in: every gate is about the JSON and none
of them needs a voice, so it runs the audits and exits — no TTS call, no
bundle, no render, no cost. Finding out a script is six words over the
ceiling used to take a full render.

Nothing shifts in any of them, and that is the constraint the old rule was
protecting: the page is **laid out whole from the first word**, so a line
never reflows as it fills. SF Mono keeps its advance across weights, so
the Heavy pass does not move the text either, and `bump`'s transform is
paint-only on an inline-block — it cannot push the word beside it. (The
separating space is a SIBLING of each word, not inside its span:
`inline-block` collapses its own trailing whitespace, and a space inside a
bumped span would close the gap in one mode and not the others.)

**No fades, in any mode.** The first version cross-faded each word up from
zero over three frames and Martin killed it on sight (2026-08-11: *"je ne
veux pas d'animation concernant l'opacité — ça apparaît en delay mais d'un
coup, voire avec un effet bump très léger"*). It is the right call beyond
taste: everything else in this system **prints** — a hard 7-frame wipe
with no ramp — so a caption that dissolves in was the one element doing
something the instrument does not do. `words` and `bump` both use
`visibility`, which has no intermediate state to animate.

A `media` beat with `quote` borrows the same band for somebody else's
sentence: one line per page, spread across the hold, every word landing at
once — there is no per-word timing to borrow, because the TTS never saw
those words.

## The screen carries no prose — ever

**Rule, all videos (Martin, 2026-08-02): the only words on screen are the
captions.** No title beats, no big typographic hooks, no bullet lists of
sentences. The voice says the argument; the screen *shows* it — an
instrument (chart, meter, grid, molecule), an ASCII specimen, or an
animated clip. Data labels inside an instrument are not prose: a bar's
name and its value are part of the reading.

Consequences worth stating: the `title` element and text-only `bullets`
belong to the slideshow now, not to reels; a beat that has nothing to
show does not exist — cut it or find its picture.

**The rule is now a gate**, because it kept losing (Martin, 2026-08-11:
*"parfois on met trop de texte sur l'écran — il faudrait être plus
sommaire et se poser la question: est-ce que ce texte est utile, ou bien
sans, on ne perd pas le sens"*). `npm run reel` refuses a beat that
breaks any of these, before the voice is billed:

| bound | why |
|---|---|
| **12 words** of prose on one screen | the budget for everything that is a sentence rather than a reading |
| `line` ≤ **7 words** | it is a caption under a specimen, not a second argument |
| `kicker` ≤ **5 words** | a kicker is a label |
| a table's right column **contains a digit** | a right column is a measurement; a phrase there is the voice's job, and it shipped twelve times |
| a table's left label ≤ **34 characters** | past that it is a claim, not a row |
| no `title` element, no text-only `bullets` | slideshow elements |

"Prose" is counted at **any depth**, including inside a lab element's
`props` — which is where the worst of it hides. A `flow` with a `sub`
under each of three stages and a `line` under the whole thing is 27 words
of screen text that no top-level check would ever have seen. `title`,
`label` and `value` are deliberately **not** counted: on a figure the
title is the row's label and on a table it is the column head, and both
are readings.

Measured the day the gate landed: **39 of the 41 reels in `posts/` trip
it.** `--loose` downgrades it to warnings, and exists for re-rendering
those, not for writing a new one.

The caption band sits at y 1180 (TikTok's chrome creeps higher than the
published safe areas) and the stage stops at 1080, so nothing competes
with the words.

## Variety — the bank is read as one account

Measured 2026-08-11 across the 41 reels in `posts/`:

```
44 table      26 figure       17 lab:comparison    3 lab:tierlist
39 mockup     23 clip         12 lab:unitgrid      2 lab:molecule
26 stat       23 lab:flow      9 lab:labelanatomy  1 lab:odometer
              20 lab:barchart  7 lab:threshold
```

Every reel has a table. Every reel ends on a phone. Four elements —
`sparkline`, `thermal`, `dissolve`, `pie` — have never once appeared in
one (Martin, 2026-08-11: *"j'ai l'impression qu'on était trop limité sur
les animations, c'était toujours les mêmes ou pas terrible, genre peu
d'ASCII utilisé"*).

`npm run reel` now prints the reel's own shape and warns on three things:

- the shape matches another post's **beat for beat**
- one element appears **more than twice** in a single reel — that is the
  format, not a beat
- **nothing in the reel is outside the bank's top third** — no novelty at
  all

It also prints `FRESH`, the elements in this reel the bank has barely
touched. Aim to have that line be non-empty before you render.

Three things that actually buy variety, in the order they are worth doing:

1. **Kill the default ending.** A `mockup` costs five seconds and appears
   in 39 of 41 reels. An `endcard` costs 1.5 and appears in none of them.
2. **Ask whether the table is a table.** A right column with no digit in
   it was never a table — it was a list of phrases, and the prose gate now
   refuses it. Twelve shipped that way. What it usually wants to be:
   `flow` (a chain), `timeline` (a when), `flag` (a where), `comparison`
   (a versus), `threshold` (against a limit).
3. **Open on the specimen.** ASCII is the signature and it appears in
   fewer than two thirds of reels. `figure` and `clip` are cheap — the
   pool is in `posts/art/` and `npm run clips:make` animates a still we
   already license.

## The script is the whole thing

**A reel earns its watch by teaching, not by pitching** (Martin,
2026-08-02, killing a first draft of 012). The bar he set: the viewer
should finish thinking *"it showed me this problem and this solution"*
or *"I just understood the whole thing from this video"*. Three
consequences:

- **Value first, app last.** The app gets the final beat and one line —
  never a second beat, never a middle-of-the-video plug. If the reel
  would be worth watching with the app removed entirely, it is ready.
- **Explain a mechanism, don't state a fact.** "Micros are undertracked"
  is a claim. "Carbs only become energy if you have B1, and milling
  takes the B1 out of the carbs" is an explanation — the viewer leaves
  with something they can repeat at a table.
- **Write it as speech, not as slogans.** Sentences connect: "the thing
  is…", "now watch what happens…", "and here is why nobody talks about
  this". A chain of clipped declaratives reads as a machine at reel
  pace, even when every line is true. Read the draft aloud; if you
  would not say it to a friend, rewrite it.
- **Length is fixed; what fits is the choice.** 30–40 s, and the gate
  enforces it. This used to read "45–55 s is fine when the content earns
  it" and the account spent a year proving that every topic earns it.
  Cut for waffle first, then cut the third-best beat, then pick a
  narrower topic — never cut the explanation to keep the beat count.
- **Write for the viewer's body, not for our database** (Martin,
  2026-08-03, killing a draft built on French flour grades). The reel
  does not have to stand on `ciqual.json` — it stands on whatever number
  the viewer can act on. The audience is American: ounces, cups,
  handfuls, foods sold in their store. A regulation only they would
  never meet, a jurisdiction, a table we happen to own — all of it is
  our interest, not theirs. Reach for our data when it is the best
  evidence, not because it is ours.

### The nutrient spine — four questions, in order

The one that works for "explain nutrient X", straight from the way
Martin asked for it. Every beat answers the next question a real person
would ask, and nothing else gets in:

1. **What is it, in one image?** Not a definition — a mechanism a
   fourteen-year-old repeats at dinner. Magnesium: your cells run on
   ATP, and ATP only fires with magnesium clipped onto it. Full battery,
   nothing comes out.
2. **How would I know I am short?** Answer it honestly even when the
   honest answer is *you would not* — that is usually the strongest beat
   in the reel, and it is the one that makes counting the only way out.
   Never list vague symptoms as a checklist.
3. **What does it run when I have enough?** Systems, not promises.
   Muscles, nerves, repair, bone.
4. **Where do I get it — and what is the myth?** Real servings, foods
   they already buy, then break the thing everyone believes. The myth is
   the payoff; it earns the watch-to-end.

- **Open on a specimen and close on the same one.** The ASCII clip is
  the signature *and* the hook — a converted GIF in the first second
  buys the next ten. Bring it back at the myth beat and the reel closes
  its own loop (`npm run clips:find`, promote into `posts/clips/`).
- **The mockup is a beat, not a bed.** One short line, four or five
  seconds. Eight seconds of phone at the end is a commercial, and the
  viewer leaves before the loop closes.
- **Diction speed is a knob.** `"voice": { "cfg_weight": 0.35 }` tightens
  the delivery — a few seconds over a full reel. Cut words first; this
  is the last squeeze, not the first.

## Before you write — the recurring traps

Ten defects keep arriving from writers and keep being caught late, after
a render has been paid for. Read this list before the first beat, not
after the critic sends it back.

1. **Open on a question, not on a fact.** The shape that works names the
   belief and then promises the receipt: "Is spinach actually a good
   source of calcium? Because every list ranks it on what is in the
   leaf." Two openings that shipped and should not have: a population
   statistic ("almost 4 in 10 girls are low on stored iron" — nobody is
   four in ten of anything) and a flat declarative about the nutrient
   ("your skin makes vitamin D out of sunlight" — unarguable, so there is
   nothing to stay for). Find the sentence the viewer would argue with.
2. **Never say what the screen already says.** The paper prints `5 %`; the
   voice explains why it is five — "your gut cannot pry the crystal open".
   A line whose whole content is on its own screen wastes the beat.
3. **The app beat hands over an action, not a feature.** "Log your stack
   and see the real milligrams" — a verb they perform, a thing they get.
   "Tally reads your labels and keeps your record" is a product
   description and it has already shipped four times. At 35 seconds the
   action rides in the **last clause of the last spoken beat**, and the
   `endcard` carries the ask silently — there is no longer a beat whose
   whole job is the app.
4. **Fold before you add a beat.** Every beat is a hard cut. Two touching
   beats under about fifteen words each — a question and its answer, a
   setup and its number — are one beat with one screen. Eight beats where
   seven fit gives the viewer a new frame every three seconds and nothing
   to finish reading.
5. **Read every line for sound, not spelling.** The narrator is a cloned
   voice and it fuses near-homophones: *started* came back as *stated* on
   a shipped render. Watch *stores/stored*, *than/that*, *fat/fact*, and
   a number running into the next word. Fix it with a different word — the
   TTS reads letters, so respelling does nothing.
6. **A mechanism claims a direction, so check the direction.** "Reads
   low", "absorbs more", "goes up" are as falsifiable as the number beside
   them. Biotin nearly shipped saying two assay designs fail "the same
   way": a sandwich assay reads **low**, a competitive assay reads
   **high**. If the `brief` or the `footer` does not settle the sign, cut
   the clause.
7. **Check the bank before reusing a shape.** The account is read as one
   account. From `tools/store-shots`:

   ```
   grep -o '"say": "[^"]*"' posts/*.json | grep -iE '<your sentence shape>'
   ```

   Burnt as of 2026-08-04, across sixteen scripts: "Log / Count one
   ordinary day and see …" as the app line (12), a `table` whose right
   column is a phrase instead of a number (12), "So what / how / where …?"
   opening a beat (11), "So how would you know?" answered "you would not"
   (6), "Tally reads / counts your …" (4), "So where do you get it?" (3),
   "Now watch …" (3). Rotate: a situation ("You get a blood test in
   March. It says normal."), an instruction ("Read the back of the
   bottle."), a wrong guess named out loud ("Most people answer salmon.
   Salmon is fourth."), or the object itself ("There is one place that
   number shows up. Your urine.").

8. **Put the first `[+]` on the first word of the beat.** For a `figure`,
   `clip`, `media`, `stat` or a `unitgrid`, the first cue does not delay a
   row — it gates the **entire screen**, so a marker after the first
   sentence plays the beat over blank paper until the voice reaches it.
   Measured on a 96-word script: three of four beats cued after their
   first sentence and the reel spent **9 of 35 seconds on an empty
   sheet**, including the first 4.6 s, which was the hook. `npm run reel`
   prints `BLANK` for any beat that opens on more than 1.2 s of nothing —
   and it knows which elements this applies to, because a `barchart`,
   `flow`, `timeline` or titled `table` has its frame on the paper from
   the cut and is not affected. **9 real cases across the bank.**

   The same beat has a second failure mode worth checking by hand: a
   `unitgrid` given ONE cue starts its extinction 85 frames later
   (2.8 s), which on a short beat is the frame the reel cuts away. Give
   it two — the grid prints on the first, the units go out on the second.

   **The general shape: a part with no cue of its own is placed relative
   to the last one, and the beat may end first.** Same family as the
   `unitgrid`, and it is the reason `sfx-audit` names "a hit landing past
   its beat" as a failure — the visual side has no such check. Measured on
   Papyr's first reel, 2026-08-14: a `comparison` carrying a `verdict` and
   given exactly `rows.length` cues put the verdict at
   `lastCue + stagger + 8` — **twelve frames before the cut**, four tenths
   of a second, on a row that is the beat's conclusion. Nothing warned; it
   rendered, and it was only visible frame by frame. A `comparison` with a
   verdict takes `rows.length + 1` cues, and any element whose last part is
   the argument wants a marker of its own.

9. **The endcard's keyword and the caption's keyword are one keyword.**
   `npm run gates` finds a word answering for two POSTS; it cannot see a
   post disagreeing with itself, and one shipped that way — the endcard
   printed `B1` while its own caption said `STALL`. The viewer types what
   is on the screen and the caption routes what it says, so neither can be
   answered. The render now refuses it.

10. **The app line must survive your own turn.** Rotating away from the
   burnt "Log one ordinary day" is not enough — the replacement has to be
   something the app really does. Two of five scripts drafted on
   2026-08-04 promised a measurement the app cannot produce: a greens reel
   that spent fifty seconds proving a label cannot tell you how much
   spirulina you got then offered to "see which nutrients it actually
   brings", and a cooking reel offered to "check what your kitchen kept"
   when the record has no idea whether you boiled or microwaved. Ask both
   questions before you write the line: does the promise survive the reel's
   own argument, and would the app produce that number tomorrow morning?
   Name something the record really holds — "read the vitamin C line",
   "check it against 109 grams".

Same rule for the comment gate: the keyword is the only attribution the
account has, so it must be free. `grep -rioE 'comment "?[a-z0-9]+'
posts/*.caption.txt posts/*.json | sort` before you pick one, and never
gate on the hero number. Reserved as of 2026-08-04, unshipped scripts
included: LEAN, BLEND, KEPT, SCAN, UNIT.

## Writing the script

**Start from the brief, not from the slides.** The slideshow text was
written for a reader who controls the pace; the reel viewer controls
nothing but the swipe away. The brief decides what is true; `FORMATS.md`
decides what shape carries it — the format bank, each one's guard rule, and
the tiers that never run here. **30–40 seconds, five or six beats, one
idea per beat:**

**Count the words before you render — the tool does it for you now.**

**A words-per-second rate is the wrong shape**, and the data says so.
Least squares over 37 rendered reels, two parameters:

```
seconds = 0.2667 × words  +  0.604 × sentences
        = 3.75 words a second of actual speech
        + 0.60 s at every sentence boundary
```

That second term is the machine, not a fudge: `tts.mjs` assembles a line
from per-sentence clips with a fixed 140 ms gap and trimmed edges, and
`render-reel.mjs` adds a 200 ms tail per beat. **A script of short
sentences pays that toll more often.** `percent-basis` (6.7 words a
sentence) ran 3.8 s past a single-rate prediction; `greens-panel` (11.3)
beat it by 6.7. RMS error 2.81 s, against 3.22 s for a single rate.

So **the word budget depends on your own sentence shape** and `npm run
reel` computes it per script rather than quoting one number. For a
five-beat reel with a 1.5 s endcard it lands near **95 words target, 98
ceiling** — but write 20 short sentences and the ceiling drops.

**Three histories worth keeping, because each one was expensive:**

1. **REELS.md carried 2.94 w/s for a week and it was not the mean of
   anything.** Caught when the first two scripts written to the new
   "35-second" budget came back at 39.9 s and 37.3 s.
2. **The single-rate replacement (2.845 typical / 2.60 slow) still let a
   40.5-second file through.** `percent-basis` cleared the gate at 98
   words and rendered 0.5 s over. That is what produced the fit above.
3. **The estimate is still not the file.** RMS 2.8 s against a 40-second
   ceiling, and per-script pace runs 2.47 to 3.26 w/s. The pre-flight
   number therefore carries a **+3.8 s margin** (the P90 of the fit's own
   residuals) and `npm run reel` **measures the finished MP4** and prints
   `OVER` with the cut in words. That last check is the only one that
   cannot be wrong; trust it over anything above it.

**This replaced a 45-second target / 75-second ceiling on 2026-08-11**
(Martin: *"on devrait caper sur 30/40 secondes plutôt, ça permettrait de
répondre rapidement au topic et d'être très concis pour faire en sorte que
chaque seconde soit importante"*). The old numbers were not being met
either: measured across the 41 reels in `posts/`, **40 of them ran past
40 seconds**, the median at 60, the longest at 98. A viewer decides in the
first second and re-decides at fifteen; everything past forty is spent on
an audience that already left.

**Cut beats, not clauses.** A shortened beat still costs a hard cut and
still needs its own screen, so trimming six words off each of seven beats
buys forty words and loses nothing the viewer noticed. Dropping a beat
buys the same forty words and gives back a cut. Five or six beats is the
shape at this length, one of them silent (the `endcard`).

**Two habits that pay for a third of the budget:**

- **Digits, not spelled numbers.** "4,700" is one word and the TTS reads
  it as four thousand seven hundred; writing it out is four words and the
  caption gets worse. (`REELS.md` already said this; at 103 words it stops
  being a style note.)
- **The endcard replaces the spoken app beat.** A `mockup` with a line
  over it is five seconds; an `endcard` is 1.5 and is read, not heard.
  That is 10 % of the reel recovered for the argument.

Check your own draft — the same number the gate uses: 

```sh
node -e "const b=require('./posts/<name>.json').reel.beats;
const w=b.map(x=>(x.say||'').replace(/\[\+\]/g,' ')).join(' ').split(/\s+/).filter(Boolean).length;
console.log(w,'words →',(w/2.845).toFixed(0),'-',(w/2.6).toFixed(0),'s')"
```

1. **Hook beat** — the demand + the broken number, spoken in the first
   two seconds, title on screen from the cut.
2. **Proof beats** — figures and tables. This is where the data lives,
   and the `[+]` cues are the choreography: the row prints when the voice
   says its number. Screen and voice must not read the same sentence —
   the paper states, the voice explains.
3. **Turn beat** — the correction. Let the screen stay empty until the
   line that matters, then print it.
4. **Endcard** — the store row and the comment gate, silent, 1.5 s, same
   keyword as the caption.

The register is `SLIDES.md` verbatim — active voice, third-grade grammar,
zero exclamation marks, the read-aloud test now literal — with the spoken
screws tightened (Martin, 2026-08-02):

- **"You" carries every beat.** "Your body throws most of it away", "you
  keep 25 to 30 percent" — the viewer is the subject of the reel, not
  the nutrient.
- **Curiosity buys the next beat.** Open loops, then close them: "the
  number one iron food barely feeds you" earns the why; a question beat
  ("so how do you get more iron?") earns the list.
- **No AI mannerisms.** No "here's the thing", no "let's dive in", no
  tidy triads for their own sake. If a sentence could open a chatbot
  answer, it does not open a beat.
- **Punctuation is the performance.** The TTS phrases off the marks —
  full sentences, real periods, commas where a human breathes. A
  fragment chain reads flat.
- **Spell the units, keep the digits.** "49 milligrams", "3 to 10
  percent" — never "mg" or "%", which the voice mangles; never
  "forty-nine", which the caption doesn't need.
- **Short sentences.** The captions page three words at a time; a clause
  that needs a comma to survive will read as noise in the band.
- **Keep one ASCII `figure` beat** — the specimen is the signature; a
  reel of photos alone could be anyone's. At most **one `media` beat**
  against it: the real thing reads as evidence precisely because
  everything around it is redrawn.

Honesty rules follow the content out of the app, as always: the voice may
not claim what the paper does not show, portions over per-100 g, sources
named, the UL spoken when a portion passes 100 %.

## The voice — RunPod Chatterbox

The endpoint Papyr already runs (`papyr-api/RUNPOD.md`): text in, base64
MP3 plus per-sentence timings out — those timings drive the captions and
the cues. ~2–5 s per line warm, ~$0.20 per hour of audio; the first line
after idle can take 30–60 s (cold start, the script polls through it).

Keys in `tools/store-shots/.env` (gitignored, never in the repo):

```
RUNPOD_API_KEY=…
RUNPOD_ENDPOINT_ID=…
```

Both come from your own RunPod account: the API key from the console, the
endpoint id from the Chatterbox serverless endpoint you deploy. Put them in
`<project>/.env`, which `reelkit init` gitignores. Nothing here ships a shared
endpoint — the voice is billed per call, so it is yours.

Audio caches per line under `posts/audio/<post>/` (gitignored), keyed on
text + voice settings — editing one beat re-speaks one beat. `voice`
overrides merge onto `language: "en"`, `exaggeration: 0.5`,
`cfg_weight: 0.5`, `temperature: 0.8`.

**The reel narrator is `"voice": "tiktok-male"`** — a reference sample
baked into the worker image (`papyr-api/tts-worker/voices/
tiktok-male-sample.wav`), cloned by Chatterbox per line. To add a voice:
drop a 24 kHz mono PCM wav in that folder, push (the image rebuilds
itself), and the name is the filename minus `-sample.wav`. If a render
comes back in the default voice, the endpoint has not rolled the new
image yet — `rm -rf posts/audio/<post>` and re-run once it has.

## Loudness

Every finished reel is normalized to **-14 LUFS, true peak -1.5 dBTP**,
automatically, as the last step of `npm run reel` (`normalizeLoudness` in
render-reel.mjs — two-pass, video stream-copied, audio re-encoded).

Remotion hands back the raw mix, and a cloned narration lands near
**-27 LUFS**: a full 13 dB under every other video in the feed, which the
ear reads as "quiet and amateur" before it reads a word (Martin, 2026-08-03
— "est-ce que tu peux mettre plus fort ou ça sature ?"). It does not
saturate: the raw file peaks at -8 dBTP, so the headroom was simply never
used. After the pass, protein-max measures -14.2 LUFS with a -1.2 dBTP
peak — no clipping, 12.8 dB louder.

Narration measures LRA ≈ 2 LU, so there is no dynamic range to protect
and the limiter only touches the loudest syllables. If a reel ever ships
with music baked in, normalize the bed to -26 LUFS as before (`volume`
stays a dB offset under the voice) — this final pass then lifts the whole
mix together and the balance survives.

## Sound design

`"sfx": true` in the reel block puts a **discrete effect on the animation
events** — a row printing, a chip landing in a tier, a verdict stamping.
Opt-in per post: without the key a reel is silent exactly as before, so
nothing already shipped changes unless it is re-rendered on purpose.

```
npm run reel vitamin-k-tier             # with sound (the post opted in)
npm run reel vitamin-k-tier -- --no-sfx # the same cut, silent → <name>.nosfx.mp4
npm run reel <post> -- --sfx            # AUDITION the kit on a post that has not
                                        # opted in — the post file is not touched
npm run sfx                             # synthesize the kit, print its levels
```

**Nothing is hand-synced.** A `[+]` already resolves to a frame, and the
element already prints on that frame; the effect is placed on the same
one. Re-speak a beat and the sound moves with the row, because both come
out of the same number.

### Two kits, one contract

`posts/sfx/` holds the **synthesized** kit — ffmpeg oscillators, no source
recording, the recipe IS the provenance. `posts/sfx/sourced/` holds
**downloaded** takes, normalized into the identical level contract by
`npm run sfx:import` from the register at `posts/sfx/sourced.json`.

**A downloaded take wins when both exist**, because the kit was built for
want of anything to reach for, not because an oscillator is the goal — a
real thermal head has a transient complexity that band-limited noise under
an envelope approximates and does not match. `--synth` forces the
synthesized side, so the two are one flag apart and "is the real one
better" is answerable by listening.

```
npm run sfx:import              import + level everything in sourced.json
npm run sfx:import -- --list    what is registered, imported, shippable
npm run reel <post> -- --synth  the A/B against the synthesized kit
```

Two things the register buys, both learned the expensive way in
`posts/clips/LICENSES.md`: a row per file that survives a clone, and a
**refusal in `npm run ship`** when a staged sound has no `source` or
`license`. Rendering only warns — auditioning is not distributing, and the
moment a missing licence costs anything is the moment the file leaves the
machine.

### Borrowed sound — the decision, and what is actually true

**Martin, 2026-08-11:** *"on peut utiliser ces sons là car tout le monde le
fait sur les réseaux et quand on les utilise les plateformes donnent les
revenus directement aux auteurs, ni besoin de citer ni besoin de dire."*
Four files ride on that call: `bell` (Apple's Apple Pay chime), `cave`
(Minecraft), `alien` (the *Annihilation* score), `fahh` (an unidentified
rip). They are in the kit and they ship.

Record the reasoning accurately, because a wrong version of it will get
re-used to justify the next thing:

- **True.** The platforms hold licences with music rights holders, and a
  track taken from the platform's own library is covered and paid for
  with no citation from us. That is the standing doctrine for music
  (below) and it is why the default is to add the sound natively at post
  time.
- **Does not transfer.** Payment routes through the platform
  *identifying* the audio — i.e. through picking it in the app. A sound
  baked into our MP4 is anonymous audio inside our own track, and nothing
  routes anywhere. A sound effect ripped from YouTube is administered by
  nobody, so there is no author to pay even in principle. And consumer
  music licences generally exclude commercial use: TikTok maintains a
  separate Commercial Music Library precisely for accounts like this one,
  which sells a paid app.
- **So the honest description is "borrowed knowingly", not "licensed".**
  That is what `posts/sfx/sourced.json` says on those four rows, and the
  ship gate passes them because a filled row means *a decision was made
  and written down* — which is the whole thing that was missing when nine
  Giphy clips shipped with no register at all.

Practical exposure is small (a Content ID claim on Shorts, at worst a
muted track) and it is Martin's call to take. Do not re-litigate it; do
not extend it to a new borrowed asset without asking him, and do not write
"licensed" or "the platform pays the author" anywhere in this repo.

### Reaction sounds — on the beat, not on a cue

Those four are not event sounds. They mark **the cut** — the moment the
viewer sees the thing being reacted to — so they hang off the beat rather
than off a `[+]`:

```json
{ "say": "…", "sound": "cave", "screen": { … } }
{ "say": "…", "sound": { "name": "bell", "at": 0.4, "volume": 0.45 } }
```

`at` is seconds into the beat, `volume` overrides the kit's -14 dB — a
reaction sound is the point of its beat, not a detail under the voice.
**One per reel at the very most.** The register in this account is the
instrument; a second sting in the same video is somebody else's account.

### The kit — a short list of real objects

**Every voice names an object, not a moment.** That is the whole rule, and
it is what the second pass fixed (Martin, 2026-08-11, of the first:
*"franchement je trouve que ça match pas du tout"*). The architecture was
already right; the material was twelve synthesized noise bursts, which is
a plausible *description* of a click and is not a click. Worse, the reveal
had just become a fade while the loudest sound in the system was still a
THERMAL HEAD — so the sound was describing motion that no longer happened.

Sourced takes live in `posts/sfx/sourced/` (gitignored, rebuilt by
`npm run sfx:import` from `posts/sfx/sourced.json`, which is committed and
carries the exact trim and the provenance of each). The synthesized kit in
`scripts/sfx.mjs` stays as the **fallback**: a clone with no downloads
renders with stand-ins and the log names every substitution.

| sound | the object | where it belongs |
|---|---|---|
| `type` `type2` | a typewriter hammer, two of them alternated | any line of text arriving on paper |
| `ratchet` | one tooth of a bicycle freewheel, 38 ms | a bar filling, counted |
| `detent` | one tick of a clock escapement | a counter's digits |
| `nib` | one pen mark, 70 ms | a data point, a callout, an event on a line |
| `plotter` | a pencil stroke, 460 ms | a line being drawn |
| `slide` | paper across paper | any continuous fill — a sector, a pour |
| `shutter` | a camera, both halves of the mirror | a specimen being photographed |
| `flip` | a page turning | one sheet replacing another |
| `stamp` | rubber onto paper onto wood | a verdict, a limit crossed |
| `print` `cut` | a thermal head, and the blade | **only** the receipt element |
| `latch` | a metal detent | a value settling |
| `popsoft` `unpop` | a bubble, forwards and reversed | one unit landing / leaving |
| `tear` | the sheet off the roll | the endcard |
| `click` | one interface click | a `recording` beat — our own app |
| `bell` `cave` `alien` `fahh` | *(borrowed)* reaction stings | see above |
| `room-tone` | the bed, not an effect | see below |

Two consequences worth stating out loud:

- **`print` lost its empire.** It used to mean "something appeared" and
  was 11 of 14 effects on the demo sheet. It is a thermal head, so it
  survives on the one element that is a receipt physically printing.
  Everything else now says what it actually is.
- **One download can be two sounds.** `unpop` is `popsoft` with
  `reverse: true, semitones: -3` — the same object going the other way,
  which the ear reads as a departure without being told. `sfx-import.mjs`
  applies both derivations, so the register stays the provenance.

Everything sits between 1.5 and 7 kHz where it can. Martin lays a trending
sound over the track inside TikTok at post time and a bed owns the bass:
a thud that carries its weight at 110 Hz vanishes under the first kick,
the same thud carrying its weight in its transient does not.

### Programmatic sound — the element sounds its own motion

`scripts/sfx-elements.mjs` holds **one emitter per element**, taking
`(props, cues, fps)` and returning hits whose frames come from that
element's real animation timeline and its own **data**. Write it once;
every post using that element gets it, shaped by its own numbers.

**This replaced type-keyed mapping on 2026-08-11** (Martin: *"ça utilise
presqu'uniquement le print… ce qu'on veut c'est de la programmatic UI
sound design, ça dépend des données et c'est géré au niveau de chaque
élément — une fois la logique faite on n'a pas besoin de refaire pour
chaque appel"*). The old map keyed on the element's TYPE and gave one
sound per `[+]`, which is why **eleven of the demo sheet's fourteen
effects were `print`**: a cue is a word the writer marked, not a thing
the element did. The same sheet now fires **126 effects across 16 sounds**.

**Every lab element has an emitter.** The ones whose sound is genuinely
one event per cue — `table`, `figure`, `flag`, `stat` — stay in the type
map below.

| element | what it now sounds |
|---|---|
| `unitgrid` | a `popsoft` per unit as the grid fills, an `unpop` per unit going out — the reduction is longer than the fill because it is |
| `barchart` | a `ratchet` placed at equal *progress*, so it is dense where the bar moves fast and opens out as it settles; teeth scale with how far the bar travels |
| `odometer` | a `detent` per digit on the counter's own deceleration, and a `latch` when it stops |
| `linechart` `sparkline` | one `plotter` stroke stretched to the real draw length, then a `nib` on the highest reading, the lowest and the last — **the data picks all three**, and the rate follows the value |
| `pie` `simplepie` `compositionbar` | one `slide` per sector, played slower for a bigger share |
| `comparison` | a hammer per row, `stamp` on the verdict (it was `print`, on an element where nothing prints) |
| `threshold` | `slide` as each source pours, `latch` as it settles, and a `stamp` on the **interpolated frame the pour crosses the limit** — computed, not authored |
| `thermal` | `print` per line on the mirrored schedule, `cut` at the tear, `stamp` on contact — the one element where the head is literal |
| `tierlist` `bullets` `flow` `rankshuffle` | a hammer per item; `flow` adds a `nib` for the connector drawing *before* each box lands, `rankshuffle` a `slide` per re-filing wave and a `latch` when the board settles |
| `timeline` `molecule` `labelanatomy` | a `nib` per mark, bond or annotation — heavy events louder, a struck correction taking the `stamp` instead |
| `calendar` | the grid arrives as ONE light `slide` — nobody counts thirty squares appearing — and then **the exception is the event**: the kept days are a pulse thinned to one every ~12 frames, and every MISSED day gets its own `unpop`. A clean month is quiet and a bad month is audibly bad, with nothing said about it |
| `dissolve` | one `flip` — a single transformation is a single sound |

Four rules keep it from becoming noise:

- **Density is capped.** A hundred units over thirty frames is a rattle,
  not a hundred events; every emitter thins to the ear's resolution
  (`MIN_GAP`, 3.2 frames) keeping the first and last hit. `thin` is
  **greedy on frames, not evenly spaced on indices** — sampling one index
  in three of an eased curve leaves the crowded end crowded.
- **Below about 8 frames a run is one gesture, not N events.** A grid of
  14 prints in FOUR frames — `PRINT_STAGGER` is 0.3 — so it gets a single
  `slide`. Two disconnected pops describing something the eye saw as one
  fill is worse than one honest sound.
- **Rate carries the shape, not extra samples.** An accelerating ratchet
  is ONE click at a rising `playbackRate`. Twenty samples would be twenty
  files to license, store and keep in step.
- **Ticks go at equal PROGRESS, through the ease's inverse.** Feeding the
  tick index straight into the ease looks right and is backwards: the
  odometer shipped one render with an accelerating ratchet and its last
  three teeth on a single frame. `progressFrames` is the only way to place
  them.

The constants in that file **mirror the .tsx components and cannot import
them** (a .mjs cannot read TypeScript — the same arrangement as
`src/lab/tier-fit.mjs`). Change a timing constant in an element and change
it there; the symptom of drift is a sound landing beside its animation
instead of on it.

**`npm run sfx:audit` is how you check that in a second** rather than in a
three-minute render. It prints hits, span and tightest gap per element and
names three failures: an emitter returning nothing, two hits inside one
gesture, and a hit landing past its beat — which also means the element's
animation is being cut off. It found eight on its first run, three of them
real bugs. `npm run sfx:audit -- --kit` lists the takes and their lengths.

A post's own `sfx.map` override still beats the emitter, which still beats
the type map below.

### The event map — restraint is the design

A sound on every cue is noise, and noise reads as a mobile game rather
than an instrument. The default sounds the events where something
**lands** — a thing arriving in a place that was waiting for it — and
stays silent wherever a value merely grows.

| element | event | sound |
|---|---|---|
| `table` | each row | a hammer — and the total, which is a verdict, `stamp` |
| `figure` `clip` | the specimen arriving, then its receipt row | `shutter`, then a hammer |
| `recording` | our own app moving | `click`, then a hammer |
| `media` | a still we photographed off a page | `shutter` — **video excerpts stay silent** |
| `stat` | the hero number | `stamp` — and it falls back to the cut, because a stat often carries no `[+]` at all |
| `flag` | each country landing in the row | a hammer |
| `endcard` | the cut into it | `tear` |

The `endcard` is the one entry that does not hang off a `[+]`: the beat is
silent by construction, so there is no cue and no spoken gap to land in.
It fires on the cut, which is the event.

Silent by default: `mockup` (the phone rises, nothing lands), `title` and
`cta` (words — the voice is already saying them), and `media` when the
file is a **video**. That last one is a rule about someone else's
material: an effect over a face reads as our sound on their footage, and
if the excerpt is unmuted a click on top of a sentence is just a click on
top of a sentence.

The old version of this list also held `barchart`, `unitgrid`, `odometer`
and `flow`, on the argument that *a bar grows, it does not land*. That was
true of a map keyed on cues and false of an emitter — growth has a shape,
and a ratchet is how a mechanism reports one. The argument it was really
making survives as the reason none of them got a landing sound.

Turn one on or off per post when a beat genuinely earns it:

```json
"sfx": { "volume": 0.16, "map": {
  "lab:barchart": "stamp",
  "table": "off",
  "lab:flow": { "each": "nib", "last": "stamp" } } }
```

### Levels — the bed's contract, one metric different

Each file is normalized on the way in to the **voice's own loudness**, so
`volume` is a real dB offset, exactly as for a music bed. The one change:
a 200 ms click has no integrated loudness — R128 measures 400 ms blocks
and gates the rest, so `loudnorm` reports -70 LUFS and helpfully
normalizes the noise floor. The metric is **momentary max** instead: the
loudest 400 ms window, measured on the file padded with silence. Target
-26 LUFS, hard peak ceiling -3 dBFS. Default `volume` 0.2 — **14 dB under
the narration**.

Measured on the `vitamin-k-tier` A/B (11 effects, 65 s): both files
deliver at **-14.2 LUFS / -1.3 dBTP**, identical — the effects add
nothing to the delivery level and nothing clips. Isolated in the 1.25–
4.75 kHz band the print sits at -32 dBFS across all ten placements
(the normalization holds), against a local voice level of -14 to -22 dBFS
— a gap of 10 to 19 dB, median 15. `phosphorus-additive` rendered as an
audition (7 effects, table rows and a `stat`) lands at the same
-14.2 LUFS / -1.3 dBTP.

**What has actually been heard in a render, and what has not.** Rendered
and frame-verified: `tierlist` items, `comparison` rows and its verdict
stamp, the `figure` row, `table` rows, `stat`. Never rendered: the
`table` **total** stamp (it takes the same code path as the comparison
verdict, which was verified, but no rendered reel has fired one),
`recording`, `clip`, and every override sound including `tick`. Treat
those as untested rather than as covered.

**And they land in the breath, by construction.** A `[+]` marks the word
the writer wanted a part printed on, and that word is almost always
sentence-initial; the TTS assembles sentences with a 140 ms gap and
trimmed edges, so the cue frame falls in the pause before the line, not
on top of it. Measured across ten posts: **79 of 81 effects fire inside a
speech gap** — the transient in the silence, the decay running under the
first syllable, which is what a foley editor would have done by hand. The
two exceptions were both a `print` on a mid-sentence cue. If an effect
ever smears a word, the fix is one fewer effect, not an offset.

### Room tone — the floor, not a fill

```json
"reel": { "roomtone": true }          // or { "volume": 0.05 }
```

**It is not there to fill the gaps between words.** Those run about
140 ms and are already occupied by the previous word's decay. What it
fixes is the floor of the whole track: our silence is a mathematical
zero, and the ear reads an absolute zero as the audio having dropped out.
It is most audible at a hard cut between beats and under the `endcard`,
which carries no voice at all.

So it is continuous, under everything, and far lower than an effect:
**-30 dB under the narration** against -14 for the kit. Being continuous
it also takes the *integrated* loudnorm path (R128 applies properly to a
bed, unlike to a 200 ms click), which is the music bed's contract — so
`volume` is a real dB offset there too.

Felt, never heard. If you can point at it, it is 6 dB too loud.

## Music

`"music": { "file": "bed.mp3", "volume": 0.12 }` in the reel block loops
the file from `posts/music/` (gitignored) under the voice for the whole
reel.

**Use real music — that is the platform's own model** (Martin,
2026-08-02): TikTok licenses the catalog, the artist is paid through it,
and a known sound is discovery leverage. Two ways in, and the second is
now the default:

1. **Baked** — Martin downloads the track into `posts/music/` and the
   render mixes it under the voice. Only he can supply a commercial
   track; the assistant can only fetch public-domain or CC-licensed
   audio, and that pool (PD classical, documentary CC) reads sleepy at
   reel pace — it was tried and cut.
2. **Native, at post time** — render with no `music` key at all, then
   pick the sound inside TikTok. This is the default: it enters the
   sound's pool, the artist is paid by the platform, and nothing can be
   muted for rights. The voice track stays intact underneath.

Picking: TikTok Creative Center → trending sounds (filter US) is the
live chart; inside the app, check what the explainer/nutrition accounts
run under narration. The register still rules the choice: minimal,
instrumental, no drop, nothing that competes with a spoken voice.

## Posting

Same protocol as `SOCIAL.md` — the Mac renders, the phone publishes. The
reel ships with its voice as original audio; if a trending sound goes
under it, it goes under quiet, in the app, and it is never a meme sound.
Caption file, comment gate and timing rules unchanged. `npm run ship`
carries the reel: the MP4 rides beside the slides, the drop page plays it
inline and offers a download, and the board's detail view leads with it.

The same MP4 goes out on TikTok, Instagram Reels and YouTube Shorts. Mark
each one on the board — the buttons are per platform — because which
platform carried a video is the only thing the numbers can be read by
later, and a mark that assumes TikTok makes the platform that works
invisible.

**The caption you copy leads with the YouTube title.** Write the title
once, in the spec's `youtubeTitle`; `postedCaption()` in `scripts/stage.mjs`
puts it on the first line, a blank line, then the body, and every surface
that hands you a caption goes through it — the drop page, the board, the
ledger's state. The `.txt` file stays the body alone on purpose: a string
that lives in two files diverges the first time somebody edits one, which
is the same argument as the sfx register and `posts/art/LICENSES.md`. It
is idempotent, so a caption that already opens with its title is left
untouched.
