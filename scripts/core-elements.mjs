// The core element names, read out of the registry itself.
//
// A node script cannot import ReelElements.tsx, so the obvious move is a
// hand-kept list beside it — and this codebase already has two of those
// (sfx-elements.mjs and tier-fit.mjs mirror constants they cannot import) and
// already knows the symptom: the copy drifts, and the drift shows up as a
// sound landing beside its animation instead of on it.
//
// Here the source is a flat object literal with one key per element, so the
// list can be READ rather than repeated. If the registry's shape ever stops
// being parseable this throws loudly instead of returning a stale list.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const kitDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const source = readFileSync(
  path.join(kitDir, "src", "ReelElements.tsx"),
  "utf8",
);

const block = source.match(/const CORE_REGISTRY[\s\S]*?\n\};/);
if (!block) {
  throw new Error(
    "could not find CORE_REGISTRY in src/ReelElements.tsx — the registry's " +
      "shape changed and scripts/core-elements.mjs must be taught the new one.",
  );
}

/** Element names in the core bank, in registry order. */
export const LAB_CORE_NAMES = [
  ...block[0].matchAll(/^\s{2}([a-z][a-z0-9]*):\s*\{/gm),
].map((m) => m[1]);

if (!LAB_CORE_NAMES.length) {
  throw new Error("CORE_REGISTRY parsed as empty — refusing to report no elements.");
}
