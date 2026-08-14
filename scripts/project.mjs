// Where the project is, and what it decided.
//
// The engine lives in node_modules; the posts, the assets and the output do
// not. Every script that used to derive its paths from its own location now
// asks here instead, and this file is the only thing in reelkit that knows a
// project exists.
//
// Resolution walks UP from the working directory looking for reel.config.mjs,
// the same way a bundler finds its config — so `reelkit reel mg` works from
// anywhere inside the project, and fails with a sentence rather than with a
// missing file three calls later.

import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

/** reelkit's own root — where src/ and scripts/ live. */
export const kitDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const CONFIG_NAME = "reel.config.mjs";

const findProjectRoot = (from = process.cwd()) => {
  let dir = path.resolve(from);
  for (;;) {
    if (existsSync(path.join(dir, CONFIG_NAME))) return dir;
    const up = path.dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
};

export const projectDir = (() => {
  const found = findProjectRoot();
  if (found) return found;
  throw Object.assign(
    new Error(
      `no ${CONFIG_NAME} in ${process.cwd()} or any parent.\n` +
        `A reelkit command runs from inside a project. Create one with:\n` +
        `  npx reelkit init`,
    ),
    { fatal: true },
  );
})();

export const postsDir = path.join(projectDir, "posts");
export const publicDir = path.join(projectDir, "public");
export const outDir = path.join(projectDir, "out");
export const elementsDir = path.join(projectDir, "elements");
/** Generated, gitignored: the theme and element modules the bundler aliases. */
export const genDir = path.join(projectDir, ".reelkit");

/**
 * The defaults, and the whole list of what a project may set. Anything not
 * here is not configurable, which is the point of writing them down: a
 * constant that belongs to the instrument (the caption band's height, the
 * 0.33 s print wipe) is not a preference, and a project that wants it
 * different is asking for a different element.
 */
const DEFAULTS = {
  /** Which org on the Attribura board this project's work belongs to. */
  attribura: { project: null },
  voice: {
    /** "runpod" | "lambda" — the Chatterbox backend. */
    backend: "runpod",
    /** The reference sample cloned per line, minus "-sample.wav". */
    sample: null,
    language: "en",
    exaggeration: 0.5,
    cfg_weight: 0.5,
    temperature: 0.8,
  },
  gates: {
    /**
     * `target` is what a script is written to; `ceiling` is what refuses.
     * They are two different numbers because the estimate is not the file —
     * the fit carries a ±3 s residual, so aiming at the ceiling ships over it.
     */
    seconds: { target: 35, ceiling: 40 },
    /** Words of prose allowed on one screen. */
    prose: 12,
    /** A `line` is a caption under a specimen, not a second argument. */
    line: 7,
    /** A `kicker` is a label. */
    kicker: 5,
    /** A table's left label past this is a claim, not a row. */
    tableLabel: 34,
    /** The legibility floor for a tier list, in points on a 393-pt handset. */
    tierFloorPt: 5.2,
    /** Seconds of blank paper a beat may open on before it is a defect. */
    blank: 1.2,
  },
  endcard: {
    /** A PNG in posts/mockups/ with a real alpha channel. */
    asset: null,
    storeUrl: null,
  },
};

const merge = (base, over) => {
  if (!over || typeof over !== "object" || Array.isArray(over)) return over ?? base;
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) {
    out[k] = k in base && base[k] && typeof base[k] === "object" && !Array.isArray(base[k])
      ? merge(base[k], v)
      : v;
  }
  return out;
};

/**
 * The project's config, defaults filled in. Loaded once per process.
 *
 * `theme` has no default here on purpose — an unthemed project falls through
 * to `src/theme.default.ts` at the bundler, so the neutral palette exists in
 * exactly one place instead of two that can disagree.
 */
export const config = await (async () => {
  const file = path.join(projectDir, CONFIG_NAME);
  const mod = await import(pathToFileURL(file).href);
  const raw = mod.default ?? mod;
  if (!raw || typeof raw !== "object") {
    throw Object.assign(
      new Error(`${CONFIG_NAME} must default-export an object.`),
      { fatal: true },
    );
  }
  return merge(DEFAULTS, raw);
})();

export const ensureDirs = () => {
  for (const d of [postsDir, publicDir, outDir, genDir]) {
    mkdirSync(d, { recursive: true });
  }
};
