#!/usr/bin/env node
// Renders a post's reel script: the `reel` block of posts/<name>.json
// becomes out/reels/<name>.mp4. A reel is written from the brief, not from
// the slides — the narration is the spine, a beat cuts to a screen, and [+]
// markers in the spoken line print that screen's parts at the exact word the
// voice reaches them. REELS.md owns the format.
//
// A beat is one spoken line. It is NOT necessarily one picture: `shots` lays
// several across the beat's own length, cutting on their own schedule while
// the line runs underneath, and `hold` keeps a beat on screen after the voice
// has stopped. Both exist because every reference reel cuts when the picture
// wants to and speaks when the argument wants to (docs/REFERENCES.md), and
// one-beat-one-screen-one-line could express neither.
//
//   npm run reel fe-absorbed
//   npm run reel fe-absorbed -- --mock     # macOS draft voice, no RunPod
//
// The voice is RunPod Chatterbox — the endpoint Papyr already runs. Keys in
// .env (see scripts/tts.mjs); audio is cached per line, so iterating on one
// beat re-speaks one beat.

import { execFileSync, spawnSync } from "node:child_process";
import { resolveSubtitles } from "../src/lab/subtitles.mjs";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { bundleProject } from "./bundle.mjs";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { imageToAscii } from "./img2ascii.mjs";
import {
  blankAudit,
  budgetAudit,
  captionAudit,
  CEILING_SECONDS as CEILING_S,
  gateAudit,
  proseAudit,
  shapeAudit,
  TARGET_SECONDS as TARGET_S,
} from "./reel-gates.mjs";
import { buildSfx } from "./sfx.mjs";
import { sourcedReady as sourcedEffect } from "./sfx-import.mjs";
import { config } from "./project.mjs";
import { postsDir, projectDir } from "./stage.mjs";
import { presetBank, resolvePresets } from "./presets.mjs";
import { warnTierList } from "./tier-legibility.mjs";
import { forget, resolveVoice, speak } from "./tts.mjs";

const FPS = 30;
// The voice never stops. A beat opens on its first syllable and ends a
// breath after its last, so consecutive beats read as one sentence
// stream — a second of silence between beats is where viewers leave.
// (Widen only for a beat that genuinely needs the air.)
//
// The tail is 200 ms, not 120: a word's release keeps decaying after the
// ear has stopped hearing it, and cutting to the next beat inside that
// decay is heard as a clipped word even when nothing was truncated
// (measured on mg-primer — the tails were intact, the air was not).
// Cost is 80 ms per beat, under a second on a full reel.
const LEAD_MS = 0;
const TAIL_MS = 200;
const MIN_BEAT_MS = 900;
const SILENT_HOLD_MS = 2000; // a beat with no line

// The endcard is read, not heard. A store row the eye recognises needs
// under a second and a half; two is where it stops being the last frame
// of a video and starts being an advertisement at the end of one
// (Martin, 2026-08-11: "le cta devrait durer moins de 2s, pas besoin de
// la dire — parfois ça pourrait être un string affiché du style
// 'comment X to get the link' sans qu'il soit énoncé, pour gagner du
// temps tout en attirant l'oeil").
/** How far the bed sits under the narration. -30 dB: felt, never heard. */
const ROOM_TONE_VOLUME = 0.032;

const sourcedRoomTone = () => sourcedEffect("room-tone");

const ENDCARD_MS = 1500;
const ENDCARD_MAX_MS = 2000;

// Social platforms play everything at roughly -14 LUFS. Remotion hands
// back the raw mix, which for a cloned narration lands near -27 — a full
// 13 dB under every other video in the feed, which the ear reads as
// "quiet and amateur" before it reads a word. So the finished file gets
// one loudness pass, two-pass for accuracy: measure, then apply the
// measured values, so the gain is as linear as the true-peak ceiling
// allows and the limiter only touches the few loudest syllables.
// Narration measures LRA ≈ 2 LU — there is no dynamic range to protect.
// Video is stream-copied; only the audio is re-encoded.
const LUFS_TARGET = -14;
const TRUE_PEAK = -1.5;

/**
 * What the -14 LUFS pass adds to a real reel's mix: a cloned narration
 * lands near -27 LUFS and comes out at -14. Used verbatim on a voiceless
 * probe so its effects sit where a shipped file puts them.
 */
const VOICE_LIFT_DB = 13;

/**
 * The colour an image's drawing is made of — its glow, in other words.
 *
 * Only pixels bright enough to BE the drawing are averaged: a line-art PNG
 * is mostly background, and including it returns a near-black grey for
 * every asset on the reel. The threshold is on luminance, so it works the
 * same whether the background is a black plate or a transparent one
 * (ffmpeg composites alpha onto black here).
 *
 * Returns null when nothing clears the threshold, and null means "no glow"
 * rather than a guessed colour.
 */
const INK_LUMA_FLOOR = 48;

const dominantInk = (file) => {
  let raw;
  try {
    raw = execFileSync(
      "ffmpeg",
      ["-v", "error", "-i", file, "-vf", "scale=64:64", "-frames:v", "1",
       "-pix_fmt", "rgb24", "-f", "rawvideo", "-"],
      { maxBuffer: 1 << 22 },
    );
  } catch {
    return null;
  }
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i + 2 < raw.length; i += 3) {
    const R = raw[i], G = raw[i + 1], B = raw[i + 2];
    if (0.2126 * R + 0.7152 * G + 0.0722 * B < INK_LUMA_FLOOR) continue;
    r += R; g += G; b += B; n++;
  }
  if (!n) return null;
  // Lifted toward its own hue: the average of a neon's pixels includes its
  // falloff, which is paler than the tube. A glow reads as the tube.
  const max = Math.max(r / n, g / n, b / n) || 1;
  const lift = Math.min(255 / max, 1.55);
  const ch = (v) => Math.round(Math.min(255, (v / n) * lift));
  return `rgba(${ch(r)}, ${ch(g)}, ${ch(b)}, 0.55)`;
};

const fixedGain = (file, db, name) => {
  const tmp = path.join(os.tmpdir(), `reel-gain-${path.basename(file)}`);
  execFileSync("ffmpeg", [
    "-i", file, "-af", `volume=${db}dB`,
    "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
    "-y", tmp,
  ], { stdio: "pipe" });
  renameSync(tmp, file);
  return `+${db} dB (no voice to normalize against)`;
};

const normalizeLoudness = (file, name) => {
  // ffmpeg prints the measurement JSON on STDERR, with the whole banner
  // above it — spawnSync, then take the last brace-delimited block.
  const probe = spawnSync(
    "ffmpeg",
    ["-i", file, "-af",
      `loudnorm=I=${LUFS_TARGET}:TP=${TRUE_PEAK}:LRA=11:print_format=json`,
      "-f", "null", "-"],
    { encoding: "utf8" },
  );
  const measure = `${probe.stderr ?? ""}${probe.stdout ?? ""}`;
  const json = measure.slice(measure.lastIndexOf("{"), measure.lastIndexOf("}") + 1);
  let m;
  try {
    m = JSON.parse(json);
  } catch {
    console.log(`LOUDNESS ${name} — measurement failed, file left as rendered`);
    return null;
  }
  const tmp = path.join(os.tmpdir(), `reel-loud-${path.basename(file)}`);
  execFileSync("ffmpeg", [
    "-i", file,
    "-af",
    `loudnorm=I=${LUFS_TARGET}:TP=${TRUE_PEAK}:LRA=11` +
      `:measured_I=${m.input_i}:measured_TP=${m.input_tp}` +
      `:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}` +
      `:offset=${m.target_offset}:linear=true`,
    // loudnorm runs at 192 kHz internally, and with no explicit -ar the AAC
    // encoder inherits the filter's rate and caps at 96 kHz — so every reel
    // shipped at a sample rate no platform wants and all of them re-encoded it.
    // 48 kHz is what social delivery expects; set it or inherit the filter.
    "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
    "-y", tmp,
  ], { stdio: "pipe" });
  renameSync(tmp, file);
  return `${Number(m.input_i).toFixed(1)} → ${LUFS_TARGET} LUFS`;
};

const args = process.argv.slice(2);
const mock = args.includes("--mock");
// The A/B: the same post, same voice cache, same cut, silent. Writes
// <name>.nosfx.mp4 so the two files sit side by side and the question
// "is this better with sound" can be answered by listening to both.
// --sfx is the other half of it: AUDITION the default kit on a post that
// has not opted in, without editing the post. What ships is still what
// the post says.
const noSfx = args.includes("--no-sfx");
const forceSfx = args.includes("--sfx");

