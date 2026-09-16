// Every key a reel post can write, by where it sits in the tree.
//
// WHY THIS EXISTS. The engine read the keys it knew and passed over the rest
// in silence, so a spec could carry the right value under the wrong name and
// render clean: `moveTo`, `hideHost` and `reel.theme` each cost a render, and
// on 2026-09-16 a post with `"presett"` on the reel and `"motoin"` on a beat
// passed every gate. A Papyr post had shipped a `cta` with `line` where the
// element reads `lines`, and its sign-off never reached a frame.
//
// The lists were taken from what the code READS, not from the docs, and then
// checked against every post on disk (Papyr, Tally, the parity fixture, the
// probes): nothing on them is refused but the three keys nothing reads.
//
// What it does not walk, on purpose: a lab element's `props` (23 elements,
// each its own shape, owned by its component), a `view`, a `glow`, and a
// caption `plate` or `shadow`. A key there is still unchecked.
//
// Plain JS beside presets.mjs, so the test asserts on it without a bundler.

const words = (s) => s.split(/\s+/).filter(Boolean);

/** level → { keys, kids: { key: level of the object or array under it } } */
const TREE = {
  post: {
    keys: words("reel theme slides format footer cover brief youtubeTitle"),
    kids: { reel: "reel" },
  },
  reel: {
    keys: words(
      "beats voice subtitles music roomtone sfx host cutout overlays bed " +
        "chrome captions motion preset",
    ),
    kids: {
      beats: "beat", voice: "voice", subtitles: "subtitles", music: "music",
      roomtone: "roomtone", host: "host", cutout: "cutout",
      overlays: "overlay", bed: "bed", chrome: "chrome", motion: "motion",
    },
  },
  beat: {
    keys: words(
      "say hold screen shots bg sound motion cues view border field label " +
        "voice subtitles cutout preset",
    ),
    kids: {
      screen: "screen", shots: "shot", sound: "sound", motion: "motion",
      cues: "cue", border: "border", field: "field", voice: "voice",
      subtitles: "subtitles", cutout: "cutout",
    },
  },
  shot: {
    keys: words("screen bg motion cues border field seconds weight at to span preset"),
    kids: {
      screen: "screen", motion: "motion", cues: "cue", border: "border",
      field: "field",
    },
  },
  cue: { keys: words("at offset") },
  voice: { keys: words("voice language exaggeration cfg_weight temperature backend") },
  // `sound` carries two shapes under one name — a per-beat bed {file, volume}
  // and an sfx reaction {name, at, volume} — so it accepts both sets.
  sound: { keys: words("file volume name at") },
  music: { keys: words("file volume") },
  roomtone: { keys: words("file volume") },
  host: { keys: words("file top radius") },
  overlay: { keys: words("file at seek seconds opacity blend") },
  bed: { keys: words("file at opacity") },
  chrome: {
    keys: words("field glow entrance border"),
    kids: { field: "field", border: "border" },
  },
  motion: {
    keys: words(
      "opacity scale x y rotate blur brightness at frames delay ease lead origin",
    ),
    kids: {
      opacity: "motionProperty", scale: "motionProperty", x: "motionProperty",
      y: "motionProperty", rotate: "motionProperty", blur: "motionProperty",
      brightness: "motionProperty",
    },
  },
  motionProperty: { keys: words("from to frames delay ease at spring") },
  field: {
    keys: words(
      "preset shape color pitch size major majorColor majorSize angle ground drift zoom",
    ),
  },
  border: { keys: words("color width inset radius") },
  cutout: { keys: words("preset file width x bottom top flip opacity from") },
  subtitles: {
    keys: words(
      "preset mode fontFamily fontSize fontWeight letterSpacing textTransform " +
        "plate background maxWords maxChars dim emphasisColor emphasis bandTop " +
        "stroke strokeColor color saidWeight shadow ink floor",
    ),
    kids: { background: "subtitlesBackground" },
  },
  subtitlesBackground: { keys: words("color radius padding") },
  footageSpec: {
    keys: words(
      "file preset ratio width height margin padding x y anchor radius fit " +
        "focus from mute spill",
    ),
    kids: { focus: "footageFocus", spill: "footageSpill" },
  },
  footageFocus: { keys: words("x y zoom") },
  footageSpill: { keys: words("matte scale dy") },
  placeItem: { keys: words("file glow x y w label linkFrom blend opacity type") },
  row: { keys: words("left right") },
  flagItem: { keys: words("code label value") },
};

