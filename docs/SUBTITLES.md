# Subtitles

The caption band's look, as a class you can name and then override.

**Why the key is `subtitles` and not `captions`.** `theme.captions` already
exists and is the PROJECT's default look; `reel.captions` is already the mode
string. Renaming either would move the floor under every post that has one. So
the new key is `subtitles`, it carries the mode inside it, and **the theme
stays the base every preset is merged onto** — a project that themed its
captions keeps exactly what it had until a post asks for something else.

```
theme.captions      the project's default  (unchanged, still the floor)
reel.subtitles      this reel's look, over the theme
beat.subtitles      this beat's, over the reel's
```

## The eight axes

Everything a caption look is, and everything it can be (Martin, 2026-09-11 —
this list is his):

| axis | keys |
|---|---|
| the face | `fontFamily` |
| the colour | `color`, `ink`, `emphasisColor` / `emphasis[]` |
| the size | `fontSize`, and `floor` for how far the fit may take it |
| the case | `textTransform` |
| the letter-spacing | `letterSpacing` |
| the background | `background: {color, radius, padding}` — or `plate: true`, the old word for it |
| the stroke | `stroke`, `strokeColor` |
| the shadow | `shadow` |

Two of those eight did not exist a day ago and two more were declared and
drawn by nothing. The bank below is fourteen combinations of them, and the
only reason it is a bank at all is that a combination of eight values is a
thing you want to name once.

**A look picks a stroke OR a shadow.** They are two devices for one job and
the choice is a property of the letterform: a thick stroke on a tight or
light face eats the counters and the word stops being readable, so the heavy
grotesques take a `drop` and the rounded faces take 16 px of stroke.

## The floor, and the day it was not the floor

