"use client";

import { useEffect, useRef } from "react";

/**
 * The Hero's <HeroCanvas> uses position:fixed so it can stay pinned while
 * the 4 "worlds" scroll past it. Fixed positioning ignores its container's
 * bounds entirely, so without this it stays visible for the rest of the
 * page too. This hook fades a wrapper element's opacity to 0 once the
 * Hero's own scroll range (heroRef) has been scrolled past.
 */
export function useHeroCanvasFade(
  heroRef: React.RefObject<HTMLElement | null>,
  canvasWrapRef: React.RefObject<HTMLElement | null>
) {
  const frame = useRef<number | undefined>(undefined);

  useEffect(() => {
    const FADE_DISTANCE = 240; // px of scroll over which the canvas fades out

    function update() {
      const hero = heroRef.current;
      const wrap = canvasWrapRef.current;
      if (hero && wrap) {
        const bottom = hero.getBoundingClientRect().bottom;
        let opacity = 1;
        if (bottom <= 0) {
          opacity = 0;
        } else if (bottom < FADE_DISTANCE) {
          opacity = bottom / FADE_DISTANCE;
        }
        wrap.style.opacity = String(opacity);
      }
      frame.current = requestAnimationFrame(update);
    }

    frame.current = requestAnimationFrame(update);
    return () => {
      if (frame.current !== undefined) cancelAnimationFrame(frame.current);
    };
  }, [heroRef, canvasWrapRef]);
}
