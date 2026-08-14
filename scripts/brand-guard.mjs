#!/usr/bin/env node
// The branding guard — reads a candidate's METADATA for a brand, never its
// pixels. A silhouette score cannot see a logo, and by the time a human spots
// the print on a label the photo is already ranked #1.
//
//   node scripts/brand-guard.mjs                 audit every sweep on disk
//   node scripts/brand-guard.mjs --verbose       print every candidate's verdict
//
// ── WHY IT LOOKS FOR NAMES AND NOT ONLY MARKS ──────────────────────────────
// The first version read the photographer, the description and the page slug
// for domains, "mockup", "logo", "brand" and trademark symbols. It caught
// MOCKUPFREE.NET and the Unsplash uploader "Mockup Graphics". It let through
// "Libby's — Curry Lentil Soup", which scored 97 and ranked #1 of the lentils
// sweep on 2026-08-05: no domain, no marker, just a brand name in plain text.
// `posts/clips/LICENSES.md` writes down what promoting a brand's own material
// costs — a confusion-of-association reading a generic photo never invites —
// so the gap was worth closing.
//
// It is NOT a brand detector. That is not reachable, and a confident-but-wrong
// classifier is worse than none. It FAILS LOUDLY instead: three cheap rules,
// each of which prints what it saw and why, and none of which silently drops a
// candidate.
//
//   1. POSSESSIVE   `Libby's`, `Kellogg's`, `Nature's` — a possessive proper
//      noun in a product title is a company nine times in ten. The tenth is
//      ordinary English ("baker's yeast", "cow's milk", "chef's knife"), so an
//      allowlist of the ordinary ones runs first. Note that `baker's yeast` is
//      itself a wanted subject.
//   2. STRANGE NAME  a capitalised token that is not in an ordinary food or
//      photography vocabulary, standing next to a product word (`soup`, `tin`,
//      `bar`, `capsule`…). "Nutella jar" trips it; "Curry Lentil Soup" does
//      not, because every word is a food. Sentence-initial capitals are
//      ignored — they carry no signal — and the photographer's name is never
//      read by this rule, because a person's name is a proper noun by nature.
//   3. KNOWN NAME    an exact hit from `posts/art/brands.json`, a list a human
//      grows every time the guard misses one. That file is the only part of
//      this meant to change often.
//
// ── WHAT A HIT COSTS ───────────────────────────────────────────────────────
// A name hit is a `watch:` line on the shortlist, in front of the human who is
// already reading the grids — and on a subject the want list marks `unbranded`
// it blocks `--promote` (with `--force` as the override, because the guard is
// wrong sometimes). It never rejects a candidate before the shortlist the way
// a domain or a "mockup" does: a rule that guesses must not delete evidence.
//
// FALSE POSITIVES ARE THE ACCEPTED FAILURE. Flagging a few honest photos costs
// a human one glance. Promoting a competitor's product shot costs a rewrite of
// `posts/clips/LICENSES.md`.
//
// ── WHAT IT MEASURED, 2026-08-05 ───────────────────────────────────────────
// Over the 65 shortlisted candidates in `posts/art/_candidates/`
// (`node scripts/brand-guard.mjs`): 7 carry a name flag, and 6 of those are the
// Unsplash uploader "Mockup Graphics", which the marker rules already caught.
// So the name rules add exactly ONE flag the old guard missed — the Libby's
// soup — and zero false alarms on the honest 58.
//
// Over 21 honest titles (every quoted title in `posts/art/LICENSES.md` plus the
// hard cases the vocabulary has to survive: "Baker's yeast", "Cow's milk",
// "Chef's knife", "St John's wort", "Confectioner's sugar", "Greek yogurt",
// "Chocolate Bar Isolated On White Background", "Toronto Ontario - Canada -
// Cabbage Town"): 0 flagged.
//
// Over 12 written-out branded titles: 11 caught. The miss is "Bragg apple cider
// vinegar bottle" — a brand nobody listed, opening the title, with no product
// word beside it. That is the shape of what still gets through: an unlisted
// name in the first position, next to a food rather than a package. The answer
// to it is the list in `posts/art/brands.json`, which is why the list exists.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { projectDir } from "./project.mjs";

// The project is resolved from the working directory — see scripts/project.mjs.
const brandsFile = path.join(projectDir, "posts", "art", "brands.json");

/** The growable half of the guard. A missing file is not an error — the two
 *  shape rules still run, they just stop knowing anyone by name. */
const KNOWN = (() => {
  if (!existsSync(brandsFile)) return [];
  try {
    return (JSON.parse(readFileSync(brandsFile, "utf8")).brands ?? []).filter(Boolean);
  } catch {
    return [];
  }
})();

