/**
 * lib/quiz/utils/randomizer.ts
 *
 * Seeded shuffling so "randomize question order" and "randomize option
 * order" can be made reproducible per-attempt (same seed = same order),
 * which matters for review mode showing the exact order the user saw.
 */

/** Mulberry32 — small, fast, seedable PRNG. Good enough for shuffling, not cryptography. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedFromString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

/** Fisher-Yates shuffle, seeded. Does not mutate the input array. */
export function seededShuffle<T>(items: T[], seed: number): T[] {
  const rng = mulberry32(seed);
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

/** Picks `count` random items from a pool without replacement, seeded. */
export function seededSample<T>(pool: T[], count: number, seed: number): T[] {
  return seededShuffle(pool, seed).slice(0, Math.min(count, pool.length));
}
