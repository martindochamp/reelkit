#!/usr/bin/env node
// Renders every drawn flag on one page → out/flags.png.
//
//   npm run flags            dark skin (what a reel usually is)
//   npm run flags -- --light
//
// The flags are hand-typed coordinates. A wrong fraction does not throw —
// it prints a flag that is not that country's flag, inside a beat nobody
// looked at twice. This is the look-before-you-ship.

import { mkdirSync } from "node:fs";
import path from "node:path";
import { bundleProject } from "./bundle.mjs";
import { renderStill, selectComposition } from "@remotion/renderer";
import { projectDir } from "./stage.mjs";

const theme = process.argv.includes("--light") ? "light" : "dark";
const serveUrl = await bundleProject();
const inputProps = { theme };
const composition = await selectComposition({ serveUrl, id: "FlagSheet", inputProps });
const out = path.join(projectDir, "out", `flags-${theme}.png`);
mkdirSync(path.dirname(out), { recursive: true });
await renderStill({ composition, serveUrl, output: out, inputProps });
console.log(`FLAGS  ${out}`);
