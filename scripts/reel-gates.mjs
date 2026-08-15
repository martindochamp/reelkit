// Three checks that run before a reel is spoken, because all three
// failures are only visible after the render is paid for.
//
//   BUDGET   the script is too long for the format
//   PROSE    the screen is carrying words the voice already said
//   SHAPE    the reel is built out of the same five elements as the last
//            eleven reels
//
// Every one of them was a note Martin wrote by hand after watching a
// finished file. A note that has to be written twice belongs in the tool.

import { readFileSync, readdirSync } from "node:fs";
import { config } from "./project.mjs";
import path from "node:path";
import { postedCaption, postsDir } from "./stage.mjs";

// ---------------------------------------------------------------------------
// BUDGET — 30 to 40 seconds
//
// Measured against finished renders, not estimated: the narrator runs
// 2.94 spoken words per second with the beat tails included. The old
// target was 45 s / 220 words and the shipped scripts drifted to 60–70 s,
// which is a different format — a viewer decides in the first second and
// re-decides at fifteen, and everything after forty is spent on an
// audience that has already left.
//
// Martin, 2026-08-11: "on devrait caper sur 30/40 secondes plutôt, ça
// permettrait de répondre rapidement au topic et d'être très concis pour
// faire en sorte que chaque seconde soit importante."

/**
 * Pace, measured 2026-08-11 across **37 rendered reels** — 6 133 words
 * against 2 156 seconds of speech, beat tails included. Pooled 2.845 w/s,
 * range 2.47 … 3.26.
 *
 * REELS.md carried **2.94** and had done for a week; it is not the mean of
 * anything measurable. It was caught the only way this gets caught: the
 * first two scripts written to the new "35-second" budget under it came
 * back at 39.9 s and 37.3 s.
 *
 * `PACE_TYPICAL` survives for anything that wants one number (the blank
 * check reasons in words). The BUDGET uses the two-parameter fit below,
 * which is measurably better and says why.
 */
export const PACE_TYPICAL = 2.845;
/**
 * Length is fixed; what fits is the choice. A project may move the band in
 * reel.config.mjs — and should say why in the commit, because widening it is
 * a decision to keep an audience that has already left.
 */
export const [TARGET_SECONDS, CEILING_SECONDS] = (() => {
  const { target, ceiling } = config.gates.seconds;
  if (!(target > 0) || !(ceiling >= target)) {
    throw Object.assign(
      new Error(
        `reel.config.mjs: gates.seconds must be { target, ceiling } with ceiling >= target.`,
      ),
      { fatal: true },
    );
  }
  return [target, ceiling];
})();

/**
 * A words-per-second rate is the wrong shape for this, and the fit says
 * so. Least squares over the same 37 renders, on two parameters:
 *
 *   seconds = 0.2667 × words + 0.604 × sentences
 *           = 3.75 words/s of actual speech, plus 0.60 s at every
 *             sentence boundary
 *
 * That second term is not a fudge — it is the machine. tts.mjs assembles
 * each line from per-sentence clips with a fixed 140 ms gap and trimmed
 * edges, and render-reel.mjs adds a 200 ms tail per beat. A script of
 * short sentences pays that toll more often, which is exactly why
 * `percent-basis` (6.7 words per sentence) ran 3.8 s past a single-rate
 * prediction while `greens-panel` (11.3) beat it by 6.7.
 *
 * RMS error 2.81 s against 3.22 s for the single rate. Better, and still
 * not tight: per-script pace runs 2.47 to 3.26 w/s and no static model
 * closes that. So the pre-flight number carries a MARGIN — the 90th
 * percentile of the fit's own residuals — and `npm run reel` measures the
 * finished file afterwards, which is the only number that cannot be wrong.
 */
const SEC_PER_WORD = 0.2667;
const SEC_PER_SENTENCE = 0.604;
/** P90 of the fit's residuals. The ceiling is tested at estimate + this. */
const PREDICT_MARGIN = 3.8;

const countSentences = (s) => ((s ?? "").match(/[.!?]+/g) ?? []).length;

/** A beat past this is two beats, or it is waffle. */
const BEAT_WORDS = 26;

const plural = (n, noun) => `${n} ${noun}${n === 1 ? "" : "s"}`;

const countWords = (s) => (s ?? "").replace(/\[\+\]/g, " ").split(/\s+/).filter(Boolean).length;

/**
 * Seconds a silent beat holds — the same defaults render-reel.mjs applies,
 * because a 1.5-second endcard is 4 % of the reel and a budget that
 * ignores it is wrong by exactly that much.
 */