// The three gates, and the two ways past them.
//
// --long   ship a script over the 40-second ceiling anyway. It exists for
//          the one topic a year that genuinely cannot be told in forty
//          seconds, and it prints the overage every time it is used.
// --loose  downgrade the prose gate to warnings. For RE-rendering a post
//          written before the gate existed — not for writing a new one.
const allowLong = args.includes("--long");
const loose = args.includes("--loose");

// --synth   force the synthesized kit even where a downloaded take exists.
//           The A/B for "is the real recording better", one flag apart.
const preferSynth = args.includes("--synth");

// --gates   run the five audits and stop. No TTS call, no bundle, no
//           render — the loop a writer actually needs, because every one
//           of those gates is about the JSON and none of them needs a
//           voice to answer. Writing a script used to cost a render to
//           find out it was six words over the ceiling.
const gatesOnly = args.includes("--gates");

// --captions words   audition the word-by-word reveal on a post that has
//                    not asked for it, the way --sfx auditions the kit.
const captionsAt = args.indexOf("--captions");
const captionsOverride =
  captionsAt === -1 ? null : (args[captionsAt + 1] ?? "words");
if (captionsOverride && !["page", "words", "bump"].includes(captionsOverride)) {
  console.error(
    `--captions takes "page", "words" or "bump", not "${captionsOverride}"`,
  );
  process.exit(1);
}

// --revoice          re-speak every beat
// --revoice 2,5      re-speak beats 2 and 5, keep the rest cached
//
// The endpoint answers in the DEFAULT voice when the worker that picks
// up the job has not rolled the image carrying the cloned sample. It is
// per-request, so one post lands right and the next one does not, and
// the wrong take then sits in the cache forever. This is the way out.
const revoiceAt = args.indexOf("--revoice");
const revoiceAll = revoiceAt !== -1;
const revoiceBeats = (() => {
  if (!revoiceAll) return null;
  const next = args[revoiceAt + 1];
  if (!next || next.startsWith("--")) return "all";
  return new Set(next.split(",").map((n) => Number(n.trim())).filter(Boolean));
})();
const names = args
  // The beat list after --revoice, and the mode after --captions, are
  // values — not post names.
  .filter(
    (a, i) =>
      !a.startsWith("--") &&
      !(revoiceAll && i === revoiceAt + 1 && /^[\d,\s]+$/.test(a)) &&
      !(captionsAt !== -1 && i === captionsAt + 1),
  )
  .map((n) => n.replace(/\.json$/, ""));
if (names.length === 0) {
  console.error(
    "usage: render-reel.mjs <post> [<post>…] [--mock] [--sfx|--no-sfx] " +
      "[--captions page|words|bump] [--revoice [2,5]] [--long] [--loose]",
  );
  process.exit(1);
}

const msToFrames = (ms) => Math.round((ms / 1000) * FPS);

/** "1 word" / "4 words" — a tool that cannot count its own nouns reads
 *  as one that cannot count. */
const plural = (n, noun) => `${n} ${noun}${n === 1 ? "" : "s"}`;

// How many cue-able parts an element exposes — must mirror
// src/ReelElements.tsx `elementParts`.
// -1 = free-form: a lab element takes as many [+] cues as its registry
// mapping accepts (src/ReelElements.tsx LAB_REGISTRY).
const partsOf = (el) => {
  switch (el.type) {
    // Nothing to print, so nothing to cue.
    case "blank":
      return 0;
    case "figure":
    case "clip":
    case "recording":
    case "media":
      return 2;
    case "table":
      return el.rows.length + (el.total ? 1 : 0);
    // One flag, one cue: the row of countries stands empty and each one
    // prints on the word that names it.
    case "flag":
      return el.flags.length;
    case "lab":
      // `tierlist` takes one cue per item, in reading order across every
      // tier — knowable, so the partial-cueing guard applies. Every other
      // lab element stays free-form.
      return el.element === "tierlist"
        ? (el.props?.tiers ?? []).reduce(
            (n, t) => n + (t.items?.length ?? 0),
            0,
          )
        : -1;
    default:
      return 1;
  }
};

/**
 * Which words the writer marked `*like this*`, and HOW HARD — by their
 * index in the line.
 *
 * By INDEX and not by character offset, because `clean` is later collapsed
 * and trimmed and every offset into it shifts. A word's ordinal does not
 * move. The `*` markup is the one already used by `title` and `stat`
 * (ReelElements.tsx `hasEmphasis`), so a writer learns it once.
 *
 * Measured need: the reference paints exactly two caption colours and the
 * choice follows the voice's stress — the same word is accented in one
 * sentence and plain in the next. No rule can infer that; the writer marks it.
 *
 * The COUNT of asterisks is the level, and one reel needs two of them: a
 * word held in the accent colour, and a word at 2.6× cap height, in the
 * same sentence. So `*word*` is level 1, `**word**` level 2, and the skin
 * says what each level looks like (`theme.captions.emphasis`). One rule,
 * one markup, as many steps as a skin cares to name.
 *
 * A run spans WORDS, not only single ones: `*two words*` marks both, which
 * the old `includes("*")` test silently got wrong for anything in between.
 */
const emphasisWords = (say) => {
  const levels = new Map();
  let open = 0;
  [...say.replace(/\[\+\]/g, " ").matchAll(/\S+/g)].forEach((m, i) => {
    const lead = (m[0].match(/^\*+/) ?? [""])[0].length;
    // The closing run may sit INSIDE the word's punctuation — `**bigger**,`
    // ends in a comma, not an asterisk. Reading the tail as `\*+$` left that
    // run open and painted the next plain word ("and") at level 2. Caught by
    // rendering the probe, not by reading this line.
    const tail = ((m[0].match(/\*+[^\w*]*$/) ?? [""])[0].match(/\*/g) ?? []).length;
    const level = Math.max(open, lead);
    if (level > 0) levels.set(i, level);
    // `*word*` opens and closes on itself; `*two` opens a run that `words*`
    // closes. The length test separates the two — `***` alone is neither.
    if (lead && tail && m[0].length > lead + tail) open = 0;
    else if (lead) open = lead;
    else if (tail) open = 0;
  });
  return levels;
};

/** The beat's picture, for the log line: one type, or the list of shots. */
const shapeOfShots = (shots) =>
  shots.length === 1
    ? shots[0].screen.type
    : `${shots.length} shots: ${shots.map((s) => s.screen.type).join(" · ")}`;

// Pull the [+] markers out of a spoken line: returns the clean text the TTS
// speaks and, for each marker, the character index (into the clean text) of
// the word it points at.
const parseCues = (say) => {
  const positions = [];
  let clean = "";
  let rest = say;
  while (true) {
    const at = rest.indexOf("[+]");
    if (at === -1) break;
    clean += rest.slice(0, at);
    rest = rest.slice(at + 3);
    positions.push(clean.length + (rest.match(/^\s*/)?.[0].length ?? 0));
  }
  clean += rest;
  return { clean: clean.replace(/\s{2,}/g, " ").trim(), positions };
};

// Word timings with character positions. Sentence offsets are measured
// (Chatterbox reports them); the inside of a sentence is spread by char
// weight — close enough for a caption and a print cue.
const wordTimings = (text, sentences, durationMs, emphasis = new Map()) => {
  const words = [];
  const spans =
    sentences?.length > 0
      ? sentences
      : [{ cs: 0, ce: text.length, om: 0, dm: durationMs }];
  for (const s of spans) {
    const chunk = text.slice(s.cs, Math.min(s.ce, text.length));
    const matches = [...chunk.matchAll(/\S+/g)];
    if (matches.length === 0) continue;
    const weight = matches.reduce((sum, m) => sum + m[0].length + 1, 0);
    let at = s.om;
    for (const m of matches) {
      words.push({
        text: m[0],
        startMs: at,
        charStart: s.cs + m.index,
        ...(emphasis.get(words.length) ? { emphasis: emphasis.get(words.length) } : {}),
      });
      at += ((m[0].length + 1) / weight) * s.dm;
    }
  }
  if (words.length === 0) {
    const matches = [...text.matchAll(/\S+/g)];
    matches.forEach((m, i) =>
      words.push({
        text: m[0],
        startMs: (i / matches.length) * durationMs,
        charStart: m.index,
        ...(emphasis.get(i) ? { emphasis: emphasis.get(i) } : {}),
      }),
    );
  }
  return words;
};

