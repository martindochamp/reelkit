# Slides — social slideshows from the receipt system

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

TikTok photo-mode / IG-carousel slideshows rendered from the same tokens as
the store screenshots. A post is a JSON file; the output is a folder of PNGs.
No design tool in the loop.

## Workflow

```
# 1. Write (or copy) a post spec
posts/<name>.json

# 2. Render — all posts, or just the ones named
npm run slides
npm run slides cheers skyr

# 3. Post
out/slides/<name>/01.png … NN.png → TikTok photo mode / IG carousel
```

AirDrop the folder to the phone; TikTok and IG both take the PNGs in order.

The same post can also ship as a **reel** — its own spoken script under a
`reel` key, not the slides read aloud: `npm run reel <name>` →
`out/reels/<name>.mp4`. `REELS.md` owns that format.

## Post spec

```json
{
  "format": "tiktok",          // 1080×1920; "carousel" → 1080×1350 (IG)
  "theme": "light",            // or "dark" (reads raw-dark/ captures)
  "footer": "A receipt for the day",
  "slides": [ … ]
}
```

Six slide types — all text is uppercased by the layout, write sentence case:

| type | fields | use |
|---|---|---|
| `hook` | `text`, `kicker?`, `sub?` | the scroll-stopper, slides 1–2. `*…*` in `text` prints Heavy, the rest drops to Regular — weight is the only contrast |
| `statement` | `value`, `label?`, `line?` | one hero number, dry line under |
| `lines` | `rows[{left,right}]`, `title?`, `total?`, `specimen?` | a receipt tape |
| `shot` | `file`, `caption?` | app capture in a specimen frame |
| `art` | `image`, `title?`, `value?`, `line?`, `kicker?` | ASCII specimen — see below |
| `verdict` | `stamp?`, `day?` | the KEPT stamp — see rule below |
| `cta` | `lines?`, `button?` | last slide, wordmark + App Store chip |
| `element` | `element`, `props`, `frame?` | a lab element's settled end state as a still (charts, grids, meters, tier lists… — REELS.md, "The lab"). tiktok format only |

**Write µg freely.** CSS `text-transform: uppercase` maps the micro sign to a
Greek capital Mu, which SF Mono draws as an M — "184 µg" printed "184 MG",
wrong by a factor of 1000. `mu()` in `src/tokens.ts` shields the sign; every
uppercased string that can carry a unit goes through it, in `Slides.tsx` and
in the lab elements. Add it to any new element that prints a value.

TikTok shows photo posts inside the reel UI — the caption and sound own the
bottom ~340 px, the button rail the right edge. The `tiktok` format keeps
that zone empty and drops the footer entirely; `footer` prints on `carousel`
only, where the full page is visible.

`shot` files come from `fastlane/screenshots/raw/` (or `raw-dark/` when the
post theme is dark) — the same captures the store pipeline uses. Mock data on
a `lines` slide gets `"specimen": true`; the honesty rule follows the content
out of the app.

## ASCII art slides

An `art` slide prints a photo as ASCII in the receipt's own ink — SF Mono
glyphs, one color, density is the shading. `image` names a file in
`posts/art/`; the conversion happens inside `npm run slides`, no manual step.
`title`/`value` set the receipt row under the art, `line` the faded
provenance line ("Magnesium per 100 g").

The converter (`scripts/img2ascii.mjs`, after alexharri.com/blog/ascii-rendering)
matches each cell's 2×3 darkness vector against the measured ink coverage of
every printable glyph, so contours pick `/ \ | _` on their own. Preview any
image in the terminal before committing to a slide:

```
npm run ascii posts/art/almond.jpg -- --cols 56
```

Per-slide tuning, all optional: `cols` (default 64; the slide auto-scales the
font, so more columns = same size, more depth — ~72 is the sweet spot on
tiktok: shapes resolve, glyphs still read as type; past ~90 small subjects
dissolve into flat gray), `contrast` (edge crunch,
2.5), `gamma` (<1 fills midtones in), `floor` (paper threshold, 0.08),
`invert`, `trim: false` (keep dead margin), `cutout: true` (remove the
background first), `crop: [x, y, w, h]` (fractions of the source — frame a
few clear shapes out of a busy photo; applies after cutout, before trim).

