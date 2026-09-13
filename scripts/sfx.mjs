// Sound design for reels — the instrument's own noises, placed on the
// animation events we already know the frame of.
//
//   npm run sfx           synthesize the kit, print its levels
//   npm run sfx -- --force  re-synthesize even if the files are there
//
// TWO THINGS make this work, and both were already in the pipeline:
//
// 1. The frames are KNOWN. A `[+]` in a beat's `say` line is resolved to a
//    frame by render-reel.mjs and handed to the element as a cue prop. The
//    row prints on that frame; the sound fires on that frame. Nothing is
//    hand-synced, nothing drifts when a line is re-spoken.
//
// 2. Levels have a contract. The music bed taught it: normalize the asset
//    to the VOICE's own loudness on the way in, and a `volume` number then
//    means one thing — a dB offset under the narration. Same here, with
//    one change: a 200 ms click has no integrated loudness (EBU R128 needs
//    400 ms blocks and gates the rest), so each effect is normalized by its
//    MOMENTARY MAX instead — the 400 ms window the ear actually registers.
//    Momentary max = -26 LUFS, `volume` 0.2 = 14 dB under the voice.
//
// LICENSING: every sound in this kit is synthesized from ffmpeg
// oscillators and noise generators. There is no source recording, no
// sample pack, no third party, and therefore no provenance question at
// all — the recipe below IS the provenance. posts/sfx/LICENSES.md says so
// in the shape posts/art/LICENSES.md uses.

import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { emitFor, strike } from "./sfx-elements.mjs";
import { sourcedReady } from "./sfx-import.mjs";
import { projectDir } from "./stage.mjs";

export const sfxDir = path.join(projectDir, "posts", "sfx");

/**
 * Where an effect sits under the narration, in linear gain.
 * 0.2 = -14 dB. The brief's window is 12-16 dB; measured on the
 * vitamin-k-tier render, 14 dB is where the print stops competing with a
 * spoken word and still reads through a trending sound layered on top.
 */
export const SFX_VOLUME = 0.2;

/**
 * The voice's own loudness — what the raw Remotion mix hands back before
 * the final -14 LUFS pass. Every effect is normalized to it, by momentary
 * max, so `volume` is a real dB offset.
 */
const SFX_LUFS = -26;

/** No effect file leaves the kit peaking above this. */
const PEAK_CEILING = -3;

// ---------------------------------------------------------------------------
// The kit — three sounds, because the instrument makes three noises.
//
// Each entry is a filter graph over lavfi sources. `trim` is a fixed dB
// offset applied after normalization, for the one place where equal
// loudness is not equal presence.
//
// Everything lives between 1.5 and 5 kHz where it can: Martin lays a
// trending sound over the track inside TikTok at post time, and a music
// bed owns the bass. A thud that carries its weight at 110 Hz disappears
// under the first kick drum; the same thud carrying its weight in its
// contact transient survives.

const noise = (d, seed, amp = 0.9) =>
  `anoisesrc=color=white:amplitude=${amp}:duration=${d}:sample_rate=48000:seed=${seed}`;