const holdSeconds = (beat) =>
  beat.hold != null ? beat.hold : beat.screen?.type === "endcard" ? 1.5 : 2;

export const budgetAudit = (beats) => {
  const per = beats.map((b) => countWords(b.say));
  const words = per.reduce((a, b) => a + b, 0);
  const silent = beats
    .filter((b) => !b.say)
    .reduce((s, b) => s + holdSeconds(b), 0);

  const sentences = beats.reduce((n, b) => n + countSentences(b.say), 0);
  const speech = SEC_PER_WORD * words + SEC_PER_SENTENCE * sentences;
  const seconds = speech + silent;
  const slowSeconds = seconds + PREDICT_MARGIN;
  /** What this script's own sentence shape leaves for words. */
  const wordsFor = (limit, margin) =>
    Math.floor(
      (limit - silent - margin - SEC_PER_SENTENCE * sentences) / SEC_PER_WORD,
    );
  const ceilingWords = wordsFor(CEILING_SECONDS, PREDICT_MARGIN);
  const targetWords = wordsFor(TARGET_SECONDS, 0);

  const errors = [];
  const warnings = [];
  if (words > ceilingWords) {
    errors.push(
      `${words} words + ${silent.toFixed(1)} s of held beats → ` +
        `${seconds.toFixed(0)}–${slowSeconds.toFixed(0)} s. The format stops at ` +
        `${CEILING_SECONDS} s, which is ${ceilingWords} words here — cut ` +
        `${words - ceilingWords}, or ${Math.max(0, words - targetWords)} to reach the ` +
        `${TARGET_SECONDS}-second target. Cut whole beats before you cut clauses: ` +
        `a shortened beat still costs a cut.`,
    );
  } else if (words > targetWords) {
    warnings.push(
      `${words} words → ${seconds.toFixed(0)}–${slowSeconds.toFixed(0)} s, over the ` +
        `${TARGET_SECONDS}-second target by ${plural(words - targetWords, "word")}. Inside the ` +
        `ceiling (${ceilingWords}), so it ships.`,
    );
  }
  per.forEach((n, i) => {
    if (n > BEAT_WORDS) {
      warnings.push(
        `beat ${i + 1} is ${n} words — one beat holds one idea, and one idea ` +
          `is under ${BEAT_WORDS} words at this pace. Split it or cut it.`,
      );
    }
  });
  return {
    words,
    sentences,
    silent,
    seconds,
    slowSeconds,
    targetWords,
    ceilingWords,
    errors,
    warnings,
  };
};

// ---------------------------------------------------------------------------
// PROSE — the screen shows, the voice argues
//
// REELS.md has said "the only words on screen are the captions" since
// 2026-08-02 and the rule keeps losing to the writer's instinct to
// explain twice. These are the four shapes it loses in, each one bounded
// by a number so the check can run.
//
// Martin, 2026-08-11: "il faudrait être plus sommaire et se poser la
// question — est-ce que ce texte est utile, ou bien sans, on ne perd pas
// le sens."

/** Words of running prose one beat's screen may carry, captions excluded. */
const BEAT_PROSE_WORDS = config.gates.prose;
/** A `line` is a caption under a specimen. Past this it is a sentence. */
const LINE_WORDS = config.gates.line;
/** A kicker is a label. Past this it is a headline. */
const KICKER_WORDS = config.gates.kicker;
/**
 * A row label names a thing — a food, a place, a document. Past this it is a
 * claim rather than a row.
 *
 * It was typed here as a literal 34 while `gates.tableLabel` was documented in
 * CONFIG.md and defaulted in project.mjs, so the config field was dead: a
 * project could set it to anything and the check never moved. Found on Papyr.
 */
const ROW_LABEL_CHARS = config.gates.tableLabel;

/** Does this string carry a measurement? A right column has to. */
const isNumeric = (s) => /\d/.test(s ?? "");

/**
 * The keys that hold a SENTENCE rather than a datum, wherever they sit —
 * including inside a lab element's `props`, which is where the worst of
 * it hides: a flow diagram with a `sub` under each of three stages and a
 * `line` under the whole thing is 27 words of screen prose that no
 * top-level check would ever see.
 *
 * `title` is deliberately NOT here. On a figure it is the row's label
 * ("Sweet potato, baked — 1 cup") and on a table it is the column head:
 * both are readings, not commentary. `label` and `value` likewise.
 */
const PROSE_KEYS = new Set(["kicker", "line", "sub", "note", "text", "lines"]);