What converts well: **one subject, isolated on white or transparent** — the
paper is the background. Dead margin is auto-cropped. Full-bleed textures
come out as a wall of noise; don't ship them. A busy background is not a
dead end: `cutout: true` runs the photo through the example rembg
endpoint (`bg.example.com/api/v1/icons/remove-bg`) and caches the
transparent result next to the source as `<name>.cutout.png` (gitignored,
regenerable) — one network call per image, ever. Pale subjects on paper keep
only their edges; pair `gamma` ≈ 0.7 with `contrast` ≈ 1.8 to ink the
interiors without flattening them.

The bar for a source image: **few objects, big shapes, paper around them** —
a bar of chocolate beats a pile of twenty nuts, and no crop saves a
full-bleed texture. Always eyeball `npm run ascii` before the slide ships;
the photo you'd choose for a moodboard is not the photo that converts. Same glyphs print in both
themes — dark mode just swaps paper and ink, like the app.

**Judge a candidate at ~34 columns, not at 72.** It separates a specimen from
a texture faster than any measure in the score, and it costs one command:

```
npm run ascii posts/art/<file>.jpg -- --cols 34
```

A full-bleed heap on white passes every silhouette test there is — it is one
connected blob with paper around it — so it scores high while being exactly
the full-bleed texture no crop saves. Narrow the grid and it stops pretending.
Worked example, from the broccoli sweep: at 72 columns a dense floret
close-up (score 94) and a head with a stalk (89) look comparable; at 34 the
close-up is a solid dark mass with no readable form, while the stalk still
draws a broccoli. The tile is also the real target — a cover specimen is
drawn at ~30 columns, so the narrow grid is what a reader meets first.

Not a second score: the same cutouts scored at 34 columns separate promoted
stills from dropped candidates *worse* than at 72 (AUC 0.61 vs 0.65, same
labelled set as `scripts/ascii-score.mjs`). The narrow grid is a better look,
not a better number. `npm run art:batch` therefore prints every shortlisted
candidate twice, 72 and 34 side by side, and flags — never re-ranks — the
ones whose tile collapses.

Sourcing: `npm run art:find "<query>"` sweeps Unsplash + Pexels (keys in
`.env`, gitignored), drops candidates into `posts/art/_candidates/` and
prints each one as ASCII with its ready-to-paste license row — judge the
conversion, never the photo. Every image in `posts/art/` has its row in
`posts/art/LICENSES.md` (CC0, Unsplash or Pexels license); keep it that way.

**Stamp red** appears on the `verdict` slide only — it depicts the app's
evening verdict, exactly as the app draws it. It is never chrome, never
emphasis, never a third color anywhere else in a post.

## Tier lists

The internet's ranking format, printed instead of colored. It is a lab
element, so it rides in as an `element` slide:

```json
{
  "type": "element",
  "element": "tierlist",
  "props": {
    "title": "Magnesium, ranked by one realistic serving",
    "unit": "mg per serving",
    "tiers": [
      { "tier": "S", "note": "80 mg+", "items": [
        { "label": "Pumpkin seeds", "value": "156 mg" },
        { "label": "Dark chocolate", "value": "91 mg" }
      ] },
      { "tier": "A", "items": [{ "label": "Almonds", "value": "77 mg" }] },
      { "tier": "B", "items": [] },
      { "tier": "D", "note": "under 15 mg", "items": [
        { "label": "White rice", "value": "9 mg" }
      ] }
    ]
  }
}
```

`title`, `unit`, a tier's `note` and an item's `value` are all optional —
a tier list can be labels only. **3 to 6 tiers, 1 to 4 items a row**;
past four the reader is skimming a table, not reading a ranking.
**Tiers print in the order given — the element never sorts them.** An
empty tier prints a dashed slot with an em dash: the row stated the bar,
and nothing cleared it.

**Long names are the element's problem, not yours.** Every value is
pinned to its chip's floor — that column of numbers is what the board is
read by — so the element measures each row's names against the column it
actually has and takes the NAME's type size down until they clear the
value's band. The number never shrinks, all chips in a row share one
size, and nothing ever crosses a chip edge. Write the name you mean:
"Orange juice, calcium-added — 1 cup" prints at 23 px over three lines in
a two-item row and the number still lands on the floor. (Before
2026-08-04 it did not: a three-line name pushed its value through the
bottom border and broke the alignment. If you find yourself abbreviating
a food to make a chip behave, that is a bug — report it.)