export const KIT = {
  /**
   * PRINT — one receipt line coming out of the head. Band-limited noise
   * chattering at 112 Hz (the stepper), 220 ms, which is the 7-frame
   * top-down wipe every printed part in this system uses. Two variants
   * from different noise seeds: seven tier items in a row on ONE sample
   * reads as a loop, and a loop reads as a mobile game.
   */
  print: {
    what: "a receipt line printing — the thermal head's chatter",
    inputs: [noise(0.22, 1301), noise(0.22, 4409, 0.9)],
    graph:
      "[0:a]bandpass=f=2300:width_type=h:w=1500,lowpass=f=6500," +
      "tremolo=f=112:d=0.85," +
      "afade=t=in:st=0:d=0.005," +
      "afade=t=out:st=0.06:d=0.16:curve=exp[chat];" +
      "[1:a]bandpass=f=3400:width_type=h:w=2400,lowpass=f=8000," +
      "afade=t=in:st=0:d=0.001," +
      "afade=t=out:st=0.002:d=0.014:curve=exp,volume=1.6[head];" +
      "[chat][head]amix=inputs=2:normalize=0[mix]",
    trim: 0,
  },
  print2: {
    what: "print, second noise seed — alternated so a run never loops",
    inputs: [noise(0.2, 7717), noise(0.2, 2273, 0.9)],
    graph:
      "[0:a]bandpass=f=2450:width_type=h:w=1600,lowpass=f=6800," +
      "tremolo=f=104:d=0.85," +
      "afade=t=in:st=0:d=0.005," +
      "afade=t=out:st=0.055:d=0.145:curve=exp[chat];" +
      "[1:a]bandpass=f=3600:width_type=h:w=2400,lowpass=f=8000," +
      "afade=t=in:st=0:d=0.001," +
      "afade=t=out:st=0.002:d=0.013:curve=exp,volume=1.55[head];" +
      "[chat][head]amix=inputs=2:normalize=0[mix]",
    trim: 0,
  },

  /**
   * STAMP — rubber onto paper onto wood. Three layers: the contact
   * transient (the only part that survives a music bed), a body whose
   * pitch falls 150 → 80 Hz as it decays, and the sheet's own "pff".
   */
  stamp: {
    what: "a stamp hitting paper — contact, body, sheet",
    inputs: [
      noise(0.05, 5501),
      "aevalsrc=exprs=sin(2*PI*(150*t-70*t*t))*exp(-26*t):d=0.24:s=48000",
      noise(0.14, 8837, 0.7),
    ],
    graph:
      "[0:a]bandpass=f=2600:width_type=h:w=3000,lowpass=f=7000," +
      "afade=t=out:st=0.001:d=0.038:curve=exp,volume=1.3[hit];" +
      "[1:a]lowpass=f=260,volume=0.9[body];" +
      "[2:a]bandpass=f=700:width_type=h:w=800," +
      "afade=t=out:st=0.008:d=0.12:curve=exp,volume=0.4[paper];" +
      "[hit][body][paper]amix=inputs=3:normalize=0[mix]",
    // A thud reads present at equal loudness; under a voice it reads
    // heavy. One dB back and it lands instead of thumping.
    trim: -1,
  },

  /**
   * TEAR — the sheet coming off the roll. Three layers over 340 ms: a low
   * fibrous rip that starts immediately, a brighter one that fades in
   * behind it (the tear travelling up the perforation), and the snap of
   * the last fibre at the end. The only sound in the kit with a shape
   * longer than the ear's integration window, which is why it can carry
   * the end of a video where a click cannot.
   */
  tear: {
    what: "a receipt torn off the roll — fibre, rising, then the snap",
    inputs: [noise(0.34, 3313), noise(0.34, 6619, 0.8), noise(0.05, 991)],
    graph:
      "[0:a]bandpass=f=2400:width_type=h:w=1800,tremolo=f=47:d=0.75," +
      "afade=t=in:st=0:d=0.02," +
      "afade=t=out:st=0.1:d=0.24:curve=exp[low];" +
      "[1:a]bandpass=f=5200:width_type=h:w=3000,tremolo=f=63:d=0.7," +
      "afade=t=in:st=0.05:d=0.18," +
      "afade=t=out:st=0.25:d=0.09:curve=exp,volume=0.85[high];" +
      "[2:a]bandpass=f=3200:width_type=h:w=2600," +
      "afade=t=out:st=0.002:d=0.045:curve=exp,volume=1.4,adelay=300[snap];" +
      "[low][high][snap]amix=inputs=3:normalize=0[mix]",
    trim: -1,
  },

  /**
   * TICKFINE — the ratchet's tooth. 12 ms, dry, no tone at all.
   *
   * `tick` cannot do this job: 30 ms with a 900 Hz ping is a musical
   * event, and twenty of them in a second is a melody nobody wrote. A
   * ratchet needs a click with no pitch to accumulate, so it can be
   * stacked at 20 a second and read as ONE accelerating gesture rather
   * than as twenty sounds. Pitch variation comes from playbackRate at
   * placement, not from twenty samples.
   */
  tickfine: {
    what: "one ratchet tooth — 12 ms, dry, no pitch to accumulate",
    inputs: [noise(0.012, 4241)],
    graph:
      "[0:a]bandpass=f=2800:width_type=h:w=2600,highpass=f=1200," +
      "afade=t=in:st=0:d=0.0003," +
      "afade=t=out:st=0.0008:d=0.0105:curve=exp[mix]",
    trim: 0,
  },

  /**
   * POPSOFT — one unit landing. 34 ms, a soft body with almost no attack:
   * a hundred of these print in a unit grid and any transient sharper
   * than this turns the grid into a rattle.
   */
  popsoft: {
    what: "one unit landing — soft, 34 ms, survives repetition",
    inputs: [
      "aevalsrc=exprs=sin(2*PI*(420*t-160*t*t))*exp(-70*t):d=0.034:s=48000",
      noise(0.01, 6421, 0.5),
    ],
    graph:
      "[0:a]lowpass=f=1800,volume=1.0[body];" +
      "[1:a]bandpass=f=3200:width_type=h:w=2400," +
      "afade=t=out:st=0.001:d=0.008:curve=exp,volume=0.35[tip];" +
      "[body][tip]amix=inputs=2:normalize=0[mix]",
    trim: -2,
  },

  /**
   * UNPOP — the same body, pitch falling instead of rising. The unit
   * leaving. Martin asked for it by that name and the name is right: the
   * ear reads a descending glide as a departure without being told.
   */
  unpop: {
    what: "one unit going out — the pop, descending",
    inputs: [
      "aevalsrc=exprs=sin(2*PI*(300*t+150*t*t))*exp(-58*t):d=0.05:s=48000",
    ],
    graph: "[0:a]lowpass=f=1500,afade=t=out:st=0.02:d=0.03:curve=exp[mix]",
    trim: -3,
  },

  /**
   * LATCH — a value settling into place, or a line being crossed. Short
   * mechanical clunk with a body: heavier than a tick, lighter than the
   * stamp, and the only thing in the kit that says "that is final"
   * without saying "verdict".
   */
  latch: {
    what: "a value settling — mechanical, 90 ms",
    inputs: [
      noise(0.02, 1777),
      "aevalsrc=exprs=sin(2*PI*(190*t-90*t*t))*exp(-40*t):d=0.09:s=48000",
    ],
    graph:
      "[0:a]bandpass=f=2200:width_type=h:w=2000," +
      "afade=t=out:st=0.001:d=0.017:curve=exp,volume=1.2[tip];" +
      "[1:a]lowpass=f=900,volume=0.8[body];" +
      "[tip][body]amix=inputs=2:normalize=0[mix]",
    trim: -1,
  },

  /**
   * SWEEP — a sector opening, a bar filling, read as ONE gesture rather
   * than as N ticks. Filtered noise rising over 420 ms; the alternative
   * to the ratchet, for an element whose motion is continuous.
   */
  sweep: {
    what: "one continuous fill — 420 ms of rising air",
    inputs: [noise(0.42, 9311, 0.8), noise(0.42, 3167, 0.6)],
    graph:
      "[0:a]bandpass=f=1400:width_type=h:w=1200," +
      "afade=t=in:st=0:d=0.09,afade=t=out:st=0.2:d=0.22:curve=exp[low];" +
      "[1:a]bandpass=f=4200:width_type=h:w=3000," +
      "afade=t=in:st=0.14:d=0.18,afade=t=out:st=0.34:d=0.08:curve=exp,volume=0.8[high];" +
      "[low][high]amix=inputs=2:normalize=0[mix]",
    trim: -2,
  },

  /**
   * TICK — one mechanical click, 30 ms. The counter, the relay, the key.
   * Not in the default map: it is here for a post that has a genuine
   * increment to sound, and it is the sound most likely to make a reel
   * feel like a game if it is spent on anything else.
   */
  tick: {
    what: "one mechanical click — a counter's detent",
    inputs: [
      noise(0.03, 9109),
      "aevalsrc=exprs=sin(2*PI*900*t)*exp(-160*t):d=0.03:s=48000",
    ],
    graph:
      "[0:a]bandpass=f=1900:width_type=h:w=1600,lowpass=f=7000," +
      "afade=t=in:st=0:d=0.0004," +
      "afade=t=out:st=0.0015:d=0.026:curve=exp[click];" +
      "[1:a]volume=0.5[ping];" +
      "[click][ping]amix=inputs=2:normalize=0[mix]",
    trim: 0,
  },
};

