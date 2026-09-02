"use client";

import { useEffect, useRef, useState } from "react";

/**
 * components/research/hooks/useCountUp.ts
 *
 * Animates a number counting up from its previous value to `target` over
 * `durationMs` — used to make the stat cards feel alive when real data
 * loads in, instead of numbers just popping into place. Pure CSS
 * couldn't do this (animating a text node's numeric content isn't
 * something `transition` can express), so it's a small rAF loop.
 */
export function useCountUp(target: number, durationMs = 700): number {
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    startRef.current = null;

    let frame: number;
    function tick(now: number) {
      if (startRef.current === null) startRef.current = now;
      const elapsed = now - startRef.current;
      const progress = Math.min(1, elapsed / durationMs);
      // ease-out-cubic — quick start, gentle settle
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
      else fromRef.current = target;
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return value;
}