/** Keys every screen takes, whatever its type. */
const SCREEN_COMMON = words("type motion quote");

/** A screen's own keys, by `type`, and the objects under them. */
const SCREENS = {
  blank: { keys: [] },
  title: { keys: words("text kicker sub") },
  figure: {
    keys: words("image ascii kicker title value line cols contrast gamma floor invert cutout crop"),
  },
  clip: {
    keys: words("file frames clipFps kicker title value line cols contrast gamma floor invert crop"),
  },
  recording: { keys: words("file loopFrames aspect loop rate kicker title value line") },
  media: { keys: words("file start end audio credit kicker title value fit") },
  mockup: { keys: words("file rise") },
  endcard: { keys: words("file line") },
  place: {
    keys: words("items file x y w label blend linkFrom glow opacity"),
    kids: { items: "placeItem" },
  },
  table: { keys: words("title rows total"), kids: { rows: "row" } },
  stat: { keys: words("value label line") },
  cta: { keys: words("lines button") },
  flag: { keys: words("flags kicker"), kids: { flags: "flagItem" } },
  lab: { keys: words("element props") },
  footage: { keys: words("spec"), kids: { spec: "footageSpec" } },
};

const isPlain = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/** Edit distance, for "did you mean" — two keys are short, this is cheap. */
const distance = (a, b) => {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const here = row[j];
      row[j] = Math.min(
        row[j] + 1,
        row[j - 1] + 1,
        prev + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      prev = here;
    }
  }
  return row[b.length];
};

const nearest = (key, known) => {
  let best = null;
  let bestD = Infinity;
  for (const k of known) {
    const d = k.toLowerCase() === key.toLowerCase() ? 0 : distance(key, k);
    if (d < bestD) [best, bestD] = [k, d];
  }
  return bestD <= 2 ? best : null;
};

/**
 * Walk a post and return every key nothing reads, as
 * `{ path, key, suggestion }`. Keys starting with `_` are comments and always
 * allowed. A value that is not an object (a preset name, `null` meaning "none
 * here", a number) has no keys to check.
 */
export const unknownKeys = (post) => {
  const found = [];

  const visit = (node, path, level) => {
    if (Array.isArray(node)) {
      node.forEach((item, i) => visit(item, `${path}[${i}]`, level));
      return;
    }
    if (!isPlain(node)) return;

    let known;
    let kids;
    if (level === "screen") {
      const own = SCREENS[node.type];
      // An unknown `type` is the element resolver's to refuse, with the list
      // of what exists; checking its keys here would only guess.
      if (!own) {
        if (isPlain(node.motion)) visit(node.motion, `${path}.motion`, "motion");
        return;
      }
      known = [...SCREEN_COMMON, ...own.keys];
      kids = { motion: "motion", ...(own.kids ?? {}) };
    } else {
      known = TREE[level].keys;
      kids = TREE[level].kids ?? {};
    }

    for (const [key, value] of Object.entries(node)) {
      if (key.startsWith("_")) continue;
      if (!known.includes(key)) {
        found.push({ path: `${path}.${key}`, key, suggestion: nearest(key, known) });
        continue;
      }
      if (kids[key]) visit(value, `${path}.${key}`, kids[key]);
    }
  };

  visit(post, "post", "post");
  return found;
};

/** The refusal, worded once so the renderer and the test read the same line. */
export const unknownKeysMessage = (name, found) =>
  `${name}: ${found.length} key(s) nothing in the engine reads — a spec ` +
  `like that renders clean and wrong.\n` +
  found
    .map(
      (f) =>
        `       ${f.path}` +
        (f.suggestion ? ` — did you mean "${f.suggestion}"?` : ""),
    )
    .join("\n") +
  `\n       If the key is real and new, add it to scripts/post-keys.mjs.`;