// ---------------------------------------------------------------------------
// Levels

/**
 * Momentary-max loudness, in LUFS. A 200 ms effect has no INTEGRATED
 * loudness — R128 measures 400 ms blocks and gates everything under the
 * threshold, so `loudnorm` on a click reports -70 and "normalizes" noise.
 * The file is padded with silence so the momentary window can fill, and
 * the loudest 400 ms window is the answer.
 */
const momentaryMax = (file) => {
  const probe = spawnSync(
    "ffmpeg",
    [
      "-hide_banner", "-v", "verbose",
      "-f", "lavfi", "-i", "aevalsrc=0:d=0.5:s=48000",
      "-i", file,
      "-f", "lavfi", "-i", "aevalsrc=0:d=1:s=48000",
      "-filter_complex",
      "[0:a][1:a][2:a]concat=n=3:v=0:a=1[c];[c]ebur128=framelog=verbose",
      "-f", "null", "-",
    ],
    { encoding: "utf8" },
  );
  const log = `${probe.stderr ?? ""}${probe.stdout ?? ""}`;
  const values = [...log.matchAll(/\bM:\s*(-?\d+(?:\.\d+)?)/g)].map((m) =>
    Number(m[1]),
  );
  return values.length ? Math.max(...values) : null;
};

const truePeak = (file) => {
  const probe = spawnSync(
    "ffmpeg",
    ["-hide_banner", "-i", file, "-af", "ebur128=peak=true", "-f", "null", "-"],
    { encoding: "utf8" },
  );
  const log = `${probe.stderr ?? ""}${probe.stdout ?? ""}`;
  const m = [...log.matchAll(/Peak:\s*(-?\d+(?:\.\d+)?)\s*dBFS/g)].pop();
  return m ? Number(m[1]) : null;
};

