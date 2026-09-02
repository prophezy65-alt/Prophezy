/**
 * lib/research/utils/topic-synonyms.ts
 *
 * A student typing "Retrieval Augmented Generation" into Topic Explorer
 * should not get papers back just because "generation" appears somewhere —
 * per the product spec's own worked example. Postgres full-text search
 * ranks a bag-of-words match; it doesn't know RAG papers also talk about
 * "dense retrieval" or "knowledge-grounded generation" without being told.
 *
 * This is that curated, deterministic "being told" — a small synonym map
 * used only to WIDEN the search's OR-terms (more real candidate rows to
 * rank), never to invent or override what ts_rank_cd actually scores. No
 * Gemini, no embeddings, no fuzzy ML matching — just a maintained list, the
 * same kind of thing a librarian's controlled vocabulary does.
 *
 * Lookup is case-insensitive and matches on the topic string OR any of its
 * synonyms (so entering "RAG" finds this entry the same as entering the
 * full phrase).
 */

interface TopicSynonymEntry {
  canonical: string;
  synonyms: string[];
}

const TOPIC_SYNONYMS: TopicSynonymEntry[] = [
  {
    canonical: "Retrieval Augmented Generation",
    synonyms: [
      "rag",
      "retrieval augmented generation",
      "retrieval-augmented generation",
      "dense retrieval",
      "knowledge grounded generation",
      "knowledge-grounded generation",
      "retrieval systems",
      "vector retrieval",
      "retrieval augmented",
    ],
  },
  {
    canonical: "Transformers",
    synonyms: ["transformer", "transformers", "self-attention", "attention mechanism", "attention is all you need"],
  },
  {
    canonical: "Computer Vision",
    synonyms: ["computer vision", "image recognition", "object detection", "image classification", "semantic segmentation"],
  },
  {
    canonical: "Medical Imaging",
    synonyms: ["medical imaging", "radiology", "mri", "ct scan", "medical image analysis", "clinical imaging"],
  },
  {
    canonical: "Reinforcement Learning",
    synonyms: ["reinforcement learning", "policy gradient", "q-learning", "markov decision process", "reward model"],
  },
  {
    canonical: "LLM Agents",
    synonyms: ["llm agents", "llm agent", "agentic", "autonomous agents", "tool-using llm", "tool use language model"],
  },
  {
    canonical: "Quantum Computing",
    synonyms: ["quantum computing", "quantum algorithm", "qubit", "quantum circuit", "quantum supremacy"],
  },
  {
    canonical: "Large Language Models",
    synonyms: ["llm", "llms", "large language model", "large language models", "foundation model", "foundation models"],
  },
  {
    canonical: "Generative AI",
    synonyms: ["generative ai", "generative model", "diffusion model", "gan", "generative adversarial network", "text-to-image"],
  },
  {
    canonical: "Multimodal AI",
    synonyms: ["multimodal", "vision-language", "vision language model", "text-to-image", "image-to-text"],
  },
  {
    canonical: "Natural Language Processing",
    synonyms: ["nlp", "natural language processing", "language model", "text classification", "named entity recognition"],
  },
  {
    canonical: "Speech",
    synonyms: ["speech recognition", "speech synthesis", "text-to-speech", "automatic speech recognition", "voice"],
  },
  {
    canonical: "Time Series",
    synonyms: ["time series", "time-series", "forecasting", "sequence modeling", "temporal prediction"],
  },
  {
    canonical: "Cybersecurity",
    synonyms: ["cybersecurity", "adversarial attack", "network security", "intrusion detection", "malware"],
  },
  {
    canonical: "Bioinformatics",
    synonyms: ["bioinformatics", "genomics", "protein structure", "computational biology", "drug discovery"],
  },
  {
    canonical: "Robotics",
    synonyms: ["robotics", "robot manipulation", "motion planning", "robot learning", "autonomous navigation"],
  },
];

/**
 * Expands a raw topic string into the full set of search terms to OR
 * together — the original phrase plus every synonym of any entry it
 * matches (by canonical name or by one of its own synonyms).
 */
export function expandTopicTerms(rawTopic: string): string[] {
  const normalized = rawTopic.trim().toLowerCase();
  const terms = new Set<string>([normalized]);

  for (const entry of TOPIC_SYNONYMS) {
    const matches =
      entry.canonical.toLowerCase() === normalized || entry.synonyms.some((s) => s === normalized);
    if (matches) {
      terms.add(entry.canonical.toLowerCase());
      for (const s of entry.synonyms) terms.add(s);
    }
  }

  return Array.from(terms);
}

export { TOPIC_SYNONYMS };
