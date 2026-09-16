#!/usr/bin/env node
// The only automated test in this repo, and it exists for one reason: the
// preset resolver decides what a spec MEANS before any gate reads it or any
// line is billed to RunPod, and the repo's standing regression gate is a
// full .parity render — too expensive to run against every edge of a merge
// rule.
//
//   node scripts/presets.test.mjs
//
// The first assertion is the one that matters most: a reel with no `preset`
// key anywhere must come back deep-equal to what went in. That is the
// promise that lets this run unconditionally on every post ever written.
//
// Writing these found a real defect: resolvePresets() built its own bank
// from disk and could not be tested without a filesystem, so it now takes
// one. A module that cannot be tested without mounting the world is a module
// that will not be tested.

import { applyPreset, resolvePresets } from "./presets.mjs";
import { motionAt, motionEnd, motionStyle, originPx } from "../src/lab/motion.mjs";
import { edgesOf, layOut, layShots, layoutOfBeat, layoutOfReel, msToFrames, offsetFrames, parseAnchor } from "../src/lab/timeline.mjs";

let pass = 0, fail = 0;
const ok = (label, cond, got) => {
  if (cond) { pass++; console.log(`  ok    ${label}`); }
  else { fail++; console.log(`  FAIL  ${label}${got !== undefined ? ` → ${JSON.stringify(got)}` : ""}`); }
};
const throws = (label, fn, re) => {
  try { fn(); fail++; console.log(`  FAIL  ${label} (did not throw)`); }
  catch (e) {
    if (re.test(e.message)) { pass++; console.log(`  ok    ${label}`); }
    else { fail++; console.log(`  FAIL  ${label} → ${e.message.slice(0,90)}`); }
  }
};

const bank = {
  base:   { chrome: { border: { width: 8, radius: 0, color: "#252525" } }, _origin: "core" },
  loud:   { extends: "base", chrome: { border: { width: 16 } }, _origin: "core" },
  push:   { view: { from: { zoom: 1 }, to: { zoom: 1.3 } }, _origin: "core" },
  speaks: { say: "no", _origin: "core" },
  selfy:  { extends: "selfy", _origin: "core" },
};

console.log("identity — a node with no preset is returned untouched");
const plain = { screen: { type: "title" }, say: "hello" };
ok("same object back", applyPreset(plain, bank, "t") === plain);
const reel = { beats: [{ say: "a" }, { say: "b", shots: [{ screen: {} }] }] };
ok("reel with no presets deep-equals itself",
   JSON.stringify(resolvePresets(structuredClone(reel), "t", bank)) === JSON.stringify(reel));

console.log("merge — the node's own keys win, the preset is a floor");
const r1 = applyPreset({ preset: "base", chrome: { border: { width: 99 } } }, bank, "t");
ok("node width beats preset width", r1.chrome.border.width === 99, r1.chrome.border);
ok("preset keys the node did not set survive", r1.chrome.border.color === "#252525");
ok("the preset key itself is consumed", r1.preset === undefined);
ok("_origin never leaks into the spec", r1._origin === undefined);

console.log("extends — a base adapted by style");
const r2 = applyPreset({ preset: "loud" }, bank, "t");
ok("child overrides parent", r2.chrome.border.width === 16);
ok("parent's other keys inherited", r2.chrome.border.radius === 0);

console.log("lists — later preset wins over earlier, node still wins over both");
const r3 = applyPreset({ preset: ["base", "loud"], chrome: { border: { radius: 12 } } }, bank, "t");
ok("later preset wins", r3.chrome.border.width === 16);
ok("node wins over both", r3.chrome.border.radius === 12);
ok("untouched key survives", r3.chrome.border.color === "#252525");

console.log("refusals");
throws("unknown name", () => applyPreset({ preset: "nope" }, bank, "t"), /no preset named "nope"/);
throws("unknown name lists the bank", () => applyPreset({ preset: "nope" }, bank, "t"), /The bank holds/);
throws("a preset may not write say", () => applyPreset({ preset: "speaks" }, bank, "t"), /may not\s+set|does not write it/);
throws("self-extending loop", () => applyPreset({ preset: "selfy" }, bank, "t"), /extends itself/);
throws("non-string name", () => applyPreset({ preset: [1] }, bank, "t"), /name or a list of names/);

console.log("depth — reel, beat and shot each resolve");
const r4 = resolvePresets({ preset: "base", beats: [
  { preset: "loud", say: "x" },
  { say: "y", shots: [{ preset: "push" }, { screen: {} }] },
]}, "t", bank);
ok("reel level", r4.chrome.border.width === 8);
ok("beat level", r4.beats[0].chrome.border.width === 16);
ok("shot level", r4.beats[1].shots[0].view.to.zoom === 1.3);
ok("sibling shot untouched", r4.beats[1].shots[1].view === undefined);
throws("error names the beat", () => resolvePresets({ beats: [{}, { preset: "nope" }] }, "post", bank), /post beat 2/);
throws("error names the shot", () => resolvePresets({ beats: [{ shots: [{ preset: "nope" }] }] }, "post", bank), /beat 1 shot 1/);

console.log("levels — a preset declares where it belongs and is refused elsewhere");
const lv = {
  reelonly: { _level: "reel", chrome: { border: { width: 12 } } },
  beatonly: { _level: ["beat", "shot"], border: { color: "#FFF" } },
  anywhere: { bg: "x.jpg" },
};
ok("right level applies", applyPreset({ preset: "reelonly" }, lv, "t", "reel").chrome.border.width === 12);
throws("reel preset on a beat", () => applyPreset({ preset: "reelonly" }, lv, "t", "beat"), /is a reel preset and this is a beat/);
throws("beat preset on the reel", () => applyPreset({ preset: "beatonly" }, lv, "t", "reel"), /beat\/shot preset/);
ok("beat preset on a shot", applyPreset({ preset: "beatonly" }, lv, "t", "shot").border.color === "#FFF");
ok("no _level means any level", applyPreset({ preset: "anywhere" }, lv, "t", "reel").bg === "x.jpg");

console.log("annotations — underscore keys describe the preset, never the spec");
const ann = { doc: { _measured: "somewhere", _why: "because", bg: "y.jpg" } };
const r5 = applyPreset({ preset: "doc" }, ann, "t", "beat");
ok("_measured stripped", r5._measured === undefined, r5);
ok("_why stripped", r5._why === undefined);
ok("real key survives", r5.bg === "y.jpg");

