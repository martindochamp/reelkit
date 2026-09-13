// Text-to-speech for reels — the same RunPod Chatterbox endpoint Papyr runs
// (papyr-api/RUNPOD.md), spoken ONE SENTENCE PER CALL. The worker's
// single-shot path returns no usable timings and pads its own pauses, so
// the caption sync lives here instead: each sentence is generated alone,
// trimmed of leading/trailing silence, and assembled with a fixed 140 ms
// gap — sentence boundaries are measured, not guessed, and the space
// between sentences is ours.
//
// Cache, two layers under posts/audio/<post>/ (gitignored):
//   seg-<hash>.wav        one trimmed sentence — survives line re-edits
//   NN-<hash>.m4a + .json the assembled line the composition plays
// Both keyed on text + voice settings; editing one sentence re-speaks one
// sentence. Same contract as the rembg cutouts.
//
// Keys in <project>/.env (gitignored, beside reel.config.mjs, never committed):
//   RUNPOD_API_KEY=…
//   RUNPOD_ENDPOINT_ID=…
//
// `resolveVoice` is the one place the project's config.voice, the post's
// `reel.voice` and a beat's own `voice` are reconciled: beat > post > project
// > DEFAULT_VOICE below, last resort. CONFIG.md owns the field list; this
// file owns two things CONFIG.md does not need to: `sample` (what a project
// author names the cloned reference) becomes `voice` (what the endpoint's
// payload and a post's own `reel.voice` call it — REELS.md's
// `"voice": "tiktok-male"`), and `backend` is checked, never carried into the
// merged object — only "runpod" has a code path, so anything else refuses by
// name rather than rendering through it unannounced. A project that sets no
// `sample` resolves to exactly DEFAULT_VOICE, unchanged from before this was
// wired — so its cache keeps hitting; a project that does set one gets the
// voice it named, which re-keys only that project's own lines (`hashOf`'s
// `v` salt versions the cache FORMAT, not this).
// --mock speaks through macOS `say` — a draft voice to judge the cut,
// never the ship voice. Mock caches never mix with the real ones.

import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { config } from "./project.mjs";
import { projectDir } from "./stage.mjs";

const env = {};
const envFile = path.join(projectDir, ".env");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2];
  }
}

const DEFAULT_VOICE = {
  voice: "default",
  language: "en",
  exaggeration: 0.5,
  cfg_weight: 0.5,
  temperature: 0.8,
};

/** Silence between sentences — a breath, not the model's variable pause. */
const GAP_MS = 140;

/** The only keys a resolved voice carries — never `backend`. See below. */
const pickVoice = (v = {}) => {
  const out = {};
  if (v.voice != null) out.voice = v.voice;
  if (v.language != null) out.language = v.language;
  if (v.exaggeration != null) out.exaggeration = v.exaggeration;
  if (v.cfg_weight != null) out.cfg_weight = v.cfg_weight;
  if (v.temperature != null) out.temperature = v.temperature;
  return out;
};

/**
 * Resolve one beat's voice. Precedence, highest first:
 *
 *   beat.voice > post reel.voice > project config.voice > DEFAULT_VOICE
 *
 * `config.voice.sample` (the noun CONFIG.md documents — "the reference
 * voice cloned per line") becomes this file's `voice` field, which is what
 * the endpoint payload and a post's own `reel.voice`/`beat.voice` call it
 * (REELS.md: `"voice": "tiktok-male"`). A project that leaves `sample` unset
 * contributes nothing here, so it resolves to plain DEFAULT_VOICE exactly as
 * before this function existed — unset stays unset, on purpose, so a
 * project's cache does not re-key itself for a decision it never made.
 *
 * `backend` is checked, not merged in: only "runpod" has a code path here,
 * so anything else — most notably the documented-but-unbuilt "lambda" —
 * refuses BY NAME rather than silently rendering through RunPod with the
 * wrong assumptions. It never reaches the returned object (and so never
 * reaches `hashOf`): the backend is a transport decision, not a property of
 * the voice that was spoken, and it must not re-key a cache that has nothing
 * to do with it.
 */
export const resolveVoice = (reelVoice = {}, beatVoice = {}) => {
  const backend =
    beatVoice.backend ?? reelVoice.backend ?? config.voice.backend ?? "runpod";
  if (backend !== "runpod") {
    throw new Error(
      `voice.backend "${backend}" is documented in CONFIG.md but not ` +
        `implemented — the only TTS path here is RunPod. Refusing rather ` +
        `than silently rendering through it.`,
    );
  }
  const fromConfig = {
    ...pickVoice(config.voice),
    ...(config.voice.sample != null ? { voice: config.voice.sample } : {}),
  };
  return {
    ...DEFAULT_VOICE,
    ...fromConfig,
    ...pickVoice(reelVoice),
    ...pickVoice(beatVoice),
  };
};