/** Synthesize one sound into posts/sfx/<name>.wav, normalized. */
const synth = (name) => {
  const rec = KIT[name];
  mkdirSync(sfxDir, { recursive: true });
  const raw = path.join(os.tmpdir(), `sfx-raw-${name}.wav`);
  execFileSync(
    "ffmpeg",
    [
      "-hide_banner", "-loglevel", "error", "-y",
      ...rec.inputs.flatMap((src) => ["-f", "lavfi", "-i", src]),
      "-filter_complex",
      `${rec.graph};[mix]alimiter=limit=0.95,aformat=sample_fmts=s16:channel_layouts=mono[out]`,
      "-map", "[out]", "-ar", "48000", "-ac", "1",
      raw,
    ],
    { stdio: "pipe" },
  );
  const m = momentaryMax(raw);
  const wanted = (m === null ? 0 : SFX_LUFS - m) + (rec.trim ?? 0);
  // A 30 ms click has a crest factor a 400 ms window cannot describe:
  // normalized to -26 LUFS momentary it wants to peak at 0 dBFS, and a
  // file that touches full scale is a file waiting to clip in someone
  // else's mix. Peak wins the argument — the sound simply lands under the
  // loudness target, which for a transient shorter than the ear's own
  // integration time is the honest place for it anyway.
  const rawPeak = truePeak(raw) ?? 0;
  const gain = Math.min(wanted, PEAK_CEILING - rawPeak);
  const out = path.join(sfxDir, `${name}.wav`);
  execFileSync(
    "ffmpeg",
    [
      "-hide_banner", "-loglevel", "error", "-y",
      "-i", raw,
      "-af", `volume=${gain.toFixed(2)}dB`,
      "-ar", "48000", "-ac", "1", "-c:a", "pcm_s16le",
      out,
    ],
    { stdio: "pipe" },
  );
  return { name, out, gain, measured: m, peak: truePeak(out) };
};

/** Every sound in the kit exists on disk (synthesizing what does not). */
export const ensureKit = ({ force = false } = {}) => {
  const made = [];
  for (const name of Object.keys(KIT)) {
    const file = path.join(sfxDir, `${name}.wav`);
    if (!force && existsSync(file)) continue;
    made.push(synth(name));
  }
  if (made.length) writeRegister();
  return made;
};

// ---------------------------------------------------------------------------
// The event map — which animation events deserve a sound
//
// Restraint is the design. A sound on every cue is noise, and noise reads
// as a mobile game rather than an instrument. The default map covers the
// events where something LANDS — a thing arriving in a place that was
// waiting for it — and stays silent everywhere a value merely grows.
//
// A key is the element's type, or "lab:<element>" for a lab element.
// The value takes (cueFrames, element) and returns [{ sound, frame }].

const typed = (cues, volume = 0.16) => cues.map((frame, i) => strike(frame, i, volume));