console.log("the shipped core bank loads and sits at its declared level");
const { presetBank } = await import("./presets.mjs");
const core = presetBank();
ok("hard-card is a reel preset", !!applyPreset({ preset: "hard-card" }, core, "t", "reel").chrome.border);
throws("hard-card refused on a beat", () => applyPreset({ preset: "hard-card" }, core, "t", "beat"), /reel preset/);
ok("photo-card is a beat preset", applyPreset({ preset: "photo-card" }, core, "t", "beat").border.color === "#FCFCFC");
throws("photo-card refused on the reel", () => applyPreset({ preset: "photo-card" }, core, "t", "reel"), /beat\/shot preset/);
ok("no annotation leaked from the core bank",
   applyPreset({ preset: "photo-card" }, core, "t", "beat")._measured === undefined);

console.log("the ground: DynamicBackground's pattern arithmetic");
const { FIELD_PRESETS, fieldLayers, resolveField } = await import("../src/lab/field.mjs");

// THE ONE THAT MATTERS. `dots` replaced a hardcoded DotField in Reel.tsx.
// This is the string that component emitted, pasted from the deleted code —
// if a refactor ever changes it, the ground silently moves under every post
// that ever asked for "dots".
{
  const [l] = fieldLayers(resolveField("dots"));
  ok("dots emits the deleted DotField's exact CSS",
     l.image === "radial-gradient(#373737 1.5px, transparent 1.5px)" && l.tile === 15,
     { image: l.image, tile: l.tile });
}

ok("a bare string resolves as a preset name",
   resolveField("blueprint").shape === "grid");
ok("a key beside the preset wins over it",
   resolveField({ preset: "blueprint", pitch: 99 }).pitch === 99);
ok("an unknown preset falls back to the defaults rather than throwing",
   resolveField("no-such-preset").shape === "dot");
ok("a spec with no preset still gets the defaults",
   resolveField({ color: "#FFF" }).pitch === 15);

// A major grid is four layers on two tiles; a minor-only grid is two on one.
// The count is the contract the drift code below depends on.
ok("grid with `major` paints major over minor",
   fieldLayers(resolveField("blueprint")).length === 4);
ok("grid without `major` paints two lines only",
   fieldLayers(resolveField({ shape: "grid", major: 1 })).length === 2);

// Every shape has to produce something paintable, or a preset silently
// renders an empty frame — the failure this repo keeps calling the
// placeholder that renders cleanly.
for (const [name, spec] of Object.entries(FIELD_PRESETS)) {
  const ls = fieldLayers(resolveField(spec));
  ok(`preset "${name}" paints at least one layer with a tile`,
     ls.length > 0 && ls.every((l) => l.image && l.tile > 0));
}

// A data URI carrying a raw `#` ends the document at the colour.
for (const shape of ["cross", "rings", "diagonal"]) {
  const [l] = fieldLayers(resolveField({ shape, color: "#ABCDEF" }));
  ok(`${shape} escapes # in its data URI`, l.image.includes("%23ABCDEF") && !l.image.includes("#"));
}


console.log("the footage box: geometry, presets-as-classes, tracks");
const { FOOTAGE_PRESETS, footageBox, parseRatio, resolveFootage, trackAt } =
  await import("../src/lab/footage.mjs");

ok("ratio parses \"16:9\"", Math.abs(parseRatio("16:9") - 16 / 9) < 1e-9);
ok("ratio passes a number through", parseRatio(2) === 2);
ok("no ratio is null, not 1", parseRatio(null) === null);
throws("a ratio with a zero side is refused", () => parseRatio("4:0"), /zero side/);
throws("a ratio that is not w:h is refused", () => parseRatio("wide"), /not a number/);

// THE CLASS CONTRACT, and the only reason presets exist here: a preset sets
// keys, a key written beside it wins. If this ever stops holding, every
// `{ preset, one-override }` in every post silently loses its override.
ok("a preset sets its keys", resolveFootage("circle").radius === "50%");
ok("a key beside the preset wins", resolveFootage({ preset: "circle", width: 0.4 }).width === 0.4);
ok("circle is square plus a radius, no code of its own",
   resolveFootage("circle").ratio === resolveFootage("square").ratio);
throws("an unknown preset names the ones that exist",
       () => resolveFootage({ preset: "nope" }), /no preset "nope"/);

// The bug this caught on a render: FOOTAGE_DEFAULTS carried `y: 0.5`, which
// is always defined, so `anchor` never got a say and half-top/middle/bottom
// all drew in the middle.
{
  const H = 1920, W = 1080;
  const top = footageBox(resolveFootage("half-top"), 0, W, H);
  const mid = footageBox(resolveFootage("half-middle"), 0, W, H);
  const bot = footageBox(resolveFootage("half-bottom"), 0, W, H);
  ok("half-top sits against the top", top.top === 0, top.top);
  ok("half-middle is centred", Math.abs(mid.top - H / 4) < 1, mid.top);
  ok("half-bottom sits against the bottom", Math.abs(bot.top + bot.height - H) < 1, bot.top);
  ok("the three halves are three different boxes",
     top.top !== mid.top && mid.top !== bot.top);
}

// THE DEFAULT IS THE WHOLE FRAME — no padding, no inset. A footage box that
// names nothing fills the canvas, and a ratio alone narrows it to a full-WIDTH
// band rather than a centred card.
{
  const bare = footageBox(resolveFootage({}), 0, 1080, 1920);
  ok("a footage box with no spec fills the canvas",
     bare.left === 0 && bare.top === 0 && bare.width === 1080 && bare.height === 1920,
     bare);
  const band = footageBox(resolveFootage({ ratio: "16:9" }), 0, 1080, 1920);
  ok("a ratio alone is a full-width band, not a centred card",
     band.left === 0 && band.width === 1080 && Math.abs(band.height - 1080 / (16 / 9)) < 1,
     band);
  ok("`full` is a name for the floor, not a set of overrides",
     footageBox(resolveFootage("full"), 0, 1080, 1920).width === bare.width);
}

