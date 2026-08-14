// Staging shared by the two renderers (render-slides.mjs → PNGs,
// render-reel.mjs → MP4). A post spec references files by name; staging is
// the step that makes them real under public/ and injects the ASCII art.

import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { imageToAscii } from "./img2ascii.mjs";
import { config, postsDir, projectDir } from "./project.mjs";

// The paths are the project's, not the engine's — see scripts/project.mjs.
// Re-exported because every renderer already imports them from here.
export { postsDir, projectDir };

// Screenshot slides read from public/raw(-dark)/ — stage from the capture
// directory when a file is only there. Missing captures fail the post loudly;
// a slideshow with a hole in it is not a deliverable.
//
// Where the captures come from is the project's business: an iOS app points
// `captures` at its fastlane output, anything else points it wherever its
// screenshots land.
export const stageShots = (post) => {
  const rawName = post.theme === "dark" ? "raw-dark" : "raw";
  const publicRawDir = path.join(projectDir, "public", rawName);
  const captureDir = path.resolve(
    projectDir,
    config.captures ?? "captures",
    rawName,
  );
  mkdirSync(publicRawDir, { recursive: true });
  for (const slide of post.slides) {
    if (slide.type !== "shot") continue;
    const staged = path.join(publicRawDir, slide.file);
    if (existsSync(staged)) continue;
    const capture = path.join(captureDir, slide.file);
    if (!existsSync(capture)) {
      throw new Error(
        `shot "${slide.file}" not found in ${publicRawDir} or ${captureDir}`,
      );
    }
    copyFileSync(capture, staged);
  }
};

// Mockup slides carry Martin's composed device frames from posts/mockups/.
export const stageMockups = (post) => {
  const publicDir = path.join(projectDir, "public", "mockups");
  mkdirSync(publicDir, { recursive: true });
  for (const slide of post.slides) {
    if (slide.type !== "mockup") continue;
    const source = path.join(postsDir, "mockups", slide.file);
    if (!existsSync(source)) {
      throw new Error(`mockup "${slide.file}" not found in posts/mockups/`);
    }
    copyFileSync(source, path.join(publicDir, slide.file));
  }
};

// Art slides reference a source image in posts/art/ — the ASCII conversion
// happens here, invisibly, and rides into the composition as a prop. Tuning
// (cols, contrast, gamma, floor, invert) comes straight off the slide spec.
export const stageArt = async (post) => {
  const convert = async (spec) => {
    const src = path.join(postsDir, "art", spec.image);
    if (!existsSync(src)) {
      throw new Error(
        `art "${spec.image}" not found in ${path.join(postsDir, "art")}`,
      );
    }
    spec.ascii = await imageToAscii(src, spec);
  };
  for (const slide of post.slides) {
    if (slide.type === "art") await convert(slide);
    // A `lines` slide can scatter faint specimens behind the rows; they are
    // ordinary art specs and go through exactly the same converter.
    for (const spec of slide.around ?? []) await convert(spec);
  }
};

// The generator leaves slide 1 flagged, because the data writes the number
// and never the line. File 003 shipped with that flag still on it — the
// placeholder renders perfectly, which is exactly why nothing caught it.
// Refuse the post instead. Spoken lines are held to the same rule.
export const refusePlaceholders = (post, name) => {
  for (const [i, slide] of post.slides.entries()) {
    const text = [slide.text, slide.sub, slide.line, slide.caption, slide.say]
      .filter(Boolean)
      .join(" ");
    if (/\bTODO\b/i.test(text)) {
      throw new Error(
        `${name} slide ${i + 1} still carries the generator's placeholder.\n` +
          `Write the demand line first — SLIDES.md, "The brief".`,
      );
    }
  }
};

/**
 * The caption as it is actually posted — the YouTube title first, then a
 * blank line, then the body.
 *
 * Martin, 2026-08-11: *"j'aimerais que tu mettes le title youtube
 * directement en première ligne de la caption"*.
 *
 * The title is COMPOSED here rather than typed into the .txt, and the
 * distinction is the whole point: it already lives in the spec as
 * `youtubeTitle`, written with the script, and a string that exists in
 * two files diverges the first time somebody edits one of them. This is
 * the same argument as the sfx register and `posts/art/LICENSES.md` —
 * one source, rendered where it is needed.
 *
 * So every surface that hands Martin a caption to copy — the drop page,
 * the board, the ledger's state — goes through this, and the .txt files
 * stay the body alone.
 */
export const postedCaption = (name) => {
  const file = path.join(postsDir, `${name}.caption.txt`);
  if (!existsSync(file)) return null;
  const body = readFileSync(file, "utf8").trim();
  const specFile = path.join(postsDir, `${name}.json`);
  if (!existsSync(specFile)) return body;
  let title = null;
  try {
    title = JSON.parse(readFileSync(specFile, "utf8")).youtubeTitle ?? null;
  } catch {
    title = null;
  }
  if (!title) return body;
  // Idempotent: a caption that already opens with its title is left alone,
  // so a hand-written one and a composed one cannot double up.
  if (body.startsWith(title)) return body;
  return `${title}\n\n${body}`;
};