export const DEFAULT_MAP = {
  // A table is text arriving on paper, so it is typed. The total is not
  // another row — it is the verdict, and it gets the stamp.
  table: (cues, el) =>
    cues.map((frame, i) =>
      el.total && i === cues.length - 1
        ? { sound: "stamp", frame, volume: 0.3 }
        : strike(frame, i),
    ),

  // The specimen arrives ON the cut, and a specimen arriving is a
  // photograph being taken — the one place a shutter is literal rather
  // than decorative. The receipt row underneath it is typed.
  figure: (cues) => [
    { sound: "shutter", frame: cues[0] ?? 0, volume: 0.2 },
    ...(cues[1] != null ? [strike(cues[1], 0)] : []),
  ],
  clip: (cues) => [
    { sound: "shutter", frame: cues[0] ?? 0, volume: 0.2 },
    ...(cues[1] != null ? [strike(cues[1], 0)] : []),
  ],

  // Our own app, moving. The thing on screen is a finger on a control, so
  // the sound is the control.
  recording: (cues) => [
    ...(cues[0] != null ? [{ sound: "click", frame: cues[0], volume: 0.18 }] : []),
    ...(cues[1] != null ? [strike(cues[1], 0)] : []),
  ],

  // Somebody else's material. A still is something we photographed off a
  // page and gets the shutter; a VIDEO excerpt stays silent — an effect
  // over a face reads as our sound on their footage, and if the excerpt
  // is unmuted it already has its own audio.
  media: (cues, el) =>
    /\.(jpe?g|png|webp|gif)$/i.test(el.file ?? "")
      ? [{ sound: "shutter", frame: cues[0] ?? 0, volume: 0.18 }]
      : [],

  // One hero number, landing alone on the paper. A stat is often the
  // whole beat and carries no `[+]` at all, so it falls back to the cut
  // rather than going silent — the number arriving IS the event.
  stat: (cues) => [{ sound: "stamp", frame: cues[0] ?? 0, volume: 0.3 }],

  // Each country printing into the row that was waiting for it — the same
  // event as a tier item, and the same hammer.
  flag: (cues) => typed(cues),

  // The end of the sheet. The endcard beat is SILENT by construction (it
  // is read, not spoken), so there is no cue to hang it on and no voice to
  // land in the gap of: it fires on the cut, which is the event.
  endcard: (cues) => [{ sound: "tear", frame: cues[0] ?? 0 }],
};

// Every lab element now has an EMITTER in sfx-elements.mjs, which reads
// its timeline and its data instead of its cue list. This map covers what
// is left: the types whose whole sound IS one event per cue.
//
// Still deliberately silent, and each for a reason worth writing down:
//
//   mockup       the phone rises. Nothing lands.
//   title / cta  words. The voice is already saying them.
//   media, when the file is a video — see the entry above.
//
// The old note here also listed barchart, unitgrid, odometer and flow as
// silent on the argument that "a bar GROWS; it does not land". That was
// true of a map keyed on cues and false of an emitter: growth has a
// shape, and a ratchet is how a mechanism reports one. The argument it
// was really making — do not put a landing sound on something that does
// not land — survives as the reason each of those got a ratchet, a
// slide or a pen rather than a stamp.
//
// Any of them can be turned on or off per post — see the override below.

const elementKey = (el) => (el.type === "lab" ? `lab:${el.element}` : el.type);

/** A post's `sfx.map` entry: "off", a sound name, or {each,first,last}. */
const overrideToFn = (spec) => {
  if (spec === "off" || spec === false || spec === null) return () => [];
  if (typeof spec === "string") {
    return (cues) => cues.map((frame) => ({ sound: spec, frame }));
  }
  return (cues) =>
    cues.map((frame, i) => {
      const sound =
        (i === 0 && spec.first) ||
        (i === cues.length - 1 && spec.last) ||
        spec.each;
      return sound ? { sound, frame } : null;
    }).filter(Boolean);
};

const durationInFrames = (file, fps) => {
  const s = Number(
    execFileSync(
      "ffprobe",
      ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file],
      { encoding: "utf8" },
    ).trim(),
  );
  // One frame of grace: a sequence that ends inside the sound's own decay
  // truncates it, and a truncated click is a different, worse click.
  return Math.max(1, Math.ceil(s * fps) + 1);
};

