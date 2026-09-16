import React from "react";
import "./fonts";
import { Composition, Still } from "remotion";
import {
  ASCII_CLIP_FPS,
  AsciiClip,
  AsciiClipProps,
  asciiClipDuration,
} from "./AsciiClip";
import {
  COVER_HEIGHT,
  COVER_WIDTH,
  Cover,
  CoverProps,
} from "./Cover";
import { FlagSheet } from "./Flags";
import { Reel, REEL_FPS, ReelProps, reelDurationInFrames } from "./Reel";
import { LabFrame } from "./ReelElements";
import {
  CAROUSEL_HEIGHT,
  SLIDE_WIDTH,
  Slide,
  SlideProps,
  TIKTOK_HEIGHT,
} from "./Slides";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Still
        id="SlideTikTok"
        component={Slide}
        width={SLIDE_WIDTH}
        height={TIKTOK_HEIGHT}
        defaultProps={
          {
            slide: { type: "hook", text: "The hook goes here." },
            index: 0,
            count: 6,
            format: "tiktok",
          } satisfies SlideProps
        }
      />
      <Still
        id="SlideCarousel"
        component={Slide}
        width={SLIDE_WIDTH}
        height={CAROUSEL_HEIGHT}
        defaultProps={
          {
            slide: { type: "hook", text: "The hook goes here." },
            index: 0,
            count: 6,
            format: "carousel",
          } satisfies SlideProps
        }
      />
      {/* The grid still — a profile/search/Explore tile, not a feed frame.
          Everything readable lives in the crop intersection; see Cover.tsx. */}
      <Still
        id="Cover"
        component={Cover}
        width={COVER_WIDTH}
        height={COVER_HEIGHT}
        defaultProps={
          {
            cover: {
              kicker: "Kicker",
              value: "0 %",
              text: "The line the cover *carries*",
            },
          } satisfies CoverProps
        }
      />
      <Composition
        id="Reel"
        component={Reel}
        width={SLIDE_WIDTH}
        height={TIKTOK_HEIGHT}
        fps={REEL_FPS}
        durationInFrames={90}
        calculateMetadata={({ props }) => ({
          durationInFrames: reelDurationInFrames(props.beats),
        })}
        defaultProps={
          {
            beats: [
              {
                element: {
                  type: "title",
                  text: "The hook goes here.",
                },
                durationInFrames: 90,
                cueFrames: [],
              },
            ],
          } satisfies ReelProps
        }
      />
      {/* A lab element at an arbitrary frame — render-slides.mjs picks a
          late frame so the settled end state prints as a slide still. */}
      {/* Every drawn flag on one sheet — the only way to see that a
          hand-typed coordinate is wrong before it ships in a beat.
          `npm run flags` renders it. */}
      <Still
        id="FlagSheet"
        component={FlagSheet}
        width={1080}
        height={1920}
        defaultProps={{ theme: "dark" as const }}
      />
      <Composition
        id="ElementFrame"
        component={LabFrame}
        width={SLIDE_WIDTH}
        height={TIKTOK_HEIGHT}
        fps={REEL_FPS}
        durationInFrames={900}
        defaultProps={{ element: "calendar", props: {} }}
      />
      <Composition
        id="AsciiClip"
        component={AsciiClip}
        width={SLIDE_WIDTH}
        height={TIKTOK_HEIGHT}
        fps={ASCII_CLIP_FPS}
        durationInFrames={30}
        calculateMetadata={({ props }) => ({
          durationInFrames: asciiClipDuration(props),
        })}
        defaultProps={
          {
            frames: ["specimen"],
            clipFps: 12,
          } satisfies AsciiClipProps
        }
      />
    </>
  );
};
