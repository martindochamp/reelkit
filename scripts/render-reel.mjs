#!/usr/bin/env node
// Renders a post's reel script: the `reel` block of posts/<name>.json
// becomes out/reels/<name>.mp4. A reel is written from the brief, not from
// the slides — the narration is the spine, each beat cuts to one screen
// element, and [+] markers in the spoken line print the element's parts at
// the exact word the voice reaches them. REELS.md owns the format.
//
//   npm run reel fe-absorbed
//   npm run reel fe-absorbed -- --mock     # macOS draft voice, no RunPod
//
// The voice is RunPod Chatterbox — the endpoint Papyr already runs. Keys in
// .env (see scripts/tts.mjs); audio is cached per line, so iterating on one
// beat re-speaks one beat.

import { execFileSync, spawnSync } from "node:child_process";
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
import { warnTierList } from "./tier-legibility.mjs";
import { forget, speak } from "./tts.mjs";

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
const wordTimings = (text, sentences, durationMs) => {
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
      words.push({ text: m[0], startMs: at, charStart: s.cs + m.index });
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
      }),
    );
  }
  return words;
};

// Caption pages: at most three words or ~20 characters, never across a
// sentence boundary — the band holds one thought at a time.
const paginate = (words, leadMs) => {
  const pages = [];
  let page = null;
  for (const w of words) {
    const chars = page ? page.chars + 1 + w.text.length : w.text.length;
    if (!page || page.words.length >= 3 || chars > 20) {
      page = { startFrame: msToFrames(leadMs + w.startMs), words: [], chars: 0 };
      pages.push(page);
    }
    page.words.push({
      text: w.text,
      startFrame: msToFrames(leadMs + w.startMs),
    });
    page.chars = page.chars ? page.chars + 1 + w.text.length : w.text.length;
    if (/[.!?]$/.test(w.text)) page = null;
  }
  return pages.map(({ startFrame, words: ws }) => ({ startFrame, words: ws }));
};

/**
 * Caption pages for a beat nobody speaks — someone else's sentence under
 * their own footage. One line per page, spread evenly across the hold,
 * every word of a page landing at once (there is no per-word timing to
 * borrow: the TTS never saw these words).
 */
const quotePages = (lines, frames) =>
  lines.map((line, i) => {
    const startFrame = Math.round((i / lines.length) * frames);
    return {
      startFrame,
      words: line.split(/\s+/).filter(Boolean).map((text) => ({ text, startFrame })),
    };
  });

