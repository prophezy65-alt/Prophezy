/**
 * lib/research/models/db.types.ts
 *
 * Convenience aliases over the generated `Database` type
 * (lib/supabase/types.ts) for the tables this module owns, plus the JSONB
 * shape of `research_knowledge_graphs.graph` (Database only types JSONB
 * columns as `Json`, so the node/edge shape is defined here instead).
 */
import type { Database } from "@/lib/supabase/types";

export type ResearchPaperRow = Database["public"]["Tables"]["research_papers"]["Row"];
export type ResearchPaperInsert = Database["public"]["Tables"]["research_papers"]["Insert"];
export type ResearchPaperUpdate = Database["public"]["Tables"]["research_papers"]["Update"];

export type ResearchCitationRow = Database["public"]["Tables"]["research_citations"]["Row"];
export type ResearchCitationInsert = Database["public"]["Tables"]["research_citations"]["Insert"];

export type ResearchKnowledgeGraphRowBase = Database["public"]["Tables"]["research_knowledge_graphs"]["Row"];

export interface KnowledgeGraphNode {
  id: string;
  label: string;
  type: "concept" | "author" | "paper" | "method" | "dataset" | "finding";
}

export interface KnowledgeGraphEdge {
  source: string;
  target: string;
  relation: string;
}

export interface KnowledgeGraphData {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
}

/** Same as the generated Row, but with `graph` narrowed from `Json` to its actual shape. */
export type ResearchKnowledgeGraphRow = Omit<ResearchKnowledgeGraphRowBase, "graph"> & { graph: KnowledgeGraphData };

export interface ResearchKnowledgeGraphInsert {
  user_id: string;
  topic: string;
  paper_ids: string[];
  graph: KnowledgeGraphData;
}
