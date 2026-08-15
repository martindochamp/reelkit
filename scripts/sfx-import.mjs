#!/usr/bin/env node
// Brings downloaded sound into the kit — trimmed, converted, and levelled
// into the SAME contract the synthesized effects obey, so `volume` keeps
// meaning one thing (a dB offset under the narration).
//
//   npm run sfx:import           import everything in posts/sfx/sourced.json
//   npm run sfx:import -- --list what is registered, and what is missing
//
// Drop the raw downloads in posts/sfx/_incoming/ (gitignored), describe
// them in posts/sfx/sourced.json (committed), run this. Output goes to
// posts/sfx/sourced/<name>.wav (gitignored, regenerable from the raws).
//
// WHY A REGISTER AND NOT JUST A FOLDER
//
// The synthesized kit needed none: the ffmpeg recipe IS the provenance.
// A downloaded file has a chain of custody instead, and this project has
// already paid for one that nobody wrote down — posts/clips/LICENSES.md
// records nine Giphy assets promoted with no licence row, three of them a
// competitor's own marketing material, already live on three platforms.
//
// So: `source` and `license` are REQUIRED, and a reel that uses a sourced
// effect whose row is still null does not render. Filling them is one line
// each and it is the cheapest insurance in the pipeline.

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { projectDir } from "./stage.mjs";

const sfxDir = path.join(projectDir, "posts", "sfx");
const incomingDir = path.join(sfxDir, "_incoming");
const outDir = path.join(sfxDir, "sourced");
const registerFile = path.join(sfxDir, "sourced.json");

/** The voice's own loudness — every effect is normalized to it. */
const SFX_LUFS = -26;
const PEAK_CEILING = -3;

export const readRegister = () => {
  if (!existsSync(registerFile)) return [];
  return JSON.parse(readFileSync(registerFile, "utf8"));
};

/** A sourced effect that may actually ship: it has a file AND a provenance. */
export const sourcedReady = (name) => {
  const row = readRegister().find((r) => r.name === name);
  if (!row) return null;
  const file = path.join(outDir, `${name}.wav`);
  if (!existsSync(file)) return null;
  if (!row.source || !row.license) return { file, row, unregistered: true };
  return { file, row, unregistered: false };
};

// ---------------------------------------------------------------------------
// Levels — momentary max, exactly as scripts/sfx.mjs does it.
//
// A 200 ms click has no INTEGRATED loudness (R128 gates it and reports
// -70), so the metric is the loudest 400 ms window on a silence-padded
// copy. A BED is different: it is continuous, so integrated loudness is
// the right measure and it takes the plain loudnorm path the music bed
// uses.

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
  const values = [...log.matchAll(/\bM:\s*(-?\d+(?:\.\d+)?)/g)].map((m) => Number(m[1]));
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

const importOne = (row) => {
  const src = path.join(incomingDir, row.file);
  if (!existsSync(src)) return { name: row.name, missing: row.file };
  mkdirSync(outDir, { recursive: true });

  // Trim first, then flatten to the kit's format: 48 kHz, mono, PCM.
  // Mono is not a downgrade here — every effect in this system is a point
  // event under a mono narration, and a stereo click only widens the one
  // thing that should sit dead centre with the voice.
  const raw = path.join(os.tmpdir(), `sfx-src-${row.name}.wav`);
  const trim = row.trim
    ? ["-ss", String(row.trim[0]), "-to", String(row.trim[1])]
    : [];

  // Two derivations, so one download can be two sounds.
  //
  // `reverse` is the honest way to make a departure out of an arrival: a
  // pop played backwards is an intake, and the ear reads it as "the thing
  // left" without being told. Cheaper and more coherent than sourcing a
  // second file — it is literally the same object going the other way.
  //
  // `semitones` shifts pitch by resampling, which also stretches the
  // sound. On a 100 ms pop that is a feature: lower AND slightly longer
  // reads as settling rather than as the same event transposed.
  const chain = [];
  if (row.reverse) chain.push("areverse");
  if (row.semitones) {
    const ratio = Math.pow(2, row.semitones / 12);
    chain.push(`asetrate=48000*${ratio.toFixed(6)}`, "aresample=48000");
  }
  // A hard cut mid-waveform clicks. Five milliseconds each end is
  // inaudible and removes it. Applied LAST, after any reversal, so the
  // fade sits on the finished shape rather than on the source's.
  chain.push(
    "afade=t=in:st=0:d=0.005",
    "areverse",
    "afade=t=in:st=0:d=0.005",
    "areverse",
  );

  execFileSync(
    "ffmpeg",
    [
      "-hide_banner", "-loglevel", "error", "-y",
      ...trim, "-i", src,
      "-af", chain.join(","),
      "-ac", "1", "-ar", "48000", "-c:a", "pcm_s16le",
      raw,
    ],
    { stdio: "pipe" },
  );

  const out = path.join(outDir, `${row.name}.wav`);
  if (row.bed) {
    // A bed is continuous, so it takes the music path: integrated
    // loudnorm to the voice's level, and `volume` is then a real offset.
    execFileSync(
      "ffmpeg",
      [
        "-hide_banner", "-loglevel", "error", "-y",
        "-i", raw,
        "-af", `loudnorm=I=${SFX_LUFS}:TP=-2:LRA=11`,
        "-ac", "1", "-ar", "48000", "-c:a", "pcm_s16le",
        out,
      ],
      { stdio: "pipe" },
    );
    return { name: row.name, bed: true, peak: truePeak(out) };
  }

  const m = momentaryMax(raw);
  const rawPeak = truePeak(raw) ?? 0;
  const gain = Math.min((m === null ? 0 : SFX_LUFS - m), PEAK_CEILING - rawPeak);
  execFileSync(
    "ffmpeg",
    [
      "-hide_banner", "-loglevel", "error", "-y",
      "-i", raw,
      "-af", `volume=${gain.toFixed(2)}dB`,
      "-ac", "1", "-ar", "48000", "-c:a", "pcm_s16le",
      out,
    ],
    { stdio: "pipe" },
  );
  return { name: row.name, measured: m, gain, peak: truePeak(out) };
};