// Caption pages: by default at most three words or ~20 characters, never
// across a sentence boundary — the band holds one thought at a time.
//
// Both sizes are a SKIN's decision, and the two references prove it in
// opposite directions. One shows exactly ONE word at a time (maxWords: 1).
// The other builds a long line that grows word by word and resets on the
// clause (maxWords: 8, maxChars: 44) — which the `words` mode already does,
// because it lays the page out and lets each word arrive onto it. Nothing
// but this cap stood between the engine and that look.
const CAP_WORDS = config.theme?.captions?.maxWords ?? 3;
const CAP_CHARS = config.theme?.captions?.maxChars ?? 20;

/**
 * `caps` is the BEAT's resolved subtitle style, not the project's.
 *
 * A preset that changed the look but not the pagination would be a preset
 * that lies: `maxWords`/`maxChars` decide how a sentence is cut into pages,
 * and that decision is made here, in Node, before a frame exists. This is
 * exactly why subtitles.mjs is plain JS — the renderer has to run the same
 * resolution the component will.
 */
/**
 * A WORD LONGER THAN THE CHARACTER CAP — the one case neither side can fix.
 *
 * Pagination cannot help: a word over the cap is always its own page. The
 * band cannot either: it shrinks to its floor and then runs off both edges
 * of the frame, which is loud but unreadable. Node cannot measure text, but
 * it can count, and counting is enough to catch this one — so it is said
 * out loud here, before the voice is billed, rather than discovered in a
 * frame.
 */
const warnWide = (texts, cap) => {
  const over = [...new Set(
    texts.map((t) => t.replace(/\*/g, "")).filter((t) => t.length > cap),
  )];
  if (!over.length) return;
  console.log(
    `WIDE  ${over.join(", ")} — longer than the ${cap}-char cap, so the band ` +
      `will shrink to its floor and still overflow. Split it, or raise ` +
      `maxChars, or lower the look's \`floor\`.`,
  );
};

const paginate = (words, leadMs, caps) => {
  const CAP_WORDS = caps?.maxWords ?? 3;
  const CAP_CHARS = caps?.maxChars ?? 20;
  const pages = [];
  let page = null;
  for (const w of words) {
    const chars = page ? page.chars + 1 + w.text.length : w.text.length;
    if (!page || page.words.length >= CAP_WORDS || chars > CAP_CHARS) {
      page = { startFrame: msToFrames(leadMs + w.startMs), words: [], chars: 0 };
      pages.push(page);
    }
    page.words.push({
      text: w.text,
      startFrame: msToFrames(leadMs + w.startMs),
      ...(w.emphasis ? { emphasis: w.emphasis } : {}),
    });
    page.chars = page.chars ? page.chars + 1 + w.text.length : w.text.length;
    if (/[.!?]$/.test(w.text)) page = null;
  }
  warnWide(words.map((w) => w.text), CAP_CHARS);
  return pages.map(({ startFrame, words: ws }) => ({ startFrame, words: ws }));
};

/**
 * Caption pages for a beat nobody speaks — someone else's sentence under
 * their own footage. One line per page, spread evenly across the hold,
 * every word of a page landing at once (there is no per-word timing to
 * borrow: the TTS never saw these words).
 */
const quotePages = (lines, frames, caps) => {
  warnWide(lines.flatMap((l) => l.split(/\s+/)), caps?.maxChars ?? CAP_CHARS);
  return lines.map((line, i) => {
    const startFrame = Math.round((i / lines.length) * frames);
    // The `*emphasis*` markers have to be parsed here too, and this is the
    // one path that never did: `beat.say` goes through emphasisWords() while
    // a `quote` or a `label` went straight to the band with its markup
    // intact, so the asterisks PRINTED. Found on a preset sheet whose own
    // labels came out reading `BEAST *MODE*`.
    const levels = emphasisWords(line);
    return {
      startFrame,
      words: line
        .split(/\s+/)
        .filter(Boolean)
        .map((raw, w) => ({
          text: raw.replace(/\*/g, ""),
          startFrame,
          ...(levels.get(w) ? { emphasis: levels.get(w) } : {}),
        })),
    };
  });
};

/**
 * Everything ONE screen needs staged: the files it reads copied into the
 * bundle's public/, and every measurement that can only be read off a file
 * (a clip's frame rate, a video's shape, an image's dominant ink) written
 * onto the element.
 *
 * A function rather than a block inside the beat loop because a beat can
 * now carry SEVERAL screens (`shots`), and each one has to be staged
 * exactly like the single picture a beat used to own.
 *
 * `where` already names the post, the beat and — inside a multi-shot beat —
 * the shot, so every refusal here points at one picture.
 */