### The four rules of a readable board

Fitting is not reading. The element guarantees that nothing overflows a
chip — it will print 15 px of grey rather than cross an edge — and 15 px
is not text. So the renderers run the element's own arithmetic before
they spend a frame and **warn** when a row was fitted under 18 px:

```
WARN  serving-tier slide 4 · tierlist S — names fitted to 15 px, 4.3 pt on a reel (floor 18 px / 5.2 pt).
      6 tiers with values — take the board to 5. A tier list is judged on the reel — SLIDES.md, "Tier lists".
```

It warns, it never blocks: a board of one-word foods reads where a board
of USDA descriptions does not, so this is your call. But the four rules
below are measured, not opinion (2026-08-04, the `serving-tier` board).

1. **Judge every tier list against the reel, never the carousel.** A lab
   element is authored against the 210→1360 band and the reel scales it
   to 210→1120 — ×0.791 — so authored px are not what the phone shows
   there. On a 393-pt handset a reel turns 25 authored px into 7.2 pt,
   19 px into 5.5 pt, 15 px into 4.3 pt. The reel is always the stricter
   surface: what reads there reads in the carousel, and the reverse is
   not true.
2. **Values plus six tiers: do not.** Six banded rows carrying numbers
   fit real food names at 15 px. Five tiers still lands at 24 px. Six is
   viable **labels only** — with no number to clear, the same board
   recovers to 23 px.
3. **Two items a row for anything that must be read.** Three is the
   ceiling, and only on the carousel (20–24 px, three-line stacks).
   Four is a table, not a ranking: 19 px, and every real name breaks
   into a four-line column the eye spells out instead of reading.
4. **Name length is not the constraint — row load and tier count are.**
   A row is fitted to its LONGEST name, so shortening one chip buys
   nothing: "Orange juice, fortified — 1 cup" (31 characters) and the
   abbreviation "OJ, calcium-added" both print at 25 px beside the same
   yogurt chip. Zero type bought — that was a word-choice problem
   answered with a mechanical hack. Keep writing the full name; spend
   the room on fewer chips and fewer bands instead.