`CAPTION_DEFAULTS` in `src/lab/subtitles.mjs` is THE caption default — sans,
**66 / 700**, `-0.01em`, mixed case, no plate, 6 words, the reference's 0.42
dim and its gold. Measured, not chosen (Martin, 2026-09-09: *"les soustitres
avec la police espacements positions et autres est parfaite, ça devrait être
celle de défaut"*), and the teardowns agree across references: no plate, heavy
weight, mixed case, tight tracking, one accent colour.

**It lived in two places and they disagreed for a day.** The promotion landed
in `src/theme.default.ts` — which is what a project with *no theme at all*
gets — while `scripts/bundle.mjs` kept its own copy as a wall of `??`
fallbacks: 48 px, weight 400, `0.08em`, uppercase, on a plate, and the caption
face falling back to `mono`. That is the path every project that HAS a theme
takes, which is all of them. So the measured look reached exactly the projects
that do not exist, and the eight-preset sheet rendered on 2026-09-09 was
judged through SF Mono at 48/400/uppercase.

One object now, merged under whatever a project says. A project that wants the
receipt caption back states it — `.parity` does, because that fixture exists
to render a Tally post the way Tally does.

Not on a shot, unlike `field`: a caption page belongs to the spoken line, and
the line outlives the cuts inside it. The one thing that does follow the
picture across a cut is the band's **colour**, and that is `bandsOf`'s job —
legibility per frame, style per sentence.

```json
{ "subtitles": "hormozi" }
{ "subtitles": { "preset": "hormozi", "fontSize": 56, "emphasisColor": "#E2483D" } }
```

## Three keys that had never been drawn

`stroke`, `strokeColor` and `align` were declared in the spec typedef and read
by **nothing**. A key a post can write that silently does nothing is worse
than an absent one — it renders a reel that looks finished and is not, which
is this codebase's oldest failure shape.

- **`stroke` + `strokeColor` + `color` are now drawn.** A solid fill with a
  stroke around it, `paint-order: stroke fill` — without that order the
  stroke paints over the fill and eats half the letterform. This is the
  platform-caption look, measured on three independent references (ad-2
  System A ≈3 px black, speechify-ad System A ≈2–4 px, design-tips "hard
  black outline"), and all three measure **no shadow beyond it**, so a stroke
  suppresses the band's own spread. `color` names the fill, because the
  outlined look is white-on-anything rather than a caption that borrows the
  page's ink — over a paper beat the borrowed ink made it black on black.
  `emphasis[].outline` is the OPPOSITE construction: it hollows the glyph out
  and drops the fill.
- **`align` is gone rather than implemented.** One reference's growing line
  pins its left edge; every other measured band is centred, and the band is
  centred in `Reel.tsx`. Building for one reference's quirk is how a preset
  bank swells past what it measures.

## `saidWeight`, and the two literals it replaced

`page` mode had `fontWeight: i === said ? 800 : 400` written into
`Reel.tsx` — two literals that **threw the theme's own weight away**. A
project that measured 700 rendered every word at 400 with one at 800. That is
the thin caption every page-mode reel has had, including the casino rebuild,
while the same engine rendering the same words in `words` mode looked right.

The band's `fontWeight` now stands, and the word being said is lifted only if
the look names a `saidWeight`. Off by default, for two reasons that are both
measurements rather than taste:

1. **No reference does it.** Peterson holds one weight across ~40 caption
   cards; story-88-95's whole band is one weight, one size, one colour;
   speechify-ad has no per-word anything, verified across seven instances.
2. **On a proportional face it reflows.** A weight change alters the glyph's
   advance, so a centred line shifts under every word. It was invisible where
   the hack was written because that face was SF Mono, whose advance does not
   move — and the caption face is no longer mono.

## The bank

| preset | what it is |
|---|---|
| `plain` | whatever the project themed. A name for the floor |
| `card` | a solid plate under the words — the receipt look, the only one with a plate |
| `karaoke` | the whole line stands dim at **0.42** and each word snaps to full on its cue, in one frame. The line never reflows, so the viewer can read ahead |
| `accent` | exactly two colours ever appear; the gold follows the voice's stress and **persists** once printed, same size, same weight |
| `hormozi` | big, heavy, upper, two or three words, no plate |
| `hormozi-outline` | the same, with a **hollow** second emphasis level |
| `outline` | white fill inside a hard black stroke, sentence case. The platform auto-caption — the only look here with **three** independent measurements behind it |
| `beast` | the loud retention caption. `hormozi` plus that stroke, and **no numbers of its own** — see below |
| `peterson` | one gold, all caps, no emphasis and no dim state at all. Measured, and plainer than it looks |
| `chip` | black text in a white **rounded** plate, no stroke, no shadow. The UI-chip caption, measured twice |
| `editorial` | a heavy grotesque with a `drop` and no stroke — the classy-and-thick half of the stroke/shadow choice |
| `impact` | Impact, uppercase, 14 px of stroke. Condensed, so more fits the safe box at a size the rounded faces cannot reach |
| `whisper` | small and low, out of the way of the picture |
| `centred` | mid-frame, for a beat with no picture |

### `beast`, and where its numbers come from

The bank's rule is that a look is measured and not invented, so this is worth
being blunt about: **there is no MrBeast teardown in this repo.** `beast`
therefore carries no numbers of its own. It is written as a spread of
`hormozi` — itself measured on the chad reference, a 45 px uppercase cap with a
gold payoff word at 2.6× — plus the stroke measured on ad-2, speechify-ad and
design-tips. That spread *is* the difference between the two looks on screen,
and it is code rather than a claim in a comment.

Two things to check against a real reference before trusting it: whether there
is a drop shadow **under** the stroke (this has none, because none of the
measured references has one), and whether the emphasis colour moves per word
or holds per card.

**The face** is Martin's eye rather than a teardown — *"mr beast c'était un
peu comme du comic sans ms épais"* (2026-09-10) — and it is recorded as an
observation because that is what it is. It happens to agree with the one
letterform detail the measured references in this family keep repeating:
ad-2's *"bold, rounded-terminal geometric sans"*, speechify-ad's *"bold,
rounded/geometric sans-serif"*, the korean hook's *"rounded terminals"*.
`ROUNDED` leads with **Chalkboard SE**, picked off a five-face render — of the
faces a mac has, it is the one that *is* thick Comic Sans, where SF Pro
Rounded reads modern and geometric and Comic Sans itself has strokes too thin
to look heavy at all. The cost, stated because it is real: Chalkboard SE ships
Regular and Bold and nothing above, so the 800 is **synthesised** rather than
drawn. SF Pro Rounded is next in the stack and does carry Heavy and Black, so
`{ "preset": "beast", "fontFamily": "\"SF Pro Rounded\"" }` buys a real one.

And a thing worth knowing before choosing a ground for it: **a black stroke
does no work over a black picture.** It is legibility over footage and over
paper, which is what all three references use it for.

### `dim: null` on everything that arrives

Four presets now state it. It is a correction rather than a preference: the
engine default carries the French reference's 0.42, and in a word-arrival mode
the mere *presence* of `dim` makes the whole page stand dim and light up —
which is that one reference's system and nobody else's. Measured on
chad-48-55: *"No fade was found at any reset — every word arrives at full
opacity on its first visible frame."*

## The separation: a stroke, or a shadow

Two devices for one job, and a look normally picks one. A thick stroke on a
narrow or light letterform eats the counters and the word stops being
readable — which is why `beast` can carry 8 px of it (a rounded face has the
room) and why every other face reaches for a halo instead.

| shadow | what it is |
|---|---|
| `auto` | the default: the page's own colour over a flat beat, its own halo over pictures. These are the two string literals that were hardcoded in `Reel.tsx`, kept to the digit — the parity fixture compares bytes |
| `spread` · `spread-art` | those two, by name, on any ground |
| `contact` | a tight dark halo at zero offset. Reads as contact, not as a drop — the one to reach for instead of a stroke |
| `drop` | an offset drop. Depth rather than separation |
| `hard` | offset, no blur. The sticker, and it survives compression |
| `none` | neither. `beast`, `outline` and `peterson` all say this, because their stroke or their colour already does the job |

A spec works too — `{ "shadow": { "y": 4, "blur": 12, "color": "#000" } }` — or
a list of them for layers. A colour absent means *the page's own separation
colour*, which is the only way one entry reads on both a dark and a light
beat.

**No reference in the teardowns has a caption shadow at all.** The spread is
reelkit's own invention and now says so in its own comment, instead of being
two literals nobody could disagree with.

## The inks

A named colour set, because a look should say "this pair" and not three hex
codes. Three colours as three ROLES: `fill` is the word, `stroke` is what
separates it from whatever is behind it, `emphasis` is what a `*marked*` word
takes.

| ink | fill | stroke | accent | chroma | ΔE from fill |
|---|---|---|---|---|---|
| `paper` | *the page's ink* | — | — | — | the floor: it names no colour |
| `mono` | `#FFFFFF` | `#0A0A0A` | *none* | — | — |
| `punch` | `#FFFFFF` | `#0A0A0A` | `#FFE800` | 0.193 | 0.209 |
| `signal` | `#FFFFFF` | `#0A0A0A` | `#00E676` | 0.214 | 0.286 |
| `hot` | `#FFFFFF` | `#0A0A0A` | `#FF2D8E` | 0.247 | 0.418 |
| `amber` | `#F8C83A` | `#14100A` | *none* | — | measured (Peterson) |
| `inverse` | `#14140F` | `#F2F1EC` | `#C81E12` | 0.204 | 0.400 |

### The metric was wrong, and the swatches were the symptom

The first version of this bank shipped `#FAE6A0` and `#C6F24E` and a test
that said they were well contrasted. Martin's answer was that they are *"loin
d'être la définition du contraste"*, and he was right — the test measured the
wrong thing.

It asked for the accent's **WCAG ratio against the stroke**. `#FAE6A0` scores
**15.9:1** there, which is excellent, and it is still invisible as an accent
beside a white fill. A pale tint of the fill can be as far from black as pure
white is.

Two numbers say what WCAG cannot, both computed in `subtitles.mjs` and both
asserted:

- **`chroma`** (OKLab) is saturation. `#FAE6A0` reads **0.091**; the
  full-chroma yellow that replaced it reads **0.193**. The floor is 0.15.
- **`deltaE`** (OKLab) is perceptual distance from the fill. `#FAE6A0` sits
  **0.118** from white — the eye cannot separate them. The floor is 0.20.

Yellow is the case that makes the pair necessary: it is intrinsically close to
white in lightness, so no luminance metric can tell a good yellow from a
washed-out one. Only its chroma can.

`scripts/presets.test.mjs` refuses a set that misses a floor, and asserts the
regression both ways — the pale gold must keep failing and the vivid yellow
must keep passing. The floors caught one thing the eye would not have:
`inverse`'s accent started at a brighter `#D92B1F`, which scores 4.3:1
against paper and misses the legibility floor; two shades down clears it at
5.1 and looks the same.

**One measured exception.** The chad reference really does use a pale gold,
and `accent`, `hormozi` and `hormozi-outline` reproduce it — so `GOLD` stays
`#FAE6A0` in those three and is not in the ink bank at all. A reproduction is
not allowed to be improved. `beast` moved to the vivid yellow because `beast`
reproduces nothing: there is no teardown behind it, so nothing is falsified by
making it read.

## The background

`background: { color, radius, padding }`. The radius is what `plate` never
had, and it is the difference between a caption lying on the picture and one
shaped like a piece of UI — `chip` is the look it exists for, and the only
one in the bank with a radius.

`plate: true` still means exactly what it meant: the receipt plate, in the
page's own paper, square-cornered, at 20/34 of padding. A `background`
written beside it wins. That equivalence is asserted, because `.parity`
depends on it.

The padding comes out of the fit's room, which is the thing a boolean could
not express: a plate is the tightest place a caption can sit.

## The safe box, and the fit
## The safe box, and the fit

```
theme.safe.x        inset from both side edges   (84)
theme.safe.bottom   the floor the band may not cross   (96)
```

`safe.x` was `left: 84, right: 84` written into the caption band. It is a
variable now, so a project rendering for a platform with different chrome
moves both edges — and the fit below — with one number. The stage band still
has its own table in `ReelElements.tsx`; that is the next thing this should
be derived from, and it is not yet.

**The fit.** `maxWords` and `maxChars` are proxies: a cap counts characters,
and what leaves the frame is a WIDTH. Three long words at 96 px in a rounded
face pass a 16-character cap comfortably and still run off both edges. So the
band **measures itself** — a canvas measurement in the renderer's own font
stack, with the letter-spacing added per gap and the `uppercase` transform
applied before measuring, because both change the answer — and comes down two
pixels at a time until the page is inside `1080 - 2·safe.x` wide and
`1920 - bandTop - safe.bottom` tall.

An emphasised word is measured at its own `scale`, which is the case that
actually overflows: `hormozi`'s second level is 1.5 em.

It stops at `floor`, a fraction of the named size, **0.66** by default. Below
that it overflows visibly rather than clipping — a caption that silently
loses its last word is worse than one that is obviously too big. A look that
would rather be small than wrong lowers the floor.

**And the one case neither side can fix** is a single word longer than the
character cap: pagination can only give it its own page, and the band can only
shrink to its floor and run off both edges. Node cannot measure text, but it
can count — so `render-reel` says it out loud before the voice is billed:

```
WIDE  UNINTERRUPTIBLEPOWERSUPPLYUNITS — longer than the 16-char cap, so the
band will shrink to its floor and still overflow. Split it, or raise
maxChars, or lower the look's `floor`.
```

## The spec

Everything `theme.captions` takes, a preset may set, and a post may write
beside a preset. The keys the drawing code reads:

| key | what it is |
|---|---|
| `mode` | `page` · `words` · `bump` |
| `fontFamily` | the band's own face, over `theme.fonts.caption`. A preset could restyle everything about the type EXCEPT the letterform it is recognised by |
| `fontSize` `fontWeight` `letterSpacing` `textTransform` | the type |
| `saidWeight` | the word being said, `page` mode only. See above |
| `saidColor` | the colour of the word being said, in every mode: the highlight that walks the page with the voice. Beats a `*marked*` colour |
| `fontStyle` | `"italic"` for a slanted face; the fit measures it as italic |
| `color` | the fill. Absent, the band borrows the page's ink |
| `ink` | a named set from `CAPTION_INKS`, or a `{fill, stroke, emphasis}` of your own |
| `stroke` `strokeColor` | a stroke around a solid fill |
| `shadow` | a name from `SHADOW_PRESETS`, `"none"`, a spec, or a list. Default `"auto"` |
| `floor` | how far the fit may shrink, as a fraction of `fontSize`. Default 0.66 |
| `plate` | a solid plate under the words, in the page's own paper |
| `dim` | not a cosmetic knob: its PRESENCE switches `words` mode from arrival to dim-and-light. `null` refuses it |
| `emphasisColor` | one colour for every `*marked*` word |
| `emphasis[]` | `{color, scale, outline}` indexed by asterisk count |
| `bandTop` | px, or a fraction of the canvas. Default 1180 of 1920 |
| `maxWords` `maxChars` | read in Node by `paginate`, never by the band |

`karaoke` and `accent` are the two caption SYSTEMS the teardowns measured, not
inventions. And `docs/REFERENCES.md` is explicit that they are **per-account,
not per-genre**: the French reference lights words out of a dim line and
hand-picks a gold accent; Peterson, same genre, same gold uppercase over a
talking head, does none of that — one colour, whole cards, hard swap, no dim
state anywhere in 21 s sampled. A build that carried the first system over as
"how captions work here" was wrong on screen until a teardown corrected it.
**So this bank is a menu, never a default.**

## The spec

Everything in `theme.captions` (`fontSize`, `fontWeight`, `letterSpacing`,
`textTransform`, `plate`, `maxWords`, `maxChars`, `dim`, `emphasisColor`,
`emphasis[]`, `bandTop`), plus:

| key | what it is |
|---|---|
| `mode` | `page` · `words` · `bump`. The `--captions` flag still wins, so a mode can be auditioned without editing a file |
| `bandTop` | now accepts a **fraction** as well as a pixel count. Anything at or below 1 is read as a fraction — no band has ever sat on row 1, so it is unambiguous, and a preset cannot know the canvas |

## Pagination is part of the look

`maxWords` / `maxChars` decide how a sentence is cut into pages, and that
happens in **Node, at staging, before a frame exists**. So a preset that
changed the type but not the pagination would be a preset that lies:
`hormozi` at 3 words / 16 chars is a different sentence shape from `karaoke`
at 6 / 34, and both have to reach `paginate()`.

That is why `subtitles.mjs` is plain JS — `render-reel.mjs` runs the same
resolution the component will. An unknown preset therefore throws **before a
word is sent to RunPod**, not at render time when the bill is already paid.

## The band now knows what is behind it

`bandsOf` decided the caption's colour from the beat's `bg` alone — paper,
photo, ink, bed. Two grounds it did not know about were putting invisible
words on the screen, both found on a render:

1. **A `field` with a light ground.** `graph` or `board` under a dark skin
   painted a white caption on a white page — visible only as its own shadow.
   A field that names a ground now decides the band from that ground's
   luminance rather than from the skin.
2. **A footage box covering the band.** `shotOverArt` knew about `media` and
   `bed` and not about the box, so a full-bleed take was read as paper and the
   caption borrowed a flat colour that was nowhere on screen. A box counts as
   art **only if it actually reaches the band** — a circle in the top corner
   does not, and treating it as one would force white words onto the page
   below it.

The rule the engine already wrote down, now with two more doors closed: *ask
what is actually behind the words, never a beat-wide assumption.*

## Known, and not fixed

**`accent`'s gold is a dark-reel colour.** `#FAE6A0` on `graph` or `board` is
legible but low-contrast, because the swatch was measured on a reel that is
black behind every word. The band's own colour now flips with the ground; the
emphasis colour does not, because it is the writer's deliberate choice and
quietly changing it would be the engine overruling the post. Name a darker
`emphasisColor` beside the preset when the ground is light.

**`beat.label` does not animate.** `quotePages` gives every word in a label
the same start frame and does not parse `*emphasis*`, so `karaoke` and `bump`
have nothing to reveal on a silent beat. Labels were built to name a beat in a
demo sheet, not to carry a sentence; a real line goes through `say`.