// THE BOX MODEL. `width` + `x` cannot say "the same gutter on both sides"
// without recomputing two numbers by hand; a margin says it once.
{
  const { marginSides } = await import("../src/lab/footage.mjs");
  const W = 1080, H = 1920;
  const box = (spec) => footageBox(resolveFootage(spec), 0, W, H);

  ok("one number is four equal sides",
     JSON.stringify(marginSides(60)) === JSON.stringify({ top: 60, right: 60, bottom: 60, left: 60 }));
  ok("[v, h] splits vertical and horizontal",
     JSON.stringify(marginSides([10, 20])) === JSON.stringify({ top: 10, bottom: 10, left: 20, right: 20 }));
  ok("a side nobody names is auto", marginSides({ left: 40 }).right === "auto");

  const g = box({ margin: 84 });
  ok("a gutter is symmetric by construction, on both axes",
     g.left === 84 && Math.abs(g.left + g.width - (W - 84)) < 0.001 &&
     g.top === 84 && Math.abs(g.top + g.height - (H - 84)) < 0.001,
     g);

  const band = box({ margin: 84, ratio: "16:9" });
  ok("a ratio takes its height from the gutter'd width",
     band.width === W - 168 && Math.abs(band.height - (W - 168) / (16 / 9)) < 0.001);
  ok("and both autos centre it vertically",
     Math.abs(band.top - (H - band.height) / 2) < 0.001, band.top);

  const pinned = box({ margin: { left: 84, right: 84, bottom: 120 }, ratio: "16:9" });
  ok("one auto absorbs the remainder, pinning the named edge",
     Math.abs(pinned.top + pinned.height - (H - 120)) < 0.001, pinned.top);

  ok("margin decides the box, and x/y are not consulted",
     box({ margin: 84, x: 0.9, y: 0.1 }).left === 84);
  ok("no margin leaves the fraction path untouched",
     box({ width: 0.5 }).left === W * 0.25);
  ok("`padding` is a synonym", box({ padding: 84 }).left === box({ margin: 84 }).left);
}

// A radius given as a percentage is of the SHORT side, and can never exceed
// half of it — a "50%" on a wide box is a pill, not a broken corner.
{
  const b = footageBox(resolveFootage({ ratio: "2:1", width: 0.8, radius: "50%" }), 0, 1080, 1920);
  ok("a percentage radius resolves against the short side", Math.abs(b.radius - b.height / 2) < 1);
  const c = footageBox(resolveFootage({ ratio: "1:1", width: 0.5, radius: 9999 }), 0, 1080, 1920);
  ok("a radius is clamped to half the short side", c.radius === c.width / 2);
}

// Tracks. This is the thing REFERENCES.md lists as gap 3 and nothing in the
// engine could express: a value that CHANGES after the item has arrived.
{
  const t = [{ at: 0, to: 0 }, { at: 2, to: 10 }];
  ok("a track holds its first value before the first key", trackAt(t, -1) === 0);
  ok("a track holds its last value after the last key", trackAt(t, 99) === 10);
  ok("a track eases between keys, not linearly", Math.abs(trackAt(t, 1) - 5) < 1e-9);
  ok("a track at a quarter is not a quarter of the way", trackAt(t, 0.5) < 2.5);
  ok("a plain number is a valid track", trackAt(0.42, 5) === 0.42);
  ok("an empty track falls back rather than throwing", trackAt([], 1, 0.7) === 0.7);
}

// Every preset must produce a box that is on the canvas and has area — a
// preset that renders an invisible box is the placeholder that renders
// cleanly, again.
for (const name of Object.keys(FOOTAGE_PRESETS)) {
  const b = footageBox(resolveFootage(name), 0, 1080, 1920);
  ok(`preset "${name}" makes a box with area on the canvas`,
     b.width > 0 && b.height > 0 && b.left < 1080 && b.top < 1920 &&
     b.left + b.width > 0 && b.top + b.height > 0,
     { w: Math.round(b.width), h: Math.round(b.height) });
}


console.log("the subtitle style: a bank of looks, merged onto the theme");
const { SUBTITLE_PRESETS, bandTopPx, resolveSubtitles } =
  await import("../src/lab/subtitles.mjs");
const THEME = { fontSize: 48, fontWeight: 400, plate: true, maxWords: 3, maxChars: 20 };

// THE FLOOR. A project that never asks for a preset must get exactly what it
// themed — this is what lets the key ship without moving any existing reel.
ok("no spec returns the theme untouched",
   JSON.stringify(resolveSubtitles(undefined, THEME)) === JSON.stringify(THEME));
ok("`plain` is a name for the floor",
   resolveSubtitles("plain", THEME).fontSize === 48);

ok("a preset overrides the theme", resolveSubtitles("hormozi", THEME).fontSize === 96);
ok("a key beside the preset wins over it",
   resolveSubtitles({ preset: "hormozi", fontSize: 120 }, THEME).fontSize === 120);
ok("a preset that says nothing about a key leaves the theme's",
   resolveSubtitles("accent", THEME).fontSize === 48);
throws("an unknown preset names the ones that exist",
       () => resolveSubtitles({ preset: "nope" }, THEME), /no preset "nope"/);

// The two caption SYSTEMS the teardowns measured have to survive the trip.
ok("karaoke carries the measured dim of 0.42", resolveSubtitles("karaoke", THEME).dim === 0.42);
ok("karaoke lights word by word", resolveSubtitles("karaoke", THEME).mode === "words");
ok("accent carries a persisting gold and no dim",
   resolveSubtitles("accent", THEME).emphasisColor === "#FAE6A0" &&
   resolveSubtitles("accent", THEME).dim === undefined);

// `bandTop` is a pixel count historically and a fraction is what a preset can
// express — a preset cannot know the canvas.
ok("bandTop above 1 is pixels", bandTopPx({ bandTop: 1180 }, 1920) === 1180);
ok("bandTop at or below 1 is a fraction", bandTopPx({ bandTop: 0.44 }, 1920) === 845);
ok("no bandTop falls back to the historical 1180", bandTopPx({}, 1920) === 1180);

// Pagination is decided in Node before a frame exists, so every preset that
// changes the look must carry caps or inherit usable ones — a preset that
// restyled without repaginating would be a preset that lies.
for (const [name, p] of Object.entries(SUBTITLE_PRESETS)) {
  const r = resolveSubtitles(name, THEME);
  ok(`preset "${name}" resolves to usable caps`,
     r.maxWords > 0 && r.maxChars > 0 && r.fontSize > 0, { w: r.maxWords, c: r.maxChars });
}


console.log("the cutout: an edge, a width, and no source dimensions anywhere");
const { CUTOUT_PRESETS, cutoutBox, resolveCutout } =
  await import("../src/lab/cutout.mjs");

// The class contract again — same one, third module.
ok("a preset sets its keys", resolveCutout("aside").bottom === 0.12);
ok("a key beside the preset wins", resolveCutout({ preset: "aside", width: 0.9 }).width === 0.9);
throws("an unknown preset names the ones that exist",
       () => resolveCutout({ preset: "nope" }), /no preset "nope"/);

