import { useEffect, useRef, useState } from "react";
import { continueRender, delayRender, staticFile } from "remotion";
import faces from "../fonts/fonts.json";

// The caption faces in fonts/ are DECLARED once, as @font-face rules, and
// loaded on demand — a face costs nothing until a caption names it.
//
// The first version loaded all 26 faces up front in every render tab and held
// the render until they were in. On a 6-minute sheet one tab never finished
// inside Remotion's 28 s limit and the render died at frame 993. Declaring
// them is free; `useCaptionFace` waits only for the one face a band draws.
type Face = { family: string; file: string; weight: string; style: string };

if (typeof document !== "undefined" && !document.getElementById("reelkit-faces")) {
  const el = document.createElement("style");
  el.id = "reelkit-faces";
  el.textContent = (faces as Face[])
    .map(
      (f) =>
        `@font-face{font-family:"${f.family}";src:url("${staticFile(`fonts/${f.file}`)}") format("woff2");` +
        `font-weight:${f.weight};font-style:${f.style};font-display:block;}`,
    )
    .join("\n");
  document.head.appendChild(el);
}

/**
 * Hold the frame until the face a caption band draws in is loaded, then
 * render again so the fit measures with that face and not its fallback. A
 * canvas measures with whatever is loaded at that instant, which is why this
 * cannot be left to the browser's own swap. A face that is not in fonts/
 * (a system face, or a stack that names none) resolves at once.
 */
export const useCaptionFace = (font: string) => {
  const [ready, setReady] = useState(
    () => typeof document === "undefined" || document.fonts.check(font),
  );
  const handle = useRef<number | null>(null);
  if (!ready && handle.current === null) {
    handle.current = delayRender(`caption face: ${font}`, { timeoutInMilliseconds: 60000 });
  }
  useEffect(() => {
    if (ready) {
      if (handle.current !== null) {
        continueRender(handle.current);
        handle.current = null;
      }
      return;
    }
    let live = true;
    document.fonts
      .load(font)
      .catch((err) => console.error(`caption face ${font} did not load: ${err}`))
      .then(() => live && setReady(true));
    return () => {
      live = false;
    };
  }, [ready, font]);
  useEffect(
    () => () => {
      if (handle.current !== null) continueRender(handle.current);
    },
    [],
  );
  return ready;
};