const proseIn = (node, out = []) => {
  if (!node || typeof node !== "object") return out;
  for (const [key, value] of Object.entries(node)) {
    if (PROSE_KEYS.has(key)) {
      if (typeof value === "string") out.push(value);
      else if (Array.isArray(value)) out.push(...value.filter((v) => typeof v === "string"));
    }
    if (value && typeof value === "object") proseIn(value, out);
  }
  return out;
};

// ---------------------------------------------------------------------------
// BLANK — how long the sheet is empty before anything prints
//
// A `[+]` prints the element's next part. For a `lab` element the FIRST
// cue is `appearAt`, and for `stat`/`title`/`cta` the whole element is
// wrapped in that one cue — so a marker placed after the first sentence
// does not delay a row, it delays the ENTIRE SCREEN. The beat plays over
// blank paper until the voice reaches the marker.
//
// Measured on the 96-word thiamine cut, 2026-08-11: three of four beats
// cued after their first sentence, and the reel spent ~9 of 35 seconds on
// an empty sheet — including the first 4.6 s, which is the hook. Nothing
// in the render said so. `percent-basis`, written the same day, puts its
// first cue on the first word of every beat and has none.
//
// Found by the reel-script-critic; it is arithmetic, so it lives here now.

/** Seconds of empty stage a beat may open with before it is a defect. */
const BLANK_SECONDS = config.gates.blank;

/**
 * Does this element's FIRST cue gate the whole screen, or only its first
 * row? The answer is per element and sometimes per cue COUNT, and it has
 * to mirror `LAB_REGISTRY` in src/ReelElements.tsx exactly — a check that
 * fires on a beat which is not actually blank is worse than no check,
 * because it trains you to scroll past the ones that are (the same
 * mistake the cover legibility floor made: measuring the wrong quantity
 * gives the same false calm as never firing).
 *
 *   WHOLE SCREEN   figure/clip/recording/media — cue 0 is the art itself
 *                  stat/title/cta/endcard      — wrapped in <Printed cue[0]>
 *                  lab:unitgrid                — c[0] → appearAt, always
 *                  lab:molecule, lab:calendar  — c[0] → appearAt, 1 cue only
 *                  lab:rankshuffle             — appearAt only from 2 cues
 *                  table with no `title`       — nothing holds the frame
 *
 *   ROWS ONLY      barchart, comparison, bullets, threshold, labelanatomy,
 *                  flow, timeline, tierlist    — the grid is on the paper
 *                  linechart, sparkline        — axes print, the head draws
 *                  odometer                    — the frame is there, it counts
 *                  a titled table              — the title holds the frame
 */
const gatesWholeScreen = (el, cueCount) => {
  if (!el) return false;
  if (["figure", "clip", "recording", "media", "stat", "title", "cta", "endcard"].includes(el.type)) {
    return true;
  }
  if (el.type === "table") return !el.title;
  if (el.type !== "lab") return false;
  switch (el.element) {
    case "unitgrid":
      return true;
    // One cue on a molecule maps to `appearAt` — the whole drawing waits.
    case "molecule":
      return cueCount === 1;
    // A calendar NEVER waits. Both of its cue shapes land on the stamps
    // (`stampsAt` for one, `cues` for many); the grid itself prints from
    // `appearAt`, which is 0 unless a post says otherwise. This case used
    // to sit beside `molecule` on the assumption that one cue gates one
    // element, and the two registry entries differ by exactly that word.
    // Caught 2026-08-11 by a writer whose calendar beat could not put its
    // stamps on the sentence they belong to without tripping a false
    // BLANK — the gate was pushing choreography the wrong way, which is
    // worse than not firing.
    case "calendar":
      return false;
    case "rankshuffle":
      return cueCount >= 2;
    default:
      return false;
  }
};

export const blankAudit = (beats) => {
  const warnings = [];
  beats.forEach((beat, i) => {
    const say = beat.say;
    if (!say) return;
    const at = say.indexOf("[+]");
    // No cues at all is not blank: the element is on the paper from the cut.
    if (at === -1) return;
    if (!gatesWholeScreen(beat.screen, (say.match(/\[\+\]/g) ?? []).length)) return;
    const before = countWords(say.slice(0, at));
    const seconds = before / PACE_TYPICAL;
    if (seconds <= BLANK_SECONDS) return;
    warnings.push(
      `beat ${i + 1} opens on ${seconds.toFixed(1)} s of blank paper — the ` +
        `first [+] gates this element's WHOLE screen and there are ${before} ` +
        `words before it` +
        (i === 0 ? ", and that is the hook" : "") +
        `. Move the first [+] to the first word.`,
    );
  });
  return warnings;
};

