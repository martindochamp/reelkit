#!/usr/bin/env node
// reelkit — one entry point, run from inside a project.
//
//   reelkit init                  scaffold a project here
//   reelkit reel <post>           render the reel
//   reelkit slides <post>         render the slideshow
//   reelkit cover <post>          render the grid cover
//   reelkit lab <element>         preview one element, alone
//   reelkit audit <post>          the writing audits, no render, no TTS call
//   reelkit gates [word]          the comment-keyword registry
//   reelkit elements              the merged element bank
//   reelkit presets               the merged preset bank
//
// Every command resolves the project by walking up from the working directory
// to reel.config.mjs (scripts/project.mjs). The engine itself lives wherever
// npm put it and holds no state.

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const kitDir = path.dirname(fileURLToPath(import.meta.url));

/** command → the script that answers it. */
/**
 * Commands whose script always receives an extra flag.
 *
 * `audit` exists because `gates` did not mean what this file's own header
 * said it meant. The header documented `reelkit gates <post>` as "the audits,
 * no render, no TTS call" and README's start-a-project list said the same at
 * step 4 — but `gates` dispatches to gates.mjs, the comment-KEYWORD registry,
 * which reads a post name as a keyword query, prints "SITTING-STILL — free."
 * and exits 0. A writer following the README got a green light with no audit
 * having run, which is the exact failure shape this codebase keeps warning
 * about: the placeholder that renders cleanly.
 *
 * Found on Papyr, the first non-Tally project — in Tally the audits are
 * `npm run reel <post> -- --gates` and nobody used the CLI's name for them.
 */
const ALWAYS = { audit: ["--gates"] };

const COMMANDS = {
  reel: "render-reel.mjs",
  audit: "render-reel.mjs",
  slides: "render-slides.mjs",
  cover: "render-cover.mjs",
  lab: "lab.mjs",
  gates: "gates.mjs",
  presets: "presets.mjs",
  demo: "build-demo.mjs",
  sfx: "sfx.mjs",
  "sfx:import": "sfx-import.mjs",
  "sfx:audit": "sfx-audit.mjs",
  ascii: "img2ascii.mjs",
  "ascii:clip": "ascii-clip.mjs",
  "ascii:score": "ascii-score.mjs",
  "art:find": "art-find.mjs",
  "art:batch": "art-batch.mjs",
  "art:brands": "brand-guard.mjs",
  "clips:find": "clips-find.mjs",
  "clips:make": "clips-make.mjs",
  flags: "flag-sheet.mjs",
  "mockup:alpha": "mockup-alpha.mjs",
  tiers: "tier-legibility.mjs",
};

const [command, ...rest] = process.argv.slice(2);

if (!command || command === "--help" || command === "-h") {
  console.log("reelkit — commands:\n");
  console.log("  init                    scaffold a project in the current directory");
  console.log("  elements                the merged element bank, core + project");
  for (const name of Object.keys(COMMANDS)) console.log(`  ${name}`);
  process.exit(command ? 0 : 1);
}

if (command === "init") {
  const { init } = await import("./scripts/init.mjs");
  await init(process.cwd(), rest);
  process.exit(0);
}

if (command === "elements") {
  // Imported lazily: it resolves the project, and `reelkit --help` must work
  // outside one.
  const { projectElementNames } = await import("./scripts/bundle.mjs");
  const { LAB_CORE_NAMES } = await import("./scripts/core-elements.mjs");
  const mine = projectElementNames();
  for (const name of LAB_CORE_NAMES) {
    console.log(`  ${mine.includes(name) ? "project (overrides core)" : "core    "}  ${name}`);
  }
  for (const name of mine) {
    if (!LAB_CORE_NAMES.includes(name)) console.log(`  project                   ${name}`);
  }
  process.exit(0);
}

const script = COMMANDS[command];
if (!script) {
  console.error(`unknown command: ${command}\nrun \`reelkit --help\``);
  process.exit(1);
}

const child = spawn(
  process.execPath,
  [path.join(kitDir, "scripts", script), ...rest, ...(ALWAYS[command] ?? [])],
  { stdio: "inherit" },
);
child.on("exit", (code) => process.exit(code ?? 0));