for (const name of names) {
  const post = JSON.parse(
    readFileSync(path.join(postsDir, `${name}.json`), "utf8"),
  );
  const reel = post.reel;
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
    const el = beat.screen;
    if (!el?.type) {
      throw new Error(`${name} beat ${i + 1} has no screen element`);
    }
    if (/\bTODO\b/i.test([beat.say, JSON.stringify(el)].join(" "))) {
      throw new Error(
        `${name} beat ${i + 1} still carries a placeholder. ` +
          `Write the line first — REELS.md.`,
      );
    }

    // A tier list can be laid out perfectly and still be unreadable: the
    // element shrinks the names until they clear the numbers, and past a
    // point what clears is texture. The reel is the surface that decides
    // — it scales every lab element to 0.79 — so the audit runs here,
    // beside the beat it belongs to, and warns.
    const tierAt =
      el.type === "lab" && el.element === "tierlist"
        ? { post: name, where: `beat ${i + 1}` }
        : null;

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

    // Real footage or a real photograph, at full quality — the only thing
    // on this stage that is not redrawn. Measured off the file (kind,
    // shape, length), trimmed by seconds in the post, and staged where
    // Remotion can stream it.
    if (el.type === "media") {
      const src = path.join(postsDir, "media", el.file);
      if (!existsSync(src)) {
        throw new Error(
          `media "${el.file}" not found in posts/media/ — drop the file there ` +
            `and add its row to posts/media/LICENSES.md.`,
        );
      }
      if (!el.credit) {
        throw new Error(
          `media "${el.file}" has no \`credit\`. Someone else's footage is ` +
            `quoted, not taken: name the channel and the person on the frame.`,
        );
      }
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
      if (el.audio > 0 && beat.say) {
        throw new Error(
          `${name} beat ${i + 1}: the media excerpt plays at ${el.audio} and the ` +
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

    // A photo background comes from the same licensed pool as the art
    // slides (posts/art/ + LICENSES.md) and is staged under public/bg/.
    if (beat.bg && beat.bg !== "ink") {
      const src = path.join(postsDir, "art", beat.bg);
      if (!existsSync(src)) {
        throw new Error(`bg "${beat.bg}" not found in posts/art/`);
      }
      const bgDir = path.join(projectDir, "public", "bg");
      mkdirSync(bgDir, { recursive: true });
      copyFileSync(src, path.join(bgDir, beat.bg));
    }

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
      beats.push({
        element: el,
        durationInFrames: frames,
        cueFrames: heldCues,
        ...(beat.bg ? { bg: beat.bg } : {}),
        ...(beat.sound ? { sound: beat.sound } : {}),
        // A muted excerpt still says something — print it in the caption
        // band, one line at a time, spread across the hold. The band is
        // already the place the viewer reads words; borrowing it for
        // someone else's sentence costs nothing and adds no chrome.
        // `label` borrows the same band to name a beat, which is what the
        // demo sheet needs and what nothing else should use.
        ...(el.quote?.length
          ? { pages: quotePages(el.quote, frames) }
          : beat.label
            ? { pages: quotePages([beat.label], frames) }
            : {}),
      });
      totalFrames += frames;
      console.log(
        `BEAT  ${name} ${i + 1}/${reel.beats.length}  ` +
          `${(holdMs / 1000).toFixed(1)}s hold  (${el.type})`,
      );
      if (tierAt) warnTierList(el.props, tierAt);
      continue;
    }

    const { clean, positions } = parseCues(beat.say);
    const parts = partsOf(el);
    if (parts !== -1 && positions.length !== 0 && positions.length !== parts) {
      throw new Error(
        `${name} beat ${i + 1}: ${positions.length} [+] cue(s) for a ` +
          `${el.type} with ${parts} part(s) — cue every part or none, ` +
          `or something prints out of order.`,
      );
    }

    if (revoiceBeats === "all" || revoiceBeats?.has(i + 1)) {
      const gone = forget(name, i, clean, reel.voice ?? {}, { mock });
      if (gone) console.log(`REVOICE ${name} beat ${i + 1} — dropped ${gone} cached file(s)`);
    }
    const clip = await speak(name, i, clean, reel.voice ?? {}, { mock });
    const basename = path.basename(clip.file);
    copyFileSync(clip.file, path.join(publicAudioDir, basename));

    const words = wordTimings(clean, clip.sentences, clip.durationMs);
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

    const beatMs = Math.max(MIN_BEAT_MS, LEAD_MS + clip.durationMs + TAIL_MS);
    const frames = msToFrames(beatMs);
    beats.push({
      element: el,
      durationInFrames: frames,
      cueFrames,
      ...(beat.bg ? { bg: beat.bg } : {}),
      ...(beat.sound ? { sound: beat.sound } : {}),
      audio: `audio/${name}/${basename}`,
      audioStartFrame: msToFrames(LEAD_MS),
      pages: paginate(words, LEAD_MS),
    });
    totalFrames += frames;
    console.log(
      `BEAT  ${name} ${i + 1}/${reel.beats.length}  ` +
        `${(clip.durationMs / 1000).toFixed(1)}s · ${cueFrames.length} cues  (${el.type})`,
    );
    if (tierAt) warnTierList(el.props, tierAt);
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

  const inputProps = {
    beats,
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
