#!/usr/bin/env node
// Batch source hunter — many subjects a run, swept, converted, scored and
// shortlisted. `art-find.mjs` is the single-query version and the idiom this
// follows; this one walks `posts/art/wanted.json` in rank order so a sourcing
// session serves the posts that are actually coming.
//
//   npm run art:batch                       the P0 tier, in rank order
//   npm run art:batch -- --priority P1 --top 4
//   npm run art:batch -- brazil-nut lentils --count 6 --resume
//   npm run art:batch -- egg --query "brown egg studio" --keep 12
//   npm run art:batch -- --promote egg --pick 3
//
// Flags: --count <n> per query per catalog · --queries <n> from the want list
// · --query "<terms>" extra search terms, repeatable, one subject at a time ·
// --keep <n> how many survivors get a cutout and the real ranking · --top <n>
// · --priority P0|P1|P2|all · --resume skip subjects already swept · --print
// <n> dump the top n grids to the terminal · --tile <n> the second, narrow
// grid (34; 0 turns it off) · --include-skip · --no-openverse · --force
// overwrite existing art or promote a flagged candidate anyway.
//
// ── WHY IT CUTS OUT BEFORE IT RANKS ────────────────────────────────────────
// `ascii-score.mjs` measured it: of the 10 past sweeps that produced a
// promotion, the human's pick ranks #1 in 8 when the candidates are scored on
// the CUTOUT grid, and only 4 in 10 on the raw grid. So the ranking that
// matters is the cutout one. It is also the expensive one — every cutout is a
// rembg round trip — so this runs in two stages:
//
//   1. RAW, free and local: convert every candidate at 72 columns and score it.
//      Good enough to throw away the walls of noise.
//   2. CUTOUT, on the survivors only: `--keep` candidates get a real cutout,
//      are rescored on that grid, and THAT is the order printed.
//
// The score is a shortlist filter, not a judge (pooled AUC 0.73 — read the
// header of ascii-score.mjs). The last call is a human reading the grids, which
// is why every shortlist is written out as ASCII to
// `posts/art/_candidates/<slug>.shortlist.txt`.
//
// ── THE COLUMN TEST — READ THE NARROW GRID FIRST ───────────────────────────
// Every shortlist prints each candidate TWICE: at 72 columns, which is what a
// slide ships, and at 34, which is roughly what a cover tile draws. Side by
// side, because the comparison is the whole point.
//
// Checking a shortlist at ~34 columns separates a specimen from a texture
// faster than any measure in the score. A full-bleed heap on white passes
// `subject`, `clean` and `paper` — it is one connected blob with paper around
// it — so it ranks high while being exactly the "no crop saves a full-bleed
// texture" failure the house rules forbid. At 72 a dense broccoli crown and a
// broccoli with a stalk look comparable; at 34 the crown is a solid dark mass
// with no readable form and the stalk still reads as a broccoli.
//
// And no, the fix is not another number. Scoring the SAME cutouts at 34
// columns was measured against the same labelled set the score was built on
// (36 promoted stills vs 294 dropped candidates): AUC 0.610 at 34 columns
// against 0.646 at 72. The narrow score is no better a filter — the narrow
// GRID is what a human reads in a second. So the tile score prints as
// information and never re-ranks anything; the ranking stays the cutout score
// at 72. A `TILE` marker appears when the tile score falls 15+ points below the
// slide score or lands under 50 — the bottom decile of both classes, a nudge to
// look, not a verdict. It fires on 7 of the 36 stills already promoted.
//
// ── THE TWO GUARDS ─────────────────────────────────────────────────────────
// Both are written down in `posts/clips/LICENSES.md` as failures already paid
// for, so neither is optional here.
//
//   LICENCE. `--promote` writes the row into `posts/art/LICENSES.md` itself, in
//   the format that file already uses. The clip register exists because a
//   promotion step did not write one; nothing gets promoted here without it.
//
//   BRANDING. A silhouette score cannot see a logo. The candidate whose ASCII
//   looked perfect carried "MOCKUPFREE.NET" printed on the label, and the
//   LuckyVitamin dumbbell is the same trap one layer up. So the source
//   description, the photographer name and the page URL are read for brand
//   marks, and for a subject the want list flags `unbranded: true` a hit is
//   disqualifying — rejected before the shortlist, with the reason printed.
//   Marks are not the only way a brand arrives: "Libby's — Curry Lentil Soup"
//   scored 97 and ranked #1 of the lentils sweep with no domain and no marker,
//   just a name in plain text. `scripts/brand-guard.mjs` adds three name rules
//   for that, and they FAIL LOUDLY rather than perfectly — a name hit prints on
//   the shortlist and blocks `--promote` on an `unbranded` subject, but never
//   deletes a candidate before a human has seen it.
//
// ── UNSPLASH DOWNLOADS ─────────────────────────────────────────────────────
// `art-find.mjs` triggers `download_location` for every candidate it saves. A
// batch sweep saves hundreds, which would burn the hourly quota on photos
// nobody keeps — and the guideline is about the moment a photo is CHOSEN. So
// the sweep browses (`urls.regular`) and `--promote` triggers the download
// endpoint for the one photo that ships. One API call per keeper, not per look.
//
// ── THREE CATALOGS ─────────────────────────────────────────────────────────
// Unsplash and Pexels, like `art-find.mjs`, plus Openverse filtered to
// `license=cc0,pdm` — which is where the oldest rows in posts/art/LICENSES.md
// came from and the only one of the three that indexes specimen photography
// rather than lifestyle stock. Keys for the first two live in
// tools/store-shots/.env (gitignored): UNSPLASH_ACCESS_KEY, PEXELS_API_KEY — a
// missing key just skips that catalog. Openverse needs none. `--no-openverse`
// turns it off.

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { projectDir } from "./project.mjs";
import { cutoutFile, imageToAscii } from "./img2ascii.mjs";
import { SCORE_COLS, asciiFeatures, explain, scoreFeatures } from "./ascii-score.mjs";
import { brandBlocks, brandCheck } from "./brand-guard.mjs";

