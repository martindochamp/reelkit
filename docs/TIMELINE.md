# Timeline — one clock, and anchors on it

**Status, 2026-09-16.** Written 2026-09-13 as a surface to agree on before a
line moved; much of it is built now. Built: the resolver (`src/lab/timeline.mjs`),
`span`, sentence edges, anchored shots and anchored cues, and `shotProps`
placing through `layoutOfBeat`. Not built: the other seven timing paths still
run beside the resolver rather than through it, nothing listed under "What gets
deleted" is deleted yet, and the reel-level element that outlives its beat is
still only a surface (last section).

Martin's go, 2026-09-13: *"tu peux carrément tout migrer, le coût qu'on a en ne
faisant rien c'est une dette technologique énorme, la labeur n'existe pas."*
This is the one change the engine's own notes said needed that go, because it
touches the beat model itself.

## Why — the model has already leaked eight times

The beat was never the only clock. Everything that had to outlive a cut was
given its own bespoke timing path instead, and there are now eight of them:

| path | where | what it does |
|---|---|---|
| the beat | `Reel.tsx:1210` | `<Sequence from durationInFrames>` per spoken line |
| shots | `:1226` | a sub-timeline tiling the beat, `seconds` or `weight` |
| the bed | `:1158` | its own span on the reel clock |
| sfx | `:1194` | placed at a frame on the reel clock |
| border spans | `:1349` | spans that cross beats |
| beat audio | `:1274` | an offset *inside* the beat |
| placed items | `:1498` | **a `<Sequence>` with no `durationInFrames`** — open-ended, runs to the end of the reel |
| the cutout | `:1271` | `offsetFrames={own ? 0 : start}` — beat clock or reel clock, chosen by where the spec was written |

That last one is the tell: the same element reads a different clock depending
on which key it was written under. And a post already writes seconds in seven
places — `from` on a footage and on a cutout, `at` in tracks, `cues` on a
silent beat, `seconds`/`weight` on a shot, `seek` on an overlay, `at` in a
motion.

So this is not a sentence model with a few exceptions. **It is already a
timeline, with a sentence-shaped index on top, and eight ways to say when.**

The thing that cannot be expressed today is the ordinary case of edited video:
an element that overlaps sentences. A b-roll across sentences 3 to 5, a
caption that lingers four frames past a cut, a held silent shot. `REFERENCES.md`
gap #1, named by four of seven teardown lists.

## The clock

One clock, the reel's, in frames at 30 fps. Frame 0 is the first frame of the
reel. Every element resolves to a start and a length on it before anything is
drawn.

## An anchor

Where something sits is an anchor plus an offset. Four kinds:

```json
{ "at": 4.2 }                                  // absolute seconds
{ "at": "s3.end", "offset": 0.2 }              // a sentence's edge
{ "at": "cut7" }                               // a cut
{ "at": "broll2.start", "offset": -0.3 }       // ANOTHER ELEMENT — the link
```

An offset is seconds, or frames when written `"+4f"`. The common case writes no
number at all: `{ "at": "s3.start" }`.

## A span

```json
{ "from": { "at": "s3.start" }, "to": { "at": "s5.end" } }
{ "from": { "at": "s3.start" }, "seconds": 2.4 }
{ "from": { "at": "s3.start" } }                 // open-ended, to the end of the reel
{ "span": "s3" }                                 // exactly as long as sentence 3
{ "span": "broll2" }                             // exactly as long as that element
```

`span` is the one that matters for authoring. It says two things **coincide**
rather than computing the coincidence from two edges that can drift apart, so
a sentence regenerated 400 ms longer takes its caption with it. Giving both
`span` and your own edges is refused as ambiguous.

The open-ended form is what a placed item already is today — it is being
named, not invented.

## Links, and what happens when a target moves

An element anchored to another moves with it. That is the whole point, and it
is what makes a timeline survivable: **nothing stores a resolved time, so
nothing goes stale.** Lengthen sentence 3 and everything anchored after it
follows; insert a sentence between two others and the rest ripples by
construction, exactly as inserting a beat does today.

Three rules decide whether this holds up:

1. **A cycle is refused by name**, the way `extends` already is in the preset
   resolver. A ↔ B is a post that cannot be laid out, and it must say so
   before the first paid TTS call.
2. **A dangling anchor is refused, not ignored.** Deleting sentence 3 while
   something is anchored to `s3.end` is exactly this codebase's oldest failure
   shape — a name that silently does nothing renders a post that looks
   finished and is not.
3. **An anchor resolves once, in order.** Anchors form a DAG; resolution is a
   topological walk. Two passes over the list is not a design.

## What a sentence becomes