/**
 * Place the kit on a reel's cues, and stage the files it uses.
 *
 * `beats` are the staged beats render-reel.mjs built, in order, each with
 * `durationInFrames` and beat-local `cueFrames`. Returns absolute-frame
 * placements the composition drops <Audio> tags on — nothing is
 * hand-synced, every effect fires on the same frame as the thing it
 * sounds like.
 *
 * `sfx` is the post's OPT-IN block (absent = silent, so nothing already
 * shipped changes unless it is re-rendered deliberately):
 *   true                                  the default kit, default level
 *   { volume: 0.16 }                      quieter
 *   { map: { "lab:barchart": "print" } }   sound an element the default skips
 *   { map: { "table": "off" } }            silence one the default sounds
 *   { map: { "lab:flow": { each: "tick", last: "stamp" } } }
 */
/**
 * Where a sound's file actually comes from.
 *
 * A downloaded take beats a synthesized one when both exist: the kit was
 * built because there was nothing to reach for, not because an oscillator
 * is the goal. A real thermal head has a transient complexity that
 * band-limited noise under an envelope approximates and does not match.
 *
 * The synthesized file stays on disk either way, and `--synth` forces it,
 * so the two are one flag apart and the question "is the real one better"
 * is answerable by listening rather than by arguing.
 *
 * Provenance is enforced HERE rather than at import, because importing is
 * auditioning and shipping is distributing. A sourced file with no row in
 * posts/sfx/sourced.json stops the render that would have used it.
 */
/**
 * The synthesized stand-in for a sound that only exists as a download.
 *
 * Ten of the kit's twelve voices are now real objects — a typewriter, a
 * freewheel, a clock escapement, a pen — and none of them can be
 * approximated well by an oscillator. That was the point of sourcing
 * them. But `posts/sfx/sourced/` is gitignored and regenerated by
 * `npm run sfx:import` from files a clone does not have, so a render on
 * a fresh checkout has to do SOMETHING.
 *
 * It degrades to the nearest synthesized shape and says so, rather than
 * throwing: a reel that renders with a stand-in click is a reel someone
 * can still look at, and the render log names every substitution.
 */
const FALLBACK = {
  type: "print",
  type2: "print2",
  ratchet: "tickfine",
  detent: "tickfine",
  nib: "tickfine",
  plotter: "sweep",
  slide: "sweep",
  shutter: "stamp",
  flip: "tear",
  crumple: "tear",
};

const resolve = (name, { preferSynth = false } = {}) => {
  const sourced = preferSynth ? null : sourcedReady(name);
  if (!sourced && !KIT[name] && FALLBACK[name]) {
    console.log(
      `SUB    sfx "${name}" is not imported — falling back to the ` +
        `synthesized "${FALLBACK[name]}". Run \`reelkit sfx:import\`.`,
    );
    return resolve(FALLBACK[name], { preferSynth });
  }
  if (sourced?.unregistered) {
    // A warning here and a refusal in `npm run ship`: rendering is
    // auditioning, shipping is distributing, and only the second one is
    // the moment a missing licence costs anything.
    console.log(
      `UNREG  sfx "${name}" has no source/license row in ` +
        `posts/sfx/sourced.json — it renders, it does not ship.`,
    );
  }
  if (sourced) return { file: sourced.file, sourced: true };
  if (!KIT[name]) {
    throw new Error(
      `unknown sfx "${name}" — not in the synthesized KIT and not imported ` +
        `into posts/sfx/sourced/.`,
    );
  }
  return { file: path.join(sfxDir, `${name}.wav`), sourced: false };
};