const seconds = (file) =>
  Number(
    execFileSync(
      "ffprobe",
      ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file],
      { encoding: "utf8" },
    ).trim(),
  );

// ---------------------------------------------------------------------------
// The CLI, and why it is behind a guard.
//
// This file is TWO things: the `sfx:import` command, and the module
// render-reel.mjs / sfx.mjs / sfx-audit.mjs read `sourcedReady` and
// `readRegister` out of. Everything below used to run at TOP LEVEL, so
// importing it ran the command — including its `process.exit(1)` when there is
// no register.
//
// In the project this was forked from that never fired: posts/sfx/sourced.json
// had existed for months. In a project scaffolded by `reelkit init` it fires
// immediately, because init makes posts/sfx/ and nothing in it — so the very
// first `reelkit reel` in a new project died with "no register at …/sourced.json"
// before it had read a single beat, and `--gates`, which is documented as
// touching nothing, died the same way. Found on Papyr, the first non-Tally
// consumer.
//
// A module that is also a script guards its body. Nothing else changes.

const isEntryPoint =
  process.argv[1] != null &&
  pathToFileURL(process.argv[1]).href === import.meta.url;

if (isEntryPoint) {
  const rows = readRegister();
  if (!rows.length) {
    console.error(
      `no register at ${registerFile}\n` +
        `Sourced sound is opt-in: describe each download there (name, file, ` +
        `source, license) and re-run. The synthesized kit needs none of this — ` +
        `\`reelkit sfx\`.`,
    );
    process.exit(1);
  }

  if (process.argv.includes("--list")) {
    for (const row of rows) {
      const out = path.join(outDir, `${row.name}.wav`);
      const state = !existsSync(out)
        ? "not imported"
        : !row.source || !row.license
          ? "IMPORTED — no source/license row, cannot ship"
          : "ready";
      console.log(`${row.name.padEnd(11)} ${state.padEnd(38)} ${row.what ?? ""}`);
    }
    process.exit(0);
  }

  const done = [];
  for (const row of rows) done.push(importOne(row));

  for (const r of done) {
    if (r.missing) {
      console.log(`SKIP  ${r.name.padEnd(11)} ${r.missing} not in posts/sfx/_incoming/`);
      continue;
    }
    const file = path.join(outDir, `${r.name}.wav`);
    const d = seconds(file);
    console.log(
      `SFX   ${r.name.padEnd(11)} ${d.toFixed(2)}s  ` +
        (r.bed
          ? `bed, ${SFX_LUFS} LUFS integrated`
          : `${r.measured?.toFixed(1) ?? "?"} → ${SFX_LUFS} LUFS momentary (${r.gain.toFixed(1)} dB)`) +
        `, peak ${r.peak?.toFixed(1) ?? "?"} dBFS`,
    );
  }

  const naked = rows.filter((r) => !r.source || !r.license);
  writeRegisterDoc(rows);
  if (naked.length) {
    console.log(
      `\n${naked.length} of ${rows.length} rows have no source/license: ` +
        `${naked.map((r) => r.name).join(", ")}.\n` +
        `They are imported and auditionable, and a reel that USES one will ` +
        `refuse to render until posts/sfx/sourced.json says where it came from.`,
    );
  }
}

function writeRegisterDoc(rows) {
  const body = rows
    .map((r) => {
      const out = path.join(outDir, `${r.name}.wav`);
      const d = existsSync(out) ? `${seconds(out).toFixed(2)} s` : "—";
      return (
        `| ${r.name}.wav | ${r.what ?? ""} | ${d} | ${r.file}` +
        `${r.trim ? ` @ ${r.trim[0]}–${r.trim[1]} s` : ""}` +
        `${r.reverse ? ", reversed" : ""}` +
        `${r.semitones ? `, ${r.semitones > 0 ? "+" : ""}${r.semitones} st` : ""} | ` +
        `${r.source ?? "**MISSING**"} | ${r.license ?? "**MISSING**"} |`
      );
    })
    .join("\n");
  writeFileSync(
    path.join(outDir, "LICENSES.md"),
    `# posts/sfx/sourced — downloaded sound

Generated by \`reelkit sfx:import\` from \`posts/sfx/sourced.json\`. Edit
the JSON, not this file.

Unlike the synthesized kit one directory up — where the ffmpeg recipe IS
the provenance — every file here came from somewhere and that somewhere
has to survive a clone. **A reel that uses an effect whose source or
license is MISSING does not render.**

| file | what it is | as shipped | from | source | license |
|---|---|---|---|---|---|
${body}

## The bar for what may go in here

**CC0, or a licence that permits commercial use with no attribution.**
Freesound with the licence filter set to Creative Commons 0, or Pixabay's
sound library. Not Zapsplat (attribution required, and a reel has nowhere
to put it), not the BBC library (RemArc is non-commercial), and nothing
ripped from a video.

Identifiable intellectual property does not go in here at all, however
common it is on the platform — a game's ambience, a film's score, a
platform's own UI chime. The account's whole differentiation is that it
looks and sounds like an instrument rather than like everyone else's
feed; borrowing someone's audio signature costs that twice.
`,
  );
}