Not the unit of the model any more — **one kind of anchor**, and the most
useful one, because it is semantic: "during the sentence about the study"
survives a re-generation of the voice, a timecode does not.

Its length still comes from the voice: measured per sentence by `speak()`,
which returns `{cs, ce, om, dm}` per sentence **measured from the assembled
audio, not estimated**. For a recorded rush it comes from forced alignment
instead — same unit, different source of truth. That is the other half of why
this migration is worth doing: it is what makes a real voice usable at all.

## What gets deleted

A migration that only adds is not a migration. The **eight timing paths**
above collapse into one resolver, and that part is not in question.

The rest of what this document first called deletions was never counted. It
has been now, across every corpus — 101 Tally posts, 2 Papyr, 1 parity and the
five probe projects, 2026-09-16:

| key | posts that write it | what it actually is |
|---|---|---|
| `cues` | **1** (Tally) | **not a deletion after all** — it is the only way a silent beat says when, so it learned anchors instead (`aede97f`). `[+]` is the other half and stays. |
| `shots` | **9** on recount, all probes, 0 in production | a deletion, as Martin ruled — once reel-level elements exist to dissolve into. |
| `host` | **4**, all in the casino probe | **blocked**, see below |
| `chrome.entrance` | **4**, the same four | **blocked**, same corpus |
| `hold` | **63** — 45 of 101 Tally, 2 Papyr, 16 probes | **not a deletion at all.** A migration of the whole corpus. |

So two entries were blocked by one probe project, one was a corpus-wide
migration wearing a deletion's clothes, and only two were what they claimed.

**`host` and `chrome.entrance`.** `src/Reel.tsx` sets the condition itself —
*"kept because posts written before this exist and still render; the deletion
candidate the moment none do"* — and that moment has not come. The migration
is not a rename either: a `cutout` needs an alpha MATTE while `host` reads a
plain clip from `posts/clips/`, so it means producing four mattes through the
matting pipeline. And deleting `posts/clips/` is not on the table: `recording`
and `clip` read it too. The second pool was never `host`'s alone.

**One measurement in that sweep was void and is recorded so nobody repeats
it.** Counting `"cutout"` across Tally returned 45 posts, which would have
been alarming — until the context was read. In Tally, `"cutout": true` is a
BOOLEAN on an image element meaning "this product photo is background
removed". In reelkit, `cutout` is the matted-person layer at reel or beat
level. Same key, two meanings, two positions in the tree — exactly the class
of divergence `docs/TWINS.md` exists for. A count is not evidence until the
key means the same thing on both sides.

If less than that comes out, the timeline was laid on top of the debt instead
of replacing it.

## What must not break

- **Parity.** A post that asks for nothing renders identically, frame for
  frame. The standing check is a full `.parity` render, and it is the gate on
  every phase of this.
- **The gates still refuse before the first paid TTS call.** They read the
  script, so they keep working only while durations stay DERIVED. Storing
  resolved times would cost that, which is the one argument against a
  conventional timeline document and the reason anchors are relative.
- **The blend trap.** A parent carrying `transform`, `filter` or `opacity` is
  a stacking context and kills `mix-blend-mode` silently. A resolver that
  wraps elements in timing nodes will hit this on its first day.

## Both questions, answered 2026-09-13

1. **A span that ends before it starts.** Martin: *"je crois que c'est un faux
   problème."* He is right, and the framing was the defect: the inversion only
   ever came from mixing a moving edge with a fixed one. An element that means
   "as long as that sentence" must be able to SAY so — hence `span` — and then
   it grows with its target instead of contradicting it. The refusal stays for
   what is left, which is a genuine authoring mistake (a start on a sentence,
   an end on an absolute second), not an accident of regeneration.

   He also asked that silences be equalised so durations compare. They already
   are: `tts.mjs` trims the edge silence off every sentence — the tail 12 dB
   quieter and with more grace than the head, because a final fricative decays
   below the level at which it started — and inserts a fixed 140 ms breath at
   assembly, "a breath, not the model's variable pause".

2. **Shots dissolve.** Martin: *"le système de timeline et notre système de
   footage devrait faire l'affaire."* A shot becomes an element with a span;
   `seconds` and `weight` become anchors. But not on day one: shots keep
   rendering THROUGH the resolver until a parity render proves the timeline
   covers them, and the key goes away after that. Deleting a feature before
   its replacement is proven is how a working pipeline breaks.

## What a post writes first — the shots

Everything above is machinery a post cannot reach yet. The first thing to open
is the shot, because it is the only place where a post already says *when*
(`seconds`, `weight`) and because Martin's ruling — shots dissolve into
elements with spans — has nowhere to dissolve into until a post can write one.