// THE POINT OF THE WHOLE DESIGN: the box has no height, so nothing had to
// measure the person. If a height ever appears here, the ffprobe this file
// deleted is back.
const bare = cutoutBox(resolveCutout({}), 0, 1080, 1920);
ok("no height in the box", !("height" in bare), bare);
ok("a bare cutout stands on the floor", bare.bottom === 0 && bare.top === null);
ok("a bare cutout is centred", Math.abs(bare.left + bare.width / 2 - 540) < 1e-9);

// `top` and `bottom` are exclusive: a box pinned to both edges is the one
// thing this geometry cannot draw without the height it refuses to know.
const t = cutoutBox(resolveCutout({ top: 0.1 }), 0, 1080, 1920);
ok("naming top drops the inherited bottom", t.bottom === null && t.top === 192, t);
ok("a preset's bottom survives its own resolve",
   Math.abs(cutoutBox(resolveCutout("aside"), 0, 1080, 1920).bottom - 0.12 * 1920) < 1e-9);

// A track is what lets the person arrive, and it is footage.mjs's track —
// one easing table in the engine, not two.
const moving = { width: 0.5, x: [{ at: 0, to: 0.15 }, { at: 2, to: 0.85 }] };
const at0 = cutoutBox(resolveCutout(moving), 0, 1080, 1920);
const at2 = cutoutBox(resolveCutout(moving), 2, 1080, 1920);
ok("a track holds its first value before the first key", Math.round(at0.left) === -108, at0.left);
ok("a track holds its last value after the last key",
   Math.round(cutoutBox(resolveCutout(moving), 9, 1080, 1920).left) === Math.round(at2.left));
ok("and it actually moves between them", at2.left > at0.left);

// Every preset must land something visible on a 1080x1920 canvas. A
// placement that puts the whole body off-frame renders a post that looks
// finished and shows nobody — this repo's oldest failure shape.
for (const name of Object.keys(CUTOUT_PRESETS)) {
  const b = cutoutBox(resolveCutout(name), 0, 1080, 1920);
  const visible = Math.min(b.left + b.width, 1080) - Math.max(b.left, 0);
  ok(`preset "${name}" keeps something on the canvas`,
     visible > b.width * 0.4 && b.width > 0, { visible: Math.round(visible), of: Math.round(b.width) });
}

console.log("the caption default: ONE object, and the keys that were dead");
const { CAPTION_DEFAULTS, CAPTION_FACE } = await import("../src/lab/subtitles.mjs");

// The whole point of moving it here. If these ever drift again, every themed
// project renders a caption nobody chose — which is what happened between
// 2026-09-09 and 2026-09-10, in scripts/bundle.mjs.
ok("the measured look is the default", CAPTION_DEFAULTS.fontSize === 66 && CAPTION_DEFAULTS.fontWeight === 700);
ok("no plate, mixed case, tight tracking",
   CAPTION_DEFAULTS.plate === false &&
   CAPTION_DEFAULTS.textTransform === "none" &&
   CAPTION_DEFAULTS.letterSpacing === "-0.01em");
ok("the caption face is not the monospace", !/mono/i.test(CAPTION_FACE));

// bundle.mjs merges `{...CAPTION_DEFAULTS, ...theme.captions}` and the
// resolver merges the theme under the preset under the spec. A project's own
// key must survive both, or the receipt fixture stops asserting anything.
const asTally = { ...CAPTION_DEFAULTS, fontSize: 48, fontWeight: 400, plate: true, saidWeight: 800 };
ok("a project's own keys win over the default",
   resolveSubtitles(undefined, asTally).fontWeight === 400 &&
   resolveSubtitles(undefined, asTally).saidWeight === 800);
ok("and a preset still wins over the project",
   resolveSubtitles("hormozi", asTally).fontWeight === 800);
ok("while a key beside the preset wins over both",
   resolveSubtitles({ preset: "hormozi", fontWeight: 500 }, asTally).fontWeight === 500);

// `dim` is not a cosmetic knob — its PRESENCE switches the band from
// word-arrival to dim-and-light, so a project has to be able to say "none".
ok("dim: null reaches the style, so a project can refuse it",
   resolveSubtitles(undefined, { ...CAPTION_DEFAULTS, dim: null }).dim === null);

// The two keys that were declared in the typedef and read by nothing.
// `stroke` is now drawn; `align` is gone. A key a post can write that does
// nothing is worse than an absent one.
ok("stroke survives resolution", resolveSubtitles({ stroke: 4 }, CAPTION_DEFAULTS).stroke === 4);
ok("strokeColor survives resolution",
   resolveSubtitles({ stroke: 4, strokeColor: "#000" }, CAPTION_DEFAULTS).strokeColor === "#000");

console.log("the separation, the inks and the fit");
const {
  CAPTION_INKS, INK_FLOORS, SAFE_DEFAULTS, SHADOW_PRESETS,
  chroma, contrast, deltaE, fitToBox, resolveBackground, resolveInk, resolveShadow,
} = await import("../src/lab/subtitles.mjs");

// `auto` has to reproduce, to the digit, the two string literals that were
// hardcoded in Reel.tsx — the parity fixture compares BYTES against Tally and
// a photo beat's caption is one of the frames it compares.
ok("auto over a flat page is the paper spread",
   resolveShadow(undefined, { paper: "#151412", overArt: false }) ===
   "0px 2px 18px #151412, 0px 0px 4px #151412");
ok("auto over pictures keeps both measured alphas",
   resolveShadow(undefined, { paper: "#151412", overArt: true }) ===
   "0px 2px 18px rgba(0,0,0,0.6), 0px 0px 4px rgba(0,0,0,0.5)");
ok("none is undefined, which is what CSS wants",
   resolveShadow("none", { paper: "#000", overArt: false }) === undefined &&
   resolveShadow(null, { paper: "#000", overArt: false }) === undefined);
ok("a spec is drawn as given",
   resolveShadow({ x: 2, y: 3, blur: 4, color: "#f00" }, { paper: "#000", overArt: false }) ===
   "2px 3px 4px #f00");
throws("an unknown shadow names the ones that exist",
       () => resolveShadow("velvet", { paper: "#000", overArt: false }), /no shadow "velvet"/);