export const buildSfx = (beats, sfx, fps, { preferSynth = false } = {}) => {
  if (!sfx) return null;
  const opts = sfx === true ? {} : sfx;
  const volume = opts.volume ?? SFX_VOLUME;
  const map = { ...DEFAULT_MAP };
  for (const [key, spec] of Object.entries(opts.map ?? {})) {
    map[key] = overrideToFn(spec);
  }

  const hits = [];
  const overruns = [];
  // Alternating variants: a run of identical samples reads as a loop.
  let prints = 0;
  let from = 0;
  // A beat shows one picture or several, and a sound belongs to the picture
  // that makes it — so the element pass runs per SHOT, on the shot's own
  // start and its own length. A beat's reaction sound stays the beat's: it
  // marks the cut into the beat, not any one picture inside it.
  const pictures = [];
  for (const beat of beats) {
    const start = from;
    from += beat.durationInFrames;
    if (beat.shots) {
      for (const shot of beat.shots) {
        pictures.push({
          beat,
          start: start + shot.startFrame,
          durationInFrames: shot.durationInFrames,
          element: shot.element,
          cueFrames: shot.cueFrames ?? [],
          reaction: shot === beat.shots[0] ? beat.sound : null,
        });
      }
    } else {
      pictures.push({
        beat,
        start,
        durationInFrames: beat.durationInFrames,
        element: beat.element,
        cueFrames: beat.cueFrames ?? [],
        reaction: beat.sound,
      });
    }
  }
  for (const picture of pictures) {
    const start = picture.start;

    // A REACTION sound belongs to the beat, not to an element part. The
    // event it marks is the cut itself — the moment the viewer sees the
    // thing the reel is reacting to — so it fires on the beat's first
    // frame and takes no [+]. `sound: "cave"` on the beat, or
    // `sound: { name, at, volume }` to place it a beat later or duck it.
    if (picture.reaction) {
      const spec =
        typeof picture.reaction === "string" ? { name: picture.reaction } : picture.reaction;
      hits.push({
        name: spec.name,
        frame: start + Math.round((spec.at ?? 0) * fps),
        ...(spec.volume != null ? { volume: spec.volume } : {}),
      });
    }

    // An element that describes its own motion wins over the type map:
    // it knows how many units it has, how far each bar travels and the
    // frame a pour crosses a line, none of which a cue list carries.
    // The map stays for elements with no emitter, and a post's own
    // `sfx.map` override still beats both.
    const key = elementKey(picture.element);
    const emitted =
      opts.map?.[key] === undefined
        ? emitFor(picture.element, picture.cueFrames ?? [], fps)
        : null;
    if (emitted?.length) {
      for (const hit of emitted) {
        // An emitter computes frames from the ELEMENT's timeline, which
        // can be longer than the beat the writer gave it. Past the beat's
        // last frame the element is no longer on screen, so its sound
        // would play over the next one — a counter still ratcheting under
        // a photograph. Drop it and say so: the fix is the beat's `hold`,
        // and the same overrun is cutting the animation off visually.
        if (hit.frame >= picture.durationInFrames) {
          overruns.push(`${key} (${hit.sound} at ${hit.frame}f of ${picture.durationInFrames}f)`);
          continue;
        }
        hits.push({
          name: hit.sound,
          frame: start + hit.frame,
          ...(hit.volume != null ? { volume: hit.volume } : {}),
          ...(hit.rate != null ? { rate: hit.rate } : {}),
        });
      }
      continue;
    }

    const fn = map[key];
    if (!fn) continue;
    for (const hit of fn(picture.cueFrames ?? [], picture.element)) {
      if (!hit) continue;
      let name = hit.sound;
      // The two-seed alternation exists so a run of seven identical
      // samples does not read as a loop. A sourced print is one
      // recording, so there is no second seed to alternate with — and a
      // real take has enough internal variation that it does not need one.
      if (name === "print" && !sourcedReady("print")) {
        name = ++prints % 2 === 0 ? "print2" : "print";
      }
      // A map hit is as expressive as an emitter hit: the typewriter
      // needs a per-row rate to stop sounding like a metronome, and it
      // is reached through this branch rather than through emitFor.
      hits.push({
        name,
        frame: start + hit.frame,
        ...(hit.volume != null ? { volume: hit.volume } : {}),
        ...(hit.rate != null ? { rate: hit.rate } : {}),
      });
    }
  }
  if (overruns.length) {
    console.log(
      `OVER   ${overruns.length} effect(s) fell past their beat and were ` +
        `dropped — the beat is shorter than the element's own animation: ` +
        `${[...new Set(overruns)].slice(0, 4).join(", ")}` +
        `${overruns.length > 4 ? " …" : ""}`,
    );
  }
  if (!hits.length) return null;

  ensureKit();
  const dir = path.join(projectDir, "public", "sfx");
  mkdirSync(dir, { recursive: true });
  const lengths = new Map();
  const origins = new Map();
  for (const name of new Set(hits.map((h) => h.name))) {
    const { file: src, sourced } = resolve(name, { preferSynth });
    copyFileSync(src, path.join(dir, `${name}.wav`));
    lengths.set(name, durationInFrames(src, fps));
    origins.set(name, sourced);
  }
  buildSfx.origins = origins;
  return hits.map((h) => ({
    file: `sfx/${h.name}.wav`,
    frame: h.frame,
    // A rate below 1 stretches the sample, so the window has to stretch
    // with it or the tail is cut off mid-decay.
    durationInFrames: Math.ceil(lengths.get(h.name) / Math.min(1, h.rate ?? 1)),
    // A reaction sound is the point of its beat, not a detail under the
    // voice, so a per-hit volume overrides the kit's -14 dB.
    volume: h.volume ?? volume,
    ...(h.rate != null ? { rate: h.rate } : {}),
  }));
};

