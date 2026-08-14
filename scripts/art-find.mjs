#!/usr/bin/env node
// Source hunter for art slides. Searches Unsplash AND Pexels, downloads the
// top candidates into posts/art/_candidates/ (gitignored), and prints each
// one AS ASCII — the judgment happens on the converted result, never on the
// photo. Every candidate ships with its ready-to-paste LICENSES.md row;
// promoting one into posts/art/ is a deliberate, human move.
//
//   npm run art:find "cashew nuts white background"
//   npm run art:find "almonds" -- --count 8 --cols 48 --cutout
//
// Keys in tools/store-shots/.env (gitignored): UNSPLASH_ACCESS_KEY,
// PEXELS_API_KEY — a missing key just skips that catalog. The Unsplash
// download guideline is honored: download_location is triggered for every
// photo actually saved.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { projectDir } from "./project.mjs";
import { imageToAscii } from "./img2ascii.mjs";

// The project is resolved from the working directory — see scripts/project.mjs.
const candidatesDir = path.join(projectDir, "posts", "art", "_candidates");

const env = {};
const envFile = path.join(projectDir, ".env");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2];
  }
}
const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY || env.UNSPLASH_ACCESS_KEY;
const PEXELS_KEY = process.env.PEXELS_API_KEY || env.PEXELS_API_KEY;
if (!UNSPLASH_KEY && !PEXELS_KEY) {
  console.error("no API key — put UNSPLASH_ACCESS_KEY and/or PEXELS_API_KEY in tools/store-shots/.env");
  process.exit(1);
}

const args = process.argv.slice(2);
const num = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : Number(args[i + 1]);
};
const query = args.filter((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--")).join(" ");
if (!query) {
  console.error('usage: art-find.mjs "<query>" [--count 5] [--cols 56] [--cutout]');
  process.exit(1);
}
const count = num("count", 5);
const cols = num("cols", 56);
const cutout = args.includes("--cutout");

const unsplashApi = (url) =>
  fetch(url, { headers: { Authorization: `Client-ID ${UNSPLASH_KEY}`, "Accept-Version": "v1" } });

/** Both catalogs normalized to { id, source, by, page, alt, fetch(): url }. */
const findUnsplash = async () => {
  if (!UNSPLASH_KEY) return [];
  const res = await unsplashApi(
    `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}` +
      `&per_page=${count}&content_filter=high`,
  );
  if (!res.ok) {
    console.error(`unsplash search ${res.status}: ${await res.text()}`);
    return [];
  }
  const { results } = await res.json();
  return results.map((p) => ({
    id: p.id,
    source: "Unsplash",
    by: `${p.user.name} (@${p.user.username})`,
    page: p.links.html,
    alt: p.alt_description,
    // Per Unsplash API guidelines: register the download, then fetch that URL.
    fetch: async () => {
      const { url } = await (await unsplashApi(p.links.download_location)).json();
      return `${url}${url.includes("?") ? "&" : "?"}w=1200&fm=jpg&q=85`;
    },
  }));
};

const findPexels = async () => {
  if (!PEXELS_KEY) return [];
  const res = await fetch(
    `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${count}`,
    { headers: { Authorization: PEXELS_KEY } },
  );
  if (!res.ok) {
    console.error(`pexels search ${res.status}: ${await res.text()}`);
    return [];
  }
  const { photos } = await res.json();
  return photos.map((p) => ({
    id: String(p.id),
    source: "Pexels",
    by: p.photographer,
    page: p.url,
    alt: p.alt,
    fetch: async () => p.src.large2x ?? p.src.large ?? p.src.original,
  }));
};

mkdirSync(candidatesDir, { recursive: true });
const slug = query.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

const candidates = (await Promise.all([findUnsplash(), findPexels()])).flat();
console.log(`ART:FIND  "${query}" — ${candidates.length} candidates\n`);

for (const [i, photo] of candidates.entries()) {
  const img = await fetch(await photo.fetch());
  const file = path.join(candidatesDir, `${slug}-${i + 1}-${photo.id}.jpg`);
  writeFileSync(file, Buffer.from(await img.arrayBuffer()));

  const rel = path.relative(process.cwd(), file);
  console.log(`─────────────────────────────────────────────  ${i + 1}/${candidates.length}`);
  console.log(`FILE     ${rel}`);
  console.log(`BY       ${photo.by} — ${photo.page}`);
  console.log(`LICENSE  | <name>.jpg | ${photo.source} ${photo.id} — ${photo.by} | ${photo.source} License |`);
  if (photo.alt) console.log(`ALT      ${photo.alt}`);
  console.log();
  try {
    console.log(await imageToAscii(file, { cols, cutout }));
  } catch (e) {
    console.log(`(conversion failed: ${e.message})`);
  }
  console.log();
}
console.log("Promote a keeper: mv it into posts/art/<name>.jpg and paste its LICENSE row into posts/art/LICENSES.md");