// "WELL CONTRASTED" IS A MEASUREMENT, and the first version of this test
// measured the wrong thing. It asked for the accent's WCAG ratio against the
// stroke: #FAE6A0 scores 15.9:1 there and is still invisible beside a white
// fill, which is what Martin said when he saw it — "loin d'être la
// définition du contraste". Two more numbers say what WCAG cannot: chroma,
// so a washed-out tint fails, and OKLab distance from the FILL, so an accent
// that does not look different from the word it sits in fails.
//
// An ink whose emphasis IS its fill declares "no accent" and is exempt from
// the last two — `mono` and the measured `amber` both do.
for (const [name, set] of Object.entries(CAPTION_INKS)) {
  if (!set.fill) continue;
  ok(`ink "${name}" fill clears ${INK_FLOORS.fillContrast}:1 on its stroke`,
     contrast(set.fill, set.stroke) >= INK_FLOORS.fillContrast,
     +contrast(set.fill, set.stroke).toFixed(1));
  if (set.emphasis === set.fill) continue;
  const c = chroma(set.emphasis);
  const d = deltaE(set.emphasis, set.fill);
  ok(`ink "${name}" accent is legible, saturated and unlike its fill`,
     contrast(set.emphasis, set.stroke) >= INK_FLOORS.accentContrast &&
       c >= INK_FLOORS.accentChroma && d >= INK_FLOORS.accentDistance,
     { wcag: +contrast(set.emphasis, set.stroke).toFixed(1), chroma: +c.toFixed(3), dE: +d.toFixed(3) });
}

// The regression that matters: the pale gold this bank used to ship must now
// be refused, and a full-chroma yellow of the same hue must pass. If these
// two ever agree again, the floors have stopped measuring anything.
ok("the pale gold that read as fade fails the floors",
   chroma("#FAE6A0") < INK_FLOORS.accentChroma &&
     deltaE("#FAE6A0", "#FFFFFF") < INK_FLOORS.accentDistance,
   { chroma: +chroma("#FAE6A0").toFixed(3), dE: +deltaE("#FAE6A0", "#FFFFFF").toFixed(3) });
ok("and the vivid yellow that replaced it passes",
   chroma("#FFE800") >= INK_FLOORS.accentChroma &&
     deltaE("#FFE800", "#FFFFFF") >= INK_FLOORS.accentDistance,
   { chroma: +chroma("#FFE800").toFixed(3), dE: +deltaE("#FFE800", "#FFFFFF").toFixed(3) });

// The background axis: `plate` is the old word for it and must still mean
// exactly what it meant, or `.parity` stops rendering a Tally post like Tally.
ok("plate: true is the receipt plate, unchanged",
   (() => {
     const b = resolveBackground({ plate: true }, "#F7F6F1");
     return b.color === "#F7F6F1" && b.radius === 0 && b.py === 20 && b.px === 34;
   })());
ok("no plate and no background paints nothing",
   resolveBackground({}, "#F7F6F1") === null);
ok("a background beside a plate wins, radius and all",
   (() => {
     const b = resolveBackground({ plate: true, background: { color: "#FFF", radius: 22, padding: [16, 30] } }, "#000");
     return b.color === "#FFF" && b.radius === 22 && b.py === 16 && b.px === 30;
   })());
ok("one padding number means both axes",
   resolveBackground({ background: { padding: 12 } }, "#000").py === 12);
ok("chip is the only look in the bank with a radius",
   Object.entries(SUBTITLE_PRESETS).filter(([, v]) => v.background?.radius).map(([k]) => k).join() === "chip");

ok("paper names no colour — it is the floor", Object.keys(CAPTION_INKS.paper).length === 0);

// THE BUG THIS CAUGHT, and the reason the ink is expanded per layer: the
// theme default carries a gold `emphasisColor`, so an ink resolved once at
// the end could never beat it. The first version shipped that and the render
// drew the theme's gold for every ink, `inverse`'s dark red included.
ok("a preset's ink beats the theme's own colours",
   resolveSubtitles({ preset: "outline", ink: "inverse" }, CAPTION_DEFAULTS).emphasisColor === CAPTION_INKS.inverse.emphasis);
ok("and a colour written beside the ink beats the ink",
   resolveSubtitles({ preset: "outline", ink: "inverse", emphasisColor: "#FF0000" }, CAPTION_DEFAULTS)
     .emphasisColor === "#FF0000");
// And the second half of the same bug: an `emphasis` LIST beats
// `emphasisColor` wherever both exist, so a theme with levels — the probe
// project has three — beat every ink until naming an ink cleared the
// inherited list. A layer that wants levels too brings its own.
ok("naming an ink clears an inherited emphasis list",
   resolveSubtitles({ preset: "outline", ink: "signal" },
     { ...CAPTION_DEFAULTS, emphasis: [{ color: "#FAE6A0" }] }).emphasis === undefined);
ok("but a look that brings its own list keeps it",
   resolveSubtitles("beast", { ...CAPTION_DEFAULTS, emphasis: [{ color: "#FAE6A0" }] })
     .emphasis?.length === 2);
ok("an ink reaches all three roles",
   (() => {
     const r = resolveSubtitles({ ink: "amber" }, CAPTION_DEFAULTS);
     return r.color === "#F8C83A" && r.strokeColor === "#14100A" && r.emphasisColor === "#F8C83A";
   })());
throws("an unknown ink names the ones that exist", () => resolveInk("chartreuse"), /no ink "chartreuse"/);

// The fit. A cap counts characters; what leaves the frame is a width.
const mm = (t, size) => t.length * size * 0.55;
const BOX = { w: 1080 - 2 * SAFE_DEFAULTS.x, h: 620 };
ok("a short page is drawn at its named size",
   fitToBox(["SHORT", "LINE"], { fontSize: 96 }, BOX, mm).fontSize === 96);
const long = fitToBox("THE VIEWER HAS TO CARE ABOUT SOMETHING OR THEY LEAVE".split(" "),
                      { fontSize: 96 }, { w: BOX.w, h: 400 }, mm);
ok("a page too tall for the box comes down", long.shrunk && long.fontSize < 96, long);
ok("and it fits once it has", long.fits, long);
const scaled = fitToBox([{ text: "WORD", scale: 1.5 }, { text: "AND" }], { fontSize: 96 }, BOX, mm);
ok("an emphasised word is measured at its own scale", scaled.fontSize <= 96, scaled);
const hopeless = fitToBox(["UNINTERRUPTIBLEPOWERSUPPLYUNITS"], { fontSize: 96 }, BOX, mm);
ok("an unfittable page stops at the floor and SAYS so",
   hopeless.fits === false && hopeless.fontSize === Math.round(96 * 0.66), hopeless);