**A number never leaves its unit — and the chip enforces that itself.**
"YOGURT, PLAIN — 6 / OZ CUP" is not a serving, so `tier-fit.mjs` ties the
quantity to what measures it before the wrap ever counts the line: a space
becomes unbreakable when the run in front of it ends in a digit and the
word after it is letters only, up to twelve of them (cup, tsp, tbsp, oz,
g, mcg, µg, ml, piece, container, tablespoons — a length, not a list, so
next week's unit is covered too), or a bare % or °. Type the name the
plain way; the break moves, never the size. **Do not type a non-breaking
space** — the boards written before 2026-08-05 carry sixteen of them and
they are now redundant, not wrong.

Three things it does not tie, because it cannot: a unit written before
its number ("mg 400"), a unit longer than twelve letters, and a pair
wider than the chip's own column — the last one stays breakable on
purpose, since an unbreakable "1 CONTAINER" in a ten-character column is
guillotined into "1 CONTAINE / R", which is worse than the orphan. If you
see a number land alone, the row is too full: that is rule 3, not a
wording problem. And the rule still governs everything the element does
not draw — the spoken lines above all.

**No color band.** The ranking is drawn in ink alone: S is a solid block
with its letter reversed out in paper, each tier below it the same ink at
a lower alpha, the last one an outline on bare paper. Stamp red stays
where it belongs. The ramp is positional, so three tiers spread over the
same range five tiers land on exactly — which is why the letters are free
("S+", "F", anything).

As a reel screen the same props take **one `[+]` cue per item** —
REELS.md, "The lab".

## Covers — the still that sells the post on a grid

```
npm run cover                # every post with a cover block or a hook
npm run cover creatine zn    # just these
npm run cover -- --posted    # only what the board calls SHIPPED or POSTED
```

Three outputs per post:

| | |
|---|---|
| `out/covers/<name>.png` | 1080×1920 — the file you upload |
| `out/covers/tile/<name>.png` | 1080×1440, the 3:4 tile pre-cut — what TikTok's desktop uploader asks for |
| `out/covers/proof/<name>.png` | the proof sheet: the same cover as every surface crops it, at the pixel size the tile really occupies |
| `out/covers/proof/_grid-N.png` | the whole set as a profile grid, three across, 130 pt tiles |

Add `--audit` to any of those to run the arithmetic and skip the frames.

**A cover is not a slide and not a reel frame.** In the For You feed and the
Reels feed the video autoplays — no click, no thumbnail, and the reel's own
first frame does the work. A cover decides only where a tile sits still and
waits: profile grid, search, Explore. For an evergreen account that is the
long tail and the profile-visitor conversion.

### What the platforms actually do (measured 2026-08-05)

Neither platform publishes its grid geometry, so this was measured, not read:
headless Chrome at 430×932 / DPR 3 with an iPhone agent, reading
`getBoundingClientRect()` off the live DOM.

| Surface | Columns | Tile | How |
|---|---|---|---|
| TikTok profile grid | 3 | 142.7 × 189.8 → **0.7515 ≈ 3:4** | measured, 120 tiles |
| TikTok hashtag grid | 3 | 143 × 190 → **0.7526** | measured, 75 tiles |
| TikTok search | **2** | 203 × 272 → **0.7463** | measured, 112 tiles |
| Instagram profile grid | 3 | 142 × 190 → **0.7474** | measured, 84 tiles |
| Instagram Explore | ? | **not established** | logged-out Explore redirects to the login wall |

Instagram paints its tiles `object-fit: cover; object-position: 50% 50%`,
which settles the crop anchor outright: **centre, both axes.** TikTok's tiles
came back as unstyled placeholders behind the GDPR modal, so centre is an
assumption there — corroborated by its desktop cropper, which defaults to a
centred 3:4 frame.

**Two assumptions this research killed.**

1. **"The grid is square" (Instagram) — wrong since January 2025.** Mosseri
   announced the move to 3:4 portrait tiles then
   ([post](https://www.instagram.com/mosseri/p/DFBmKBBy24A/),
   [9to5Mac](https://9to5mac.com/2025/05/29/instagram-changes-standard-photo-aspect-ratio/),
   which also dates 3:4 *feed* support to 2025-05-29). Half the guides online
   say the tile is 4:5 — they are conflating the upload ratio with the tile
   ratio. The measurement settles it: 142 × 190 = 0.747.
2. **"TikTok tiles are taller than Instagram's."** They are not; both are 3:4
   within half a percent. The design had been built against a 1:1.335 TikTok
   tile, which is a different crop and a different safe band.

Instagram's own help page is stale and contradicts the product: it still says
covers are 420×654 and "you can't edit your cover photo after you've
uploaded it" ([help.instagram.com/1038071743007909](https://help.instagram.com/1038071743007909)).
Both halves are dead — see below.

### Can you even upload one

- **Instagram: yes, both ways.** "Add from camera roll" in the cover editor at
  post time, and ⋯ → Edit → Cover afterwards. The grid crop is adjustable
  *separately* from the cover ("Crop profile image" / ⋯ → Edit → Adjust
  preview), so a cover that survives a centre crop is a floor, not a ceiling.
  ([Later](https://later.com/blog/instagram-reels-cover-photo/),
  [Hootsuite](https://blog.hootsuite.com/instagram-reels-cover/))
- **TikTok: yes on desktop, probably on mobile, officially neither.**
  tiktok.com/upload → Edit cover → **Upload cover**, JPG/PNG, and it asks you
  to crop to **3:4** — the tile, not the 9:16
  ([RouteNote](https://routenote.com/blog/upload-tiktok-thumbnail/)). Camera-roll
  cover upload reached the mobile app around 2024-07-22
  ([Lindsey Gamble](https://www.lindseygamble.com/blog/tiktok-allows-the-uploading-of-custom-thumbnail-covers)),
  but **TikTok's own help page still documents frame-selection only** —
  "tap Select cover… drag and place the frame anywhere on the video"
  ([support.tiktok.com](https://support.tiktok.com/en/using-tiktok/creating-videos/editing-posting-and-deleting)).
  Treat mobile upload as region- or account-gated. After posting, the cover
  can be changed for **7 days** only.
  **Consequence: on TikTok the reel's own first frame must survive as a cover
  too**, because on any account where upload is not offered, that frame IS
  the cover. Do not design a cover that only works as a separate file.
- Photo mode / carousel: the post screen offers "Edit cover"
  ([support.tiktok.com](https://support.tiktok.com/en/using-tiktok/creating-videos/making-a-post)),
  but whether it accepts a non-slide image is not established. Assume slide 1.

### Chrome, and the safe band

TikTok stamps the **view count and play icon over the bottom-left** of a grid
tile. On search-result tiles the caption sits *below* the artwork, not over
it, so search costs nothing. Instagram's tile glyphs (reels, carousel,
pinned) could not be located from any official source and the logged-out
grid renders bare `<img>` tiles — **not established, and not invented.**

Neither platform publishes an organic safe zone. The numbers that circulate
("14 % top / 20 % bottom") are Meta's **ads** guidance, and even there the
current figures — 14 % top / 35 % bottom / 6 % sides — appear only inside the
diagram image, never in the prose
([facebook.com/business/help/980593475366490](https://www.facebook.com/business/help/980593475366490);
the one number written in text is "leave the bottom 40 % free" for
disclaimers). TikTok's safe zone ships as downloadable ad overlay .zips with
no inline pixel numbers.

So the band is derived, not quoted. Every tile is a centre crop of the full
width, so only the vertical band is ever in question:

```
3:4  →  1440 rows, centred   →  y  240 … 1680      every measured surface
1:1  →  1080 rows, centred   →  y  420 … 1500      Explore, IF still square
```

**Everything a reader must read lives in y 444…1476** — the square, minus 24
rows of margin for the rounding a device does laying a grid out in points.
`COVER_SAFE_TOP` / `COVER_SAFE_BOTTOM` in `src/cover-fit.mjs`. The rest of
the frame is bleed. TikTok's view count lands at rows 1500–1680, which the
band keeps empty for free.

### Two numbers that change how you draw

Three tiles across a 390-pt handset, gutters near zero, is a **130 pt tile**.
1080 authored pixels are shown across 130 pt — **8.3 px to the point.**

1. **Nothing is authored under 90 px.** 11 pt is the floor where type stops
   being read at arm's length, 14 pt is comfortable. The headline runs
   110–260 px and the hero token twice that. At the 110 px floor a line holds
   **12 characters** — so the real constraint is not word count, it is word
   packing, and a cover carries roughly 36 characters where a slide carries a
   sentence.
2. **Hairlines die.** 130 pt at DPR 3 is 0.36 device px per design px, so the
   receipt's 2 px rule lands under one device pixel and renders as grey haze.
   On a cover a rule is **8 px** (`COVER_RULE`) or it is not a rule. This is
   the one place the cover does not copy the slides.

### The shape of a cover

**A hero token, three or four words, and a specimen.** The token is read, the
figure is recognised, and they do not compete because they answer different
questions. A grid of twenty purely typographic tiles has no silhouette and
every tile looks like the tile beside it — that was the first pass, and it is
the thing to avoid.

```json
"cover": {
  "value": "3–5 g",
  "text": "The *tested* tub",
  "kicker": "Nutrient file 014",
  "line": "EU reference, per day",
  "invert": true,
  "specimen": { "type": "art", "image": "capsule.jpg", "cutout": true }
}
```

Only `text` is required. Without a `cover` block the renderer derives one
from the post's first hook and its first figure, so every post in the bank
has a tile — but a derived cover is a safety net, not a deliverable. The
hooks are written for a full screen and most of them are twice a tile's
budget.

- **`text`** — three or four words. `*…*` prints Heavy against Regular, the
  same emphasis grammar as a hook slide; weight is the contrast. Two lines of
  a tile is the whole reading budget once a figure sits under them: about
  **24 characters**, and a line holds 12, so one long word can miss the box
  on its own.
- **`value`** — the hero token, printed at about 1.5× the headline with a
  figure and 2.1× without. This is the SIZE contrast, and it is the one thing
  still legible when the tile is a thumbnail of a thumbnail. It never wraps.
- **`specimen`** — one of three registers, below.
- **`invert`** — solid ink, paper type. Two inks give exactly one way to be
  the loudest thing in a grid of twenty tiles, and an inverted tile is its
  own silhouette, so a cover with no honest specimen can still carry weight.
  Spend it on one tile in seven.

### The three specimen registers

| | | |
|---|---|---|
| `rows` | two or three receipt lines, the post's own two numbers side by side | the workhorse — always legible, always honest, needs no artwork |
| `art` | an ASCII figure from `posts/art/` | a silhouette, and only for subjects that convert DENSE |
| `element` | a lab element's settled end state, photographed through `ElementFrame` and trimmed to its own ink | `unitgrid` is the one that reads: a field of blocks with one lit |

A table's labels must be **short**: the type is capped by the widest row, and
`ARTICHOKE 13 G` prints at 10 pt while `ARTICHOKE, STEAMED, 120 G 13 G`
prints at 6. Put the portion in the headline when the row cannot hold it.

**A lab element is a slide, not a tile, unless its meaning is a SHAPE.** A
flow diagram or a comparison table is prose in boxes; scaled into a cover
band its own 30 px labels land near 2 pt, which is dust with a border. In
practice `unitgrid` carries this register — `1 of 34`, `1 of 63`, `5 of 24`
are four different fields and four different tiles. Do not put an element on
an inverted cover: the staged still bakes its own paper in.

**Density decides an ASCII figure, not size.** Measured by downsampling
finished tiles to the 130 pt a real grid gives them and looking: mean ink
coverage of the glyphs, on `img2ascii`'s own scale. A capsule at 0.51, a
pill bottle at 0.51, sunflower seed at 0.48, a scallop at 0.46 and an orange
at 0.44 read as shapes at 1×. Spinach at 0.36, a mussel at 0.34, a dumbbell
at 0.28 and cocoa powder at 0.14 read as nothing at all — a sparse subject
drawn twice as large is still a scatter of pale marks. **The fix is always a
different subject or a tighter crop, never a bigger band.** `SPECIMEN_INK_MIN`
in `src/cover-fit.mjs` is the floor and `npm run cover -- --audit` prints the
number.

**The column count comes out of the band, not out of a constant.** The slides
draw at 72; the first cover pass copied 30, and at 30 a figure that fills its
band prints glyphs near 4 pt — a grey stain with a rule over it. So the glyph
size is picked first (`SPECIMEN_GLYPH_TARGET`, 52 px ≈ 6.3 pt) and the
columns are however many fit at it: a wide subject earns 26 and keeps its
detail, a square one drops to 14 and prints blocky, which is what survives.
The renderer converts twice — once at a probe to learn the subject's aspect,
once for real. `cols` on the specimen still overrides.

### The audit, and the proof

```
npm run cover -- --audit --posted    # arithmetic only, no frames spent
npm run cover -- --posted            # render
```

`--audit` resolves every cover, runs the still's own arithmetic and prints one
line per tile with the headline and hero sizes in tile points. It warns, never
blocks — same call as the tier list. Four floors fire:

```
WARN  zn cover — headline is 30 characters over 7 words; the box holds 24 in
      2 lines of 12. It printed at 110 px (13.2 pt on a tile) over 3 lines,
      2 allowed. 7 words over 3 lines; the box holds 2. Three or four words.

WARN  mg cover — specimen glyphs at 35.6 px (4.3 pt on a tile, floor 44 px).

WARN  x cover — "kale.jpg" converts at 0.35 ink (floor 0.42). At 130 pt this
      figure is a scatter of pale marks, not a silhouette.

WARN  biotin-assay and multivitamin carry the same specimen (art:capsule.jpg).
      On a grid the pair reads as one post printed twice.
```

That last one is the defect a single cover cannot show you, and the reason
the grid sheet exists.

Then **look at the proof sheet.** It prints the cover as each surface crops
it, twice: at 3× (the device pixels a retina tile really gets) and at 1×
(roughly what the eye resolves at arm's length). If the headline does not
read on the 1× strip, the cover is not done. `_grid-N.png` is the same test
for the whole set at once — three across, which is the only place this
artwork ever competes.

## Voice on slides

Same rules as the app, no exceptions: dry statements, zero exclamation marks,
uppercase mono, no emoji inside the images. The caption under the post can be
looser; the paper cannot.

**Active voice. Third-grade reading level. A person or a food does the verb.**
Dry is not the same as literary, and the drafts kept drifting into the second
one. Three tells, all of them from real slides that shipped:

| Tell | Draft | Fixed |
|---|---|---|
| An abstract noun does the verb | "The capsule is not expensive. It is unmeasured." | "You buy the pill because nobody counted your food." |
| The clever negation | "A number you cannot absorb is not a number." | "Your body throws most of it away." |
| Literary scene-setting | "This is where the plant kingdom runs out." | "Plants are bad at zinc. All of them." |
| The compressed fragment | "An ordinary day already clears it. 120 %, with no plan at all." | "You probably eat enough zinc already." |
| Naming the setting, not the thing | "The shelf sells 50 mg." | "Most zinc supplements hold 50 mg." |
| A slogan where a question belongs | "One day, counted, answers it." | "If you think you run low on zinc, count one day of food." |

The test: read the line out loud. If you would not say it to someone across a
table, it does not go on the paper. Short words beat exact words — "takes"
over "absorbs", "leaves" over "is excreted", "pill" over "capsule". One idea
per sentence, and no sentence that needs a comma to survive.

This is a register, not a dumbing-down: the numbers stay exact, the sources
stay named. Only the grammar gets simple.

## The brief — four lines, written before the JSON

Files 003–006 are all correct and half of them are dead. The fault is the
same in each: **they open on a supply-side fact when the reader arrives with
a demand-side problem.** "364 mg of magnesium per 100 g. One food." is the
generator's own placeholder, shipped unedited — it states an inventory, and
nobody scrolls for an inventory. The number is the *proof*. It was being used
as the *hook*.

So no post starts in `posts/`. It starts as four lines in a commit message,
a note, anywhere:

| | |
|---|---|
| **DEMAND** | The reader's problem, in their words, before any nutrient is named. "My stool is a project." "I pay $200 a year for a pill I have never verified." Not "iron is important". |
| **TURN** | The one thing the post corrects. It must be *a slide*, not a caption — the swipe is bought by the correction, not by the list. If a post has no turn, it is a table, and a table is not content. |
| **PROOF** | The arithmetic that settles it. The tally clearing on the last portion, the panel with two lines under 100 %, the absorbed percentage. This is where the data goes, and it is the only place it goes. |
| **ASK** | One keyword, one open question. Both change every post. |

The demand is the only line the data cannot supply and the only one that
decides whether the post is watched. Write it first, in a sentence you would
say out loud, then go find whether the table agrees. **If the table
disagrees, the table wins and the brief gets rewritten** — that is the whole
value of owning `ciqual.json`. Twice already the data has been better than
the brief: "which B am I missing" turned out to be "four of your seven come
from a 1941 milling standard", and "7 foods to raise testosterone" turned out
to be a 20-week restriction experiment that says the opposite.

### Hook mechanics — rotate, never repeat two files running

Weight is the only contrast on a hook slide, so the *mechanic* is what keeps
the series from reading as one post published nine times.

| Mechanic | Shape | Used by |
|---|---|---|
| The false leader | Name the food everyone names, then beat it | 007 fiber (artichoke vs oatmeal) |
| The price tag | A dollar figure against a food figure | 008 magnesium |
| The broken instrument | The chart is right and useless | 009 iron (49 mg, 3 % absorbed) |
| The experiment | A real study's before/after, as the opening line | 010 zinc (20 weeks, testosterone to a quarter) |
| The hidden author | Reveal who actually put the nutrient there | Panel 001 (a 1941 standard, not a plant) |
| The famous one, demoted | The known food is the smallest number in the file | 005 potassium (the banana) |
| The removal | What the process takes out | 006 fiber (what milling removes) |
| The ceiling | A normal portion walks past a safety limit | 011 vitamin A (one plate of liver, 3.5× the limit) |
| The pinch | Right per 100 g, absurd per portion | 012 iodine (one gram of kombu, twice the ceiling) |
| The disagreement | Two sources, one food, numbers that cannot both be true | 013 selenium (USDA vs CIQUAL, 19×) |
| The short list | Ask the reader to name the sources, then let the list run out | 014 vitamin D ("name a food, now name a second one") |
| The deleted source | The authority everyone still quotes took its own document down | 014 antioxidants (the USDA's ORAC table, deleted May 2012) |
| The alias | The thing is on the package under a name that is not its own — so the reader has been looking in the wrong place | 014 phosphorus (phosphoric acid, sodium phosphate) |
| ~~The reversal~~ | ~~"Not a capsule. A seed."~~ | **Retired** — used twice (003, 005-draft), and it is the register of the grift accounts next door |

New mechanics are welcome; a repeated one is not. Check the last two files
before writing.

### Length — one message per slide, 12 to 20 of them

The eight-slide file was a habit, not a finding. Photo mode charges nothing
per slide and watch-through is the metric, so the constraint is *one clear
message per slide*, not a slide count. Twelve to twenty is the working range.

What fills them honestly: split a crowded slide instead of compressing it.
Seven B vitamins on one panel is a wall; seven slides, one vitamin each —
what it does, which food carries it, one number — is seven messages. The rule
that keeps this from padding: **if a slide has no message of its own, it is
not a slide.** A prettier version of the slide before it is padding.

### The last two slides are one unit

The real call to action is the **second-to-last** slide: the problem named,
then the solution, in the reader's own terms. The last slide is the sign-off —
mockup, one line, comment gate. Readers who quit at the mockup already got
the argument; the mockup only collects the ones who wanted the link.

So: turn slide → problem/solution slide → mockup. Never the mockup alone.

### Two rules the drafts kept breaking

- **The turn is a slide.** 005 put its best line ("a banana carries 320") on
  slide 7 and it is the only reason that post works. Make that structural:
  every file gets a turn slide between the receipt and the CTA.
- **The ask is not decoration.** `Comment "49" for the link` on a post whose
  hero number is 49 gives the reader nothing to gain. Gate on a word that is
  the post's own idea (`HEME`, `ZINC`, `PANEL`) and make the caption's
  question different every time — "which one surprised you" four posts
  running is one comment prompt, not four.

## The nutrient file format

The repeatable series recipe, proven on `posts/magnesium.json` (001):

1. **Hook** — the hero number in `*heavy*` against regular weight:
   "*592 mg* of magnesium per 100 g. Not a capsule. *A seed.*"
   Kicker `Nutrient file NNN` carries the series.
2. **3–4 art slides** — one food each, ASCII specimen at 72 cols. The
   `line` under each carries the honest portion ("A 30 g handful — 178 mg")
   and a **running tally** ("tally 178 / 375") — the reason to swipe is
   watching the counter clear the reference on the last portion.
3. **The day's receipt** — a `lines` slide: the same portions as rows, the
   EU reference as the last row, the total = the day's tally. The app's
   gesture, printed as a post.
4. **CTA** — comment gate on the hero number: `Comment "592" for the link`.
   One keyword per post = free attribution (the comments tell you which
   post converted). Answer by hand until an auto-DM tool takes over.

Honesty rules the format inherits: never claim "top N" of the raw CIQUAL
table (its literal top is dried seaweed nobody eats 100 g of); portions
over per-100g flattery; values from the app's own `ciqual.json`; the EU
NRV named as a reference, not a target.

## The account playbook

Superseded in part by `SOCIAL.md`, which owns accounts, cadence,
timing and the generated content bank. One correction it carries: the
angles below describe *audiences*, not accounts — running all four
formats on one account is what keeps a 3-a-day cadence out of
duplicate-content suppression.

One account = one angle. The pipeline makes volume cheap; the angle makes it
land. Suggested angles, each a distinct account with its own post cadence:

- **discipline / quantified-self** — verdict posts, day receipts, streak-free
  streaks ("Day 41. Kept."). `cheers`, `day41` are this angle.
- **label literacy** — scan stories, category drift, twin estimates
  ("A skyr with 2.4 g protein is not a skyr."). `skyr` is this angle.
- **training log** — session receipts, records in plain ink, prefill from the
  last real session.
- **build in public** — the instrument itself: design system, honesty rules,
  why no confetti.

Two to four accounts, run honestly. Platforms remove networks of accounts
posting duplicated content — the leverage here is one pipeline feeding
*different* angles, not one post copied eight times. Per post: 5–7 slides,
hook on slide 1, receipt in the middle, verdict or shot before the CTA, a
trending sound underneath, caption in the same dry voice.

## Cadence

Batch-write specs weekly (a `posts/` review is a code review), render in one
run, schedule daily. A post is a JSON diff — iterate on hooks by copying a
spec and changing one slide.