const stageScreen = async (el, { say, where }) => {

  // Art anywhere inside a lab element's props. One rule — any object
  // carrying an `image` gets an `ascii` beside it, converted with that
  // object's own tuning — which is what makes `dissolve` (two
  // pre-converted specimens) reachable from a post at all. It has been
  // in the registry since 2026-08-02 and has never appeared in a reel,
  // because nothing filled its props.
  if (el.type === "lab" && el.props) {
    const convert = async (node) => {
      if (!node || typeof node !== "object") return;
      if (typeof node.image === "string" && !node.ascii) {
        const src = path.join(postsDir, "art", node.image);
        if (!existsSync(src)) {
          throw new Error(`lab art "${node.image}" not found in posts/art/`);
        }
        node.ascii = await imageToAscii(src, node);
      }
      for (const v of Object.values(node)) {
        if (v && typeof v === "object") await convert(v);
      }
    };
    await convert(el.props);
  }

  // Figures convert their art here, same converter as the slides.
  if (el.type === "figure") {
    const src = path.join(postsDir, "art", el.image);
    if (!existsSync(src)) {
      throw new Error(`figure "${el.image}" not found in posts/art/`);
    }
    el.ascii = await imageToAscii(src, el);
  }

  // The mockup rides from posts/mockups/, same pool as the slides.
  if (el.type === "mockup") {
    const src = path.join(postsDir, "mockups", el.file);
    if (!existsSync(src)) {
      throw new Error(`mockup "${el.file}" not found in posts/mockups/`);
    }
    const dir = path.join(projectDir, "public", "mockups");
    mkdirSync(dir, { recursive: true });
    copyFileSync(src, path.join(dir, el.file));
  }

  // The endcard is the App Store's own product row, printed. It rides
  // from the same pool as the mockups and defaults to the one file the
  // account actually needs.
  if (el.type === "endcard") {
    // The CUT-OUT row, not the screenshot: the capture's page is pure
    // black and our dark paper is #151412, so the plate printed as a
    // visible rectangle — the same 21-unit gap that made `bg: "ink"` a
    // no-op. `appstore-row.png` is made from the .jpg by
    // `npm run mockup:alpha` (border flood fill, then cropped to the
    // ink); both originals stay selectable per post via `file`.
    //
    // The default comes from the PROJECT (`endcard.asset` in
    // reel.config.mjs). It was the literal "appstore-row.png" here, which is
    // the file one account happens to have cut; a project with no such
    // capture got "endcard not found in posts/mockups/" naming a file it had
    // never heard of. Found on Papyr, which has no row cut yet — so the
    // refusal now says what to set and what to run.
    el.file = el.file ?? config.endcard?.asset ?? "appstore-row.png";
    const src = path.join(postsDir, "mockups", el.file);
    if (!existsSync(src)) {
      throw new Error(
        `endcard "${el.file}" not found in posts/mockups/.\n` +
          `       Set \`endcard.asset\` in reel.config.mjs to the row this ` +
          `project actually has, cut one with \`reelkit mockup:alpha\`, or ` +
          `sign off with the \`cta\` element, which needs no asset.`,
      );
    }
    const dir = path.join(projectDir, "public", "mockups");
    mkdirSync(dir, { recursive: true });
    copyFileSync(src, path.join(dir, el.file));
  }

  // A placed item is staged exactly like `media` — same pool, same
  // public/ folder. What differs is only WHEN it leaves the frame, and
  // that is Reel.tsx's business, not staging's.
  if (el.type === "place") {
    const dir = path.join(projectDir, "public", "media");
    mkdirSync(dir, { recursive: true });
    for (const item of el.items ?? [el]) {
      const src = path.join(postsDir, "media", item.file);
      if (!existsSync(src)) {
        throw new Error(`place "${item.file}" not found in posts/media/`);
      }
      copyFileSync(src, path.join(dir, item.file));
      // The halo takes the item's OWN colour. Read here, at staging, from
      // the pixels that carry the drawing rather than from the whole
      // image — averaging in the black background would drag every glow
      // toward grey and undo the point.
      if (!item.glow) item.glow = dominantInk(src);
    }
  }

  // A footage box: the file, plus the optional matte that spills outside it.
  // Same pool and same public/ folder as `media` — what differs is the shape
  // it is drawn in, and that is Footage.tsx's business, not staging's.
  if (el.type === "footage") {
    const dir = path.join(projectDir, "public", "media");
    mkdirSync(dir, { recursive: true });
    const spec = el.spec ?? {};
    for (const file of [spec.file, spec.spill?.matte].filter(Boolean)) {
      const src = path.join(postsDir, "media", file);
      if (!existsSync(src)) {
        throw new Error(
          `footage "${file}" not found in posts/media/ — drop the file there.`,
        );
      }
      copyFileSync(src, path.join(dir, file));
    }
    // The spill has to be drawn at the size `object-fit: cover` would have
    // produced, and a Remotion component rendering one frame cannot ask a
    // video how big it is. Measured here, the way `media` already measures.
    if (spec.spill?.matte) {
      const [w, h] = execFileSync(
        "ffprobe",
        ["-v", "error", "-select_streams", "v:0", "-show_entries",
         "stream=width,height", "-of", "csv=p=0:s=x",
         path.join(postsDir, "media", spec.spill.matte)],
        { encoding: "utf8" },
      ).trim().split("x").map(Number);
      spec.spill.srcW = w;
      spec.spill.srcH = h;
    }
  }

  // Real footage or a real photograph, at full quality — the only thing
  // on this stage that is not redrawn. Measured off the file (kind,
  // shape, length), trimmed by seconds in the post, and staged where
  // Remotion can stream it.
  if (el.type === "media") {
    const src = path.join(postsDir, "media", el.file);
    if (!existsSync(src)) {
      throw new Error(
        `media "${el.file}" not found in posts/media/ — drop the file there.`,
      );
    }
    // The `credit` requirement is GONE (Martin, 2026-09-08: "on s'en fout
    // de créditer nos ressources à partir de maintenant", "c'est
    // littéralement un requirement stupide"). It blocked the genre these
    // formats are copied from, where a reel carries dozens of borrowed
    // cutaways rather than one quoted clip. `credit` is still accepted on
    // an element and still drawn where a post sets it — it is no longer
    // demanded.
    const dir = path.join(projectDir, "public", "media");
    mkdirSync(dir, { recursive: true });
    copyFileSync(src, path.join(dir, el.file));
    el.kind = /\.(mp4|mov|m4v|webm)$/i.test(el.file) ? "video" : "photo";
    const [w, h] = execFileSync(
      "ffprobe",
      ["-v", "error", "-select_streams", "v", "-show_entries", "stream=width,height", "-of", "csv=p=0", src],
      { encoding: "utf8" },
    )
      .trim()
      .split(",")
      .map(Number);
    el.aspect = h > 0 ? w / h : 16 / 9;
    if (el.kind === "video") {
      const seconds = Number(
        execFileSync(
          "ffprobe",
          ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", src],
          { encoding: "utf8" },
        ).trim(),
      );
      const start = Math.max(0, el.start ?? 0);
      const end = Math.min(el.end ?? seconds, seconds);
      if (end <= start) {
        throw new Error(
          `media "${el.file}": end (${end}s) is not after start (${start}s)`,
        );
      }
      el.trimBefore = Math.round(start * FPS);
      el.trimAfter = Math.round(end * FPS);
      el.excerptMs = (end - start) * 1000;
    }
    // Two voices at once is neither of them. If the excerpt is meant to
    // be HEARD, the beat holds and says nothing of its own.
    if (el.audio > 0 && say) {
      throw new Error(
        `${where}: the media excerpt plays at ${el.audio} and the ` +
          `beat also speaks. Drop the \`say\` (the excerpt is the beat) or ` +
          `mute the excerpt.`,
      );
    }
  }

  // A recording plays as video — the app itself, not a conversion of
  // it. Same pool as the clips (posts/clips/), staged under public/
  // where Remotion can stream it.
  if (el.type === "recording") {
    const src = path.join(postsDir, "clips", el.file);
    if (!existsSync(src)) {
      throw new Error(`recording "${el.file}" not found in posts/clips/`);
    }
    const dir = path.join(projectDir, "public", "clips");
    mkdirSync(dir, { recursive: true });
    copyFileSync(src, path.join(dir, el.file));
    // The take's own length (what <Loop> replays) and its shape (what
    // the frame is measured from) — both read off the file, never
    // guessed in the post.
    const seconds = Number(
      execFileSync(
        "ffprobe",
        ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", src],
        { encoding: "utf8" },
      ).trim(),
    );
    const [w, h] = execFileSync(
      "ffprobe",
      ["-v", "error", "-select_streams", "v", "-show_entries", "stream=width,height", "-of", "csv=p=0", src],
      { encoding: "utf8" },
    )
      .trim()
      .split(",")
      .map(Number);
    el.loopFrames = Math.max(1, Math.round(seconds * FPS));
    el.aspect = h > 0 ? w / h : 1;
  }

  // Clips (posts/clips/) become animated specimens: every source frame
  // through the same converter, trim forced off so the geometry holds
  // from frame to frame and the specimen never trembles.
  if (el.type === "clip") {
    const src = path.join(postsDir, "clips", el.file);
    if (!existsSync(src)) {
      throw new Error(`clip "${el.file}" not found in posts/clips/`);
    }
    const nb = Number(
      execFileSync(
        "ffprobe",
        ["-v", "error", "-select_streams", "v", "-show_entries", "stream=nb_frames", "-of", "csv=p=0", src],
        { encoding: "utf8" },
      ).trim(),
    );
    const dur = Number(
      execFileSync(
        "ffprobe",
        ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", src],
        { encoding: "utf8" },
      ).trim(),
    );
    el.clipFps = nb > 0 && dur > 0 ? nb / dur : 12;
    const tmp = mkdtempSync(path.join(os.tmpdir(), "reel-clip-"));
    execFileSync("ffmpeg", ["-i", src, "-vsync", "0", path.join(tmp, "f_%04d.png"), "-loglevel", "error"]);
    el.frames = [];
    for (const f of readdirSync(tmp).filter((n) => n.endsWith(".png")).sort()) {
      el.frames.push(
        await imageToAscii(path.join(tmp, f), { ...el, trim: false, cutout: false }),
      );
    }
    rmSync(tmp, { recursive: true, force: true });
  }
};

/**
 * A photo background — the same licensed pool the art slides draw from
 * (posts/art/ + LICENSES.md), staged under public/bg/.
 */
const stageBg = (bg) => {
  const src = path.join(postsDir, "art", bg);
  if (!existsSync(src)) {
    throw new Error(`bg "${bg}" not found in posts/art/`);
  }
  const bgDir = path.join(projectDir, "public", "bg");
  mkdirSync(bgDir, { recursive: true });
  copyFileSync(src, path.join(bgDir, bg));
};

/**
 * The shots of a beat, laid across the beat's own length.
 *
 * The point of the whole exercise: a beat's length is its spoken line, and
 * the pictures under that line cut on their own schedule. A shot names
 * `seconds` for an exact length, or `weight` for a share of whatever the
 * voice leaves (default 1 — three plain shots are thirds).
 *
 * The shots TILE the beat exactly: no gap, no overflow. The last weighted
 * shot absorbs the rounding, and the whole remainder when every shot named
 * its own seconds. A shot that would land under one frame is refused — it
 * is a picture nobody sees, and dropping it silently is how a render lies.
 */
