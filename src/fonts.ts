import { continueRender, delayRender, staticFile } from "remotion";
import faces from "../fonts/fonts.json";

// Every face in fonts/ is registered before the first frame is drawn, so a
// caption look that names "Montserrat" or "TikTok Sans" gets that face on any
// machine rather than whatever the CSS stack falls through to. The fit in
// Reel.tsx measures text on a canvas, and a canvas measures with whatever is
// loaded at that moment — which is why this blocks the render instead of
// letting the face swap in a few frames late.
//
// A face that fails to load is reported and skipped rather than failing the
// render: its stack still falls back, exactly as it did before fonts shipped.
type Face = { family: string; file: string; weight: string; style: string };

if (typeof document !== "undefined" && typeof FontFace !== "undefined") {
  const handle = delayRender("Loading the caption faces in fonts/");
  Promise.all(
    (faces as Face[]).map((f) =>
      new FontFace(f.family, `url(${staticFile(`fonts/${f.file}`)}) format("woff2")`, {
        weight: f.weight,
        style: f.style,
      })
        .load()
        .then((loaded) => document.fonts.add(loaded))
        .catch((err) => console.error(`font ${f.file} did not load: ${err}`)),
    ),
  ).then(() => continueRender(handle));
}
