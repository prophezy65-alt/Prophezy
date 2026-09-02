/**
 * lib/research/utils/arxiv-categories.ts
 *
 * Deterministic, Gemini-free classification of a paper into human-readable
 * domain labels. Two sources, both real, neither invented:
 *
 *   1. arXiv's own public category taxonomy (https://arxiv.org/category_taxonomy)
 *      — every paper already carries real category codes (e.g. "cs.CL",
 *      "cs.LG") in Paper.fieldsOfStudy. CATEGORY_TOPICS maps those codes to
 *      the friendly domain names product wants ("NLP", "Machine Learning").
 *   2. arXiv's taxonomy doesn't subdivide finely enough for a few labels the
 *      product spec explicitly wants (RAG, LLM Agents, Multimodal AI aren't
 *      categories at all) — FINE_GRAINED_TOPIC_PATTERNS derives those by
 *      matching the paper's OWN title/abstract text against a curated regex
 *      per label. This is still fully deterministic and grounded in the
 *      paper's real words — not a classifier, not Gemini, not a guess.
 *
 * deriveTopics() combines both and is called once, at sync time (see
 * scripts/sync-research-papers.ts), so `research_synced_papers.topics` is
 * plain stored data — Topic Explorer never recomputes this at query time.
 */

/** arXiv category code -> friendly domain label. Not exhaustive — extend as
 *  the sync's category coverage grows. A code with no entry here still
 *  makes it into `categories` (the raw arXiv codes), just not `topics`. */
export const CATEGORY_TOPICS: Record<string, string> = {
  "cs.AI": "AI",
  "cs.LG": "Machine Learning",
  "stat.ML": "Machine Learning",
  "cs.CL": "NLP",
  "cs.CV": "Computer Vision",
  "eess.IV": "Computer Vision",
  "cs.RO": "Robotics",
  "cs.NE": "Deep Learning",
  "cs.MA": "AI Agents",
  "cs.CR": "Cybersecurity",
  "cs.DC": "MLOps",
  "cs.DB": "Data Science",
  "cs.IR": "Data Science",
  "stat.AP": "Data Science",
  "eess.AS": "Speech",
  "eess.SP": "Speech",
  "q-bio.BM": "Bioinformatics",
  "q-bio.GN": "Bioinformatics",
  "q-bio.QM": "Bioinformatics",
  "q-bio.NC": "Bioinformatics",
  "quant-ph": "Quantum Computing",
  "physics.med-ph": "Medical AI",
};

/** Deep Learning is treated as a strict superset of Machine Learning for
 *  chip counts — a paper tagged Deep Learning also always gets Machine
 *  Learning, matching how the field actually nests, without needing a
 *  second category entry per code. */
const IMPLIED_TOPICS: Record<string, string[]> = {
  "Deep Learning": ["Machine Learning"],
  NLP: ["AI"],
  "Computer Vision": ["AI"],
  Robotics: ["AI"],
  "AI Agents": ["AI"],
};

/** [label, pattern] — pattern is tested against `${title} ${abstract}`,
 *  lowercased. Order matters only for readability; results are deduped. */
const FINE_GRAINED_TOPIC_PATTERNS: [string, RegExp][] = [
  ["RAG", /\bretrieval[- ]augmented generation\b|\brag\b|\bdense retrieval\b|\bretrieval[- ]augmented\b|\bknowledge[- ]grounded generation\b/],
  ["LLM Agents", /\bllm agents?\b|\bagentic\b|\bautonomous agents?\b|\btool[- ]using (?:llm|language model)/],
  ["Multimodal AI", /\bmultimodal\b|\bvision[- ]language\b|\btext[- ]to[- ]image\b|\bimage[- ]to[- ]text\b/],
  ["Generative AI", /\bgenerative (?:ai|model|adversarial)\b|\bdiffusion model\b|\bgan\b|\btext generation\b/],
  ["Reinforcement Learning", /\breinforcement learning\b|\bpolicy gradient\b|\bq[- ]learning\b|\bmarkov decision process\b/],
  ["LLMs", /\blarge language models?\b|\bllms?\b|\bfoundation models?\b/],
  ["Time Series", /\btime[- ]series\b|\bforecasting\b(?!.*weather)/],
];

/**
 * Derives the `topics` array for a paper from its real arXiv categories
 * plus a deterministic keyword match against its own title/abstract.
 * Never calls Gemini, never invents a label not traceable to one of the
 * two sources above.
 */
export function deriveTopics(categories: string[], title: string, abstract?: string): string[] {
  const topics = new Set<string>();

  for (const cat of categories) {
    const label = CATEGORY_TOPICS[cat];
    if (label) {
      topics.add(label);
      for (const implied of IMPLIED_TOPICS[label] ?? []) topics.add(implied);
    }
  }

  const haystack = `${title} ${abstract ?? ""}`.toLowerCase();
  for (const [label, pattern] of FINE_GRAINED_TOPIC_PATTERNS) {
    if (pattern.test(haystack)) {
      topics.add(label);
      for (const implied of IMPLIED_TOPICS[label] ?? []) topics.add(implied);
    }
  }

  return Array.from(topics).sort();
}

/** The full set of labels this module can ever produce — used to render a
 *  stable, complete topic-chip filter row in the UI (so chips with zero
 *  current results still show, rather than the row reshuffling every
 *  search). */
export const ALL_TOPIC_LABELS: string[] = Array.from(
  new Set([
    ...Object.values(CATEGORY_TOPICS),
    ...Object.values(IMPLIED_TOPICS).flat(),
    ...FINE_GRAINED_TOPIC_PATTERNS.map(([label]) => label),
  ])
).sort();
