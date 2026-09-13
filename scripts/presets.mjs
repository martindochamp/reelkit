// A preset is a named JSON fragment. That is the whole idea, and the reason
// this file is 120 lines instead of a subsystem.
//
// Seven reference reels were torn down frame by frame on 2026-09-08 and the
// recurring devices they produced fall into two kinds, which look alike in a
// list and are nothing alike to build:
//
//   1. A THING THAT DOES NOT EXIST — a swipe carousel, a hand holding a
//      phone, a cross-and-check pair. Those are components, and reelkit
//      already has a bank for components: `<project>/elements/<name>/`,
//      documented in ELEMENTS.md. They are not presets and must not be
//      forced through here.
//   2. A NAMED SET OF VALUES on things that already exist — a camera leg
//      from here to there, a caption band set this way, a border of that
//      weight. Those are JSON, and they had nowhere to live. This is that
//      place.
//
// The distinction is load-bearing. A preset system that also ships code is
// a second plugin mechanism competing with the element bank, and the two
// would drift the way sfx-elements.mjs and tier-fit.mjs already drift from
// the registry they mirror.
//
// Banks, and the shadowing rule, are the element bank's rule verbatim:
// core presets ship in reelkit/presets/, a project's own live in
// <project>/presets/, and a project name shadows a core name deliberately.
// A project that writes its own `film-strip` has decided the core one is
// wrong for it, and silently ignoring that would be the worse surprise.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const kitDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

/**
 * Keys a preset may never set.
 *
 * `say` is the voice. A preset that could write `say` would put words in the
 * writer's mouth from a file they are not reading, and the whole point of the
 * writing gates is that the words are a decision. A preset styles; it does
 * not speak.
 */
const REFUSED = new Set(["say"]);

const loadBank = (dir, origin) => {
  const bank = {};
  if (!existsSync(dir)) return bank;
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".json")) continue;
    const name = file.slice(0, -5);
    let body;
    try {
      body = JSON.parse(readFileSync(path.join(dir, file), "utf8"));
    } catch (e) {
      throw new Error(`preset ${origin}/${file} is not valid JSON — ${e.message}`);
    }
    bank[name] = { ...body, _origin: origin };
  }
  return bank;
};

/**
 * Core bank, then the project's over it. Project shadows core, on purpose.
 *
 * The project directory is PASSED IN rather than imported. Importing
 * project.mjs would make this module refuse to load outside a project, and
 * a module that cannot load without mounting the world is a module that
 * will not be tested — which is how the defect above got here.
 */
export const presetBank = (projectDir) => ({
  ...loadBank(path.join(kitDir, "presets"), "core"),
  ...(projectDir ? loadBank(path.join(projectDir, "presets"), "project") : {}),
});

/**
 * Objects merge, everything else replaces.
 *
 * Arrays replace rather than concatenate: a preset carrying `beats` and a
 * post carrying `beats` are two versions of the same list, not two halves of
 * one, and interleaving them would produce a reel neither file describes.
 */
const merge = (base, over) => {
  if (!isPlain(base) || !isPlain(over)) return over === undefined ? base : over;
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) out[k] = merge(base[k], v);
  return out;
};

const isPlain = (v) =>
  v !== null && typeof v === "object" && !Array.isArray(v);