// The project is resolved from the working directory — see scripts/project.mjs.
const artDir = path.join(projectDir, "posts", "art");
const candidatesDir = path.join(artDir, "_candidates");
const wantedFile = path.join(artDir, "wanted.json");
const licenseFile = path.join(artDir, "LICENSES.md");

const env = {};
const envFile = path.join(projectDir, ".env");
if (existsSync(envFile))
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2];
  }
const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY || env.UNSPLASH_ACCESS_KEY;
const PEXELS_KEY = process.env.PEXELS_API_KEY || env.PEXELS_API_KEY;

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const str = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const num = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : Number(args[i + 1]);
};
/** Bare words: subject slugs, never a flag or a flag's value. */
const bare = args.filter((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));
/**
 * Extra search terms for this run, repeatable: --query "raw chicken liver".
 * A sweep that comes back with the wrong food — a live chicken for "chicken
 * liver" — is a query problem, not a scoring problem, and the want list's terms
 * are a first guess, not a contract.
 */
const extraQueries = args.flatMap((a, i) => (a === "--query" ? [args[i + 1]] : []));

const wanted = JSON.parse(readFileSync(wantedFile, "utf8")).wanted;
const bySlug = new Map(wanted.map((w) => [w.slug, w]));

// The branding guard lives in `scripts/brand-guard.mjs` — marks (domains,
// "mockup", trademark symbols) and names (possessives, strange names beside a
// product word, the growable list in `posts/art/brands.json`). Read its header
// before loosening anything here.

// ── the column test ─────────────────────────────────────────────────────────
/** What a cover tile draws. `--tile 0` turns the second grid off. */
const TILE_COLS = num("tile", 34);
/** A tile this far under the slide score, or this low outright, wants an eye. */
const TILE_DROP = 15;
const TILE_FLOOR = 50;
const tileFlag = (c) =>
  c.tile == null || c.cut == null
    ? false
    : c.cut - c.tile >= TILE_DROP || c.tile < TILE_FLOOR;