const layShots = (shots, frames, where) => {
  const fixed = shots.map((s) => (s.seconds != null ? msToFrames(s.seconds * 1000) : null));
  const weights = shots.map((s, k) => (fixed[k] != null ? 0 : Math.max(0, s.weight ?? 1)));
  const fixedTotal = fixed.reduce((n, f) => n + (f ?? 0), 0);
  const weightTotal = weights.reduce((n, w) => n + w, 0);
  const free = frames - fixedTotal;
  if (free < 0) {
    throw new Error(
      `${where}: the shots ask for ${(fixedTotal / FPS).toFixed(2)} s and the ` +
        `beat runs ${(frames / FPS).toFixed(2)} s. Shorten a shot, hold the beat ` +
        `longer, or drop a \`seconds\` and let that shot take what is left.`,
    );
  }
  const lengths = fixed.map((f, k) =>
    f != null ? f : weightTotal ? Math.round((free * weights[k]) / weightTotal) : 0,
  );
  // Into the last WEIGHTED shot where there is one: a shot that named its
  // own seconds asked for a length and gets to keep it.
  let absorber = lengths.length - 1;
  for (let k = lengths.length - 1; k >= 0; k--) {
    if (fixed[k] == null) {
      absorber = k;
      break;
    }
  }
  lengths[absorber] += frames - lengths.reduce((n, f) => n + f, 0);
  const short = lengths.findIndex((f) => f < 1);
  if (short !== -1) {
    throw new Error(
      `${where}: shot ${short + 1} lands on ${lengths[short]} frame(s) — a ` +
        `picture nobody sees. Give the beat more to say, hold it longer, or ` +
        `cut the shot.`,
    );
  }
  let at = 0;
  return lengths.map((durationInFrames, k) => {
    const startFrame = at;
    at += durationInFrames;
    return { shot: shots[k], startFrame, durationInFrames };
  });
};