/** Resolve one name into a flat fragment, following `extends` first. */
const fragment = (name, bank, seen, where, level) => {
  const entry = bank[name];
  if (!entry) {
    const known = Object.keys(bank).sort();
    throw new Error(
      `${where}: no preset named "${name}". ` +
        (known.length
          ? `The bank holds: ${known.join(", ")}.`
          : `The bank is empty — presets live in <project>/presets/*.json.`) +
        ` A missing preset is refused rather than ignored: a name that ` +
        `silently does nothing renders a post that looks finished and is not.`,
    );
  }
  if (seen.includes(name)) {
    throw new Error(
      `${where}: preset "${name}" extends itself — ${[...seen, name].join(" → ")}`,
    );
  }
  const { extends: parent, ...rest } = entry;
  // Every leading-underscore key is an annotation ABOUT the preset — where it
  // was measured, why it exists, which level it belongs to. None of them are
  // values for the spec, so none of them travel into it. (A post may still
  // write its own `_note`; that is the author annotating their own file, and
  // it is not this file's business.)
  const own = Object.fromEntries(
    Object.entries(rest).filter(([k]) => !k.startsWith("_")),
  );
  const _level = entry._level;
  if (_level) {
    const allowed = Array.isArray(_level) ? _level : [_level];
    if (!allowed.includes(level)) {
      throw new Error(
        `${where}: preset "${name}" is a ${allowed.join("/")} preset and this ` +
          `is a ${level}. Levels set different keys — a reel preset names ` +
          `\`chrome.border\`, a beat preset names \`border\` — so applying one ` +
          `at the wrong level merges keys that nothing reads there, and the ` +
          `post renders looking finished with the preset having done nothing.`,
      );
    }
  }
  for (const key of Object.keys(own)) {
    if (REFUSED.has(key)) {
      throw new Error(
        `${where}: preset "${name}" sets "${key}", which a preset may not ` +
          `set. A preset styles a beat; it does not write it.`,
      );
    }
  }
  const base = parent
    ? fragment(parent, bank, [...seen, name], where, level)
    : {};
  return merge(base, own);
};

/**
 * Apply a node's `preset` key, if it has one. The node's own keys always win,
 * so a preset is a floor and never a ceiling — that is what makes one
 * adaptable per post rather than a second place to look for the truth.
 */
export const applyPreset = (node, bank, where, level) => {
  if (!isPlain(node) || node.preset === undefined) return node;
  const names = Array.isArray(node.preset) ? node.preset : [node.preset];
  let base = {};
  for (const name of names) {
    if (typeof name !== "string") {
      throw new Error(`${where}: "preset" takes a name or a list of names.`);
    }
    base = merge(base, fragment(name, bank, [], where, level));
  }
  const { preset, ...own } = node;
  return merge(base, own);
};

/**
 * Walk a reel and resolve presets on the reel, every beat and every shot.
 * Those three are the only nodes that take one: a preset describes how a
 * stretch of picture is set, and those are the three nodes that own a
 * stretch of picture.
 */
export const resolvePresets = (reel, name, bank) => {
  const out = applyPreset(reel, bank, `${name} reel`, "reel");
  if (!Array.isArray(out.beats)) return out;
  out.beats = out.beats.map((beat, i) => {
    const b = applyPreset(beat, bank, `${name} beat ${i + 1}`, "beat");
    if (Array.isArray(b.shots)) {
      b.shots = b.shots.map((shot, j) =>
        applyPreset(shot, bank, `${name} beat ${i + 1} shot ${j + 1}`, "shot"),
      );
    }
    return b;
  });
  return out;
};

// ---------------------------------------------------------------------
// `reelkit presets` — print the merged bank, marking which side each name
// came from. Same shape and same purpose as `reelkit elements`: the answer
// to "what can I name here" should not be a directory listing.
if (import.meta.url === `file://${process.argv[1]}`) {
  const { projectDir } = await import("./project.mjs");
  const bank = presetBank(projectDir);
  const names = Object.keys(bank).sort();
  if (!names.length) {
    console.log("no presets — core ships none and this project defines none.");
  }
  for (const name of names) {
    const p = bank[name];
    const level = p._level
      ? (Array.isArray(p._level) ? p._level.join("/") : p._level)
      : "any";
    const keys = Object.keys(p).filter((k) => !k.startsWith("_") && k !== "extends");
    console.log(
      // 16 wide plus a separator: `reel/beat/shot` is 14 and the old 10 let
      // the keys column glue itself onto the level, which is how the first
      // motion preset printed as "reel/beat/shotmotion".
      `${name.padEnd(18)} ${p._origin.padEnd(8)} ${level.padEnd(16)} ` +
        `${p.extends ? `extends ${p.extends}  ` : ""}${keys.join(", ")}`,
    );
    if (p._measured) console.log(`${" ".repeat(19)}${p._measured}`);
  }
}
