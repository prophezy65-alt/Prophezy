"use client";

import { useEffect, useRef } from "react";
import { computeWorldScrollState } from "./scrollMath";

/**
 * Drives the navbar dot color, the progress rail's accent color, and the
 * rail index label directly via the DOM (CSS custom property + textContent)
 * on every animation frame. Deliberately avoids React state so scrolling
 * never triggers a re-render of the chrome — the 3D scene reads the same
 * section rects independently inside its own useFrame loop.
 */
export function useWorldScroll(
  sectionRefs: React.RefObject<Array<HTMLElement | null>>,
  railIdxRef: React.RefObject<HTMLSpanElement | null>
) {
  const frame = useRef<number | undefined>(undefined);

  useEffect(() => {
    function update() {
      const worldRects = sectionRefs.current.slice(1, 5).map((el) => el?.getBoundingClientRect() ?? null);
      const { activeIndex, activeColor } = computeWorldScrollState(worldRects, window.innerHeight);

      document.documentElement.style.setProperty("--wc", activeColor);
      if (railIdxRef.current) {
        railIdxRef.current.textContent = String(activeIndex >= 0 ? activeIndex + 1 : 0).padStart(2, "0");
      }

      frame.current = requestAnimationFrame(update);
    }

    frame.current = requestAnimationFrame(update);
    return () => {
      if (frame.current !== undefined) cancelAnimationFrame(frame.current);
    };
  }, [sectionRefs, railIdxRef]);
}