// The floor is what decides whether it gives up: the same word that cannot
// fit above 0.66 of its size fits below it, and a look that would rather be
// small than wrong says so.
const lowered = fitToBox(["UNINTERRUPTIBLEPOWERSUPPLYUNITS"], { fontSize: 96, floor: 0.4 }, BOX, mm);
ok("a lower floor lets the fit succeed where the default gave up",
   lowered.fits && lowered.fontSize < Math.round(96 * 0.66), lowered);

// The safe box replaced `left: 84, right: 84` written into the band.
ok("the safe inset is still 84", SAFE_DEFAULTS.x === 84);
ok("and it now has a floor too", SAFE_DEFAULTS.bottom > 0);

// MOTION. The channel is pure, so its arithmetic is asserted here rather
// than read off a frame — what a frame is for is judging whether the
// numbers were the right ones, which is a different question.
ok("an element with no motion carries no style at all",
   Object.keys(motionStyle(undefined, 10, {})).length === 0);
ok("an entrance opens on its from value",
   motionAt({ opacity: [0, 1], frames: 8 }, 0, {}).opacity === 0);
ok("and lands exactly on its to value",
   motionAt({ opacity: [0, 1], frames: 8 }, 8, {}).opacity === 1);
ok("then holds, rather than running off its end",
   motionAt({ opacity: [0, 1], frames: 8 }, 40, {}).opacity === 1);
ok("a bare number reads as from-rest",
   motionAt({ opacity: 0.5, frames: 4 }, 4, {}).opacity === 0.5);
ok("a property nobody animates is absent, not reset to rest",
   motionAt({ opacity: [0, 1], frames: 4 }, 4, {}).scale === undefined);
ok("an exit hangs off the end of the element's life",
   motionAt({ opacity: [1, 0], at: "exit", frames: 6 }, 54, { life: 60 }).opacity === 1);
ok("and has run by its last frame",
   motionAt({ opacity: [1, 0], at: "exit", frames: 6 }, 60, { life: 60 }).opacity === 0);
ok("an exit with no life to hang off holds its end state",
   motionAt({ opacity: [1, 0], at: "exit", frames: 6 }, 3, {}).opacity === 0);
// (`split`/`stagger` had an assertion here. Both were deleted from the
// channel on 2026-09-13: nothing passes an index, so nothing ever staggered.)

// Bounce is a NUMBER on the curve axis, not a preset of its own: the same
// spring overshoots or does not, depending only on its damping.
const springMax = (spring) => {
  let max = 0;
  for (let f = 0; f <= 20; f++) {
    max = Math.max(max, motionAt({ scale: [0, 1], frames: 20, ease: { spring } }, f, {}).scale);
  }
  return max;
};
ok("an underdamped spring overshoots", springMax({ stiffness: 200, damping: 6 }) > 1);
ok("a damped one never does", springMax({ stiffness: 100, damping: 40 }) <= 1);
ok("and either way it settles exactly on its to value",
   motionAt({ scale: [0, 1], frames: 20, ease: { spring: { stiffness: 200, damping: 6 } } }, 20, {}).scale === 1);

ok("transform composes translate, then rotate, then scale",
   motionStyle({ x: [0, 10], rotate: [0, 5], scale: [0, 1], frames: 1 }, 1, {}).transform ===
     "translate(10px, 0px) rotate(5deg) scale(1)");
ok("blur and brightness land in one filter",
   motionStyle({ blur: [8, 0], brightness: [0.4, 1], frames: 4 }, 0, {}).filter ===
     "blur(8px) brightness(0.4)");
ok("a settled blur is dropped rather than written as blur(0px)",
   motionStyle({ blur: [8, 0], frames: 4 }, 4, {}).filter === undefined);

// A COMBO is two properties on two clocks. Without per-property timing the
// only "zoom in + fade" expressible is two identical spans, which is the one
// version of it nobody uses.
const combo = {
  opacity: { to: 1, from: 0, frames: 6 },
  scale: { from: 0.9, to: 1, frames: 14, delay: 2 },
};
ok("a short fade finishes while a longer zoom is still running",
   motionAt(combo, 6, {}).opacity === 1 && motionAt(combo, 6, {}).scale < 1);
ok("and the zoom lands on its own last frame",
   Math.abs(motionAt(combo, 16, {}).scale - 1) < 1e-9);
ok("a delayed property has not started before its delay",
   motionAt({ scale: { from: 0.5, to: 1, frames: 10, delay: 5 } }, 5, {}).scale === 0.5);
ok("a property's own ease beats the spec's",
   motionAt({ x: { from: 0, to: 100, frames: 10, ease: "linear" }, frames: 10, ease: "out" }, 5, {}).x === 50);
ok("and a property with no timing of its own still takes the spec's",
   motionAt({ opacity: [0, 1], frames: 10, ease: "linear" }, 5, {}).opacity === 0.5);

// `lead` is black time, and it must move the animation too — a lead that
// only hid the element would show it mid-flight the frame it appears.
ok("during the lead the element is not drawn at all",
   motionStyle({ opacity: [0, 1], frames: 6, lead: 6 }, 3, {}).visibility === "hidden");
ok("the entrance starts when the lead ends, not before",
   motionAt({ opacity: [0, 1], frames: 6, lead: 6 }, 6, {}).opacity === 0);
ok("and it lands a full span after the lead",
   motionAt({ opacity: [0, 1], frames: 6, lead: 6 }, 12, {}).opacity === 1);

// motionEnd is what lets a specimen run one second past its effect instead
// of four: the sheet asks the engine when the effect is over.
ok("an effect's end is its lead plus its span",
   motionEnd({ opacity: [0, 1], frames: 6, lead: 6 }) === 12);
ok("a combo ends with its LAST property, not its first",
   motionEnd(combo) === 16);
ok("an exit does not count towards it — it ends when the element does",
   motionEnd({ opacity: [1, 0], at: "exit", frames: 8 }) === 0);
ok("a move inside the beat counts from its own second",
   motionEnd({ y: [0, -60], at: 1.2, frames: 12 }) === 48);

// The anchor a scale grows from. Declared since the first version and drawn
// by nothing until it was asserted — the same shape of defect as the caption
// `stroke`, which was typed for weeks and never reached a frame.
ok("a scale grows from the centre unless told otherwise",
   motionStyle({ scale: [0.5, 1], frames: 10 }, 5, {}).transformOrigin === "center");
