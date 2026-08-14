#!/usr/bin/env node
// Renders social slideshows: every posts/<name>.json (or just the names
// passed as args) becomes out/slides/<name>/NN.png — one PNG per slide,
// ready to drop into TikTok photo mode or an IG carousel.
//
// Bundles the Remotion project once, then renders every slide through the
// renderer API — no per-slide CLI startup.

import { mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { bundleProject } from "./bundle.mjs";
import { renderStill, selectComposition } from "@remotion/renderer";
import {
  projectDir,
  postsDir,
  refusePlaceholders,
  stageArt,
  stageMockups,
  stageShots,
} from "./stage.mjs";
import { warnTierList } from "./tier-legibility.mjs";

const outRoot = path.join(projectDir, "out", "slides");

const requested = process.argv.slice(2).map((n) => n.replace(/\.json$/, ""));
const available = readdirSync(postsDir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.replace(/\.json$/, ""));
const names = requested.length > 0 ? requested : available;

const missing = names.filter((n) => !available.includes(n));
if (missing.length > 0) {
  console.error(`no such post: ${missing.join(", ")} (have: ${available.join(", ")})`);
  process.exit(1);
}

console.log("BUNDLE  src/index.ts");
const serveUrl = await bundleProject();

let rendered = 0;
for (const name of names) {
  const post = JSON.parse(readFileSync(path.join(postsDir, `${name}.json`), "utf8"));
  refusePlaceholders(post, name);
  stageShots(post);
  stageMockups(post);
  await stageArt(post);

  const compositionId = post.format === "carousel" ? "SlideCarousel" : "SlideTikTok";
  // A shrunk post must not leave stale trailing slides behind — the folder
  // gets AirDropped whole.
  const outDir = path.join(outRoot, name);
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  for (let i = 0; i < post.slides.length; i += 1) {
    const slide = post.slides[i];
    const output = path.join(outDir, `${String(i + 1).padStart(2, "0")}.png`);

    // A lab element as a still: render its settled end state (late frame)
    // through the ElementFrame composition. tiktok format only — the lab
    // canvas is 1080×1920.
    if (slide.type === "element") {
      // A tier list fits its names down until they clear the numbers; past
      // a point what fits is texture. Same audit as the reel, and the reel
      // is the standard it is held to — a carousel slide is the roomier
      // surface (scripts/tier-legibility.mjs).
      if (slide.element === "tierlist") {
        warnTierList(slide.props, { post: name, where: `slide ${i + 1}` });
      }
      const inputProps = {
        element: slide.element,
        props: slide.props ?? {},
        ...(post.theme ? { theme: post.theme } : {}),
      };
      const composition = await selectComposition({
        serveUrl,
        id: "ElementFrame",
        inputProps,
      });
      await renderStill({
        composition,
        serveUrl,
        output,
        inputProps,
        frame: slide.frame ?? 600,
      });
      console.log(`SLIDE  ${name}/${path.basename(output)}  (element:${slide.element})`);
      rendered += 1;
      continue;
    }

    const inputProps = {
      slide,
      index: i,
      count: post.slides.length,
      ...(post.theme ? { theme: post.theme } : {}),
      ...(post.footer ? { footer: post.footer } : {}),
      format: post.format === "carousel" ? "carousel" : "tiktok",
    };
    const composition = await selectComposition({
      serveUrl,
      id: compositionId,
      inputProps,
    });
    await renderStill({ composition, serveUrl, output, inputProps });
    console.log(`SLIDE  ${name}/${path.basename(output)}  (${slide.type})`);
    rendered += 1;
  }
}

console.log(`DONE  ${rendered} slides → ${outRoot}`);