// ── the marker rules, unchanged: a mark on the file, not a name in it ──────
const HARD_BRAND = [
  [/\b[a-z0-9][a-z0-9-]*\.(com|net|org|io|co|shop|store|de|fr|uk)\b/i, "a domain in the source text"],
  [/\bmock[\s-]?ups?\b/i, "a mockup — the label usually carries the vendor's own mark"],
  [/\blogo(s|type)?\b/i, "a logo"],
  [/\bbrand(s|ed|ing)?\b/i, "a brand mention"],
  [/[®™©]/, "a trademark symbol"],
  [/\btrademark\b/i, "a trademark"],
];
const SOFT_BRAND = [
  [/\blabel(s|led|ing|ling)?\b/i, "a printed label"],
  [/\bpackag(e|es|ing|ed)\b/i, "packaging"],
  [/\bproduct shot\b/i, "a product shot"],
];

// ── rule 1: possessives that are ordinary English, not companies ───────────
const ORDINARY_POSSESSIVE = new Set(
  `baker bakers brewer brewers confectioner farmer farmers grower chef chefs cook cooks
   butcher butchers grocer fishmonger fisherman gardener shepherd hunter sailor artist
   photographer designer painter writer author editor doctor nurse child children kid kids
   woman women man men people person someone everyone family mother mum mom father dad
   grandmother grandma grandfather grandpa parent parents lady ladies gentleman king queen
   cow cows goat goats sheep ewe buffalo camel mare hen hens bird birds duck ducks cat cats
   dog dogs lamb calf pig pigs bee bees ox
   earth world god devil angel saint st john adam eve buddha
   valentine christmas easter halloween thanksgiving newyear year years month week day
   today tomorrow yesterday morning evening night summer winter spring autumn
   monday tuesday wednesday thursday friday saturday sunday
   alzheimer parkinson crohn hodgkin graves addison
   beginner traveller traveler visitor customer client reader viewer neighbour neighbor
   student teacher scientist researcher engineer worker seller buyer owner`
    .split(/\s+/)
    .filter(Boolean),
);

// ── rule 2: the vocabulary an honest stock title is written in ─────────────
// Not a dictionary. Everything a food or a specimen photograph is normally
// described with — if a capitalised word is NOT here and it stands next to a
// product word, a human should look. Add to it freely; every addition costs
// one missed flag and buys one fewer false alarm.
const VOCAB = new Set(
  `a an the and or of on in at with without for from to by over under near next into out
   is are was were be being been this that these those it its there here as but not no yes
   up down top bottom left right front back side above below inside outside around
   close closeup up-close detail detailed view viewed shot photo photograph photography
   picture image studio background backdrop surface table tabletop board plate bowl dish
   cup glass mug jar tin can bottle basket sack bag box crate spoon fork knife tray napkin
   cloth linen wood wooden marble slate stone ceramic porcelain metal steel copper paper
   white black grey gray green red blue yellow orange brown purple pink golden dark light
   pale bright vibrant vivid colorful colourful natural fresh freshly raw cooked boiled
   baked roasted grilled fried steamed dried dry wet ripe unripe organic healthy nutritious
   delicious tasty savory savoury sweet bitter sour salty spicy mild rustic minimal minimalist
   simple clean elegant classic modern traditional homemade artisan artisanal gourmet
   greek spanish italian french indian chinese japanese mexican thai turkish german english
   british american mediterranean asian korean vietnamese moroccan lebanese russian polish
   swiss danish dutch irish scottish brazilian australian canadian african european nordic
   scandinavian sicilian tuscan bavarian roman continental oriental western
   isolated arrangement composition concept concepts theme themes ideal perfect great
   beautiful vibrantly high resolution macro flatlay flat lay overhead angle angled
   whole half halved sliced slice slices chopped diced grated ground crushed peeled shelled
   unshelled cracked open opened closed sealed stacked scattered heap heaped pile piled
   handful bunch cluster group set assorted mixed mix single one two three four five six
   several many few small large big tiny huge medium fresh-cut cut piece pieces portion
   serving servings amount pinch scoop spoonful tablespoon teaspoon gram grams kilogram
   food foods meal meals breakfast lunch dinner snack cuisine kitchen cooking recipe recipes
   ingredient ingredients diet dietary nutrition nutritional protein proteins vitamin vitamins
   mineral minerals fiber fibre omega calcium iron zinc magnesium potassium selenium iodine
   fruit fruits vegetable vegetables veggie veggies greens herb herbs spice spices grain
   grains cereal seed seeds nut nuts legume legumes bean beans pulse pulses root roots leaf
   leaves stalk stalks stem floret florets crown head heads sprout sprouts pod pods kernel
   almond almonds walnut walnuts cashew cashews hazelnut hazelnuts pistachio pistachios
   peanut peanuts macadamia pecan chestnut chestnuts brazil coconut sunflower pumpkin sesame
   flax flaxseed chia quinoa oat oats bran rice pasta bread flour wheat barley rye corn maize
   lentil lentils chickpea chickpeas soy soya tofu tempeh pea peas broccoli cauliflower
   cabbage kale spinach chard watercress lettuce rocket arugula celery leek onion onions
   garlic shallot carrot carrots beet beetroot potato potatoes sweet turnip radish parsnip
   pepper peppers chili chilli tomato tomatoes cucumber courgette zucchini aubergine eggplant
   mushroom mushrooms asparagus artichoke avocado pumpkin squash brussels
   apple apples pear pears banana bananas orange oranges lemon lemons lime limes grapefruit
   berry berries strawberry strawberries blueberry blueberries blackberry blackberries
   raspberry raspberries cherry cherries grape grapes melon watermelon mango papaya guava
   kiwi pineapple peach plum apricot fig figs date dates raisin prune
   meat beef pork lamb veal chicken turkey duck goose liver kidney heart gizzard offal
   fillet filet steak breast thigh wing escalope mince mincemeat cutlet chop rib ribs
   fish salmon tuna mackerel sardine sardines anchovy cod haddock herring trout bass bream
   seafood shellfish shrimp prawn prawns crab lobster mussel mussels oyster oysters clam
   scallop scallops squid octopus seaweed kelp nori wakame algae
   egg eggs yolk yolks white whites shell shells
   milk cream butter cheese yogurt yoghurt skyr curd whey kefir dairy
   oil olive rapeseed sunflower-oil vinegar salt sugar honey syrup sauce broth stock soup
   stew curry salad sandwich toast pita pate paste spread jam
   chocolate cocoa cacao coffee tea water juice smoothie drink beverage
   supplement supplements capsule capsules softgel softgels tablet tablets pill pills gummy
   gummies powder granules sachet stick dose dosage daily
   flake flakes crumb crumbs chunk chunks stick sticks cube cubes ball balls
   laboratory lab test tube pipette flask beaker scale scales weight measuring
   hand hands holding held person people woman man kitchen wooden rustic
   health wellness fitness gym training workout muscle body`
    .split(/\s+/)
    .filter(Boolean),
);