ok("and from wherever the origin names",
   motionStyle({ scale: [0.5, 1], frames: 10, origin: "top left" }, 5, {}).transformOrigin === "top left");
ok("an origin on a translation still rides on the transform",
   motionStyle({ y: [40, 0], frames: 10, origin: "bottom" }, 5, {}).transformOrigin === "bottom");
ok("but a spec with no transform writes no origin at all",
   motionStyle({ opacity: [0, 1], frames: 10, origin: "top left" }, 5, {}).transformOrigin === undefined);

// An anchor has to mean the ELEMENT's corner, not the corner of whatever
// layer happens to carry the transform. Measured on frames first: `top` on a
// footage card dragged it toward the top of the screen instead of growing it
// from its own top edge.
const ANCHOR_BOX = { left: 200, top: 400, width: 600, height: 800 };
ok("centre is the box's middle, not the canvas's", originPx("center", ANCHOR_BOX) === "500px 800px");
ok("a corner is the box's corner", originPx("top left", ANCHOR_BOX) === "200px 400px");
ok("the opposite corner too", originPx("bottom right", ANCHOR_BOX) === "800px 1200px");
ok("one word names one axis and centres the other", originPx("top", ANCHOR_BOX) === "500px 400px");
ok("and the same sideways", originPx("right", ANCHOR_BOX) === "800px 800px");
ok("an unnamed origin is the centre", originPx(undefined, ANCHOR_BOX) === "500px 800px");

// TIMELINE. The resolver is pure, so the arithmetic is asserted here and the
// frames are kept for judging whether the numbers were the right ones.
// docs/TIMELINE.md holds the surface; this is the part that is settled
// whatever its two open questions are answered.
// The renderer's own rounding, moved here so the layout and the render cannot
// disagree by a frame. These are the values render-reel.mjs has always given.
ok("a second is thirty frames", msToFrames(1000, 30) === 30);
ok("and it rounds to nearest, not down", msToFrames(1040, 30) === 31);
ok("half a frame rounds up", msToFrames(1050, 30) === 32);

ok("seconds become frames", offsetFrames(0.2, 30) === 6);
ok("an f suffix is frames, untouched", offsetFrames("+4f", 30) === 4);
ok("a negative offset reads as one", offsetFrames("-0.3", 30) === -9);
ok("no offset is no frames", offsetFrames(undefined, 30) === 0);
throws("an offset that is neither is refused", () => offsetFrames("soon"), /not seconds or frames/);

ok("a bare number anchors absolutely", parseAnchor(1.5, 30).ref === null && parseAnchor(1.5, 30).frames === 45);
ok("a bare string anchors to a name", parseAnchor("s3.end").ref === "s3.end");
ok("a name plus an offset keeps both",
   (() => { const a = parseAnchor({ at: "s3.end", offset: "+4f" }, 30); return a.ref === "s3.end" && a.frames === 4; })());
ok("an absolute anchor folds its offset in", parseAnchor({ at: 2, offset: 0.5 }, 30).frames === 75);

const TL_NAMED = { "s3.start": 90, "s3.end": 150 };
ok("an absolute span lands where it says",
   layOut([{ id: "a", from: { at: 0 }, seconds: 1 }], TL_NAMED).a.start === 0);
ok("and takes the length it asked for",
   layOut([{ id: "a", from: { at: 0 }, seconds: 1 }], TL_NAMED).a.length === 30);
ok("a span between two sentence edges takes the gap",
   (() => { const r = layOut([{ id: "b", from: { at: "s3.start" }, to: { at: "s3.end" } }], TL_NAMED).b;
            return r.start === 90 && r.length === 60; })());
ok("an element anchored to ANOTHER moves with it, whatever the order in the list",
   layOut([{ id: "c", from: { at: "b.end" }, seconds: 1 },
           { id: "b", from: { at: "s3.start" }, to: { at: "s3.end" } }], TL_NAMED).c.start === 150);
ok("a span with no end runs to the end of the reel",
   layOut([{ id: "d", from: { at: "s3.start" } }], TL_NAMED, { end: 300 }).d.length === 210);
ok("and has no length at all when the reel's end is unknown",
   layOut([{ id: "d", from: { at: "s3.start" } }], TL_NAMED).d.length === null);

throws("two elements with one name are refused",
   () => layOut([{ id: "a", from: { at: 0 } }, { id: "a", from: { at: 1 } }], TL_NAMED),
   /both called "a"/);
throws("an anchor to a name that exists nowhere is refused, not ignored",
   () => layOut([{ id: "a", from: { at: "s9.end" } }], TL_NAMED),
   /names nothing/);
throws("an anchor to an element with no such edge says so",
   () => layOut([{ id: "open", from: { at: "s3.start" } },
                 { id: "after", from: { at: "open.end" } }], TL_NAMED),
   /no such edge/);
throws("a loop is refused BY NAME",
   () => layOut([{ id: "a", from: { at: "b.end" }, seconds: 1 },
                 { id: "b", from: { at: "a.end" }, seconds: 1 }], TL_NAMED),
   /loop/);
throws("a span that ends before it starts is refused by default",
   () => layOut([{ id: "x", from: { at: "s3.end" }, to: { at: "s3.start" } }], TL_NAMED),
   /ends before it starts/);
ok("and clamps to one frame when the caller asks for that instead",
   layOut([{ id: "x", from: { at: "s3.end" }, to: { at: "s3.start" } }], TL_NAMED,
          { onInverted: "clamp" }).x.length === 1);

// `span` says COINCIDENCE. It is the answer to the inversion question rather
// than a policy for failing at it: the case only ever arose from mixing a
// moving edge with a fixed one, so an element that means "as long as that"
// should be able to say exactly that.
ok("a span takes its target's whole length",
   (() => { const r = layOut([{ id: "cap", span: "s3" }], TL_NAMED).cap;
            return r.start === 90 && r.length === 60; })());
ok("and it FOLLOWS when the sentence is regenerated longer — no inversion possible",
   layOut([{ id: "cap", span: "s3" }], { "s3.start": 90, "s3.end": 210 }).cap.length === 120);
ok("a span can coincide with another element, not only a sentence",
   (() => { const r = layOut([{ id: "b", from: { at: "s3.start" }, to: { at: "s3.end" } },
                              { id: "c", span: "b" }], TL_NAMED).c;
            return r.start === 90 && r.length === 60; })());