// The salt versions the CACHE, not the text: v1 cached whole lines with
// the worker's own pauses baked in, v3 re-cuts every segment under the
// asymmetric trim above. An old file must never satisfy a new lookup.
const hashOf = (text, voice, mock) =>
  createHash("sha256")
    .update(JSON.stringify({ v: 3, text, voice, mock: mock ? 1 : 0 }))
    .digest("hex")
    .slice(0, 10);

/** Sentences with their char spans in the line — the caption anchors. */
export const splitSentences = (text) => {
  const out = [];
  const re = /[^.!?]+[.!?]*/g;
  let m;
  while ((m = re.exec(text))) {
    const t = m[0].trim();
    if (!t) continue;
    const lead = m[0].indexOf(t[0]);
    out.push({ text: t, cs: m.index + lead, ce: m.index + lead + t.length });
  }
  return out;
};

/**
 * Forget one line's audio so the next render re-speaks it.
 *
 * Deleting the assembled `NN-<hash>.m4a` is NOT enough: the line is
 * rebuilt from per-sentence `seg-<hash>.wav` files, so a re-render would
 * reassemble the same voice from cache. This drops the line AND every
 * segment it is made of — which is what "the endpoint answered in the
 * default voice" needs, because that failure is per-request: some
 * workers carry the cloned sample, some do not, so one post comes back
 * right and the next one does not.
 */
export const forget = (post, idx, text, voiceOverrides = {}, { mock = false } = {}) => {
  const voice = { ...DEFAULT_VOICE, ...voiceOverrides };
  const dir = path.join(projectDir, "posts", "audio", post);
  if (!existsSync(dir)) return 0;
  const base = `${String(idx + 1).padStart(2, "0")}-${hashOf(text, voice, mock)}`;
  let n = 0;
  for (const ext of ["m4a", "json"]) {
    const f = path.join(dir, `${base}.${ext}`);
    if (existsSync(f)) { rmSync(f, { force: true }); n++; }
  }
  for (const s of splitSentences(text)) {
    const seg = path.join(dir, `seg-${hashOf(s.text, voice, mock)}.wav`);
    if (existsSync(seg)) { rmSync(seg, { force: true }); n++; }
  }
  return n;
};

// ---------------------------------------------------------------------------
// One sentence → one trimmed 24 kHz mono wav

const runpodGenerate = async (text, voice) => {
  const key = env.RUNPOD_API_KEY;
  const endpoint = env.RUNPOD_ENDPOINT_ID;
  if (!key || !endpoint) {
    throw new Error(
      "RUNPOD_API_KEY / RUNPOD_ENDPOINT_ID missing from <project>/.env " +
        "(gitignored, beside reel.config.mjs).\n" +
        "Or render a draft with --mock (macOS voice, no network, no cost).",
    );
  }
  const headers = {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
  const body = {
    input: {
      text,
      voice: voice.voice,
      language: voice.language,
      enable_chunking: false,
      enable_sentence_timing: false,
      exaggeration: voice.exaggeration,
      cfg_weight: voice.cfg_weight,
      temperature: voice.temperature,
    },
  };
  let res = await fetch(`https://api.runpod.ai/v2/${endpoint}/runsync`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`runpod runsync ${res.status}: ${await res.text()}`);
  let job = await res.json();

  // Cold start: runsync can hand back IN_PROGRESS/IN_QUEUE instead of the
  // result. Poll /status until the worker wakes (30-60 s after idle).
  const started = Date.now();
  while (job.status === "IN_PROGRESS" || job.status === "IN_QUEUE") {
    if (Date.now() - started > 180_000) {
      throw new Error(`runpod job ${job.id} still ${job.status} after 180 s`);
    }
    await new Promise((r) => setTimeout(r, 2500));
    res = await fetch(`https://api.runpod.ai/v2/${endpoint}/status/${job.id}`, {
      headers,
    });
    if (!res.ok) throw new Error(`runpod status ${res.status}: ${await res.text()}`);
    job = await res.json();
  }
  if (job.status !== "COMPLETED" || !job.output?.audio_base64) {
    throw new Error(`runpod job failed: ${JSON.stringify(job).slice(0, 400)}`);
  }
  // The worker used to fall back to its default voice without saying so,
  // and a wrong take then sat in the cache until a human heard it. Newer
  // images report what they actually cloned; refuse anything else rather
  // than bake it in. Older images omit the field — then we cannot know,
  // and `--revoice` is the remedy.
  const used = job.output.voice_used;
  if (used && voice.voice && used !== voice.voice) {
    throw new Error(
      `runpod answered in the "${used}" voice, not "${voice.voice}" — ` +
        `the worker that took this job does not carry the sample. Re-run; ` +
        `if it persists the tts-worker image needs to roll.`,
    );
  }
  return { audio: Buffer.from(job.output.audio_base64, "base64"), ext: "mp3" };
};

const mockGenerate = (text) => {
  const aiff = path.join(os.tmpdir(), `tts-mock-${process.pid}-${text.length}.aiff`);
  execFileSync("say", ["-o", aiff, text]);
  return { file: aiff };
};

// Trim edge silence and normalize to the pool format. The gap between
// sentences is added at assembly, never left inside a segment.
//
// The TAIL is trimmed 12 dB quieter and with more grace than the head
// (Martin, 2026-08-03: "j'ai l'impression que le son est cut"). Measured
// on mg-primer: no beat was truncated mid-syllable — every tail sat
// 23-38 dB under the line's peak — but a sentence-final fricative decays
// through the -38 dB floor while it is still audible, so the release got
// shaved off six of seven beats. A word ENDS below the level at which it
// STARTS; the two edges cannot share a threshold.
const TRIM_FILTER =
  "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05," +
  "areverse," +
  "silenceremove=start_periods=1:start_threshold=-57dB:start_silence=0.12," +
  "areverse";

const toTrimmedWav = (input, output) => {
  execFileSync("ffmpeg", [
    "-i", input,
    "-af", TRIM_FILTER,
    "-ar", "24000", "-ac", "1", "-c:a", "pcm_s16le",
    "-y", output,
  ], { stdio: "pipe" });
};

const wavDurationMs = (file) => {
  const out = execFileSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file],
    { encoding: "utf8" },
  );
  return Math.round(parseFloat(out) * 1000);
};