for (const name of names) {
  const post = JSON.parse(
    readFileSync(path.join(postsDir, `${name}.json`), "utf8"),
  );
  // Presets resolve here, before anything reads the reel — the gates, the
  // budget, the TTS. A preset is a named JSON fragment merged UNDER the node
  // that names it (presets.mjs), so everything downstream sees one plain
  // spec and no part of the pipeline needs to know presets exist.
  const reel = post.reel
    ? resolvePresets(post.reel, name, presetBank(projectDir))
    : post.reel;
  if (!reel?.beats?.length) {
    throw new Error(
      `${name} has no reel script. A reel is not the slideshow spoken — ` +
        `write the beats from the brief (REELS.md), under a "reel" key.`,
    );
  }

  // ------------------------------------------------------------------
  // The gates run BEFORE the first TTS call. A word over the ceiling, a
  // sentence printed on the paper and a reel shaped like the last eleven
  // are all cheap to fix in the JSON and expensive to fix in an MP4 —
  // and the voice is billed by the line.
  // `_name` is the standing convention for a file that can never ship
  // (gates.mjs reads it the same way). The three writing gates exist to
  // protect a published reel; on a probe or a demo sheet they only refuse
  // to render the thing you built them to inspect.
  const isProbe = name.startsWith("_");
  if (isProbe) console.log(`PROBE  ${name} — underscore file, writing gates skipped`);

  const budget = budgetAudit(reel.beats);
  if (!isProbe) console.log(
    `BUDGET ${name}  ${budget.words} words` +
      (budget.silent ? ` + ${budget.silent.toFixed(1)} s held` : "") +
      ` → ${budget.seconds.toFixed(0)}–${budget.slowSeconds.toFixed(0)} s ` +
      `(target ${TARGET_S} s / ${budget.targetWords} w, ` +
      `ceiling ${CEILING_S} s / ${budget.ceilingWords} w)`,
  );
  for (const w of budget.warnings) console.log(`WARN   ${name} — ${w}`);
  for (const w of blankAudit(reel.beats)) console.log(`BLANK  ${name} — ${w}`);
  if (budget.errors.length && !allowLong && !isProbe) {
    throw new Error(
      `${name}: ${budget.errors.join(" ")}\n` +
        `       --long ships it anyway, and prints the overage every time.`,
    );
  }
  if (budget.errors.length) {
    console.log(`LONG   ${name} — over the ceiling, shipped on --long: ${budget.errors[0]}`);
  }

  const prose = isProbe ? [] : proseAudit(reel.beats);
  for (const p of prose) console.log(`${loose ? "WARN  " : "PROSE "} ${name} ${p}`);
  if (prose.length && !loose && !isProbe) {
    throw new Error(
      `${name}: ${prose.length} beat(s) print words the voice is already ` +
        `saying. Cut them, or re-render an old post with --loose.`,
    );
  }

  // The comment gate is the only attribution the account has, so a post
  // that disagrees with its own caption cannot be answered at all.
  const gate = gateAudit(name, reel.beats);
  for (const g of gate) console.log(`GATE   ${name} — ${g}`);
  if (gate.length && !loose && !isProbe) {
    throw new Error(`${name}: ${gate[0]}`);
  }

  // Warned here, REFUSED at ship — the same split as the sound register:
  // rendering is auditioning, shipping is distributing, and a caption
  // that is too long only costs anything at the moment it is pasted.
  for (const c of captionAudit(name)) console.log(`CAPLEN ${name} — ${c}`);

  const shape = shapeAudit(name, reel.beats);
  console.log(`SHAPE  ${name}  ${shape.shape.join(" · ")}`);
  if (shape.fresh.length) {
    console.log(`FRESH  ${name}  ${shape.fresh.join(", ")} — rare in the bank`);
  }
  for (const w of shape.warnings) console.log(`WARN   ${name} — ${w}`);

  if (gatesOnly) {
    console.log(
      `GATES  ${name} — passed. Nothing spoken, nothing rendered. ` +
        `Drop --gates to make the file.`,
    );
    process.exit(0);
  }

  const publicAudioDir = path.join(projectDir, "public", "audio", name);
  mkdirSync(publicAudioDir, { recursive: true });

  const beats = [];
  let totalFrames = 0;
  for (const [i, beat] of reel.beats.entries()) {
    // A named preset that does not exist has to fail HERE — before a word is
    // sent to RunPod. Resolving it late means the bill is already paid when
    // the typo surfaces, which is the shape of failure this file exists to
    // prevent everywhere else.
    resolveSubtitles(beat.subtitles ?? reel.subtitles, config.theme?.captions ?? {});
    // A beat shows ONE picture, or several.
    //
    // `screen` is the single-picture form and is untouched — same key, same
    // engine props, same frames. `shots` is the decoupled one: a list of
    // pictures cutting on their own schedule underneath one spoken line,
    // which is what every reel in docs/REFERENCES.md actually does and what
    // one-beat-one-screen-one-line could not express at all.
    if (beat.screen && beat.shots) {
      throw new Error(
        `${name} beat ${i + 1} carries both \`screen\` and \`shots\`. One ` +
          `picture is \`screen\`; several are \`shots\`, each with its own.`,
      );
    }
    const single = !beat.shots;
    if (!single && (!Array.isArray(beat.shots) || !beat.shots.length)) {
      throw new Error(`${name} beat ${i + 1}: \`shots\` is an empty list.`);
    }
    const shots = beat.shots ?? [{ screen: beat.screen, bg: beat.bg }];
    // The first shot's screen answers for the beat wherever a beat-level
    // default reads the element (the silent hold, the log line).
    const el = shots[0].screen;

    // A tier list can be laid out perfectly and still be unreadable: the
    // element shrinks the names until they clear the numbers, and past a
    // point what clears is texture. The reel is the surface that decides
    // — it scales every lab element to 0.79 — so the audit runs here,
    // beside the beat it belongs to, and warns.
    const tierWarns = [];
    for (const [k, shot] of shots.entries()) {
      const screen = shot.screen;
      const where = single
        ? `${name} beat ${i + 1}`
        : `${name} beat ${i + 1} shot ${k + 1}`;
      if (!screen?.type) {
        throw new Error(`${where} has no screen element`);
      }
      // A placed item outlives its own beat — that is the whole of what it
      // is — and a shot ends when the next picture cuts. The two cannot be
      // one object, so `place` stays a beat of its own.
      if (!single && screen.type === "place") {
        throw new Error(
          `${where}: \`place\` outlives its beat and a shot does not. A placed ` +
            `item is a beat of its own, never a shot.`,
        );
      }
      if (/\bTODO\b/i.test([beat.say, JSON.stringify(screen)].join(" "))) {
        throw new Error(
          `${where} still carries a placeholder. Write the line first — REELS.md.`,
        );
      }
      await stageScreen(screen, { say: beat.say, where });
      if (screen.type === "lab" && screen.element === "tierlist") {
        tierWarns.push({ props: screen.props, at: { post: name, where } });
      }
      // "ink" and "bed" are not files. "ink" is the inverted paper; "bed"
      // means paint nothing and let the reel's bed show through.
      if (shot.bg && shot.bg !== "ink" && shot.bg !== "bed") stageBg(shot.bg);
    }

    // A beat's own bed, if it has one. At BEAT level, not inside an
    // element branch: a beat can carry a sound without carrying a placed
    // item, and the first version of this silently dropped exactly that.
    if (beat.sound?.file) {
      const sSrc = path.join(postsDir, "music", beat.sound.file);
      if (!existsSync(sSrc)) {
        throw new Error(`sound "${beat.sound.file}" not found in posts/music/`);
      }
      const sDir = path.join(projectDir, "public", "music");
      mkdirSync(sDir, { recursive: true });
      copyFileSync(sSrc, path.join(sDir, beat.sound.file));
    }

    /** The shot list this beat hands the composition, laid over `frames`. */
    const shotProps = (frames) =>
      layShots(shots, frames, `${name} beat ${i + 1}`).map(
        ({ shot, startFrame, durationInFrames }) => ({
          element: shot.screen,
          startFrame,
          durationInFrames,
          // A shot has no spoken word to hang a [+] on, so its cues are
          // SECONDS into the shot — the form a silent beat already uses,
          // for the same reason.
          cueFrames: (shot.cues ?? []).map((t) => msToFrames(t * 1000)),
          ...(shot.bg ? { bg: shot.bg } : {}),
          ...(shot.border !== undefined ? { border: shot.border ?? null } : {}),
          ...(shot.field !== undefined ? { field: shot.field ?? null } : {}),
        }),
      );

    if (!beat.say) {
      // How long a silent beat holds, in order of who knows best:
      //
      // 1. the post, if it says
      // 2. the excerpt's own length, for an unmuted media beat — the
      //    person finishes their sentence and the reel moves on
      // 3. the endcard's ceiling: it is read, not spoken, and a store row
      //    on screen for two full seconds is an advertisement
      // 4. two seconds
      const holdMs =
        beat.hold != null
          ? beat.hold * 1000
          : el.type === "media" && el.excerptMs
            ? el.excerptMs
            : el.type === "endcard"
              ? ENDCARD_MS
              : SILENT_HOLD_MS;
      if (el.type === "endcard" && holdMs > ENDCARD_MAX_MS) {
        throw new Error(
          `${name} beat ${i + 1}: the endcard holds ${(holdMs / 1000).toFixed(1)} s. ` +
            `It is a glance, not a beat — ${ENDCARD_MAX_MS / 1000} s is the ceiling.`,
        );
      }
      const frames = msToFrames(holdMs);
      // A silent beat may still choreograph: `cues` in SECONDS into the
      // hold, since there are no spoken words to hang a [+] on.
      const heldCues = (beat.cues ?? []).map((t) => msToFrames(t * 1000));
      // The look this beat's band will be drawn with — needed here only for
      // its character cap, so an unfittable word is named before the render.
      const heldStyle = resolveSubtitles(
        beat.subtitles ?? reel.subtitles,
        config.theme?.captions ?? {},
      );
      beats.push({
        // The single-picture form keeps the shape it has always had — one
        // `element`, one `cueFrames`, one `bg` — so a post that has not
        // asked for shots hands the composition byte-identical props.
        ...(single
          ? { element: el, cueFrames: heldCues, ...(beat.bg ? { bg: beat.bg } : {}) }
          : { cueFrames: [], shots: shotProps(frames) }),
        durationInFrames: frames,
        ...(beat.view ? { view: beat.view } : {}),
        ...(beat.border !== undefined ? { border: beat.border ?? null } : {}),
        ...(beat.field !== undefined ? { field: beat.field ?? null } : {}),
        ...(beat.sound ? { sound: beat.sound } : {}),
        // A muted excerpt still says something — print it in the caption
        // band, one line at a time, spread across the hold. The band is
        // already the place the viewer reads words; borrowing it for
        // someone else's sentence costs nothing and adds no chrome.
        // `label` borrows the same band to name a beat, which is what the
        // demo sheet needs and what nothing else should use.
        ...(el.quote?.length
          ? { pages: quotePages(el.quote, frames, heldStyle) }
          : beat.label
            ? { pages: quotePages([beat.label], frames, heldStyle) }
            : {}),
        ...(beat.subtitles !== undefined ? { subtitles: beat.subtitles } : {}),
        ...(beat.cutout !== undefined ? { cutout: beat.cutout ?? null } : {}),
      });
      totalFrames += frames;
      console.log(
        `BEAT  ${name} ${i + 1}/${reel.beats.length}  ` +
          `${(holdMs / 1000).toFixed(1)}s hold  (${shapeOfShots(shots)})`,
      );
      for (const t of tierWarns) warnTierList(t.props, t.at);
      continue;
    }

    // Marked BEFORE the asterisks are stripped, and stripped before the
    // voice ever sees them — a TTS reading "star word star" out loud is
    // exactly the kind of defect that ships once and is heard by everyone.
    const emphasis = emphasisWords(beat.say);
    const { clean, positions } = parseCues(beat.say.replace(/\*/g, ""));
    // A `[+]` prints one PART of the screen on the word the voice reaches
    // it. A beat with several shots has several screens, so the marker no
    // longer names anything — each shot carries its own `cues`, in seconds
    // into that shot, exactly as a silent beat does.
    if (!single && positions.length) {
      throw new Error(
        `${name} beat ${i + 1}: ${positions.length} [+] cue(s) on a beat with ` +
          `${shots.length} shots. A [+] prints a part of THE screen and this ` +
          `beat has several — give the shot its own \`cues\` (seconds into ` +
          `that shot) instead.`,
      );
    }
    const parts = single ? partsOf(el) : -1;
    if (parts !== -1 && positions.length !== 0 && positions.length !== parts) {
      throw new Error(
        `${name} beat ${i + 1}: ${positions.length} [+] cue(s) for a ` +
          `${el.type} with ${parts} part(s) — cue every part or none, ` +
          `or something prints out of order.`,
      );
    }

    // beat.voice > reel.voice > project config.voice > DEFAULT_VOICE —
    // resolved once here so `--revoice`'s forget() and the real speak()
    // agree on exactly what they are keying the cache on.
    const voice = resolveVoice(reel.voice ?? {}, beat.voice ?? {});
    if (revoiceBeats === "all" || revoiceBeats?.has(i + 1)) {
      const gone = forget(name, i, clean, voice, { mock });
      if (gone) console.log(`REVOICE ${name} beat ${i + 1} — dropped ${gone} cached file(s)`);
    }
    const clip = await speak(name, i, clean, voice, { mock });
    const basename = path.basename(clip.file);
    copyFileSync(clip.file, path.join(publicAudioDir, basename));

    const words = wordTimings(clean, clip.sentences, clip.durationMs, emphasis);
    // Two `[+]` markers can land on ONE frame — a short word spoken fast is
    // under 33 ms, and the timings are interpolated inside a sentence, so
    // nothing upstream guarantees they separate. Any element that
    // interpolates BETWEEN consecutive cues (the timeline head, the flow
    // connectors) then gets a zero-width range and Remotion throws
    // `inputRange must be strictly monotonically increasing` — a crash
    // after the TTS bill, with a message that names no beat and no post.
    //
    // Fixing it per element would be a dozen guards; the cue list is the
    // one place the invariant belongs, so it is enforced once, here, and
    // every element downstream can assume it. One frame is 33 ms — below
    // the sync error the ear can hear against a spoken word.
    const cueFrames = [];
    for (const p of positions) {
      const word = words.find((w) => w.charStart >= p) ?? words[words.length - 1];
      const at = msToFrames(LEAD_MS + word.startMs);
      const last = cueFrames[cueFrames.length - 1];
      cueFrames.push(last == null || at > last ? at : last + 1);
    }

    // `hold` on a SPOKEN beat: silent frames after the line lands.
    //
    // The picture used to leave the instant the voice did, so a beat could
    // never sit on its last word — and the reproduction of a 7.0 s
    // reference came out at 14.8 s precisely because the references spend
    // most of each card's screen time holding after the clause finishes
    // (research/2026-09-08/.../GAPS-rendered.md #3). Same key and same
    // meaning as on a silent beat, where the clip is simply 0 ms long:
    // `hold` is what the beat does once nobody is speaking.
    const holdMs = beat.hold != null ? beat.hold * 1000 : 0;
    const beatMs = Math.max(MIN_BEAT_MS, LEAD_MS + clip.durationMs + TAIL_MS + holdMs);
    const frames = msToFrames(beatMs);
    beats.push({
      ...(single
        ? { element: el, cueFrames, ...(beat.bg ? { bg: beat.bg } : {}) }
        : { cueFrames: [], shots: shotProps(frames) }),
      durationInFrames: frames,
      ...(beat.border !== undefined ? { border: beat.border ?? null } : {}),
      ...(beat.field !== undefined ? { field: beat.field ?? null } : {}),
      ...(beat.sound ? { sound: beat.sound } : {}),
      // The camera this beat frames from. Passed through untouched — the
      // easing between legs is Reel.tsx's, because it needs the frame.
      ...(beat.view ? { view: beat.view } : {}),
      audio: `audio/${name}/${basename}`,
      audioStartFrame: msToFrames(LEAD_MS),
      ...(beat.subtitles !== undefined ? { subtitles: beat.subtitles } : {}),
      ...(beat.cutout !== undefined ? { cutout: beat.cutout ?? null } : {}),
      pages: paginate(
        words,
        LEAD_MS,
        resolveSubtitles(beat.subtitles ?? reel.subtitles, config.theme?.captions ?? {}),
      ),
    });
    totalFrames += frames;
    console.log(
      `BEAT  ${name} ${i + 1}/${reel.beats.length}  ` +
        `${(clip.durationMs / 1000).toFixed(1)}s` +
        (holdMs ? ` + ${(holdMs / 1000).toFixed(1)}s hold` : "") +
        ` · ${cueFrames.length} cues  (${shapeOfShots(shots)})`,
    );
    for (const t of tierWarns) warnTierList(t.props, t.at);
  }

  // Background music rides under the voice — a file Martin dropped in
  // posts/music/. It is NORMALIZED to the voice's own loudness on the way
  // in, so `volume` means one thing across every bed: a dB offset under
  // the narration. (Learned the hard way: a public-domain Gnossienne at
  // -34 LUFS against a -26 LUFS voice is inaudible at any sane volume,
  // while a loud pop master would bury the words at the same number.)
  let music = null;
  if (reel.music) {
    const file = typeof reel.music === "string" ? reel.music : reel.music.file;
    const src = path.join(postsDir, "music", file);
    if (!existsSync(src)) {
      throw new Error(`music "${file}" not found in posts/music/`);
    }
    const musicDir = path.join(projectDir, "public", "music");
    mkdirSync(musicDir, { recursive: true });
    const staged = path.join(musicDir, `norm-${file.replace(/\.[^.]+$/, "")}.m4a`);
    if (!existsSync(staged)) {
      execFileSync("ffmpeg", [
        "-i", src,
        "-af", "loudnorm=I=-26:TP=-2:LRA=11",
        // Same -ar trap as the final pass: loudnorm without it hands the
        // encoder 192 kHz, and a bed at an odd rate gets resampled again
        // inside Remotion before it ever meets the voice.
        "-c:a", "aac", "-b:a", "160k", "-ar", "48000",
        "-y", staged,
      ], { stdio: "pipe" });
      console.log(`MUSIC  ${file} normalized to -26 LUFS`);
    }
    music = {
      file: `music/${path.basename(staged)}`,
      volume: reel.music.volume ?? 0.5,
    };
  }

  // Room tone — the floor under the whole track.
  //
  // Not an effect and not music: the effects sit 14 dB under the voice
  // and land on events, this sits 30 dB under and never stops. What it
  // fixes is that our silence is a mathematical zero, which the ear reads
  // as "the audio dropped out" — most audibly at the hard cut between two
  // beats and under the endcard, which has no voice at all. It is
  // normalized by INTEGRATED loudness (it is continuous, so R128 applies
  // properly) and looped, exactly like a music bed.
  let roomTone = null;
  if (!noSfx && (reel.roomtone ?? reel.roomTone)) {
    const spec = reel.roomtone ?? reel.roomTone;
    const ready = sourcedRoomTone();
    if (!ready) {
      throw new Error(
        `this post asks for room tone and posts/sfx/sourced/room-tone.wav ` +
          `is not imported — \`reelkit sfx:import\`.`,
      );
    }
    if (ready.unregistered) {
      console.log(
        `UNREG  room-tone has no source/license row in ` +
          `posts/sfx/sourced.json — it renders, it does not ship.`,
      );
    }
    const dir = path.join(projectDir, "public", "sfx");
    mkdirSync(dir, { recursive: true });
    copyFileSync(ready.file, path.join(dir, "room-tone.wav"));
    roomTone = {
      file: "sfx/room-tone.wav",
      volume: (typeof spec === "object" ? spec.volume : null) ?? ROOM_TONE_VOLUME,
    };
    console.log(
      `TONE  ${name} room tone at ${(20 * Math.log10(roomTone.volume)).toFixed(0)} dB under the voice`,
    );
  }

  // Sound design — one effect per animation event, on the SAME frame the
  // element prints on, because both come from the same [+] cue. Opt-in
  // per post (`"sfx": true` in the reel block), so a re-render of
  // anything already shipped is unchanged. `--no-sfx` renders the same
  // post silent, to <name>.nosfx.mp4, for the A/B.
  const sfx = noSfx
    ? null
    : buildSfx(beats, forceSfx || reel.sfx, FPS, { preferSynth });
  if (sfx) {
    const counts = sfx.reduce((m, s) => {
      const n = path.basename(s.file, ".wav").replace(/2$/, "");
      return { ...m, [n]: (m[n] ?? 0) + 1 };
    }, {});
    console.log(
      `SFX   ${sfx.length} effect(s) — ` +
        Object.entries(counts).map(([k, v]) => `${v}× ${k}`).join(", ") +
        ` · ${(20 * Math.log10(sfx[0].volume)).toFixed(0)} dB under the voice` +
        (buildSfx.origins && [...buildSfx.origins.values()].some(Boolean)
          ? `  · ${[...buildSfx.origins].filter(([, v]) => v).map(([k]) => k).join(", ")} from posts/sfx/sourced/`
          : "  · synthesized kit") +
        (preferSynth ? " (--synth)" : "") +
        (forceSfx && !reel.sfx ? "  — AUDITION (--sfx), the post has not opted in" : ""),
    );
  } else if (noSfx && reel.sfx) {
    console.log("SFX   suppressed (--no-sfx)");
  }

  // The presenter card, if the post asks for one. Same pool as the clips
  // (posts/clips/), staged under public/ — the `recording` path, minus the
  // per-beat measuring, because this take is not a beat: it runs under all
  // of them. Staged HERE, above the bundle, for the reason the next comment
  // gives: a file copied after bundling is not in the bundle's public/.
  let host = null;
  if (reel.host) {
    const h = typeof reel.host === "string" ? { file: reel.host } : reel.host;
    const src = path.join(postsDir, "clips", h.file);
    if (!existsSync(src)) {
      throw new Error(`host "${h.file}" not found in posts/clips/`);
    }
    const dir = path.join(projectDir, "public", "clips");
    mkdirSync(dir, { recursive: true });
    copyFileSync(src, path.join(dir, h.file));
    host = h;
  }

  // The cutouts — every matte the reel or one of its beats names, from
  // posts/media/ into public/media/, the pool `footage` already reads.
  //
  // No ffprobe here, unlike the spill three hundred lines up. A cutout is
  // placed by an edge and takes its height from the source's own aspect in
  // the browser, so nothing on this side has to know how tall the person is
  // — which is also why `reelkit lab cutout` works with no staging at all.
  const cutouts = [reel.cutout, ...reel.beats.map((b) => b.cutout)]
    .filter(Boolean)
    .map((c) => (typeof c === "string" ? null : c.file))
    .filter(Boolean);
  if (cutouts.length) {
    const dir = path.join(projectDir, "public", "media");
    mkdirSync(dir, { recursive: true });
    for (const file of new Set(cutouts)) {
      const src = path.join(postsDir, "media", file);
      if (!existsSync(src)) {
        throw new Error(
          `cutout "${file}" not found in posts/media/ — drop the matte there. ` +
            `It has to be a VP9 webm WITH an alpha channel; see docs/CUTOUT.md.`,
        );
      }
      copyFileSync(src, path.join(dir, file));
    }
    console.log(`CUTOUT  ${name}  ${[...new Set(cutouts)].join(", ")}`);
  }

  // Light leaks, from posts/overlays/. Same staging rule as the host: above
  // the bundle, or the bundle's public/ will not contain them.
  let overlays = null;
  if (Array.isArray(reel.overlays) && reel.overlays.length) {
    const dir = path.join(projectDir, "public", "overlays");
    mkdirSync(dir, { recursive: true });
    for (const o of reel.overlays) {
      const src = path.join(postsDir, "overlays", o.file);
      if (!existsSync(src)) {
        throw new Error(`overlay "${o.file}" not found in posts/overlays/`);
      }
      copyFileSync(src, path.join(dir, o.file));
    }
    overlays = reel.overlays;
    console.log(
      `LEAKS  ${name}  ${overlays.length} overlay(s) — ` +
        overlays.map((o) => `${o.file}@${o.at}s`).join(", "),
    );
  }

  // The bed, from posts/beds/ — a looping video under the whole reel.
  //
  // Not a background: a background belongs to a beat and is repainted at
  // every cut, and a bed keeps running while beats cut over it. A beat only
  // sees it by declining to paint, with `"bg": "bed"`.
  //
  // Each entry names the second it takes over at; a bed runs until the next
  // one starts, and the last to the end. The asset's own length is probed
  // here rather than authored, because a wrong loop length is a stutter
  // nobody would think to look for in the JSON.
  let bed = null;
  if (reel.bed) {
    const list = Array.isArray(reel.bed) ? reel.bed : [reel.bed];
    const dir = path.join(projectDir, "public", "beds");
    mkdirSync(dir, { recursive: true });
    const staged = list
      .map((b) => ({ ...b, at: b.at ?? 0 }))
      .sort((x, y) => x.at - y.at)
      .map((b) => {
        const src = path.join(postsDir, "beds", b.file);
        if (!existsSync(src)) {
          throw new Error(`${name}: bed "${b.file}" not found in posts/beds/`);
        }
        copyFileSync(src, path.join(dir, b.file));
        const seconds = Number(
          execFileSync("ffprobe", [
            "-v", "error", "-show_entries", "format=duration",
            "-of", "csv=p=0", src,
          ]).toString().trim(),
        );
        if (!(seconds > 0)) {
          throw new Error(`${name}: bed "${b.file}" has no readable duration.`);
        }
        return { ...b, loopFrames: Math.max(1, Math.round(seconds * FPS)) };
      });
    bed = staged.map((b, i) => {
      const startFrame = Math.round(b.at * FPS);
      const nextAt = staged[i + 1] ? Math.round(staged[i + 1].at * FPS) : totalFrames;
      return {
        file: b.file,
        startFrame,
        durationInFrames: Math.max(1, nextAt - startFrame),
        loopFrames: b.loopFrames,
        ...(b.opacity != null ? { opacity: b.opacity } : {}),
      };
    });
    console.log(
      `BED    ${name}  ${bed.length} loop(s) — ` +
        bed.map((b) =>
          `${b.file}@${(b.startFrame / FPS).toFixed(1)}s ` +
          `${(b.durationInFrames / FPS).toFixed(1)}s over a ` +
          `${(b.loopFrames / FPS).toFixed(1)}s clip`,
        ).join(", "),
    );
    // Read the AUTHORED beats, not the resolved ones: by this point a
    // shots beat has been flattened into spans and its per-shot bg is no
    // longer on the beat.
    const bedded = reel.beats.filter(
      (b) => b.bg === "bed" || (b.shots ?? []).some((sh) => sh.bg === "bed"),
    ).length;
    if (!bedded) {
      console.log(
        `BED    ${name} — WARNING: a bed is staged and no beat says ` +
          `"bg": "bed", so every beat paints over it and none of it is ` +
          `visible. This is the one way a bed fails silently.`,
      );
    }
  }

  // Bundle after staging — staticFile reads from the bundle's copy of
  // public/, so the audio must exist first. One bundle per post keeps a
  // multi-post run correct.
  console.log("BUNDLE  src/index.ts");
  const serveUrl = await bundleProject();

  const captions = captionsOverride ?? reel.captions ?? "page";
  if (captions !== "page") {
    console.log(
      `CAPTIONS ${name}  ${captions}` +
        (captionsOverride && !reel.captions
          ? "  — AUDITION (--captions), the post has not asked for it"
          : ""),
    );
  }

  // The exact cut times, printed. Placing an overlay means naming a second
  // on the reel's clock, and the only way to find one was to hand-sum the
  // ROUNDED per-beat seconds from the log above — which drifted 0.82 s over
  // four beats in a real run and landed a light leak on the wrong moment.
  {
    let t = 0;
    const cuts = beats.map((b) => {
      const at = t / FPS;
      t += b.durationInFrames;
      return at.toFixed(2);
    });
    console.log(`CUTS  ${name}  ${cuts.join("s  ")}s  · end ${(t / FPS).toFixed(2)}s`);
  }

  const inputProps = {
    beats,
    ...(host ? { host } : {}),
    ...(reel.cutout ? { cutout: reel.cutout } : {}),
    ...(reel.chrome ? { chrome: reel.chrome } : {}),
    ...(reel.subtitles ? { subtitles: reel.subtitles } : {}),
    ...(overlays ? { overlays } : {}),
    ...(bed ? { bed } : {}),
    ...(post.theme ? { theme: post.theme } : {}),
    ...(music ? { music } : {}),
    ...(sfx ? { sfx } : {}),
    ...(roomTone ? { roomTone } : {}),
    ...(captions !== "page" ? { captions } : {}),
  };
  const composition = await selectComposition({
    serveUrl,
    id: "Reel",
    inputProps,
  });
  const outDir = path.join(projectDir, "out", "reels");
  mkdirSync(outDir, { recursive: true });
  const output = path.join(
    outDir,
    `${name}${mock ? ".mock" : ""}${noSfx && reel.sfx ? ".nosfx" : ""}.mp4`,
  );
  let lastPct = -1;
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    // Without this Remotion writes full-range JPEG video (yuvj420p, color_range
    // pc) tagged bt470bg — PAL colorimetry on an HD file. Every platform decodes
    // assuming limited range and bt709, so our two inks came back crushed at one
    // end and washed at the other. bt709 makes the file say what it is.
    colorSpace: "bt709",
    outputLocation: output,
    inputProps,
    onProgress: ({ progress }) => {
      const pct = Math.round(progress * 20) * 5;
      if (pct === lastPct) return;
      lastPct = pct;
      console.log(`RENDER ${name}  ${pct} %`);
    },
  });
  // A probe with no narration must NOT be normalized to -14 LUFS. The
  // target assumes a voice: with only effects and a bed in the file, the
  // pass measured -49 and lifted everything 35 dB, so the demo sheet
  // played its effects at roughly the level a shipped reel plays a
  // SPOKEN WORD — which is precisely the judgement the sheet exists to
  // support, made wrong.
  //
  // Instead apply the fixed gain a real reel's voice track receives
  // (measured: a raw mix lands near -27 LUFS and the pass lifts it ~13 dB
  // to -14). Everything then sits exactly where it sits in a shipped
  // file, and the sheet is worth listening to.
  const silentProbe = isProbe && !reel.beats.some((b) => b.say);
  const lufs = silentProbe
    ? fixedGain(output, VOICE_LIFT_DB, name)
    : normalizeLoudness(output, name);

  // The only duration that cannot be wrong. The pre-flight estimate has an
  // RMS error of 2.8 s against a 40-second ceiling and per-script pace runs
  // 2.47 to 3.26 words a second, so a script can clear the gate and still
  // land long — `percent-basis` predicted 37 s and rendered 40.5. Measure
  // the file and say so, with the cut in words rather than in seconds.
  const rendered = totalFrames / FPS;
  if (rendered > CEILING_S && !isProbe) {
    const over = rendered - CEILING_S;
    console.log(
      `OVER  ${name} — the finished file is ${rendered.toFixed(1)} s, ` +
        `${over.toFixed(1)} s past the ${CEILING_S}-second ceiling. The estimate ` +
        `said ${budget.seconds.toFixed(0)}–${budget.slowSeconds.toFixed(0)} s; the ` +
        `estimate is not the file. Cut about ${plural(Math.ceil(over / 0.2667), "word")} ` +
        `and re-render — the voice is cached, so only the edited beats are re-spoken.`,
    );
  }
  console.log(
    `REEL  ${output}  ${rendered.toFixed(1)}s · ${beats.length} beats` +
      (lufs ? ` · ${lufs}` : "") +
      (mock ? "  — MOCK VOICE, not for shipping" : ""),
  );
}
