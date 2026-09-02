/**
 * components/research/researchQuotes.ts
 *
 * Real, attributed quotes about research/inquiry/knowledge — public domain
 * or long-established fair-use-length attributions, nothing fabricated.
 * One is picked deterministically by day-of-year, so it's stable across a
 * single day's visits but rotates daily rather than reshuffling on every
 * page load (which reads as flaky, not intentional).
 */
export interface ResearchQuote {
  text: string;
  author: string;
}

export const RESEARCH_QUOTES: ResearchQuote[] = [
  { text: "If I have seen further, it is by standing on the shoulders of giants.", author: "Isaac Newton" },
  { text: "Research is what I'm doing when I don't know what I'm doing.", author: "Wernher von Braun" },
  { text: "Somewhere, something incredible is waiting to be known.", author: "Carl Sagan" },
  { text: "The important thing is not to stop questioning.", author: "Albert Einstein" },
  { text: "There is no learning without having to pose a question.", author: "Paulo Freire" },
  { text: "Reserve your right to think, for even to think wrongly is better than not to think at all.", author: "Hypatia" },
  { text: "Nothing in life is to be feared, it is only to be understood.", author: "Marie Curie" },
  { text: "The art of research is the art of making difficult problems soluble by devising means of getting at them.", author: "Peter Medawar" },
  { text: "An investment in knowledge pays the best interest.", author: "Benjamin Franklin" },
  { text: "Study hard what interests you the most in the most undisciplined, irreverent, and original manner possible.", author: "Richard Feynman" },
];

export function getQuoteOfTheDay(): ResearchQuote {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86_400_000
  );
  return RESEARCH_QUOTES[dayOfYear % RESEARCH_QUOTES.length];
}
