// `reelkit init` — the smallest thing that renders.
//
// It writes a config with the palette left EMPTY and the wordmark unset, on
// purpose. A scaffold that ships a working brand is a scaffold whose output
// looks finished before anyone decided anything, and that is how a
// placeholder reaches a feed.

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const CONFIG = `// What this project decided. Everything not here is the instrument's, not
// yours — see reelkit/docs/CONFIG.md for the whole surface.

export default {
  // Which project on the Attribura board this work belongs to. The board is
  // where posted marks, stats, spent keywords and the idea bank live.
  attribura: { project: null },

  theme: {
    // Your wordmark. Unset, it prints a visible defect rather than nothing.
    brand: { wordmark: null },

    // The four inks, in both modes. Semantic names: \`paper\` is whatever the
    // page is, \`ink\` is whatever the type is. Pull the values from the real
    // product — a palette invented for the videos is a second brand.
    palettes: {
      light: { paper: "#FAFAFA", ink: "#17171A", faded: "#86868B", trace: "#E2E2E4" },
      dark:  { paper: "#121214", ink: "#EDEDF0", faded: "#86868B", trace: "#2A2A2E" },
    },

    // Numbers live in it, so it has to be monospaced.
    mono: '"SF Mono", "SFMono-Regular", ui-monospace, Menlo, Monaco, monospace',
    hairline: 3,
  },

  voice: {
    backend: "runpod",     // the Chatterbox endpoint
    sample: null,          // the reference sample cloned per line
  },

  gates: {
    // Length is fixed; what fits is the choice. Widen this and you are
    // deciding to keep an audience that already left — say why in the commit.
    seconds: { target: 35, ceiling: 40 },
  },

  endcard: {
    asset: null,           // a PNG in posts/mockups/ with a real alpha channel
    storeUrl: null,
  },
};
`;

const GITIGNORE = `node_modules/
out/
.reelkit/
.env

# Regenerable, and one TTS call per line to rebuild — never committed.
posts/audio/
public/

# The assets stay out, their provenance stays in. A register that does not
# survive a clone is not a register.
posts/clips/*
!posts/clips/LICENSES.md
posts/media/*
!posts/media/LICENSES.md
posts/art/*.cutout.png
posts/art/_candidates/
posts/music/
`;

const LICENSES = (what) =>
  `# ${what} — provenance\n\n` +
  `One row per file, added the day it lands. A file with no row here does not\n` +
  `ship: the register is the only thing that survives a clone.\n\n` +
  `| file | source | licence | added |\n|---|---|---|---|\n`;

export const init = async (dir) => {
  const config = path.join(dir, "reel.config.mjs");
  if (existsSync(config)) {
    console.error(`reel.config.mjs already exists in ${dir} — nothing written.`);
    process.exit(1);
  }

  for (const d of [
    "posts",
    "posts/art",
    "posts/clips",
    "posts/media",
    "posts/mockups",
    "posts/sfx",
    "elements",
  ]) {
    mkdirSync(path.join(dir, d), { recursive: true });
  }

  writeFileSync(config, CONFIG);
  writeFileSync(path.join(dir, ".gitignore"), GITIGNORE);
  writeFileSync(path.join(dir, "posts/art/LICENSES.md"), LICENSES("Art"));
  writeFileSync(path.join(dir, "posts/clips/LICENSES.md"), LICENSES("Clips"));
  writeFileSync(path.join(dir, "posts/media/LICENSES.md"), LICENSES("Media"));

  console.log(`reelkit project scaffolded in ${dir}\n`);
  console.log("Next, in order:");
  console.log("  1. reel.config.mjs — the palette and the wordmark. Pull them");
  console.log("     from the real product, not from a mood board.");
  console.log("  2. reelkit elements — what the bank already draws.");
  console.log("  3. posts/<name>.json — the first spec.");
  console.log("  4. reelkit gates <name> — the audits, before any voice is billed.");
};
