import { WORLDS, DEFAULT_ACCENT } from "./constants";

export interface WorldScrollState {
  /** 0..1 opacity for each of the 4 world environments, in WORLDS order */
  opacities: number[];
  /** index into WORLDS of the currently active world, or -1 if none is active */
  activeIndex: number;
  /** hex color of the active world, or the default accent when none is active */
  activeColor: string;
}

/**
 * Given the bounding rects of the 4 world sections (research, projects,
 * placement, resume — in that order) and the current viewport height,
 * compute how "in focus" each world is and which one is currently active.
 *
 * A world is considered active once its section has crossed a threshold of
 * being centered in the viewport. This mirrors a simple triangular falloff
 * around the vertical center of the screen.
 */
export function computeWorldScrollState(
  rects: Array<DOMRect | null>,
  viewportHeight: number
): WorldScrollState {
  const opacities: number[] = [];
  let bestIndex = -1;
  let bestScore = -1;

  rects.forEach((rect, i) => {
    if (!rect) {
      opacities.push(0);
      return;
    }
    const center = rect.top + rect.height / 2;
    const distance = Math.abs(center - viewportHeight / 2);
    const score = 1 - Math.min(distance / (viewportHeight * 0.7), 1);
    opacities.push(Math.max(score, 0));
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  });

  const isActive = bestScore > 0.4 && bestIndex >= 0;

  return {
    opacities,
    activeIndex: isActive ? bestIndex : -1,
    activeColor: isActive ? WORLDS[bestIndex]!.color : DEFAULT_ACCENT,
  };
}