/** Two grids, one eye movement. Left is the slide, right is the cover tile. */
const sideBySide = (left, right, leftHead, rightHead, gap = 4) => {
  const L = (left ?? "").split("\n");
  const R = (right ?? "").split("\n");
  const width = Math.max(leftHead.length, ...L.map((l) => l.length));
  const pad = " ".repeat(gap);
  const out = [`${leftHead.padEnd(width)}${pad}${rightHead}`];
  for (let i = 0; i < Math.max(L.length, R.length); i += 1)
    out.push(`${(L[i] ?? "").padEnd(width)}${pad}${R[i] ?? ""}`.trimEnd() || " ");
  return out.join("\n");
};

// ── catalogs ────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** The network drops; a sweep must not. Three tries, then give up on that call. */
const grab = async (url, opts, tries = 3) => {
  let last;
  for (let i = 0; i < tries; i += 1) {
    try {
      const res = await fetch(url, opts);
      if (res.status === 429 || res.status >= 500) throw new Error(`http ${res.status}`);
      return res;
    } catch (e) {
      last = e;
      await sleep(600 * (i + 1));
    }
  }
  throw last;
};

const unsplashApi = (url) =>
  grab(url, { headers: { Authorization: `Client-ID ${UNSPLASH_KEY}`, "Accept-Version": "v1" } });

const findUnsplash = async (query, count) => {
  if (!UNSPLASH_KEY) return [];
  const res = await unsplashApi(
    `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}` +
      `&per_page=${count}&content_filter=high`,
  );
  if (!res.ok) {
    console.error(`  unsplash "${query}" ${res.status}`);
    return [];
  }
  const { results } = await res.json();
  return results.map((p) => ({
    id: p.id,
    source: "Unsplash",
    by: `${p.user.name} (@${p.user.username})`,
    page: p.links.html,
    alt: p.alt_description,
    // Browse only — the download endpoint fires on promotion, see the header.
    url: `${p.urls.raw}${p.urls.raw.includes("?") ? "&" : "?"}w=1200&fm=jpg&q=85`,
    downloadLocation: p.links.download_location,
  }));
};

const findPexels = async (query, count) => {
  if (!PEXELS_KEY) return [];
  const res = await grab(
    `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${count}`,
    { headers: { Authorization: PEXELS_KEY } },
  );
  if (!res.ok) {
    console.error(`  pexels "${query}" ${res.status}`);
    return [];
  }
  const { photos } = await res.json();
  return photos.map((p) => ({
    id: String(p.id),
    source: "Pexels",
    by: p.photographer,
    page: p.url,
    alt: p.alt,
    url: p.src.large2x ?? p.src.large ?? p.src.original,
  }));
};

