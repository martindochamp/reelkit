#!/usr/bin/env node
// Source hunter for animated specimens — Giphy search for the clip
// elements, sibling of art-find.mjs. Downloads candidates into
// posts/clips/_candidates/ (gitignored) and prints each one's MIDDLE
// FRAME as ASCII — the judgment happens on the converted result, never
// on the gif. Promoting one into posts/clips/ is a deliberate, human
// move; the same sourcing bar as art slides applies: one subject, big
// shapes, paper around them — now also a readable silhouette in motion.
//
//   npm run clips:find "duck"
//   npm run clips:find "walking banana" -- --count 8 --cols 56
//   npm run clips:find "sardine" -- --stickers     only the cut-out catalog
//   npm run clips:find "sardine" -- --gifs         only the video catalog
//
// GIPHY_API_KEY in tools/store-shots/.env (gitignored).

import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { imageToAscii } from "./img2ascii.mjs";
import { projectDir } from "./stage.mjs";

const env = {};
const envFile = path.join(projectDir, ".env");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2];
  }
}
if (!env.GIPHY_API_KEY) {
  console.error("GIPHY_API_KEY missing from tools/store-shots/.env");
  process.exit(1);
}

const args = process.argv.slice(2);
const query = args.find((a) => !a.startsWith("--"));
if (!query) {
  console.error('usage: clips-find.mjs "<query>" [--count 6] [--cols 64]');
  process.exit(1);
}
const num = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? dflt : Number(args[i + 1]);
};
const count = num("count", 6);
const cols = num("cols", 64);

const candidatesDir = path.join(projectDir, "posts", "clips", "_candidates");
mkdirSync(candidatesDir, { recursive: true });

// Two catalogs behind one query, and STICKERS lead on purpose. The art
// bar is "one subject, big shapes, paper around them" — a sticker is
// already that: transparent background, so the subject arrives cut out
// and img2ascii flattens the alpha to white. The /gifs catalog is where
// the memes live: dark plates, full-bleed video, faces mid-motion, all
// of which convert to a solid wall of glyphs. Three writers in a row
// swept /gifs for food and came back with nothing usable (2026-08-03).
const SOURCES = { stickers: "stickers", gifs: "gifs" };
const which = args.includes("--gifs")
  ? ["gifs"]
  : args.includes("--stickers")
    ? ["stickers"]
    : ["stickers", "gifs"];

const search = async (kind, limit) => {
  const url =
    `https://api.giphy.com/v1/${SOURCES[kind]}/search?api_key=${env.GIPHY_API_KEY}` +
    `&q=${encodeURIComponent(query)}&limit=${limit}&rating=g&lang=en`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`giphy ${kind} ${res.status}: ${await res.text()}`);
    return [];
  }
  const { data } = await res.json();
  return (data ?? []).map((g) => ({ ...g, kind }));
};

const per = which.length > 1 ? Math.ceil(count / 2) : count;
const data = (await Promise.all(which.map((k) => search(k, per)))).flat();
if (!data.length) {
  console.log(`no results for "${query}"`);
  process.exit(0);
}

const slug = query.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 24);
for (const [i, gif] of data.entries()) {
  const src = gif.images?.original?.url;
  if (!src) continue;
  const file = path.join(
    candidatesDir,
    `${slug}-${gif.kind === "stickers" ? "st-" : ""}${gif.id}.gif`,
  );
  if (!existsSync(file)) {
    const dl = await fetch(src);
    writeFileSync(file, Buffer.from(await dl.arrayBuffer()));
  }

  // Middle frame → ASCII, the same judgment call as art:find.
  const tmp = mkdtempSync(path.join(os.tmpdir(), "clips-find-"));
  try {
    const frame = path.join(tmp, "mid.png");
    execFileSync("ffmpeg", [
      "-i", file,
      "-vf", "select=eq(n\\,0)+gte(t\\,0.5)",
      "-frames:v", "1",
      "-y", frame,
      "-loglevel", "error",
    ]);
    const ascii = await imageToAscii(frame, { cols, trim: true });
    console.log(`\n─── ${i + 1}/${data.length}  [${gif.kind}]  ${path.basename(file)}`);
    console.log(`    "${gif.title?.trim() || "untitled"}" — ${gif.url}`);
    // The provenance row, ready to paste — the same courtesy art-find
    // has always extended to stills. Its absence here is why nine clips
    // reached posts/clips/ with no register at all and had to be traced
    // back from byte hashes on 2026-08-04. Giphy publishes no per-asset
    // licence and exposes none through the API, so the licence column is
    // written as what it is: unread, not assumed.
    console.log(
      `    LICENSE  | <name>.gif | Giphy ${gif.kind === "stickers" ? "sticker" : "gif"} ` +
        `\`${gif.id}\` "${gif.title?.trim() || "untitled"}" — ` +
        `${gif.username || gif.user?.username || "uploader not exposed by the API"} — ` +
        `${gif.url} | unknown — unverified | <post> |`,
    );
    console.log(ascii);
  } catch {
    console.log(`\n─── ${i + 1}/${data.length}  ${path.basename(file)} (preview failed)`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}
console.log(
  `\nDONE  ${data.length} candidates → posts/clips/_candidates/\n` +
    `Promote one: mv posts/clips/_candidates/<file> posts/clips/<name>.gif\n` +
    `AND paste its LICENSE row into posts/clips/LICENSES.md — a clip with no\n` +
    `row in the register is an untraceable third-party asset in an ad.\n` +
    `Cheaper first: npm run clips:make "<a still in posts/art/>" animates a\n` +
    `specimen we already license, and the provenance is already written.\n` +
    `Then in a beat: { "type": "clip", "file": "<name>.gif", "cols": 72, … }`,
);