const speakSentence = async (dir, text, voice, mock) => {
  const wav = path.join(dir, `seg-${hashOf(text, voice, mock)}.wav`);
  if (existsSync(wav)) return wav;
  if (mock) {
    const { file } = mockGenerate(text);
    toTrimmedWav(file, wav);
    rmSync(file, { force: true });
  } else {
    const { audio } = await runpodGenerate(text, voice);
    const tmp = path.join(os.tmpdir(), `tts-${path.basename(wav)}.mp3`);
    writeFileSync(tmp, audio);
    toTrimmedWav(tmp, wav);
    rmSync(tmp, { force: true });
  }
  return wav;
};

// ---------------------------------------------------------------------------

/**
 * Speak one line, through the cache. Returns
 * { file, ext, durationMs, sentences: [{cs, ce, om, dm}] } — sentence
 * offsets MEASURED from the assembled audio, not estimated.
 */
export const speak = async (post, idx, text, voiceOverrides = {}, { mock = false } = {}) => {
  const voice = { ...DEFAULT_VOICE, ...voiceOverrides };
  const dir = path.join(projectDir, "posts", "audio", post);
  mkdirSync(dir, { recursive: true });
  const base = path.join(
    dir,
    `${String(idx + 1).padStart(2, "0")}-${hashOf(text, voice, mock)}`,
  );
  const meta = `${base}.json`;
  if (existsSync(meta) && existsSync(`${base}.m4a`)) {
    return { ...JSON.parse(readFileSync(meta, "utf8")), file: `${base}.m4a` };
  }

  const spans = splitSentences(text);
  if (spans.length === 0) throw new Error(`nothing to speak in: ${text}`);

  const wavs = [];
  for (const s of spans) {
    wavs.push(await speakSentence(dir, s.text, voice, mock));
  }
  const durations = wavs.map(wavDurationMs);

  // Assemble: every segment but the last carries the gap as trailing pad.
  const args = wavs.flatMap((w) => ["-i", w]);
  const pads = wavs
    .map((_, i) =>
      i < wavs.length - 1
        ? `[${i}:a]apad=pad_dur=${GAP_MS / 1000}[a${i}]`
        : `[${i}:a]acopy[a${i}]`,
    )
    .join(";");
  const chain = wavs.map((_, i) => `[a${i}]`).join("");
  execFileSync("ffmpeg", [
    ...args,
    "-filter_complex", `${pads};${chain}concat=n=${wavs.length}:v=0:a=1[out]`,
    "-map", "[out]",
    "-c:a", "aac", "-b:a", "128k",
    "-y", `${base}.m4a`,
  ], { stdio: "pipe" });

  const sentences = [];
  let om = 0;
  spans.forEach((s, i) => {
    sentences.push({ cs: s.cs, ce: s.ce, om, dm: durations[i] });
    om += durations[i] + (i < spans.length - 1 ? GAP_MS : 0);
  });
  const record = { ext: "m4a", durationMs: om, sentences };
  writeFileSync(meta, JSON.stringify(record, null, 2));
  return { ...record, file: `${base}.m4a` };
};