throws("a span AND its own edges is refused as ambiguous",
   () => layOut([{ id: "cap", span: "s3", seconds: 2 }], TL_NAMED),
   /one or the other/);
throws("a span on something open-ended has no end to borrow",
   () => layOut([{ id: "open", from: { at: "s3.start" } }, { id: "x", span: "open" }], TL_NAMED),
   /no such edge/);

// The edges that exist before anything is placed. Sentence offsets are what
// `speak()` MEASURED on the assembled audio; word edges are deliberately not
// published, because a word's start is interpolated inside its sentence and
// would look exactly like a measurement while being an estimate.
const TL_BEATS = [
  { durationInFrames: 30, sentences: [{ om: 0, dm: 1000 }] },
  { durationInFrames: 60, sentences: [{ om: 0, dm: 900 }, { om: 1040, dm: 800 }] },
];
const TL_EDGES = edgesOf(TL_BEATS, { fps: 30 });
ok("the reel starts at zero and ends past its last beat",
   TL_EDGES["reel.start"] === 0 && TL_EDGES["reel.end"] === 90);
ok("a beat publishes both its edges",
   TL_EDGES["beat1.start"] === 0 && TL_EDGES["beat1.end"] === 30);
ok("the second beat starts where the first ended",
   TL_EDGES["beat2.start"] === 30);
ok("a cut is named for the beat it cuts into", TL_EDGES["cut2"] === 30);
ok("a sentence edge is its beat's start plus its own measured offset",
   TL_EDGES["s1.start"] === 0 && TL_EDGES["s1.end"] === 30);
ok("sentences are numbered ACROSS the reel, not inside a beat",
   TL_EDGES["s2.start"] === 30 && TL_EDGES["s3.start"] === 61);
ok("and a sentence carries its own measured length",
   TL_EDGES["s3.end"] === 85);
ok("no word edge is published — an estimate must not look like a measurement",
   Object.keys(TL_EDGES).every((k) => !/^w\d/.test(k)));
ok("the edges drop straight into the resolver",
   layOut([{ id: "cap", span: "s2" }], TL_EDGES).cap.length === 27);

// The shot tiler, which lived in render-reel.mjs with no test at all. Its
// three behaviours are worth pinning before the timeline places the same
// tiles: a named `seconds` is kept exactly, weights share what is left, and
// the ROUNDING goes into the last weighted shot rather than the last shot.
const TL_SHOTS = (shots, frames) => layShots(shots, frames, "probe", { fps: 30 });
ok("three plain shots split a beat in three",
   TL_SHOTS([{}, {}, {}], 90).map((s) => s.durationInFrames).join(",") === "30,30,30");
ok("and they run back to back from zero",
   TL_SHOTS([{}, {}, {}], 90).map((s) => s.startFrame).join(",") === "0,30,60");
ok("a shot that named its seconds keeps them to the frame",
   TL_SHOTS([{}, {}, { seconds: 1 }], 131)[2].durationInFrames === 30);
ok("and the rounding lands on the last WEIGHTED shot, not the last one",
   TL_SHOTS([{}, {}, { seconds: 1 }], 131).map((s) => s.durationInFrames).join(",") === "51,50,30");
ok("a weight takes its share of what the voice leaves",
   TL_SHOTS([{ weight: 3 }, { weight: 1 }], 80).map((s) => s.durationInFrames).join(",") === "60,20");
throws("shots that ask for more than the beat runs are refused",
   () => TL_SHOTS([{ seconds: 3 }], 60), /Shorten a shot/);
throws("and a shot nobody could see is refused too",
   () => TL_SHOTS([{ seconds: 1 }, {}, {}], 31), /picture nobody sees/);

// A whole reel through the resolver. The numbers below are the ones a real
// render produced for posts/_shots.json — three beats of 90, 90 and 60
// frames — and the shot placements were confirmed frame by frame on the
// output: 30/30/30, then 38/37/15 with the fixed shot LAST, which is the only
// arrangement where the absorber has to tell "last shot" from "last weighted".
const TL_REEL = layoutOfReel([
  { durationInFrames: 90, shots: [{}, {}, {}] },
  { durationInFrames: 90, shots: [{}, {}, { seconds: 0.5 }] },
  { durationInFrames: 60 },
], { fps: 30 });
ok("a beat lands at its own start and runs its own length",
   TL_REEL.beat1.start === 0 && TL_REEL.beat1.length === 90);
ok("the second beat follows the first", TL_REEL.beat2.start === 90);
ok("a beat with no shots places only itself", TL_REEL.beat3s1 === undefined);
ok("three plain shots tile the first beat in thirds",
   [TL_REEL.beat1s1, TL_REEL.beat1s2, TL_REEL.beat1s3].map((s) => s.start).join(",") === "0,30,60");
ok("and the shots of the SECOND beat are placed on the reel's clock, not the beat's",
   TL_REEL.beat2s1.start === 90);
ok("the absorber's frame comes off the last WEIGHTED shot, here too",
   [TL_REEL.beat2s1, TL_REEL.beat2s2, TL_REEL.beat2s3].map((s) => s.length).join(",") === "38,37,15");
ok("which matches the frames the renderer actually produced: 128 and 165",
   TL_REEL.beat2s2.start === 128 && TL_REEL.beat2s3.start === 165);
ok("and the last shot ends exactly where the beat does",
   TL_REEL.beat2s3.start + TL_REEL.beat2s3.length === TL_REEL.beat2.start + TL_REEL.beat2.length);

// One beat through the resolver, in the shape `layShots` returns — this is
// what lets the renderer stop having a placement path of its own without
// restructuring its beat loop. The numbers must be the tiler's, to the frame.
const TL_BEAT = layoutOfBeat([{}, {}, { seconds: 0.5 }], 90, "beat1", { fps: 30 });
ok("it returns one entry per shot, carrying the shot itself",
   TL_BEAT.length === 3 && TL_BEAT[2].shot.seconds === 0.5);
ok("beat-local frames, exactly as the tiler gave them",
   TL_BEAT.map((t) => `${t.startFrame}+${t.durationInFrames}`).join(" ") === "0+38 38+37 75+15");
ok("and it agrees with layShots shot for shot",
   JSON.stringify(TL_BEAT.map((t) => [t.startFrame, t.durationInFrames])) ===
   JSON.stringify(layShots([{}, {}, { seconds: 0.5 }], 90, "beat1", { fps: 30 })
     .map((t) => [t.startFrame, t.durationInFrames])));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
