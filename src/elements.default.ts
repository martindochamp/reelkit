import type React from "react";

/**
 * The project element registry — empty here, because core owns none.
 *
 * `reelkit-elements` is a bundler alias. Staging scans `<project>/elements/`
 * and writes `<project>/.reelkit/elements.tsx`, a map of every folder that
 * exports a component and a cue mapping; the alias points at it. A project
 * with no `elements/` folder gets this file, and the core bank is all it has.
 *
 * This is the folder core never overwrites. An update to reelkit cannot touch
 * it, because it lives in the project's own repository — which is the only
 * version of that promise a merge cannot break.
 */
export type LabEntry = {
  component: React.ComponentType<any>;
  /** Maps the beat's `[+]` cue frames onto the element's own cue props. */
  mapCues: (cues: number[], props: any) => object;
};

export const projectElements: Record<string, LabEntry> = {};
