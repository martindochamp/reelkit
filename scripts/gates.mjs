#!/usr/bin/env node
// The comment gate is the only attribution the account has: a viewer types one
// word, a DM goes out, and the App Store link carries that post's campaign
// token. Two posts sharing a keyword means one of them cannot be answered —
// the router has no way to know which link was asked for.
//
//   npm run gates            every keyword, who owns it, and any collision
//   npm run gates BLEND      is this one free?
//
// Reserved keywords hide in three shapes across two file types — bare
// (`Comment lean for the link`), quoted (`Comment "PANEL" for the link`), and
// escaped inside a JSON string (`Comment \"PANEL\"`). The first version of this
// check only matched the bare shape and reported the bank clean while PANEL was
// double-booked, so match all three or do not bother running it.

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { postsDir } from "./project.mjs";


// A numeric gate is banned outright (SLIDES.md: never gate on the hero number
// — the viewer types the number they just read and every post collides), so
// they are reported apart rather than counted as ordinary keywords.
const isNumeric = (w) => /^\d+$/.test(w);

// A post that can never go out cannot collide with anything. Two kinds:
// an underscore file (excluded from the board's own scan) and one carrying
// brief.supersededBy. Counting them as live collisions is how a checker
// trains you to ignore it — which is how PANEL stayed double-booked while a
// first version of this script reported the bank clean.
const isDead = (post) => {
  if (post.startsWith("_")) return true;
  try {
    const spec = JSON.parse(
      readFileSync(path.join(postsDir, `${post}.json`), "utf8"),
    );
    return Boolean(spec.brief?.supersededBy) || Boolean(spec.brief?.DO_NOT_SHIP);
  } catch {
    return false;
  }
};

const scan = () => {
  const owners = new Map(); // KEYWORD -> Set(post)
  for (const file of readdirSync(postsDir)) {
    if (!/\.(json|caption\.txt)$/.test(file)) continue;
    if (file === "ledger.json") continue;
    const post = file.replace(/\.caption\.txt$|\.json$/, "");
    const text = readFileSync(path.join(postsDir, file), "utf8");
    for (const m of text.matchAll(/comment\s+\\?"?([a-z0-9]+)/gi)) {
      const word = m[1].toUpperCase();
      if (!owners.has(word)) owners.set(word, new Set());
      owners.get(word).add(post);
    }
  }
  return owners;
};

const live = (who) => [...who].filter((p) => !isDead(p));

const owners = scan();
const query = process.argv[2]?.toUpperCase();

if (query) {
  const who = owners.get(query);
  const alive = who ? live(who) : [];
  if (!who) console.log(`\n${query} — free.\n`);
  else if (!alive.length) {
    console.log(`\n${query} — free. (only ${[...who].join(", ")}, which cannot ship)\n`);
  } else console.log(`\n${query} — taken by ${alive.join(", ")}.\n`);
  process.exit(alive.length ? 1 : 0);
}

const collisions = [...owners].filter(([, who]) => live(who).length > 1);
const numeric = [...owners].filter(([w]) => isNumeric(w));
const clean = [...owners]
  .filter(([w, who]) => who.size === 1 && !isNumeric(w))
  .map(([w]) => w)
  .sort();

console.log();
if (collisions.length) {
  for (const [word, who] of collisions) {
    console.log(`COLLISION  ${word} — ${live(who).join(", ")}`);
  }
  console.log(`\n${collisions.length} keyword(s) answer for two posts. One of them cannot route.\n`);
} else {
  console.log(`No collisions.\n`);
}
if (numeric.length) {
  console.log(`Numeric gates (banned — the viewer types the hero number):`);
  console.log(`  ${numeric.map(([w, who]) => `${w} (${[...who].join(", ")})`).join("  ")}\n`);
}
console.log(`Reserved (${clean.length}):`);
console.log(`  ${clean.join("  ")}\n`);
