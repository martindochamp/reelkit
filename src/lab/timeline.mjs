// TIMELINE — one clock, and anchors on it. In plain JS so both sides can run
// it: the renderer lays out with it and a test asserts on it without a
// bundler. Same arrangement as motion.mjs, field.mjs and footage.mjs.
//
// Read docs/TIMELINE.md first: it holds the surface, what this replaces, and
// the two questions still open. This file is the part of it that is settled
// whatever those answers are — parsing an anchor, ordering the dependencies,
// and refusing the two ways a layout can be impossible.
//
// WHY A RESOLVER AND NOT A FIELD OF NUMBERS. Nothing here stores a resolved
// time. An element says where it sits RELATIVE to something — a sentence's
// edge, a cut, or another element — so lengthening a sentence moves
// everything after it and nothing goes stale. That is also what keeps the
// gates working: they refuse a post before the first paid TTS call because
// durations are derived, and a stored timeline would cost that.

/**
 * @typedef {{at: number|string, offset?: number|string}} Anchor
 * `at` is either seconds (a number) or a name: `"s3.start"`, `"cut7"`,
 * `"broll2.end"`. `offset` is seconds, or frames when written `"+4f"`.
 *
 * @typedef {{id: string, from?: Anchor, to?: Anchor, seconds?: number, span?: string}} Placed
 * An element's span. `to` and `seconds` are alternatives; with neither, the
 * span is open-ended and runs to the end of the reel — which is what a placed
 * scene item already does today (Reel.tsx, "a Sequence with no
 * durationInFrames").
 *
 * `span` says COINCIDENCE instead of computing it: `{span: "s3"}` is "exactly
 * as long as sentence 3", and when that sentence is regenerated longer both
 * edges move together. Martin, 2026-09-13, on whether a span that ends before
 * it starts should be refused or clamped: *"je crois que c'est un faux
 * problème"* — and he is right, because the inversion only ever came from
 * mixing a moving edge with a fixed one. Saying the intent directly removes
 * the case instead of choosing how to fail at it.
 */

/** `"+4f"` → frames, `0.2` → seconds × fps, `"-0.3"` → seconds × fps. */
export const offsetFrames = (offset, fps = 30) => {
  if (offset == null) return 0;
  if (typeof offset === "number") return Math.round(offset * fps);
  const m = String(offset).trim().match(/^([+-]?[0-9]*\.?[0-9]+)\s*(f|s)?$/);
  if (!m) throw new Error(`offset "${offset}" is not seconds or frames (e.g. 0.2, "-0.3", "+4f")`);
  const n = Number(m[1]);
  return m[2] === "f" ? Math.round(n) : Math.round(n * fps);
};

/**
 * An anchor split into what it depends on and how far it sits from it.
 * A number is absolute and depends on nothing.
 */
export const parseAnchor = (a, fps = 30) => {
  if (a == null) throw new Error("an anchor is required — write { at: 0 } for the first frame");
  if (typeof a === "number") return { ref: null, frames: Math.round(a * fps) };
  if (typeof a === "string") return { ref: a, frames: 0 };
  if (typeof a.at === "number") return { ref: null, frames: Math.round(a.at * fps) + offsetFrames(a.offset, fps) };
  if (typeof a.at === "string") return { ref: a.at, frames: offsetFrames(a.offset, fps) };
  throw new Error(`an anchor's \`at\` is seconds or a name, not ${JSON.stringify(a.at)}`);
};

/** The element an edge name belongs to: "broll2.end" → "broll2". */
const ownerOf = (name) => String(name).split(".")[0];

/**
 * The edges that exist before any element is placed: the reel's own bounds,
 * each beat, each cut, and each SENTENCE.
 *
 * Sentences are numbered across the whole reel — `s1`, `s2`, … — not per
 * beat, because "insert a sentence between A and B" has to mean something
 * globally. Their edges come from what `speak()` measured on the assembled
 * audio (`om`, `dm` per sentence), which is why a sentence edge is solid.
 *
 * WORD EDGES ARE NOT PUBLISHED, deliberately. A word's start is interpolated
 * inside its sentence at the proportion of its characters
 * (render-reel.mjs ~line 404), so anchoring to one would be anchoring to an
 * estimate while looking exactly like anchoring to a measurement. They come
 * back the day forced alignment lands — REFERENCES.md gap #7.
 *
 * @param {{durationInFrames: number, sentences?: {om: number, dm: number}[]}[]} beats
 * @returns {Record<string, number>} edge name → frame
 */