// Openverse, filtered to CC0 and public-domain marks — the catalog the oldest
// rows in posts/art/LICENSES.md came from, and the only one of the three that
// indexes museum and rawpixel-style specimen photography. No key, no account.
// It earns its place on the hard subjects: Unsplash and Pexels between them
// hold no isolated Brazil nut, and a stock search for one returns market
// stalls and squirrels.
const findOpenverse = async (query, count) => {
  const res = await grab(
    `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}` +
      `&license=cc0,pdm&page_size=${count}&mature=false`,
    { headers: { "User-Agent": "reelkit/0.1 (personal use)" } },
  );
  if (!res.ok) {
    console.error(`  openverse "${query}" ${res.status}`);
    return [];
  }
  const { results = [] } = await res.json();
  return results.map((p) => {
    // Wikimedia lands on /w/index.php?curid=8494945 — the curid IS the id, and
    // taking the last path segment instead makes a filename with a query
    // string in it. Flickr and rawpixel do put the id in the path.
    const foreign = String(p.foreign_landing_url ?? "").replace(/\/$/, "");
    const id =
      foreign.match(/curid=(\d+)/)?.[1] ||
      foreign.replace(/[?#].*$/, "").split("/").pop() ||
      p.id;
    const provider = p.source ?? p.provider ?? "Openverse";
    return {
      id,
      source: "Openverse",
      by: `${p.creator ?? "unknown"} — ${provider}`,
      page: p.foreign_landing_url ?? "",
      alt: p.title,
      // Originals on Wikimedia run to tens of megabytes; the grid is 72 glyphs
      // wide, so a big source buys nothing and costs the whole sweep's time.
      url: (p.width ?? 0) > 2600 ? (p.thumbnail ?? p.url) : p.url,
      rowBody: `${provider} ${id} "${p.title ?? ""}" — ${p.creator ?? "unknown"}`,
      rowLicense: String(p.license ?? "").toUpperCase(),
    };
  });
};

/** Each catalog words its own row; the file's existing rows are the format. */
const licenseRow = (slug, photo) =>
  `| ${slug}.jpg | ${photo.rowBody ?? `${photo.source} ${photo.id} — ${photo.by}`} | ` +
  `${photo.rowLicense ?? `${photo.source} License`} |`;

const manifestFile = (slug) => path.join(candidatesDir, `${slug}.batch.json`);
const reportFile = (slug) => path.join(candidatesDir, `${slug}.shortlist.txt`);

// ── promote ────────────────────────────────────────────────────────────────
// The only step that writes into posts/art/, and the only one that writes a
// licence row. It refuses to overwrite, and refuses a branded candidate for a
// subject the want list marked unbranded.
async function promote() {
  const slug = str("promote");
  const pick = str("pick", "1");
  const manifest = manifestFile(slug);
  if (!existsSync(manifest)) {
    console.error(`no sweep on disk for "${slug}" — run the sweep first`);
    process.exit(1);
  }
  const { subject, candidates } = JSON.parse(readFileSync(manifest, "utf8"));
  const chosen = /^\d+$/.test(pick)
    ? candidates[Number(pick) - 1]
    : candidates.find((c) => path.basename(c.file).includes(pick));
  if (!chosen) {
    console.error(`no candidate "${pick}" in ${path.relative(projectDir, manifest)}`);
    process.exit(1);
  }
  const dest = path.join(artDir, `${slug}.jpg`);
  if (existsSync(dest) && !flag("force")) {
    console.error(`COLLISION  ${path.relative(projectDir, dest)} already exists — not overwritten`);
    process.exit(1);
  }
  // Re-read the guard here rather than trusting the manifest: a sweep taken
  // before a rule existed — or before a name reached posts/art/brands.json —
  // still gets checked at the only step that writes into posts/art/.
  chosen.brand = { ...(chosen.brand ?? {}), ...brandCheck(chosen) };
  // A name hit blocks here even though it never blocked the shortlist: the
  // guess is allowed to cost a human one look, never a promotion. `--force`
  // is the override, and it exists because the guard is wrong sometimes.
  if (subject?.unbranded && brandBlocks(chosen.brand) && !flag("force")) {
    const why = [...(chosen.brand.names ?? []), ...(chosen.brand.hard ?? [])].join("; ");
    console.error(`BRANDED    ${why} — "${slug}" is flagged unbranded`);
    console.error(`           re-run with --force if the photo itself carries no mark`);
    process.exit(1);
  }
  // Everywhere else a name is not disqualifying, but it is never silent.
  if (chosen.brand?.names?.length)
    console.log(`BRAND?     ${chosen.brand.names.join("; ")} — check the photo before it ships`);

  // Unsplash guideline: the download endpoint fires when a photo is chosen.
  if (chosen.downloadLocation) {
    try {
      const res = await unsplashApi(chosen.downloadLocation);
      const { url } = await res.json();
      if (url) {
        const img = await grab(`${url}${url.includes("?") ? "&" : "?"}w=1600&fm=jpg&q=90`);
        writeFileSync(dest, Buffer.from(await img.arrayBuffer()));
      }
    } catch (e) {
      console.error(`  download endpoint failed (${e.message}) — copying the swept file`);
    }
  }
  if (!existsSync(dest)) copyFileSync(chosen.file, dest);

  // The cutout is a regenerable derivative, but it is already paid for.
  const cachedCut = chosen.file.replace(/\.[^.]+$/, "") + ".cutout.png";
  if (existsSync(cachedCut) && !existsSync(dest.replace(/\.jpg$/, ".cutout.png")))
    copyFileSync(cachedCut, dest.replace(/\.jpg$/, ".cutout.png"));

  const row = licenseRow(slug, chosen);
  const lines = readFileSync(licenseFile, "utf8").split("\n");
  if (lines.some((l) => l.startsWith(`| ${slug}.jpg |`))) {
    console.log(`licence row for ${slug}.jpg already present — left alone`);
  } else {
    let last = -1;
    for (const [i, l] of lines.entries()) if (/^\|.*\|\s*$/.test(l)) last = i;
    lines.splice(last + 1, 0, row);
    writeFileSync(licenseFile, lines.join("\n"));
  }
  console.log(`PROMOTED   ${path.relative(projectDir, dest)}`);
  console.log(`LICENCE    ${row}`);
  if (chosen.brand?.soft?.length) console.log(`NOTE       ${chosen.brand.soft.join("; ")}`);
}

// ── sweep ───────────────────────────────────────────────────────────────────
async function sweepSubject(subject, opts) {
  const { slug } = subject;
  const dest = path.join(artDir, `${slug}.jpg`);
  if (existsSync(dest) && !opts.force) return { slug, skipped: `COLLISION — ${slug}.jpg exists` };
  if (subject.converts === "skip" && !opts.includeSkip)
    return { slug, skipped: `converts: skip — ${subject.convertNote ?? ""}` };
  if (opts.resume && existsSync(reportFile(slug)))
    return { slug, skipped: "already swept (--resume)" };

  // `hard` subjects get more looks: the want list says most candidates fail.
  const hard = subject.converts === "hard";
  const perQuery = opts.count + (hard ? 3 : 0);
  const queries = [
    ...extraQueries,
    ...subject.queries.slice(0, hard ? opts.queries + 1 : opts.queries),
  ];

  console.log(`\n══ ${slug}  [${subject.priority} · rank ${subject.rank} · converts ${subject.converts}]`);
  console.log(`   ${subject.subject}`);
  if (subject.convertNote) console.log(`   note: ${subject.convertNote}`);

  const seen = new Set();
  const photos = [];
  for (const query of queries) {
    const found = (
      await Promise.all([
        findUnsplash(query, perQuery),
        findPexels(query, perQuery),
        opts.noOpenverse ? [] : findOpenverse(query, perQuery),
      ])
    ).flat();
    for (const p of found) {
      const key = `${p.source}:${p.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      photos.push({ ...p, query });
    }
  }
  console.log(`   swept ${queries.length} queries → ${photos.length} distinct candidates`);

  mkdirSync(candidatesDir, { recursive: true });
  const rejected = [];
  const scored = [];
  for (const [i, photo] of photos.entries()) {
    const brand = brandCheck(photo);
    if (subject.unbranded && brand.hard.length) {
      rejected.push({ photo, why: brand.hard.join("; ") });
      continue;
    }
    const safeId = String(photo.id).replace(/[^A-Za-z0-9._-]+/g, "-").slice(0, 40);
    const file = path.join(candidatesDir, `${slug}-${i + 1}-${safeId}.jpg`);
    try {
      if (!existsSync(file)) {
        const img = await grab(photo.url);
        // An open catalog serves a few dead or non-raster URLs. A saved HTML
        // error page would sit in the cache forever and fail every rerun.
        const type = img.headers.get("content-type") ?? "";
        if (!type.startsWith("image/") || /svg/.test(type))
          throw new Error(`not a raster image (${type || "no content-type"})`);
        writeFileSync(file, Buffer.from(await img.arrayBuffer()));
      }
      // Stage 1 — raw, free, local. Only a coarse filter.
      const text = await imageToAscii(file, { cols: SCORE_COLS });
      const features = await asciiFeatures(text);
      const { score } = scoreFeatures(features);
      scored.push({ ...photo, file, brand, raw: score });
    } catch (e) {
      // Never leave a file that cannot be converted in the cache.
      if (existsSync(file)) rmSync(file, { force: true });
      console.error(`   ${path.basename(file)}: ${e.message}`);
    }
  }
  scored.sort((a, b) => b.raw - a.raw);

  // Stage 2 — cutout the survivors and rank on THAT grid. 8/10 vs 4/10.
  // Then the column test: the same cutout at tile width, free, no network.
  const shortlist = scored.slice(0, opts.keep);
  for (const c of shortlist) {
    let grid = c.file;
    try {
      grid = await cutoutFile(c.file);
      const text = await imageToAscii(grid, { cols: SCORE_COLS });
      const features = await asciiFeatures(text);
      const { score, parts } = scoreFeatures(features);
      c.cut = score;
      c.text = text;
      c.why = explain(features, parts);
    } catch (e) {
      c.cut = null;
      c.why = `cutout failed: ${e.message}`;
      c.text = await imageToAscii(c.file, { cols: SCORE_COLS }).catch(() => "");
      grid = c.file;
    }
    if (TILE_COLS > 0)
      try {
        c.tileText = await imageToAscii(grid, { cols: TILE_COLS });
        const tf = await asciiFeatures(c.tileText);
        const { score, parts } = scoreFeatures(tf);
        c.tile = score;
        c.tileWhy = explain(tf, parts);
      } catch {
        c.tile = null;
      }
  }
  shortlist.sort((a, b) => (b.cut ?? -1) - (a.cut ?? -1));

  const report = [
    `SHORTLIST  ${slug} — ${subject.subject}`,
    `${subject.priority} · rank ${subject.rank} · converts ${subject.converts}${
      subject.unbranded ? " · unbranded only" : ""
    }`,
    subject.convertNote ? `note: ${subject.convertNote}` : "",
    `serves: ${subject.serves.join(" · ")}`,
    `swept ${photos.length} candidates, ${rejected.length} rejected on branding, ` +
      `top ${shortlist.length} cut out and ranked on the cutout grid`,
    TILE_COLS > 0
      ? `Read the RIGHT grid first: ${TILE_COLS} columns is what a cover tile draws, and a ` +
        `full-bleed texture that passes at ${SCORE_COLS} collapses there.`
      : "",
    "",
  ];
  for (const [i, c] of shortlist.entries()) {
    // Names print on their own line above; `watch:` keeps the marker findings.
    const marks = [...c.brand.hard, ...c.brand.soft].join("; ");
    report.push(
      "─".repeat(76),
      `#${i + 1}  cutout ${c.cut ?? "—"}  tile ${c.tile ?? "—"}` +
        `${tileFlag(c) ? "  TILE COLLAPSE" : ""}  raw ${c.raw}  ${path.basename(c.file)}`,
      `    ${SCORE_COLS}c: ${c.why}`,
      TILE_COLS > 0 && c.tileWhy ? `    ${TILE_COLS}c: ${c.tileWhy}` : "",
      // A name hit is loud on purpose: it is a guess, and the human reading
      // this line is the one who can settle it against the photo.
      c.brand.names?.length ? `    BRAND?  ${c.brand.names.join("; ")}` : "",
      `    ${c.by} — ${c.page}`,
      c.alt ? `    alt: ${c.alt}` : "",
      // On an `unbranded` subject a hard hit never reaches this list — it was
      // rejected. Everywhere else it is still worth a human's eye, so it prints.
      marks ? `    watch: ${marks}` : "",
      `    LICENSE ${licenseRow(slug, c)}`,
      "",
      TILE_COLS > 0
        ? sideBySide(
            c.text,
            c.tileText,
            `${SCORE_COLS} COLUMNS — the slide`,
            `${TILE_COLS} COLUMNS — the cover tile`,
          )
        : (c.text ?? ""),
      "",
    );
  }
  if (rejected.length) {
    report.push("─".repeat(76), "REJECTED ON BRANDING");
    for (const r of rejected) report.push(`  ${r.photo.source} ${r.photo.id} — ${r.why}`);
  }
  writeFileSync(reportFile(slug), report.filter((l) => l !== "").join("\n") + "\n");
  writeFileSync(
    manifestFile(slug),
    JSON.stringify(
      {
        slug,
        swept: new Date().toISOString(),
        subject,
        candidates: shortlist.map((c) => ({
          file: c.file,
          source: c.source,
          id: c.id,
          by: c.by,
          page: c.page,
          alt: c.alt,
          query: c.query,
          brand: c.brand,
          raw: c.raw,
          cut: c.cut,
          tile: c.tile,
          tileCols: TILE_COLS,
          downloadLocation: c.downloadLocation,
          license: licenseRow(slug, c),
        })),
        rejected: rejected.map((r) => ({ id: r.photo.id, source: r.photo.source, why: r.why })),
      },
      null,
      2,
    ),
  );

  console.log(`   cut  ${String(TILE_COLS).padStart(2)}c  raw  candidate`);
  for (const c of shortlist)
    console.log(
      `   ${String(c.cut ?? "—").padStart(3)}  ${String(c.tile ?? "—").padStart(3)}` +
        `${tileFlag(c) ? "!" : " "} ${String(c.raw).padStart(3)}  ` +
        `${path.basename(c.file)}  — ${c.why}` +
        `${c.brand.names?.length ? `  [BRAND? ${c.brand.names.join("; ")}]` : ""}`,
    );
  if (shortlist.some(tileFlag))
    console.log(`   ! = the tile grid collapses — look at the ${TILE_COLS}-column pass, not the score`);
  if (rejected.length)
    console.log(`   rejected on branding: ${rejected.map((r) => r.photo.id).join(", ")}`);
  console.log(`   → ${path.relative(projectDir, reportFile(slug))}`);
  if (opts.print)
    for (const c of shortlist.slice(0, opts.print))
      console.log(
        `\n${
          TILE_COLS > 0
            ? sideBySide(
                c.text,
                c.tileText,
                `${SCORE_COLS} COLUMNS — the slide`,
                `${TILE_COLS} COLUMNS — the cover tile`,
              )
            : c.text
        }`,
      );
  return { slug, shortlist };
}

async function sweep() {
  if (!UNSPLASH_KEY && !PEXELS_KEY && flag("no-openverse")) {
    console.error("no catalog left — Openverse is off and neither key is in .env");
    process.exit(1);
  }
  const opts = {
    count: num("count", 5),
    queries: num("queries", 2),
    // 8, not 5, and measured: on the chicken-liver sweep the two best cutout
    // grids (95, 95) sat at raw rank 9 and 12 — a keep of 5 threw them away
    // before they were ever cut out. Raw punishes a dark subject as "a wall",
    // which is precisely the subject a cutout rescues. Raise it further on a
    // dark or pale subject; every extra keep is one rembg call.
    keep: num("keep", 8),
    print: num("print", 0),
    force: flag("force"),
    resume: flag("resume"),
    includeSkip: flag("include-skip"),
    noOpenverse: flag("no-openverse"),
  };
  let subjects;
  if (bare.length) {
    subjects = bare.map(
      (s) =>
        bySlug.get(s) ?? {
          slug: s,
          subject: s.replace(/-/g, " "),
          queries: [s.replace(/-/g, " ")],
          serves: ["ad hoc — not in the want list"],
          priority: "—",
          rank: 0,
          converts: "unknown",
          unbranded: false,
        },
    );
  } else {
    const priority = str("priority", "P0");
    subjects = wanted
      .filter((w) => priority === "all" || w.priority === priority)
      .sort((a, b) => a.rank - b.rank)
      .slice(0, num("top", 99));
  }

  console.log(
    `ART:BATCH  ${subjects.length} subjects · ${opts.count}/query · ` +
      `${opts.queries} queries · keep ${opts.keep} · cutout-ranked`,
  );
  const collisions = [];
  for (const subject of subjects) {
    try {
      const r = await sweepSubject(subject, opts);
      if (r.skipped) {
        console.log(`\n══ ${r.slug}  SKIPPED — ${r.skipped}`);
        if (r.skipped.startsWith("COLLISION")) collisions.push(r.slug);
      }
    } catch (e) {
      console.error(`\n══ ${subject.slug}  FAILED — ${e.message}`);
    }
  }
  if (collisions.length)
    console.log(`\nCOLLISIONS  already in posts/art/, not touched: ${collisions.join(", ")}`);
  console.log(
    "\nRead the shortlists, pick with your eye, then:\n" +
      "  reelkit art:batch --promote <slug> --pick <n>",
  );
}

if (flag("promote")) await promote();
else await sweep();