// ---------------------------------------------------------------------------
// GATE — the endcard's keyword against the caption's
//
// `npm run gates` inventories the bank and finds keywords answering for
// two POSTS. It cannot see the failure that actually shipped: one post
// disagreeing with itself. `thiamine-emergency` printed "Comment B1" on
// the endcard while its own caption said "Comment STALL" — the viewer
// types what they read on the screen, the caption routes what it says,
// and the DM answers neither. Both words were "taken by
// thiamine-emergency", so the collision check reported the bank clean.
//
// Found by the reel-script-critic reading the two files side by side,
// 2026-08-11. A check a human had to run by hand belongs in the tool.

const keywordIn = (text) =>
  text.match(/comment\s+\\?"?([a-z0-9]+)/i)?.[1]?.toUpperCase() ?? null;

export const gateAudit = (name, beats) => {
  const onScreen = beats
    .map((b) => b.screen)
    .filter((el) => el?.type === "endcard" || el?.type === "cta")
    .flatMap((el) => [el.line, ...(el.lines ?? [])])
    .filter(Boolean)
    .map(keywordIn)
    .filter(Boolean);
  if (!onScreen.length) return [];

  let caption;
  try {
    caption = readFileSync(path.join(postsDir, `${name}.caption.txt`), "utf8");
  } catch {
    return [];
  }
  const written = keywordIn(caption);
  if (!written) return [];

  const wrong = [...new Set(onScreen)].filter((w) => w !== written);
  return wrong.map(
    (w) =>
      `the endcard says "${w}" and ${name}.caption.txt says "${written}". ` +
      `The viewer types what is on the screen and the caption routes what ` +
      `it says, so one of them cannot be answered. Pick one word.`,
  );
};

export const proseAudit = (beats) => {
  const found = [];
  const at = (i, msg) => found.push(`beat ${i + 1}: ${msg}`);

  beats.forEach((beat, i) => {
    const el = beat.screen ?? {};
    // Running prose — everything that is a sentence rather than a datum,
    // at any depth.
    const prose = proseIn(el).join(" ");
    const n = countWords(prose);
    if (n > BEAT_PROSE_WORDS) {
      at(i, `${n} words of prose on screen (budget ${BEAT_PROSE_WORDS}). ` +
        `Take out whatever the voice already says — if the beat still means ` +
        `the same thing without a line, the line was decoration.`);
    }
    const line = el.line ?? el.props?.line;
    const kicker = el.kicker ?? el.props?.kicker;
    if (line && countWords(line) > LINE_WORDS) {
      at(i, `\`line\` is ${countWords(line)} words — it is a caption, not a ` +
        `sentence: "${line}"`);
    }
    if (kicker && countWords(kicker) > KICKER_WORDS) {
      at(i, `\`kicker\` is ${countWords(kicker)} words — a kicker is a label: ` +
        `"${kicker}"`);
    }

    if (el.type === "title") {
      at(i, `the \`title\` element is a slideshow element. A reel beat shows ` +
        `an instrument, a specimen or real footage — the voice carries the ` +
        `words (REELS.md, "The screen carries no prose").`);
    }
    if (el.type === "lab" && el.element === "bullets") {
      at(i, `text-only \`bullets\` is a slideshow element, same rule as \`title\`.`);
    }

    for (const row of [...(el.rows ?? []), ...(el.total ? [el.total] : [])]) {
      if (!isNumeric(row.right)) {
        at(i, `table row "${row.left}" has no number in its right column ` +
          `("${row.right}"). A right column is a measurement — a phrase there ` +
          `is the voice's job, and it has shipped twelve times.`);
      }
      if ((row.left ?? "").length > ROW_LABEL_CHARS) {
        at(i, `table label is ${row.left.length} characters ` +
          `(max ${ROW_LABEL_CHARS}): "${row.left}"`);
      }
    }
  });
  return found;
};

// ---------------------------------------------------------------------------
// SHAPE — is this reel built like every other reel
//
// Measured 2026-08-11 across the 41 reels in posts/: 44 tables, 39
// mockups, 26 stats, 26 figures. Every reel has a table and every reel
// ends on a phone. Four lab elements have never appeared in one.
//
// Martin, 2026-08-11: "j'ai l'impression qu'on était trop limité sur les
// animations, c'était toujours les mêmes ou pas terrible."

export const shapeOf = (beats) =>
  beats.map((b) =>
    b.screen?.type === "lab" ? `lab:${b.screen.element}` : (b.screen?.type ?? "?"),
  );

/** How often each element appears across every reel in posts/, this one aside. */
export const bank = (exclude) => {
  const count = {};
  const shapes = new Map();
  for (const file of readdirSync(postsDir)) {
    if (!file.endsWith(".json") || file === "ledger.json") continue;
    const slug = file.replace(/\.json$/, "");
    if (slug === exclude) continue;
    let spec;
    try {
      spec = JSON.parse(readFileSync(path.join(postsDir, file), "utf8"));
    } catch {
      continue;
    }
    if (!spec.reel?.beats?.length) continue;
    const shape = shapeOf(spec.reel.beats);
    shapes.set(slug, shape.join(","));
    for (const key of shape) count[key] = (count[key] ?? 0) + 1;
  }
  return { count, shapes };
};

export const shapeAudit = (name, beats) => {
  const shape = shapeOf(beats);
  const { count, shapes } = bank(name);
  const warnings = [];

  const twin = [...shapes].find(([, s]) => s === shape.join(","));
  if (twin) {
    warnings.push(`same beat-for-beat shape as ${twin[0]} — ${shape.join(" · ")}`);
  }

  const repeated = Object.entries(
    shape.reduce((m, k) => ({ ...m, [k]: (m[k] ?? 0) + 1 }), {}),
  ).filter(([k, n]) => n > 2 && k !== "media");
  for (const [k, n] of repeated) {
    warnings.push(`${k} appears ${n} times in one reel — that is the format, not a beat`);
  }

  // The novelty test: is there anything here the bank has not already worn
  // out? "Worn out" is the top third of the bank by use.
  const ranked = Object.entries(count).sort((a, b) => b[1] - a[1]);
  const worn = new Set(ranked.slice(0, Math.ceil(ranked.length / 3)).map(([k]) => k));
  const fresh = [...new Set(shape)].filter((k) => !worn.has(k));
  if (!fresh.length) {
    warnings.push(
      `every element here is in the bank's top third (${[...worn].join(", ")}). ` +
        `Never used in a reel: ${["sparkline", "thermal", "dissolve", "pie"]
          .filter((k) => !count[`lab:${k}`])
          .map((k) => `lab:${k}`)
          .join(", ") || "none left"}.`,
    );
  }
  return { shape, fresh, warnings };
};

// ---------------------------------------------------------------------------
// The caption fits the box it is pasted into

/**
 * Instagram and TikTok both cut a caption at **2,200 characters** (TikTok
 * matched Instagram in 2023, up from 300). YouTube's description box holds
 * far more, so this is the binding one.
 *
 * The damage is not that the end is unreadable. Our captions put the
 * comment gate on the LAST line — "Comment MARKER and I will send you the
 * app" — so a truncated caption silently deletes the account's entire
 * attribution mechanism, and the post still looks fine. Six of the bank's
 * captions were over when this was written; Martin caught it by eye on
 * niacin-marker.
 *
 * Measured on the COMPOSED caption (`postedCaption`), because the YouTube
 * title now leads it and those characters count too.
 */
export const CAPTION_LIMIT = 2200;
/** Instagram shows this much before "… more". The hook has to live here. */
export const CAPTION_FOLD = 125;

/**
 * Aim here, not at the limit. A caption that fits with two characters to
 * spare breaks the next time anyone fixes a typo, and the thing it breaks
 * is the comment gate.
 */
export const CAPTION_TARGET = 2000;

export const captionAudit = (name) => {
  const text = postedCaption(name);
  if (!text) return [];
  const out = [];
  if (text.length > CAPTION_TARGET && text.length <= CAPTION_LIMIT) {
    out.push(
      `caption is ${text.length} characters — inside the ${CAPTION_LIMIT} limit with only ${CAPTION_LIMIT - text.length} to spare. Aim for ` +
        `${CAPTION_TARGET}: the next typo fix pushes it over, and what falls ` +
        `off the end is the comment gate.`,
    );
  }
  if (text.length > CAPTION_LIMIT) {
    out.push(
      `caption is ${text.length} characters — ${text.length - CAPTION_LIMIT} ` +
        `over Instagram's and TikTok's ${CAPTION_LIMIT} limit. It will be cut, ` +
        `and the comment gate is on the last line.`,
    );
  }
  return out;
};

/**
 * The refusal, separate from the advice. `captionAudit` also warns when a
 * caption merely sits close to the limit — useful in a render log, and
 * NOT a reason to block a ship. Wiring `ship` to "any message" made a
 * 2,198-character caption unshippable, which is the check being right
 * about the number and wrong about what to do with it.
 */
export const captionTooLong = (name) => {
  const text = postedCaption(name);
  return text != null && text.length > CAPTION_LIMIT ? text.length : 0;
};
