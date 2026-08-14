#!/usr/bin/env node
// reelkit — one entry point, run from inside a project.
//
//   reelkit init                  scaffold a project here
//   reelkit reel <post>           render the reel
//   reelkit slides <post>         render the slideshow
//   reelkit cover <post>          render the grid cover
//   reelkit lab <element>         preview one element, alone
//   reelkit gates <post>          the audits, no render, no TTS call
//   reelkit elements              the merged element bank
//
// Every command resolves the project by walking up from the working directory
// to reel.config.mjs (scripts/project.mjs). The engine itself lives wherever
// npm put it and holds no state.

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const kitDir = path.dirname(fileURLToPath(import.meta.url));

/** command → the script that answers it. */
const COMMANDS = {
  reel: "render-reel.mjs",
  slides: "render-slides.mjs",
  cover: "render-cover.mjs",
  lab: "lab.mjs",
  gates: "gates.mjs",
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
  [path.join(kitDir, "scripts", script), ...rest],
  { stdio: "inherit" },
);
child.on("exit", (code) => process.exit(code ?? 0));