export const edgesOf = (beats, { fps = 30 } = {}) => {
  // NOTE for phase 3: render-reel.mjs has its own `msToFrames`, and parity
  // means rounding the same way it does. Reconcile the two before the
  // renderer lays out through this rather than after.
  const ms = (v) => Math.round((v / 1000) * fps);
  const named = { "reel.start": 0 };
  let t = 0;
  let n = 0;
  beats.forEach((b, i) => {
    named[`beat${i + 1}.start`] = t;
    named[`beat${i + 1}.end`] = t + b.durationInFrames;
    // The cut INTO this beat. `cut1` is the top of the reel, which is not a
    // cut anyone can see — it is named so the list has no hole in it.
    named[`cut${i + 1}`] = t;
    for (const s of b.sentences ?? []) {
      n += 1;
      named[`s${n}.start`] = t + ms(s.om);
      named[`s${n}.end`] = t + ms(s.om + s.dm);
    }
    t += b.durationInFrames;
  });
  named["reel.end"] = t;
  return named;
};

/**
 * Lay every element on the clock.
 *
 * @param {Placed[]} placed
 * @param {Record<string, number>} named  edges the caller already knows, in
 *   FRAMES — sentence starts and ends, cuts. These depend on nothing.
 * @param {{fps?: number, end?: number, onInverted?: "refuse"|"clamp"}} opts
 *   `end` is the reel's last frame, for open-ended spans.
 *   `onInverted` is docs/TIMELINE.md's first open question; it defaults to
 *   refusing, because a span that silently collapses to nothing renders a
 *   post that looks finished and is not — this codebase's oldest defect.
 * @returns {Record<string, {start: number, length: number|null}>}
 */
export const layOut = (placed, named = {}, { fps = 30, end = null, onInverted = "refuse" } = {}) => {
  // `span` is expanded here so nothing downstream has to know about it. It
  // exists because the inversion this resolver used to agonise over only ever
  // came from mixing a moving edge with a fixed one: saying "these coincide"
  // removes the case instead of choosing how to fail at it.
  placed = placed.map((p) => {
    if (p.span == null) return p;
    if (p.from != null || p.to != null || p.seconds != null) {
      throw new Error(
        `"${p.id}" gives both \`span\` and its own edges. \`span: "${p.span}"\` ` +
          `already means from its start to its end — one or the other.`,
      );
    }
    return { ...p, from: { at: `${p.span}.start` }, to: { at: `${p.span}.end` } };
  });

  const byId = new Map();
  for (const p of placed) {
    if (byId.has(p.id)) throw new Error(`two elements are both called "${p.id}" — an anchor could not say which`);
    byId.set(p.id, p);
  }

  // What each element waits on: its own anchors, minus the edges already known.
  const waitsOn = new Map();
  for (const p of placed) {
    const refs = [];
    for (const a of [p.from, p.to]) {
      if (a == null) continue;
      const { ref } = parseAnchor(a, fps);
      if (ref == null) continue;
      if (ref in named) continue;
      const owner = ownerOf(ref);
      if (!byId.has(owner)) {
        throw new Error(
          `"${p.id}" is anchored to "${ref}", which names nothing. A dangling ` +
            `anchor is refused rather than ignored: a name that silently does ` +
            `nothing renders a post that looks finished and is not.`,
        );
      }
      refs.push(owner);
    }
    waitsOn.set(p.id, refs);
  }

  // Topological order. A cycle is refused BY NAME — the resolver cannot lay
  // out A-after-B-after-A, and saying so beats laying out something arbitrary.
  const order = [];
  const state = new Map(); // undefined | "open" | "done"
  const visit = (id, trail) => {
    const s = state.get(id);
    if (s === "done") return;
    if (s === "open") {
      const cycle = [...trail.slice(trail.indexOf(id)), id].join(" → ");
      throw new Error(`these anchors form a loop and cannot be laid out: ${cycle}`);
    }
    state.set(id, "open");
    for (const dep of waitsOn.get(id) ?? []) visit(dep, [...trail, id]);
    state.set(id, "done");
    order.push(id);
  };
  for (const p of placed) visit(p.id, []);

  // Resolve in that order, publishing each element's own edges as it lands so
  // the next one can anchor to them.
  const edges = { ...named };
  const out = {};
  for (const id of order) {
    const p = byId.get(id);
    const edgeOf = (a) => {
      const { ref, frames } = parseAnchor(a, fps);
      if (ref == null) return frames;
      if (!(ref in edges)) {
        throw new Error(
          `"${id}" is anchored to "${ref}", which exists but has no such edge. ` +
            `An element publishes \`.start\` and \`.end\`; a sentence publishes both too.`,
        );
      }
      return edges[ref] + frames;
    };

    const start = edgeOf(p.from);
    let length = null;
    if (p.seconds != null) length = Math.round(p.seconds * fps);
    else if (p.to != null) length = edgeOf(p.to) - start;
    else if (end != null) length = end - start;

    if (length != null && length <= 0) {
      if (onInverted === "clamp") length = 1;
      else {
        throw new Error(
          `"${id}" ends before it starts (${length} frames). Its anchors moved ` +
            `under it — most likely a sentence was regenerated longer. This is ` +
            `docs/TIMELINE.md's first open question; the answer today is to refuse.`,
        );
      }
    }

    out[id] = { start, length };
    edges[`${id}.start`] = start;
    if (length != null) edges[`${id}.end`] = start + length;
  }
  return out;
};