/** Words that mean "this is a manufactured good", where a strange capitalised
 *  neighbour stops being a place name and starts being a company. */
const PRODUCT_WORDS = new Set(
  `soup cereal bar bars drink drinks beverage juice snack snacks tin tins can cans bottle
   bottles jar jars pack packs packet packets package packaging box boxes carton cartons
   sachet sachets pouch wrapper label capsule capsules softgel softgels tablet tablets pill
   pills gummy gummies powder supplement supplements formula blend mix shake sauce ketchup
   mayonnaise spread syrup yogurt yoghurt milk cheese butter chocolate biscuit biscuits
   cookie cookies cracker crackers chips crisps noodles pasta coffee tea soda cola beer wine
   brand product`
    .split(/\s+/)
    .filter(Boolean),
);

const norm = (w) =>
  w
    .toLowerCase()
    .replace(/['’]s$/, "")
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "");

const ordinary = (w) => {
  const n = norm(w);
  if (!n) return true;
  if (VOCAB.has(n)) return true;
  // A container noun is never the strange one: "Chocolate Bar" is a bar.
  if (PRODUCT_WORDS.has(n)) return true;
  if (n.endsWith("s") && VOCAB.has(n.slice(0, -1))) return true;
  if (n.endsWith("es") && VOCAB.has(n.slice(0, -2))) return true;
  if (ORDINARY_POSSESSIVE.has(n)) return true;
  // Hyphenated compounds are ordinary when both halves are: "Lentil-Shaped".
  if (n.includes("-")) return n.split("-").every((p) => !p || VOCAB.has(p) || /^\d+$/.test(p));
  return /^\d+$/.test(n);
};

/** Sentences, so a capital that only marks a beginning is not read as a name. */
const sentences = (title) =>
  String(title)
    .split(/(?<=[.!?;:])\s+|\s+[-–—]\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

const possessiveHits = (title) => {
  const out = [];
  for (const m of String(title).matchAll(/\b([A-Za-z][A-Za-z&.-]{1,})['’]s\b/g)) {
    const word = m[1];
    if (ORDINARY_POSSESSIVE.has(norm(word))) continue;
    if (VOCAB.has(norm(word))) continue;
    if (!/^[A-Z]/.test(word)) continue;
    out.push(`"${word}'s" reads as a company, not a food`);
  }
  return out;
};

const strangeNameHits = (title) => {
  const out = [];
  for (const s of sentences(title)) {
    const tokens = s.split(/[^A-Za-z0-9'’&.-]+/).filter(Boolean);
    for (const [i, tok] of tokens.entries()) {
      const capitalised = /^[A-Z][a-z]/.test(tok) || /^[A-Z]{3,}$/.test(tok);
      if (!capitalised || ordinary(tok)) continue;
      // A sentence-initial capital carries no signal on its own — but "Bragg
      // apple cider vinegar" and "Zephyrhills bottle" both open on the brand,
      // so position 0 still counts when a product word sits right next to it.
      const neighbours = [tokens[i - 1], tokens[i + 1]].filter(Boolean).map(norm);
      const product = neighbours.find((n) => PRODUCT_WORDS.has(n));
      if (product) out.push(`"${tok}" next to "${product}" — a name on a product`);
    }
  }
  return out;
};

const knownHits = (text) => {
  const out = [];
  for (const b of KNOWN) {
    const re = new RegExp(`(^|[^A-Za-z0-9])${b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^A-Za-z0-9]|$)`, "i");
    if (re.test(text)) out.push(`"${b}" — on the known-brand list`);
  }
  return out;
};

/**
 * Three buckets, and they are not the same weight.
 *   hard  — a mark on the file. Rejected before the shortlist on an
 *           `unbranded` subject; that behaviour predates this module.
 *   soft  — worth a glance, never blocks.
 *   names — this module's addition. Never rejects, always prints, blocks
 *           `--promote` on an `unbranded` subject.
 */
export function brandCheck(photo) {
  // The page URL contributes its SLUG, never its host — "unsplash.com" is not a
  // brand on the product, and reading it as one rejected an entire sweep once.
  const slugWords = String(photo.page ?? "")
    .replace(/^https?:\/\/[^/]+/, "")
    .replace(/[/_-]/g, " ");
  const text = `${photo.by ?? ""} ${photo.alt ?? ""} ${slugWords}`;
  // The title only, for the two shape rules: a photographer is a proper noun by
  // trade, and reading `by` for strange names flags every human being on earth.
  const title = String(photo.alt ?? "");

  const hard = HARD_BRAND.filter(([re]) => re.test(text)).map(([, why]) => why);
  const soft = SOFT_BRAND.filter(([re]) => re.test(text)).map(([, why]) => why);
  const names = [
    ...new Set([...possessiveHits(title), ...strangeNameHits(title), ...knownHits(text)]),
  ];
  return { hard, soft, names };
}

/** Everything a human should see about one candidate, or "" when it is clean. */
export const brandNote = (b) =>
  [...(b?.names ?? []), ...(b?.hard ?? []), ...(b?.soft ?? [])].join("; ");

/** Does this candidate fail an `unbranded` subject? Names count here. */
export const brandBlocks = (b) => Boolean(b?.hard?.length || b?.names?.length);

// ── CLI: audit every sweep already on disk ─────────────────────────────────
const isCli = import.meta.url === `file://${process.argv[1]}`;
if (isCli) {
  const verbose = process.argv.includes("--verbose");
  const dir = path.join(projectDir, "posts", "art", "_candidates");
  const { readdirSync } = await import("node:fs");
  const files = readdirSync(dir).filter((f) => f.endsWith(".batch.json"));
  let n = 0;
  let flagged = 0;
  let newFlags = 0;
  console.log(`BRAND GUARD  ${KNOWN.length} known names · ${files.length} sweeps on disk\n`);
  for (const f of files) {
    const j = JSON.parse(readFileSync(path.join(dir, f), "utf8"));
    const unbranded = j.subject?.unbranded ? " · unbranded subject" : "";
    for (const c of [...j.candidates, ...(j.rejected ?? [])]) {
      n += 1;
      const b = brandCheck(c);
      const note = brandNote(b);
      if (b.names.length) {
        flagged += 1;
        // The number that matters: names the OLD guard would have missed.
        const fresh = !b.hard.length;
        if (fresh) newFlags += 1;
        console.log(
          `${j.slug}${unbranded}  ${fresh ? "NAME ONLY" : "name+mark"}  ` +
            `${path.basename(c.file ?? c.id ?? "")}`,
        );
        console.log(`   ${c.by}`);
        console.log(`   ${c.alt ?? ""}`);
        console.log(`   → ${b.names.join("; ")}${b.hard.length ? ` | marks: ${b.hard.join("; ")}` : ""}\n`);
      } else if (verbose) {
        console.log(`${j.slug}  ok  ${c.alt ?? ""}${note ? `  (${note})` : ""}`);
      }
    }
  }
  console.log(
    `${flagged} of ${n} candidates carry a name flag (${((100 * flagged) / n).toFixed(0)} %), ` +
      `of which ${newFlags} the marker rules would have missed`,
  );
}