// ---------------------------------------------------------------------------
// The register — same shape as posts/art/LICENSES.md, written by the code
// that makes the files so it cannot drift from them.

const writeRegister = () => {
  const rows = Object.entries(KIT)
    .map(([name, rec]) => {
      const file = path.join(sfxDir, `${name}.wav`);
      const ms = existsSync(file)
        ? `${Math.round(
            Number(
              execFileSync(
                "ffprobe",
                ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file],
                { encoding: "utf8" },
              ),
            ) * 1000,
          )} ms · ${truePeak(file)?.toFixed(1)} dBFS peak`
        : "—";
      return (
        `| ${name}.wav | ${rec.what} | ${ms} | synthesized — ffmpeg lavfi, ` +
        `no source recording | first-party, no rights held by anyone else |`
      );
    })
    .join("\n");
  writeFileSync(
    path.join(sfxDir, "LICENSES.md"),
    `# posts/sfx — sound kit

Discrete effects for reel animation events. **Every file here is
synthesized**: ffmpeg's own oscillators (\`aevalsrc\`) and noise generator
(\`anoisesrc\`) through a filter graph. There is no source recording, no
sample pack, no library, no download. Nothing in this directory is a
derivative of anyone's work.

The recipes are in \`reelkit/scripts/sfx.mjs\` (\`KIT\`) and \`reelkit sfx\`
regenerates every file from them — which is why the wavs are gitignored
and this register is not. **The recipe is the provenance.**

| file | what it is | as shipped | source | license |
|---|---|---|---|---|
${rows}

## Why synthesized rather than CC0

CC0 sound libraries exist and Freesound has a CC0 filter, so a licensed
route was available. It was not taken, for three reasons:

1. **A click has no authorship worth borrowing.** The whole asset is
   200 ms of band-limited noise under an envelope. Nothing about a
   recording of a real printer survives that description better than a
   generated one does, and the generated one is tuned to the exact 7-frame
   wipe it accompanies.
2. **A licence is a claim about a chain of custody, and chains break.**
   \`posts/clips/LICENSES.md\` is the register of what happens when the
   chain is reconstructed after the fact: nine assets promoted with no
   row written, three of them a competitor's marketing material, already
   live on three platforms. A synthesized asset has no chain to keep.
3. **It regenerates.** A CC0 download has to be stored, backed up and
   re-found. This kit is 40 lines of filter graph in a tracked file.

## Levels

Each file is normalized to a **momentary max of -26 LUFS** — the raw
narration's own loudness, before the final -14 LUFS pass. Integrated
loudness does not exist for a 200 ms sound (R128 measures 400 ms blocks
and gates the rest; \`loudnorm\` reports -70 and normalizes the noise
floor), so the metric is the loudest 400 ms window, measured on the file
padded with silence.

One exception overrides the target: **nothing leaves the kit peaking
above -3 dBFS**. A 30 ms click normalized to -26 LUFS momentary wants to
touch full scale, because a 400 ms window cannot describe its crest
factor. Peak wins that argument — the sound simply lands under the
loudness target, which for a transient shorter than the ear's own
integration time is where it belongs anyway.

With that normalization, the \`volume\` in a placement is a real dB
offset under the voice. The default is 0.2 — **14 dB under**.
`,
  );
};

// ---------------------------------------------------------------------------

if (import.meta.url === `file://${process.argv[1]}`) {
  const force = process.argv.includes("--force");
  const made = ensureKit({ force });
  if (!made.length) {
    console.log(`SFX  kit already in ${path.relative(projectDir, sfxDir)} — --force to rebuild`);
  }
  for (const m of made) {
    console.log(
      `SFX  ${m.name.padEnd(8)} ${m.measured?.toFixed(1)} → ${SFX_LUFS} LUFS momentary ` +
        `(${m.gain >= 0 ? "+" : ""}${m.gain.toFixed(1)} dB), peak ${m.peak?.toFixed(1)} dBFS`,
    );
  }
  console.log(
    `SFX  ${Object.keys(KIT).length} sounds · register at posts/sfx/LICENSES.md`,
  );
}
