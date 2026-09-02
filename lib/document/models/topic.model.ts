/**
 * lib/document/models/topic.model.ts
 */

export interface Topic {
  name: string;
  weight: number; // 0..1 importance
  pageIndexes: number[];
}

export interface Keyword {
  term: string;
  frequency: number;
  weight: number; // 0..1, tf-idf-ish importance
}

export interface DefinitionEntry {
  term: string;
  definition: string;
  pageIndex: number;
}

export interface ExtractedConcept {
  name: string;
  kind: "concept" | "example" | "algorithm" | "objective" | "outcome" | "task" | "question" | "answer";
  text: string;
  pageIndex: number;
}
