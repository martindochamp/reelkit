# Timeline — one clock, and anchors on it

**Nothing here is built.** This is the surface to agree on before a line moves,
written 2026-09-13 against what the tree actually does today.

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

A migration that only adds is not a migration. This one collapses:

- the **eight timing paths** above into one resolver,
- `hold` — it becomes a span that outlasts its sentence,
- the two cue systems (`[+]` markers and `cues` in seconds) into one anchor,
- `shots`' `seconds`/`weight` tiling — shots become elements with spans,
- `offsetFrames`' dual clock — there is one clock,
- `chrome.entrance`, already superseded by the motion bank,
- `host`, which 0 of 101 posts use.

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

## Order of work

1. This document, contested.
2. The resolver, pure and tested without a bundler — anchors in, starts and
   lengths out. Cycles and dangling names refused there.
3. Render through it with the existing keys mapped onto anchors, and prove
   parity: the same post, the same frames.
4. Only then the new vocabulary in posts, and the deletions above.