A shot keeps `seconds` and `weight`, which tile and are what nearly every
existing post uses. It gains the anchor form:

```json
"shots": [
  { "screen": {…}, "span": "s2" },
  { "screen": {…}, "at": "s3.start", "to": "s3.end" },
  { "screen": {…}, "at": "cut4", "seconds": 1.2 }
]
```

Three rules, and the third is the one worth arguing with:

1. **A shot names its time one way.** `span` with `seconds`, or `at` with
   `weight`, is refused as ambiguous — the resolver already refuses `span`
   beside its own edges, and this is the same refusal one level up.
2. **Anchors and tiles do not mix inside one beat.** Either every shot tiles
   or every shot is anchored. A beat where two shots tile around a third that
   anchored itself has no defined answer for what "the rest" means, and
   inventing one would be the kind of silent arithmetic this migration exists
   to remove.
3. **An anchored shot may leave the beat empty — allowed, and announced.**
   Martin, 2026-09-16: *"j'autorise."* Tiles cover a beat by construction and
   anchors do not, so a shot anchored inside a beat that runs longer leaves
   frames with no picture. That is either a hole nobody wants or precisely the
   wordless held shot the references use and the beat model could never
   express; the two have the same shape and nothing in a spec tells them
   apart. Refusing it would re-impose the rule this document exists to lift,
   so the engine allows it and prints what it found.

   **What a hole actually renders as, measured on frames rather than assumed:**
   the beat's own ground and the caption band, with no screen element — the
   previous shot does NOT persist. One consequence worth knowing before you
   write one: the hole also loses the shot-level `field`, so it falls back to
   the BEAT's ground, not the ground of the picture that just left. A held
   wordless shot that should keep the same backdrop needs that backdrop set on
   the beat.

## The last structural step — an element that outlives its beat

Anchored shots and anchored cues both live INSIDE a beat. The thing Martin
asked for first — *"des éléments qui chevauchent les phrases"* — still cannot
be written: a b-roll across sentences 3 to 5, a caption lingering past a cut,
a picture that starts under one line and ends under the next.

**The precedent already exists and is worth reading before generalising it.**
The scene layer escapes the beat today: one `<Sequence>` per placed item with
no `durationInFrames`, on the reel's clock, "each entering on its own beat and
none of them leaving". So the mechanism is proven. Its two limits are exactly
what has to be lifted:

| `place` today | what gap #1 needs |
|---|---|
| `file` is required — a picture or a video, never a title, a table, a lab drawing or a footage box | **any element**, the same `screen` a beat writes |
| no `durationInFrames` — it enters and never leaves | **a span**, so it can end where it should |

Everything else `place` carries is worth keeping and is orthogonal: fractional
`x`/`y`/`w`, `blend`, `glow`, `opacity`, `label`, the `linkFrom` connector, and
the clip at `STAGE_BOTTOM_REEL` that keeps it off the caption band.

The shape, then, is a reel-level list whose entries are a screen plus a span:

```json
"elements": [
  { "screen": { "type": "footage", "spec": {…} }, "from": "s3.start", "to": "s5.end" },
  { "screen": { "type": "title", "text": "…" }, "span": "s7" },
  { "screen": { "type": "media", "file": "logo.png" }, "at": "cut2", "x": 0.8, "y": 0.2, "w": 0.15 }
]
```

`shots` dissolve into it — a shot is one of these whose span happens to sit
inside a beat — and `place` becomes the case where the screen is a file and
the span has no end. Two keys collapse into one list rather than a third
mechanism joining them.

**The one decision I would rather have contested than assume: the geometry.**
Two live in the engine today and they do not meet. A beat's screen is laid in
the STAGE COLUMN (top 260, sides 120 and 190, the type measure); a placed item
is positioned fractionally anywhere on the canvas. A reel-level element has to
pick, and neither answer is free — the column is what makes type read as type
and a table line up, while fractions are what let a picture sit in a corner.
My recommendation is that an element **keeps the geometry its screen type
already has** (a title in the column, a footage box against the canvas, a file
fractionally placed) and that `x`/`y`/`w` override it when written, because
that is the rule that breaks nothing already rendering. But it is the join
between two systems, and joins are where this engine has hurt before.

## Order of work

1. This document, contested.
2. The resolver, pure and tested without a bundler — anchors in, starts and
   lengths out. Cycles and dangling names refused there.
3. Render through it with the existing keys mapped onto anchors, and prove
   parity: the same post, the same frames. *Done for shots only; seven paths
   remain.*
4. Only then the new vocabulary in posts, and the deletions above. *Started
   before step 3 finished: anchored shots and cues shipped on 2026-09-16.*
